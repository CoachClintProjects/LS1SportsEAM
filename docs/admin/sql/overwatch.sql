-- Club-scoped live analytics. No platform-wide compliance counts leak into Admin.
create or replace function public.admin_overwatch(p_tenant uuid,p_org uuid,p_ledger uuid,p_from date,p_to date,p_export text default null)
returns jsonb language plpgsql stable security invoker set search_path=public as $$
declare personnel jsonb; integrity jsonb; ledger accounting_ledgers; report jsonb; journals_count integer; invalid_count integer; cfg jsonb; bank numeric; reserve numeric; entries jsonb;
begin
 if not exists(select 1 from organizations where id=p_org and tenant_id=p_tenant) then raise exception 'Club outside account';end if;
 if p_from is null or p_to is null or p_from>p_to then raise exception 'Choose valid report dates';end if;
 with staff as (
 select p.id,concat_ws(' ',coalesce(p.preferred_name,p.first_name),p.last_name) name,p.status,string_agg(distinct d.name,', ' order by d.name) roles
 from people p join role_assignments a on a.person_id=p.id join role_definitions d on d.id=a.role_definition_id
 where p.tenant_id=p_tenant and p.status='active' and a.tenant_id=p_tenant and a.organization_id=p_org and a.status='active' and d.is_active and (a.starts_at is null or a.starts_at<=now()) and (a.ends_at is null or a.ends_at>now()) and d.code not in ('ATHLETE','ATHLETE_ASSET','PARENT','PARENT_GUARDIAN','GUARDIAN') group by p.id
 ), evidence as (
 select s.*,
 exists(select 1 from safesport_records r join documents doc on doc.id=r.document_id join document_types dt on dt.id=doc.document_type_id where r.person_id=s.id and r.status='active' and r.completed_on<=current_date and r.expires_on>=current_date and r.verified_at is not null and doc.tenant_id=p_tenant and doc.owner_person_id=s.id and dt.code='SAFE_SPORT' and doc.verification_status='verified' and (doc.expires_at is null or doc.expires_at>now())) safe_clear,
 exists(select 1 from background_checks r join documents doc on doc.id=r.document_id join document_types dt on dt.id=doc.document_type_id where r.person_id=s.id and r.status='completed' and r.completed_at<=now() and r.expires_on>=current_date and lower(trim(r.result_classification)) in ('clear','passed') and doc.tenant_id=p_tenant and doc.owner_person_id=s.id and dt.code='BACKGROUND_CHECK' and doc.verification_status='verified' and (doc.expires_at is null or doc.expires_at>now())) background_clear,
 exists(select 1 from safesport_records r where r.person_id=s.id and r.status='active' and r.expires_on<current_date) expired_safesport,
 exists(select 1 from background_checks r where r.person_id=s.id and r.status in ('active','completed') and r.expires_on<current_date) expired_background
 from staff s)
 select jsonb_build_object('total',count(*),'clear',count(*) filter(where safe_clear and background_clear),'rate',round(100.0*count(*) filter(where safe_clear and background_clear)/nullif(count(*),0),2),'expired_safesport',count(*) filter(where expired_safesport and not safe_clear),'expired_background_checks',count(*) filter(where expired_background and not background_clear),'missing_or_unverified',count(*) filter(where not(safe_clear and background_clear)), 'rows',case when p_export='personnel' then coalesce(jsonb_agg(to_jsonb(e) order by name,id),'[]'::jsonb) else '[]'::jsonb end) into personnel from evidence e;
 with athletes_in_club as (
 select distinct a.id,a.person_id from athletes a join people p on p.id=a.person_id where p.tenant_id=p_tenant and p.status='active' and (exists(select 1 from registrations r where r.athlete_id=a.id and r.organization_id=p_org and r.status in ('active','approved','submitted')) or exists(select 1 from team_memberships m join teams t on t.id=m.team_id where m.athlete_id=a.id and m.status='active' and t.organization_id=p_org))
 ) select jsonb_build_object('athletes',count(*),'birth_unverified',case when exists(select 1 from document_types where code='BIRTH_CERTIFICATE') then count(*) filter(where not exists(select 1 from documents d join document_types dt on dt.id=d.document_type_id where d.owner_person_id=a.person_id and d.tenant_id=p_tenant and dt.code='BIRTH_CERTIFICATE' and d.verification_status='verified' and (d.expires_at is null or d.expires_at>now()))) else null end,'pending_governing_ids',count(*) filter(where exists(select 1 from memberships m where m.person_id=a.person_id and m.organization_id=p_org and upper(trim(m.membership_number))='PENDING') or exists(select 1 from external_ids x where x.tenant_id=p_tenant and ((x.entity_type='athlete' and x.entity_id=a.id) or (x.entity_type='person' and x.entity_id=a.person_id)) and upper(trim(x.external_id))='PENDING' and (x.valid_to is null or x.valid_to>=current_date)))) into integrity from athletes_in_club a;
 if p_ledger is not null then
  select l.* into ledger from accounting_ledgers l join legal_entities e on e.id=l.legal_entity_id where l.id=p_ledger and e.organization_id=p_org;
  if ledger.id is null then raise exception 'Ledger outside club';end if;
  select count(*),count(*) filter(where n<2 or debit<>credit or debit<=0) into journals_count,invalid_count from (select j.id,count(l.id) n,coalesce(sum(l.debit),0) debit,coalesce(sum(l.credit),0) credit from gl_journals j left join gl_lines l on l.journal_id=j.id where j.ledger_id=p_ledger and j.status='posted' and j.journal_date<=p_to group by j.id) totals;
  if invalid_count=0 then
   report:=admin_ledger_report(p_tenant,p_org,p_ledger,p_from,p_to);
   select config_value into cfg from system_configurations where tenant_id=p_tenant and config_namespace='admin.overwatch' and config_key=p_ledger::text and active order by version desc limit 1;
   if cfg is not null then
    select coalesce(sum(l.debit-l.credit) filter(where l.account_id=(cfg->>'bank_account')::uuid),0),coalesce(sum(l.debit-l.credit) filter(where l.account_id=(cfg->>'reserve_account')::uuid),0) into bank,reserve from gl_lines l join gl_journals j on j.id=l.journal_id where j.ledger_id=p_ledger and j.status='posted' and j.journal_date<=p_to;
   end if;
   if p_export='finance' then
    select coalesce(jsonb_agg(to_jsonb(x) order by journal_date,journal_number,id),'[]'::jsonb) into entries from (select l.id,j.journal_date,j.journal_number,j.description,a.account_code,a.account_name,a.account_type,l.debit::text,l.credit::text,l.currency,j.reversal_of from gl_lines l join gl_journals j on j.id=l.journal_id join chart_of_accounts a on a.id=l.account_id where j.ledger_id=p_ledger and j.status='posted' and j.journal_date between p_from and p_to) x;
   end if;
  end if;
 end if;
 return jsonb_build_object('generatedAt',now(),'personnel',personnel,'integrity',integrity,'report',report,'postedJournals',journals_count,'invalidJournals',invalid_count,'cash',bank::text,'reserve',reserve::text,'liquiditySetup',cfg,'entries',entries);
