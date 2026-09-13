create table if not exists public.urws_financial_dispositions (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid,
 organization_id uuid not null references public.organizations(id) on delete cascade,
 case_id uuid not null references public.urws_cases(id) on delete cascade,
 decision_id uuid references public.urws_decisions(id) on delete set null,
 remedy_id uuid references public.urws_remedies(id) on delete set null,
 disposition_type text not null check (disposition_type in ('refund','credit','fee_waiver','organization_absorbed','family_charge','transfer','write_off','payment_plan','service_credit','operational_correction','other')),
 amount numeric(12,2) check (amount is null or amount >= 0),
 currency char(3) not null default 'CAD',
 status text not null default 'authorized' check (status in ('authorized','executing','completed','failed','cancelled')),
 invoice_id uuid references public.invoices(id) on delete set null,
 payment_id uuid references public.payments(id) on delete set null,
 refund_id uuid references public.refunds(id) on delete set null,
 external_reference text,
 execution_note text,
 authorized_at timestamptz not null default now(),
 execution_started_at timestamptz,
 completed_at timestamptz,
 failed_at timestamptz,
 executed_by_person_id uuid,
 executed_by_auth_user_id uuid,
 executed_by_operator_id uuid references public.platform_superuser_operators(id) on delete set null,
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check (executed_by_person_id is not null or executed_by_auth_user_id is not null or executed_by_operator_id is not null or status='authorized')
);
create index if not exists urws_financial_dispositions_case_idx on public.urws_financial_dispositions(case_id,status,created_at desc);
create index if not exists urws_financial_dispositions_remedy_idx on public.urws_financial_dispositions(remedy_id) where remedy_id is not null;
create unique index if not exists urws_financial_dispositions_refund_uidx on public.urws_financial_dispositions(refund_id) where refund_id is not null;
alter table public.urws_financial_dispositions enable row level security;
do $$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='urws_financial_dispositions' and policyname='urws_financial_dispositions_superuser') then
  create policy urws_financial_dispositions_superuser on public.urws_financial_dispositions for all using (app.is_superuser()) with check (app.is_superuser());
 end if;
end $$;

create or replace function public.urws_begin_financial_execution(p_remedy_id uuid,p_invoice_id uuid default null,p_payment_id uuid default null,p_refund_id uuid default null,p_external_reference text default null,p_note text default null)
returns uuid language plpgsql security definer set search_path=public,app as $$
declare r public.urws_remedies%rowtype; c public.urws_cases%rowtype; v_person uuid; v_operator uuid; v_auth uuid; v_tenant uuid; v_id uuid;
begin
 select * into r from public.urws_remedies where id=p_remedy_id; if not found then raise exception 'URWS remedy not found'; end if;
 if r.status not in ('approved','executing') then raise exception 'Only approved remedies can enter execution'; end if;
 select * into c from public.urws_cases where id=r.case_id; if not found then raise exception 'URWS case not found'; end if;
 v_auth:=auth.uid(); v_person:=app.current_person_id();
 select id,person_id into v_operator,v_person from public.platform_superuser_operators where auth_user_id=v_auth and active=true limit 1;
 if v_person is null and v_operator is null then v_person:=app.current_person_id(); end if;
 if not app.urws_has_authority(v_person,c.organization_id,c.case_type_code,'execute_financial_remedy',coalesce(r.amount,0)) then raise exception 'URWS remedy execution authority denied' using errcode='42501'; end if;
 if r.remedy_type='refund' and p_refund_id is null then raise exception 'Refund execution requires a canonical refunds record'; end if;
 select tenant_id into v_tenant from public.organizations where id=c.organization_id;
 insert into public.urws_financial_dispositions(tenant_id,organization_id,case_id,decision_id,remedy_id,disposition_type,amount,currency,status,invoice_id,payment_id,refund_id,external_reference,execution_note,execution_started_at,executed_by_person_id,executed_by_auth_user_id,executed_by_operator_id,metadata)
 values(v_tenant,c.organization_id,c.id,r.decision_id,r.id,r.remedy_type,r.amount,r.currency,'executing',p_invoice_id,p_payment_id,p_refund_id,nullif(trim(coalesce(p_external_reference,'')),''),nullif(trim(coalesce(p_note,'')),''),now(),v_person,v_auth,v_operator,jsonb_build_object('source','urws_execution')) returning id into v_id;
 update public.urws_remedies set status='executing',updated_at=now(),resulting_refund_id=coalesce(p_refund_id,resulting_refund_id) where id=r.id;
 insert into public.platform_event_outbox(tenant_id,event_type,aggregate_type,aggregate_id,actor_person_id,payload)
 values(v_tenant,'urws.financial_execution.started','urws_financial_disposition',v_id,v_person,jsonb_build_object('organization_id',c.organization_id,'case_id',c.id,'remedy_id',r.id,'disposition_type',r.remedy_type,'amount',r.amount,'currency',r.currency,'refund_id',p_refund_id));
 return v_id;
