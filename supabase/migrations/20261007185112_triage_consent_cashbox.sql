-- Explicit, opt-in consent authority and real competition cash-box authorizations.
create table public.triage_consent_policies (
 waiver_id uuid primary key references public.waivers(id),organization_id uuid not null references public.organizations(id),tenant_id uuid not null references public.tenants(id),
 enabled boolean not null default false,team_manager_allowed boolean not null default false,policy_reference text not null,version integer not null default 1,updated_by uuid not null references public.people(id),updated_at timestamptz not null default now()
);
create table public.competition_cashbox_vouchers (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),organization_id uuid not null references public.organizations(id),competition_id uuid not null references public.competitions(id),legal_entity_id uuid not null references public.legal_entities(id),
 total numeric(14,2) not null check(total>0),currency text not null,allocations jsonb not null,status text not null default 'authorized' check(status in ('authorized','prepared','cancelled')),
 authorized_by uuid not null references public.people(id),authorized_at timestamptz not null default now(),authorization_reason text not null,prepared_by uuid references public.people(id),prepared_at timestamptz,preparation_reason text,revision integer not null default 1
);
create unique index competition_cashbox_active on public.competition_cashbox_vouchers(competition_id,legal_entity_id) where status<>'cancelled';
alter table public.triage_consent_policies enable row level security;
alter table public.competition_cashbox_vouchers enable row level security;
revoke all on public.triage_consent_policies,public.competition_cashbox_vouchers from public,anon,authenticated;
grant all on public.triage_consent_policies,public.competition_cashbox_vouchers to service_role;
create policy triage_consent_service on public.triage_consent_policies for all to service_role using(true) with check(true);
create policy triage_cashbox_service on public.competition_cashbox_vouchers for all to service_role using(true) with check(true);

