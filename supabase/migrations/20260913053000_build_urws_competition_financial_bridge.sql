alter table public.urws_financial_commitments add column if not exists source_type text;
alter table public.urws_financial_commitments add column if not exists source_id uuid;
create unique index if not exists urws_financial_commitments_source_uidx on public.urws_financial_commitments(organization_id,source_type,source_id,commitment_type) where source_type is not null and source_id is not null;

create or replace function app.urws_recompute_commitment_recovery(p_commitment_id uuid)
returns void language plpgsql security definer set search_path=public,app as $$
declare v_recovered numeric:=0;v_amount numeric;v_refundable_until timestamptz;v_status text;
begin
 select amount,refundable_until into v_amount,v_refundable_until from public.urws_financial_commitments where id=p_commitment_id;
 if not found then return; end if;
 select coalesce(sum(amount),0) into v_recovered from public.urws_financial_recoveries where commitment_id=p_commitment_id and status='received';
 v_status:=case when v_recovered>=v_amount and v_amount>0 then 'recovered' when v_recovered>0 then 'partially_recovered' else 'committed' end;
 update public.urws_financial_commitments set recovered_amount=least(v_recovered,v_amount),status=v_status,recoverability=case when v_recovered>=v_amount and v_amount>0 then 'fully_recoverable' when v_recovered>0 then 'partially_recoverable' when v_refundable_until is not null and v_refundable_until<now() then 'non_recoverable' else recoverability end,updated_at=now() where id=p_commitment_id;
end $$;

create or replace function app.urws_sync_competition_entry_fee(p_fee_id uuid)
returns uuid language plpgsql security definer set search_path=public,app as $$
declare f public.competition_entry_fees%rowtype;c public.competitions%rowtype;v_amount numeric;v_id uuid;
begin
 select * into f from public.competition_entry_fees where id=p_fee_id;if not found then return null;end if;
 select * into c from public.competitions where id=f.competition_id;if not found or c.organization_id is null then return null;end if;
 v_amount:=coalesce(f.total_amount,f.quantity*f.unit_amount,0);
 insert into public.urws_financial_commitments(tenant_id,organization_id,subject_type,subject_id,commitment_type,counterparty_type,amount,currency,committed_at,recoverability,recovered_amount,status,evidence,source_type,source_id)
 values(c.tenant_id,c.organization_id,case when f.entry_id is null then 'competition' else 'competition_entry' end,coalesce(f.entry_id,f.competition_id),'competition_entry_fee','competition_host',v_amount,f.currency_code,f.created_at,'unknown',0,case when lower(f.status) in ('cancelled','void','waived') then 'cancelled' else 'committed' end,jsonb_build_object('competition_id',f.competition_id,'entry_id',f.entry_id,'fee_id',f.id,'fee_type',f.fee_type,'fee_status',f.status),'competition_entry_fee',f.id)
 on conflict (organization_id,source_type,source_id,commitment_type) where source_type is not null and source_id is not null do update set amount=excluded.amount,currency=excluded.currency,status=excluded.status,evidence=excluded.evidence,updated_at=now()
 returning id into v_id;
 return v_id;
end $$;

create or replace function app.urws_competition_fee_sync_trigger() returns trigger language plpgsql security definer set search_path=public,app as $$ begin perform app.urws_sync_competition_entry_fee(new.id); return new; end $$;
drop trigger if exists urws_competition_entry_fee_sync on public.competition_entry_fees;
create trigger urws_competition_entry_fee_sync after insert or update of total_amount,quantity,unit_amount,status,currency_code on public.competition_entry_fees for each row execute function app.urws_competition_fee_sync_trigger();

create or replace function app.urws_competition_scratch_event_trigger() returns trigger language plpgsql security definer set search_path=public,app as $$
declare c public.competitions%rowtype;
begin
 if lower(coalesce(new.status,'')) not in ('requested','approved') then return new; end if;
 if tg_op='UPDATE' and new.status is not distinct from old.status then return new; end if;
 select * into c from public.competitions where id=new.competition_id;
 if c.organization_id is null then return new; end if;
 if exists(select 1 from public.platform_event_outbox e where e.event_type='competition.entry.exception.requested' and e.payload->>'scratch_id'=new.id::text) then return new; end if;
 insert into public.platform_event_outbox(tenant_id,event_type,aggregate_type,aggregate_id,actor_person_id,payload)
 values(c.tenant_id,'competition.entry.exception.requested','competition_scratch',new.id,new.requested_by,jsonb_build_object('organization_id',c.organization_id,'competition_id',new.competition_id,'entry_id',new.competition_entry_id,'scratch_id',new.id,'athlete_id',new.athlete_id,'reason_code',new.reason_code,'status',new.status));
 return new;
end $$;
drop trigger if exists urws_competition_scratch_event on public.competition_scratches;
create trigger urws_competition_scratch_event after insert or update of status on public.competition_scratches for each row execute function app.urws_competition_scratch_event_trigger();

create or replace view public.v_urws_competition_financial_exposure as
select c.organization_id,c.id as competition_id,c.name as competition_name,count(fc.id) as commitment_count,coalesce(sum(fc.amount),0) as committed_amount,coalesce(sum(fc.recovered_amount),0) as recovered_amount,coalesce(sum(greatest(fc.amount-fc.recovered_amount,0)),0) as unrecovered_amount
from public.competitions c left join public.urws_financial_commitments fc on fc.source_type='competition_entry_fee' and (fc.evidence->>'competition_id')::uuid=c.id
group by c.organization_id,c.id,c.name;

grant select on public.v_urws_competition_financial_exposure to authenticated;