end $$;
revoke all on function public.admin_overwatch(uuid,uuid,uuid,date,date,text) from public,anon,authenticated;
grant execute on function public.admin_overwatch(uuid,uuid,uuid,date,date,text) to service_role;

create or replace function public.admin_overwatch_settings(p_tenant uuid,p_org uuid,p_actor uuid,p_ledger uuid,p_bank uuid,p_reserve uuid)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare entity uuid; version_no integer;
begin
 select l.legal_entity_id into entity from accounting_ledgers l join legal_entities e on e.id=l.legal_entity_id where l.id=p_ledger and e.organization_id=p_org and exists(select 1 from organizations where id=p_org and tenant_id=p_tenant);
 if entity is null or p_actor is null or p_bank is null or p_reserve is null or p_bank=p_reserve or (select count(*) from chart_of_accounts where id in(p_bank,p_reserve) and legal_entity_id=entity and active and lower(account_type)='asset')<>2 then raise exception 'Choose separate active bank and reserve asset accounts in the selected club ledger';end if;
 perform pg_advisory_xact_lock(hashtextextended('overwatch-settings:'||p_ledger,0));
 select coalesce(max(version),0)+1 into version_no from system_configurations where tenant_id=p_tenant and config_namespace='admin.overwatch' and config_key=p_ledger::text;
 update system_configurations set active=false where tenant_id=p_tenant and config_namespace='admin.overwatch' and config_key=p_ledger::text and active;
 insert into system_configurations(tenant_id,config_namespace,config_key,config_value,version,updated_by) values(p_tenant,'admin.overwatch',p_ledger::text,jsonb_build_object('bank_account',p_bank,'reserve_account',p_reserve),version_no,p_actor);
 insert into audit_events(tenant_id,actor_user_id,action,entity_type,entity_id,after_data,reason) values(p_tenant,p_actor,'overwatch.accounts','accounting_ledger',p_ledger,jsonb_build_object('bank_account',p_bank,'reserve_account',p_reserve),'Bank and reserve reporting accounts selected');
 return jsonb_build_object('saved',true);