create function public.admin_triage_authority_action(p_task uuid,p_revision integer,p_tenant uuid,p_orgs uuid[],p_role text,p_team uuid,p_actor_user uuid,p_actor_person uuid,p_action text,p_values jsonb,p_reason text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare t public.operational_tasks%rowtype; w public.waiver_assignments%rowtype; policy public.triage_consent_policies%rowtype; cash public.competition_cashbox_vouchers%rowtype; comp public.competitions%rowtype; entity public.legal_entities%rowtype; official public.competition_official_assignments%rowtype; line jsonb; lines jsonb:='[]'::jsonb; seen uuid[]:=array[]::uuid[]; amount numeric; total numeric:=0; person uuid; doc uuid; task_id uuid; prior jsonb; saved jsonb; corr uuid:=gen_random_uuid(); message text; official_name text;
begin
 if p_actor_user is null or p_actor_person is null or not exists(select 1 from public.people where id=p_actor_person and tenant_id=p_tenant) then raise exception 'Authenticated club person required';end if;
 if length(trim(coalesce(p_reason,'')))<10 or length(p_reason)>4000 then raise exception 'Record a reason between 10 and 4000 characters';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_tenant::text||':triage',0));
 if p_action='authorize_cashbox' then
  if p_role not in ('org_admin','competition_manager') then raise exception 'Competition Manager or Organization Admin authorization required';end if;
  select * into comp from public.competitions where id=(p_values->>'competition_id')::uuid and tenant_id=p_tenant and organization_id=any(p_orgs) for share;
  if comp.id is null or comp.status in ('cancelled','completed') then raise exception 'Select a current club competition';end if;
  select * into entity from public.legal_entities where id=(p_values->>'legal_entity_id')::uuid and organization_id=comp.organization_id;
  if entity.id is null then raise exception 'Select the competition club’s legal entity';end if;
  if jsonb_typeof(p_values->'allocations') is distinct from 'array' or jsonb_array_length(p_values->'allocations') not between 1 and 250 then raise exception 'Enter at least one authorized official payout';end if;
  for line in select value from jsonb_array_elements(p_values->'allocations') loop
   select * into official from public.competition_official_assignments where id=(line->>'assignment_id')::uuid and competition_id=comp.id and person_id is not null and status not in ('cancelled','declined') for share;
   if official.id is null or official.id=any(seen) then raise exception 'Select distinct current official assignments';end if;
   amount:=(line->>'amount')::numeric;
   if amount is null or amount<=0 or amount>99999999 or amount<>round(amount,2) then raise exception 'Payouts must be positive amounts with at most two decimal places';end if;
   seen:=array_append(seen,official.id);total:=total+amount;
   select first_name||' '||last_name into official_name from public.people where id=official.person_id;
   lines:=lines||jsonb_build_array(jsonb_build_object('assignment_id',official.id,'person_id',official.person_id,'official',official_name,'role',official.role_code,'amount',amount));
  end loop;
  if exists(select 1 from public.competition_cashbox_vouchers where competition_id=comp.id and legal_entity_id=entity.id and status<>'cancelled') then raise exception 'This competition already has an active cash-box authorization';end if;
  insert into public.competition_cashbox_vouchers(tenant_id,organization_id,competition_id,legal_entity_id,total,currency,allocations,authorized_by,authorization_reason)
  values(p_tenant,comp.organization_id,comp.id,entity.id,total,trim(entity.base_currency),lines,p_actor_person,p_reason) returning * into cash;
  insert into public.operational_tasks(tenant_id,organization_id,assigned_role,title,description,priority,status,metadata,due_at)
  values(p_tenant,comp.organization_id,'treasurer','Prepare cash box: '||comp.name,'Authorized official payouts total '||total||' '||cash.currency||'. Count and record the physical cash prepared.','normal','open',jsonb_build_object('kind','cashbox','entity_type','competition_cashbox_vouchers','entity_id',cash.id,'exception_code','CASH_BOX_VOUCHER','recommended_action','Review each authorized official payout and attest to the physical cash prepared.','evidence',jsonb_build_object('amount',total,'currency',cash.currency,'allocations',lines)),comp.starts_at) returning id into task_id;
  saved:=to_jsonb(cash);message:='Cash-box authorization recorded and sent to Treasurer.';
 else
  select * into t from public.operational_tasks where id=p_task for update;
  if t.id is null or t.tenant_id is distinct from p_tenant or not coalesce(t.organization_id=any(p_orgs),false) or (p_role<>'org_admin' and t.assigned_role is distinct from p_role) or (p_team is not null and t.team_id is distinct from p_team) or (p_role='team_manager' and p_team is null) then raise exception '[DENY: ERR-901] Task is outside your assignment';end if;
  if t.revision is distinct from p_revision then raise exception 'Task changed. Reload before saving.' using errcode='40001';end if;
  if t.status='completed' then raise exception 'This task is closed';end if;
  prior:=to_jsonb(t);task_id:=t.id;
  if p_action in ('set_consent_policy','consent_override') and t.metadata->>'kind'='waiver' then
   select * into w from public.waiver_assignments where id=(t.metadata->'evidence'->>'waiver_assignment_id')::uuid and tenant_id=p_tenant and organization_id=t.organization_id and (team_id is null or team_id=t.team_id) for update;
   if not exists(select 1 from public.waivers where id=w.waiver_id and organization_id=t.organization_id) then raise exception 'Waiver belongs to another club';end if;
   if w.id is null or w.status not in ('assigned','pending','expired') then raise exception 'The waiver no longer needs review';end if;
   select * into policy from public.triage_consent_policies where waiver_id=w.waiver_id and tenant_id=p_tenant and organization_id=t.organization_id for update;
   if p_action='set_consent_policy' then
    if p_role<>'org_admin' then raise exception 'Only Organization Admin can configure consent exception authority';end if;
    if coalesce(policy.version,0) is distinct from (p_values->>'version')::integer then raise exception 'Policy changed. Reload before saving.' using errcode='40001';end if;
    if length(trim(coalesce(p_values->>'policy_reference','')))<10 then raise exception 'Record the governing club policy reference';end if;
    insert into public.triage_consent_policies(waiver_id,organization_id,tenant_id,enabled,team_manager_allowed,policy_reference,updated_by)
    values(w.waiver_id,t.organization_id,p_tenant,coalesce((p_values->>'enabled')::boolean,false),coalesce((p_values->>'team_manager_allowed')::boolean,false),trim(p_values->>'policy_reference'),p_actor_person)
    on conflict(waiver_id) do update set enabled=excluded.enabled,team_manager_allowed=excluded.team_manager_allowed,policy_reference=excluded.policy_reference,updated_by=excluded.updated_by,updated_at=now(),version=triage_consent_policies.version+1 returning * into policy;
    saved:=to_jsonb(policy);message:='Consent exception policy saved. No waiver has been overridden.';
   else
    if not coalesce(policy.enabled,false) or (p_role<>'org_admin' and not (p_role='team_manager' and policy.team_manager_allowed)) then raise exception 'Club policy does not authorize this role to record a consent exception';end if;
    select person_id into person from public.athletes where id=w.athlete_id;
    if person is null then person:=w.person_id;end if;
    doc:=(p_values->>'document_id')::uuid;
    perform d.id from public.documents d join public.document_types dt on dt.id=d.document_type_id where d.id=doc and d.tenant_id=p_tenant and d.owner_person_id=person and dt.code='WAIVER' and d.verification_status='verified' and (d.expires_at is null or d.expires_at>now()) for share of d;
    if not found then raise exception 'A current verified waiver document for this swimmer is required';end if;
    update public.waiver_assignments set status='waived',waived_at=now(),updated_at=now(),metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('deck_exception',jsonb_build_object('actor',p_actor_person,'policy_version',policy.version,'policy_reference',policy.policy_reference,'document_id',doc,'reason',p_reason,'recorded_at',now())) where id=w.id returning to_jsonb(waiver_assignments.*) into saved;
    update public.operational_tasks set status='completed',completed_at=now() where id=t.id;
    message:='Authorized waiver exception recorded. Other competition eligibility checks still apply.';
   end if;
  elsif p_action in ('prepare_cashbox','cancel_cashbox') and t.metadata->>'kind'='cashbox' then
   select * into cash from public.competition_cashbox_vouchers where id=(t.metadata->>'entity_id')::uuid and tenant_id=p_tenant and organization_id=t.organization_id for update;
   if cash.id is null or cash.status<>'authorized' then raise exception 'Cash box has already been processed';end if;
   if p_action='prepare_cashbox' then
    if p_role not in ('org_admin','treasurer') then raise exception 'Treasurer preparation authority required';end if;
    if cash.authorized_by=p_actor_person then raise exception 'A different authorized person must count and prepare this cash box';end if;
    if (p_values->>'counted_amount')::numeric is distinct from cash.total then raise exception 'The counted cash must equal the authorized payout total';end if;
    for line in select value from jsonb_array_elements(cash.allocations) loop
     perform 1 from public.competition_official_assignments where id=(line->>'assignment_id')::uuid and competition_id=cash.competition_id and person_id=(line->>'person_id')::uuid and role_code=line->>'role' and status not in ('cancelled','declined') for share;
     if not found then raise exception 'The official matrix changed. Cancel this authorization and obtain a new one.';end if;
    end loop;
    update public.competition_cashbox_vouchers set status='prepared',prepared_by=p_actor_person,prepared_at=now(),preparation_reason=p_reason,revision=revision+1 where id=cash.id returning to_jsonb(competition_cashbox_vouchers.*) into saved;
    message:='Physical cash preparation recorded. This does not record a payout or post a ledger entry.';
   else
    if p_role<>'org_admin' then raise exception 'Organization Admin must cancel a cash-box authorization';end if;
    update public.competition_cashbox_vouchers set status='cancelled',preparation_reason=p_reason,revision=revision+1 where id=cash.id returning to_jsonb(competition_cashbox_vouchers.*) into saved;
    message:='Cash-box authorization cancelled.';
   end if;
   update public.operational_tasks set status='completed',completed_at=now() where id=t.id;
  else raise exception 'Action does not match this task';end if;
  update public.operational_tasks set metadata=metadata||jsonb_build_object('last_action_at',now()) where id=t.id;
 end if;
 insert into public.audit_events(tenant_id,actor_user_id,actor_person_id,action,entity_type,entity_id,before_data,after_data,correlation_id,reason) values(p_tenant,p_actor_user,p_actor_person,'triage.'||p_action,'operational_tasks',task_id,prior,saved,corr,p_reason);
 return jsonb_build_object('message',message,'id',task_id);