end $$;

create or replace function public.urws_complete_financial_execution(p_disposition_id uuid,p_success boolean,p_external_reference text default null,p_note text default null)
returns void language plpgsql security definer set search_path=public,app as $$
declare d public.urws_financial_dispositions%rowtype; r public.urws_remedies%rowtype; c public.urws_cases%rowtype; rf public.refunds%rowtype; v_person uuid; v_operator uuid; v_auth uuid; v_tenant uuid;
begin
 select * into d from public.urws_financial_dispositions where id=p_disposition_id; if not found then raise exception 'Financial disposition not found'; end if;
 if d.status not in ('authorized','executing') then raise exception 'Financial disposition is not executable'; end if;
 select * into r from public.urws_remedies where id=d.remedy_id;
 select * into c from public.urws_cases where id=d.case_id;
 v_auth:=auth.uid(); v_person:=app.current_person_id();
 select id,person_id into v_operator,v_person from public.platform_superuser_operators where auth_user_id=v_auth and active=true limit 1;
 if v_person is null and v_operator is null then v_person:=app.current_person_id(); end if;
 if not app.urws_has_authority(v_person,c.organization_id,c.case_type_code,'execute_financial_remedy',coalesce(d.amount,0)) then raise exception 'URWS remedy execution authority denied' using errcode='42501'; end if;
 if p_success and d.disposition_type='refund' then
  select * into rf from public.refunds where id=d.refund_id; if not found then raise exception 'Canonical refund record not found'; end if;
  if coalesce(lower(rf.status),'') not in ('processed','completed','succeeded','refunded') or rf.processed_at is null then raise exception 'Refund cannot be marked executed until the canonical refund is processed'; end if;
 end if;
 update public.urws_financial_dispositions set status=case when p_success then 'completed' else 'failed' end,completed_at=case when p_success then now() else null end,failed_at=case when p_success then null else now() end,external_reference=coalesce(nullif(trim(coalesce(p_external_reference,'')),''),external_reference),execution_note=coalesce(nullif(trim(coalesce(p_note,'')),''),execution_note),executed_by_person_id=v_person,executed_by_auth_user_id=v_auth,executed_by_operator_id=v_operator,updated_at=now() where id=d.id;
 update public.urws_remedies set status=case when p_success then 'completed' else 'failed' end,completed_at=case when p_success then now() else null end,execution_reference=coalesce(nullif(trim(coalesce(p_external_reference,'')),''),execution_reference),updated_at=now() where id=r.id;
 select tenant_id into v_tenant from public.organizations where id=c.organization_id;
 insert into public.platform_event_outbox(tenant_id,event_type,aggregate_type,aggregate_id,actor_person_id,payload)
 values(v_tenant,case when p_success then 'urws.financial_execution.completed' else 'urws.financial_execution.failed' end,'urws_financial_disposition',d.id,v_person,jsonb_build_object('organization_id',c.organization_id,'case_id',c.id,'remedy_id',r.id,'disposition_type',d.disposition_type,'amount',d.amount,'currency',d.currency,'refund_id',d.refund_id));
end $$;

grant select on public.urws_financial_dispositions to authenticated;
grant execute on function public.urws_begin_financial_execution(uuid,uuid,uuid,uuid,text,text) to authenticated;
grant execute on function public.urws_complete_financial_execution(uuid,boolean,text,text) to authenticated;