end $$;
revoke all on function public.admin_overwatch_settings(uuid,uuid,uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.admin_overwatch_settings(uuid,uuid,uuid,uuid,uuid,uuid) to service_role;

create or replace function public.admin_bill_signoff_state(p_tenant uuid,p_org uuid,p_id uuid)
returns jsonb language plpgsql volatile security invoker set search_path=public as $$
declare b vendor_bills; policy payable_authority_policies; fingerprint text; signed boolean;
begin
 select v.* into b from vendor_bills v join legal_entities e on e.id=v.legal_entity_id join organizations o on o.id=e.organization_id where v.id=p_id and o.id=p_org and o.tenant_id=p_tenant;
 if b.id is null then raise exception 'Bill outside club';end if;
 select * into policy from payable_authority_policies where legal_entity_id=b.legal_entity_id;
 fingerprint:=md5(jsonb_build_object('id',b.id,'vendor',b.vendor_id,'entity',b.legal_entity_id,'total',b.total,'tax',b.tax_total,'currency',b.currency,'number',b.bill_number,'date',b.bill_date,'due',b.due_date,'lines',(select jsonb_agg(jsonb_build_object('description',l.description,'quantity',l.quantity,'unit_price',l.unit_price,'line_total',l.line_total) order by l.line_no) from vendor_bill_lines l where l.vendor_bill_id=b.id))::text);
 select exists(select 1 from audit_events a where a.tenant_id=p_tenant and a.entity_type='vendor_bill' and a.entity_id=b.id and a.action='payable.president_signed' and a.after_data->>'fingerprint'=fingerprint and a.after_data->>'policy_version'=coalesce(policy.version,0)::text and a.occurred_at>=coalesce((select max(occurred_at) from audit_events where tenant_id=p_tenant and entity_id=b.id and action in ('vendor_bill.return','vendor_bill.edit')), '-infinity'::timestamptz)) into signed;
 return jsonb_build_object('required',policy.legal_entity_id is null or b.total>=policy.executive_threshold or b.approval_required_role='org_admin','signed',signed,'fingerprint',fingerprint,'threshold',policy.executive_threshold::text,'policy_version',coalesce(policy.version,0));
end $$;
revoke all on function public.admin_bill_signoff_state(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.admin_bill_signoff_state(uuid,uuid,uuid) to service_role;

create or replace function public.admin_president_sign_bill(p_tenant uuid,p_org uuid,p_actor_user uuid,p_actor_person uuid,p_id uuid,p_version integer,p_signature text,p_reason text)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare b vendor_bills; state jsonb; expected_name text; saved jsonb;
begin
 select concat_ws(' ',first_name,last_name) into expected_name from people where id=p_actor_person and tenant_id=p_tenant and status='active';
 if p_actor_user is null or expected_name is null or lower(trim(p_signature)) is distinct from lower(trim(expected_name)) or length(trim(coalesce(p_reason,'')))<5 then raise exception 'Type your full account name and enter the approval reason';end if;
 if not exists(select 1 from role_assignments a join role_definitions d on d.id=a.role_definition_id where a.person_id=p_actor_person and a.tenant_id=p_tenant and a.organization_id=p_org and a.status='active' and d.code='ORGANIZATION_ADMIN' and d.is_active and (a.starts_at is null or a.starts_at<=now()) and (a.ends_at is null or a.ends_at>now())) then raise exception 'Active Club President authority required';end if;
 select v.* into b from vendor_bills v join legal_entities e on e.id=v.legal_entity_id where v.id=p_id and e.organization_id=p_org;
 if b.id is null then raise exception 'Bill outside club';end if;
 perform pg_advisory_xact_lock(hashtextextended('ledger-entity:'||b.legal_entity_id,0));
 perform pg_advisory_xact_lock(hashtextextended('vendor-bill:'||b.id,0));
 perform pg_advisory_xact_lock(hashtextextended('payable-policy:'||b.legal_entity_id,0));
 select * into b from vendor_bills where id=p_id for update;
 if b.version is distinct from p_version or b.status not in ('submitted','approved','partially_paid') then raise exception 'Bill changed. Reload before signing.';end if;
 state:=admin_bill_signoff_state(p_tenant,p_org,p_id);
 insert into audit_events(tenant_id,actor_user_id,actor_person_id,action,entity_type,entity_id,after_data,reason) values(p_tenant,p_actor_user,p_actor_person,'payable.president_signed','vendor_bill',p_id,state||jsonb_build_object('signature',trim(p_signature),'bill_version',p_version,'statement','I approve this bill for release'),trim(p_reason));
 if b.status='submitted' then saved:=admin_vendor_bill_write(p_tenant,p_org,p_actor_user,p_actor_person,'org_admin',p_id,'approve',p_version,'{}',p_reason);
 else update vendor_bills set approved_by=p_actor_user,approved_at=now(),version=version+1 where id=p_id returning to_jsonb(vendor_bills.*) into saved;end if;
 return saved;
end $$;
revoke all on function public.admin_president_sign_bill(uuid,uuid,uuid,uuid,uuid,integer,text,text) from public,anon,authenticated;
grant execute on function public.admin_president_sign_bill(uuid,uuid,uuid,uuid,uuid,integer,text,text) to service_role;

create or replace function public.admin_payment_signoff_guard() returns trigger language plpgsql security invoker set search_path=public as $$
declare state jsonb; org uuid; tenant uuid; entity uuid;
begin
 select e.organization_id,o.tenant_id,e.id into org,tenant,entity from vendor_bills b join legal_entities e on e.id=b.legal_entity_id join organizations o on o.id=e.organization_id where b.id=new.vendor_bill_id;
 perform pg_advisory_xact_lock(hashtextextended('payable-policy:'||entity,0));
 state:=admin_bill_signoff_state(tenant,org,new.vendor_bill_id);
 if (state->>'required')::boolean and not (state->>'signed')::boolean then raise exception '[ HOLD - PENDING PRESIDENT SIGN-OFF ]';end if;
 return new;
end $$;
revoke all on function public.admin_payment_signoff_guard() from public,anon,authenticated;
create trigger admin_payment_signoff_guard before insert on public.ap_payments for each row execute function public.admin_payment_signoff_guard();

create or replace function public.admin_bill_signoff_states(p_tenant uuid,p_org uuid,p_ids uuid[])
returns jsonb language sql volatile security invoker set search_path=public as $$
 select coalesce(jsonb_object_agg(b.id,admin_bill_signoff_state(p_tenant,p_org,b.id)),'{}'::jsonb) from vendor_bills b join legal_entities e on e.id=b.legal_entity_id join organizations o on o.id=e.organization_id where b.id=any(p_ids) and e.organization_id=p_org and o.tenant_id=p_tenant;
$$;
revoke all on function public.admin_bill_signoff_states(uuid,uuid,uuid[]) from public,anon,authenticated;
grant execute on function public.admin_bill_signoff_states(uuid,uuid,uuid[]) to service_role;