end $$;
revoke all on function public.admin_triage_authority_action(uuid,integer,uuid,uuid[],text,uuid,uuid,uuid,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.admin_triage_authority_action(uuid,integer,uuid,uuid[],text,uuid,uuid,uuid,text,jsonb,text) to service_role;
notify pgrst,'reload schema';

create or replace function public.admin_triage_change(p_source text,p_id uuid,p_revision integer,p_action text,p_note text,p_tenant uuid,p_orgs uuid[],p_role text,p_team uuid,p_actor_user uuid,p_actor_person uuid,p_create jsonb default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare before_row jsonb; after_row jsonb; item_id uuid:=p_id; i public.workflow_instances%rowtype; d public.workflow_definitions%rowtype; stages jsonb; stage_no integer; next_stage text; corr uuid:=gen_random_uuid();
begin
 if p_source not in ('operational_tasks','workflow_tasks','competition_exceptions') then raise exception 'Unknown task source'; end if;
 if p_actor_user is null or not exists(select 1 from auth.users where id=p_actor_user) then raise exception 'Authentication required'; end if;
 if p_actor_person is null then raise exception 'Your account needs a person record before changing tasks'; end if;
 if length(trim(coalesce(p_note,'')))<3 or length(p_note)>4000 then raise exception 'Record a resolution note between 3 and 4000 characters'; end if;
 if p_action='create' then
   if p_source<>'operational_tasks' or p_create is null or length(trim(coalesce(p_create->>'title','')))=0 then raise exception 'Task title is required'; end if;
   if not ((p_create->>'organization_id')::uuid=any(p_orgs)) or (p_role<>'org_admin' and p_create->>'assigned_role'<>p_role) or (p_role='team_manager' and (p_create->>'team_id')::uuid is distinct from p_team) then raise exception '[DENY: ERR-901] Task is outside your assignment'; end if;
   insert into public.operational_tasks(tenant_id,organization_id,team_id,assigned_role,title,description,priority,status,due_at)
   values(p_tenant,(p_create->>'organization_id')::uuid,nullif(p_create->>'team_id','')::uuid,p_create->>'assigned_role',trim(p_create->>'title'),p_create->>'description',p_create->>'priority','open',nullif(p_create->>'due_at','')::timestamptz)
   returning id,to_jsonb(operational_tasks.*) into item_id,after_row;
 else
   execute format('select to_jsonb(t) from public.%I t where id=$1 for update',p_source) into before_row using p_id;
   if before_row is null or (before_row->>'tenant_id')::uuid is distinct from p_tenant or not coalesce((before_row->>'organization_id')::uuid=any(p_orgs),false) or (p_role<>'org_admin' and before_row->>'assigned_role' is distinct from p_role) or (p_team is not null and (before_row->>'team_id')::uuid is distinct from p_team) or (p_role='team_manager' and p_team is null) then raise exception '[DENY: ERR-901] Task is outside your assignment'; end if;
   if (before_row->>'revision')::integer is distinct from p_revision then raise exception 'Task changed. Refresh and review the latest version.' using errcode='40001'; end if;
   if before_row->>'origin_key' is not null or before_row->'metadata'->>'kind' in ('fee_voucher','cashbox') then raise exception 'Resolve the linked record using its domain controls';end if;
   if p_action not in ('complete','reopen') then raise exception 'Unknown task action'; end if;
   if p_action='complete' and lower(before_row->>'status') in ('completed','resolved','cancelled','skipped') then raise exception 'Task is already closed'; end if;
   if p_action='reopen' and lower(before_row->>'status') not in ('completed','resolved') then raise exception 'Only completed tasks can be reopened'; end if;
   if p_source='operational_tasks' then
     update public.operational_tasks set status=case when p_action='complete' then 'completed' else 'open' end,completed_at=case when p_action='complete' then now() else null end where id=p_id returning to_jsonb(operational_tasks.*) into after_row;
   elsif p_source='competition_exceptions' then
     -- A human attests to the resolution; this never changes eligibility or money.
     update public.competition_exceptions set status=case when p_action='complete' then 'resolved' else 'open' end,resolved_at=case when p_action='complete' then now() else null end,resolved_by=case when p_action='complete' then p_actor_person else null end where id=p_id returning to_jsonb(competition_exceptions.*) into after_row;
   else
     if p_action<>'complete' then raise exception 'Completed workflow stages cannot be reopened from the task list'; end if;
     select * into i from public.workflow_instances where id=(before_row->>'workflow_instance_id')::uuid for update;
     select * into d from public.workflow_definitions where id=i.workflow_definition_id;
     if d.tenant_id is distinct from p_tenant or i.status not in ('pending','running') then raise exception 'Workflow is not running in this club'; end if;
     stages:=d.definition->'stages';
     if jsonb_typeof(stages) is distinct from 'array' or jsonb_array_length(stages)=0 then raise exception 'Workflow stages need review by Organization Admin'; end if;
     select ordinality::integer-1 into stage_no from jsonb_array_elements_text(stages) with ordinality where value=before_row->>'task_code' limit 1;
     if stage_no is null then raise exception 'Task does not match a workflow stage'; end if;
     if coalesce((i.context->>'stage_index')::integer,0)<>stage_no then raise exception 'Complete the current workflow stage first'; end if;
     next_stage:=stages->>(stage_no+1);
     update public.workflow_tasks set status='completed',completed_at=now(),decision=p_note where id=p_id returning to_jsonb(workflow_tasks.*) into after_row;
     if next_stage is not null then
       insert into public.workflow_tasks(workflow_instance_id,task_code,assigned_to,status,tenant_id,organization_id,team_id,assigned_role,metadata)
       values(i.id,next_stage,(before_row->>'assigned_to')::uuid,'pending',p_tenant,(before_row->>'organization_id')::uuid,(before_row->>'team_id')::uuid,before_row->>'assigned_role',coalesce(before_row->'metadata','{}'::jsonb)||jsonb_build_object('stage_index',stage_no+1));
     end if;
     update public.workflow_instances set status=case when next_stage is null then 'completed' else 'running' end,completed_at=case when next_stage is null then now() else null end,context=coalesce(context,'{}'::jsonb)||jsonb_build_object('stage_index',stage_no+1,'current_stage',next_stage) where id=i.id;
     insert into public.workflow_transition_history(workflow_instance_id,from_state,to_state,transition_code,actor_person_id,reason,metadata) values(i.id,before_row->>'task_code',coalesce(next_stage,'completed'),'task_completed',p_actor_person,p_note,jsonb_build_object('task_id',p_id,'correlation_id',corr));
   end if;
 end if;
 insert into public.audit_events(tenant_id,actor_user_id,actor_person_id,action,entity_type,entity_id,before_data,after_data,correlation_id,reason)
 values(p_tenant,p_actor_user,p_actor_person,'triage.'||p_action,p_source,item_id,before_row,after_row,corr,p_note);
 return jsonb_build_object('id',item_id,'row',after_row,'correlationId',corr);
end $$;
revoke all on function public.admin_triage_change(text,uuid,integer,text,text,uuid,uuid[],text,uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.admin_triage_change(text,uuid,integer,text,text,uuid,uuid[],text,uuid,uuid,uuid,jsonb) to service_role;
