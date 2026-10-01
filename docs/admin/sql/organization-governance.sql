-- Canonical governance records. These are configuration definitions, not seeded business data.
create table public.organization_governance_types (
 code text primary key,name text not null,initial_status text not null,fields jsonb not null,
 transitions jsonb not null,required_for_activation jsonb not null default '[]'
);
create table public.organization_governance_records (
 id uuid primary key, tenant_id uuid not null references public.tenants(id),
 organization_id uuid not null references public.organizations(id),
 kind text not null references public.organization_governance_types(code),
 title text not null check(length(trim(title)) between 1 and 250),status text not null,
 details jsonb not null default '{}' check(jsonb_typeof(details)='object'),
 due_on date,owner_person_id uuid references public.people(id),version integer not null default 1,
 created_by uuid not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 work_item_id uuid not null unique references public.work_items(id)
);
create index governance_scope on public.organization_governance_records(tenant_id,organization_id,kind,status,due_on);
create index governance_owner on public.organization_governance_records(owner_person_id);
create table public.organization_governance_files (
 id uuid primary key,record_id uuid not null references public.organization_governance_records(id),
 title text not null,storage_path text not null unique,mime_type text not null,size_bytes bigint not null,
 uploaded_by uuid not null,created_at timestamptz not null default now()
);
create index governance_files_record on public.organization_governance_files(record_id);
alter table public.organization_governance_types enable row level security;
alter table public.organization_governance_records enable row level security;
alter table public.organization_governance_files enable row level security;
revoke all on public.organization_governance_types,public.organization_governance_records,public.organization_governance_files from public,anon,authenticated;
grant select on public.organization_governance_types to service_role;
grant select,insert,update on public.organization_governance_records,public.organization_governance_files to service_role;
insert into public.organization_governance_types values ('policy','Policies & bylaws','draft','[{"key": "category", "label": "Category", "type": "select", "required": true, "options": ["Bylaw", "Code of conduct", "Refund policy", "Operating policy"]}, {"key": "body", "label": "Policy text", "type": "textarea", "required": true}, {"key": "effective_on", "label": "Effective date", "type": "date", "required": true}]'::jsonb,'{"draft": ["review", "withdrawn"], "review": ["draft", "active", "withdrawn"], "active": ["superseded", "withdrawn"]}'::jsonb,'["body", "effective_on"]'::jsonb);
insert into public.organization_governance_types values ('insurance','Insurance','draft','[{"key": "insurer", "label": "Insurer", "type": "text", "required": true}, {"key": "policy_number", "label": "Policy number", "type": "text", "required": true}, {"key": "coverage_type", "label": "Coverage type", "type": "select", "required": true, "options": ["General liability", "Directors & officers", "Participant medical", "Other"]}, {"key": "coverage_limit", "label": "Coverage limit", "type": "number", "required": true}, {"key": "currency", "label": "Currency", "type": "text", "required": true}, {"key": "effective_on", "label": "Coverage starts", "type": "date", "required": true}, {"key": "expires_on", "label": "Coverage ends", "type": "date", "required": true}]'::jsonb,'{"draft": ["review", "cancelled"], "review": ["draft", "active", "cancelled"], "active": ["expired", "cancelled"]}'::jsonb,'["insurer", "policy_number", "coverage_limit", "currency", "effective_on", "expires_on"]'::jsonb);
insert into public.organization_governance_types values ('sanction','Sanctioning & renewals','draft','[{"key": "governing_body", "label": "Governing body", "type": "text", "required": true}, {"key": "reference_number", "label": "Sanction / charter reference", "type": "text", "required": false}, {"key": "submission_reference", "label": "Submission confirmation", "type": "text", "required": false}, {"key": "effective_on", "label": "Valid from", "type": "date", "required": false}, {"key": "expires_on", "label": "Valid until", "type": "date", "required": false}, {"key": "notes", "label": "Submission notes", "type": "textarea", "required": false}]'::jsonb,'{"draft": ["submitted", "cancelled"], "submitted": ["active", "rejected", "cancelled"], "rejected": ["draft"], "active": ["expired", "cancelled"]}'::jsonb,'["governing_body", "reference_number", "effective_on", "expires_on"]'::jsonb);
insert into public.organization_governance_types values ('incident','Incidents & decisions','reported','[{"key": "occurred_on", "label": "Incident date", "type": "date", "required": true}, {"key": "severity", "label": "Severity", "type": "select", "required": true, "options": ["low", "medium", "high", "critical"]}, {"key": "description", "label": "Reported facts", "type": "textarea", "required": true}, {"key": "immediate_action", "label": "Immediate protective action", "type": "textarea", "required": false}, {"key": "resolution", "label": "Findings and resolution", "type": "textarea", "required": false}]'::jsonb,'{"reported": ["investigating"], "investigating": ["resolved"], "resolved": ["investigating", "closed"], "closed": ["investigating"]}'::jsonb,'[]'::jsonb);

create or replace function public.admin_governance_write(p_tenant uuid,p_org uuid,p_actor_user uuid,p_actor_person uuid,p_id uuid,p_operation text,p_expected_version integer,p_values jsonb,p_reason text)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare prior organization_governance_records; saved organization_governance_records; definition organization_governance_types;
 target text; item uuid; fld jsonb; k text; v text; required_key text; record_details jsonb; owner uuid; closed boolean;
begin
 if p_actor_user is null or p_id is null or p_operation is null or p_operation not in ('create','edit','assign','transition','attach') then raise exception 'Valid actor, record and action required';end if;
 if nullif(trim(p_reason),'') is null then raise exception 'Action reason required';end if;
 perform 1 from organizations where id=p_org and tenant_id=p_tenant;if not found then raise exception 'Organization outside tenant';end if;
 perform pg_advisory_xact_lock(hashtextextended('governance:'||p_id::text,0));
 select * into prior from organization_governance_records where id=p_id for update;
 if p_operation='create' then
  if prior.id is not null then
   if prior.tenant_id=p_tenant and prior.organization_id=p_org and prior.created_by=p_actor_user then
    if prior.title=trim(p_values->>'title') and prior.kind=p_values->>'kind' and prior.details=coalesce(p_values->'details','{}') then return to_jsonb(prior);end if;
    raise exception 'Record changed after creation. Reload before editing.';
   end if;
   raise exception 'Record identifier unavailable';
  end if;
  select * into definition from organization_governance_types where code=p_values->>'kind';
  if not found then raise exception 'Governance type required';end if;
  target:=definition.initial_status;
 else
  if prior.id is null or prior.tenant_id<>p_tenant or prior.organization_id<>p_org then raise exception 'Record outside organization';end if;
  if prior.version is distinct from p_expected_version then raise exception 'Record changed. Reload before saving.';end if;
  select * into definition from organization_governance_types where code=prior.kind;
  target:=prior.status;
  if p_operation='transition' then
   target:=p_values->>'status';
   if target is null or not coalesce((definition.transitions->prior.status)?target,false) then raise exception 'Transition not allowed';end if;
  elsif p_operation='edit' and prior.status in ('active','closed','superseded','withdrawn','cancelled','expired') then
   raise exception 'This record is locked. Create a replacement or use an authorized lifecycle action.';
  end if;
 end if;
 record_details:=case when p_operation in ('create','edit') then coalesce(p_values->'details','{}') else prior.details end;
 if jsonb_typeof(record_details)<>'object' then raise exception 'Record details must be an object';end if;
 for k in select jsonb_object_keys(record_details) loop
  if not exists(select 1 from jsonb_array_elements(definition.fields) x where x->>'key'=k) then raise exception 'Unsupported field: %',k;end if;
 end loop;
 for fld in select * from jsonb_array_elements(definition.fields) loop
  k:=fld->>'key';v:=nullif(trim(record_details->>k),'');
  if coalesce((fld->>'required')::boolean,false) and v is null then raise exception '% is required',fld->>'label';end if;
  if v is not null then
   if fld->>'type'='number' and (v::numeric<0 or v::numeric>999999999999.99) then raise exception 'Amount outside allowed range';end if;
   if fld->>'type'='date' then perform v::date;end if;
   if fld->>'type'='select' and not (fld->'options')?v then raise exception 'Invalid value for %',fld->>'label';end if;
   if length(v)>50000 then raise exception 'Field exceeds maximum length';end if;
  end if;
 end loop;
 if nullif(record_details->>'effective_on','') is not null and nullif(record_details->>'expires_on','') is not null and (record_details->>'expires_on')::date<(record_details->>'effective_on')::date then raise exception 'Expiry must not precede effective date';end if;
 if definition.code='insurance' and (record_details->>'currency' !~ '^[A-Z]{3}$' or (record_details->>'coverage_limit')::numeric<=0) then raise exception 'Positive coverage and three-letter currency required';end if;
 if definition.code='incident' and (record_details->>'occurred_on')::date>current_date then raise exception 'Incident date cannot be in the future';end if;
 if p_operation='transition' and target='active' then
  for required_key in select jsonb_array_elements_text(definition.required_for_activation) loop
   if nullif(trim(record_details->>required_key),'') is null then raise exception 'Complete % before activation',required_key;end if;
  end loop;
  if nullif(record_details->>'expires_on','') is not null and (record_details->>'expires_on')::date<current_date then raise exception 'Expired evidence cannot be activated';end if;
  if definition.code in ('insurance','sanction') and not exists(select 1 from organization_governance_files where record_id=p_id) then raise exception 'Upload the coverage or sanction evidence before activation';end if;
 end if;
 if p_operation='transition' and definition.code='sanction' and target='submitted' and nullif(trim(record_details->>'submission_reference'),'') is null then raise exception 'Record the external submission confirmation first';end if;
 if p_operation='transition' and definition.code='incident' and target in ('resolved','closed') and nullif(trim(record_details->>'resolution'),'') is null then raise exception 'Findings and resolution are required';end if;
 if p_operation='transition' and target='expired' and (nullif(record_details->>'expires_on','') is null or (record_details->>'expires_on')::date>=current_date) then raise exception 'The recorded coverage or sanction has not expired';end if;
 if p_operation='transition' and target='superseded' then
  perform 1 from organization_governance_records where id=(p_values->>'replacement_id')::uuid and id<>p_id and tenant_id=p_tenant and organization_id=p_org and kind=prior.kind and status='active';
  if not found then raise exception 'Select an active replacement policy';end if;
 end if;
 owner:=case when p_operation in ('create','edit','assign') then nullif(p_values->>'owner_person_id','')::uuid else prior.owner_person_id end;
 if owner is not null then
  perform 1 from people p join role_assignments ra on ra.person_id=p.id join role_definitions rd on rd.id=ra.role_definition_id
   where p.id=owner and p.tenant_id=p_tenant and p.status='active' and ra.tenant_id=p_tenant and ra.organization_id=p_org and ra.status='active' and rd.code='ORGANIZATION_ADMIN'
    and (ra.starts_at is null or ra.starts_at<=now()) and (ra.ends_at is null or ra.ends_at>now());
  if not found then raise exception 'Owner must be an active Organization Administrator';end if;
 end if;
 if p_operation='create' then
  item:=gen_random_uuid();
  insert into work_items(id,tenant_id,work_type,entity_type,entity_id,status) values(item,p_tenant,'GOVERNANCE_REVIEW','organization_governance',p_id,'open');
  insert into organization_governance_records(id,tenant_id,organization_id,kind,title,status,details,due_on,owner_person_id,created_by,work_item_id)
   values(p_id,p_tenant,p_org,definition.code,trim(p_values->>'title'),target,record_details,nullif(p_values->>'due_on','')::date,owner,p_actor_user,item) returning * into saved;
 else
  update organization_governance_records set title=case when p_operation='edit' then trim(p_values->>'title') else title end,status=target,details=record_details,
   due_on=case when p_operation in ('edit','assign') then nullif(p_values->>'due_on','')::date else due_on end,owner_person_id=owner,version=version+1,updated_at=now()
   where id=p_id returning * into saved;
 end if;
 if p_operation='attach' then
  if p_values->>'storage_path' is null or p_values->>'storage_path' not like 'governance-records/'||p_tenant||'/'||p_org||'/'||p_id||'/%' then raise exception 'File outside record storage';end if;
  if not exists(select 1 from storage.objects where bucket_id='governance-records' and name=substring(p_values->>'storage_path' from length('governance-records/')+1)) then raise exception 'Stored file not found';end if;
  insert into organization_governance_files(id,record_id,title,storage_path,mime_type,size_bytes,uploaded_by)
   values((p_values->>'file_id')::uuid,p_id,p_values->>'title',p_values->>'storage_path',p_values->>'mime_type',(p_values->>'size_bytes')::bigint,p_actor_user);
 end if;
 closed:=target in ('closed','superseded','withdrawn','cancelled');
 update work_items set owner_person_id=owner,status=case when closed then 'completed' else 'open' end,
  priority=case when definition.code='incident' and record_details->>'severity' in ('high','critical') then 'urgent' else 'normal' end,
  payload=jsonb_build_object('title',saved.title,'assigned_role','org_admin','organization_id',p_org,'due_on',least(saved.due_on,nullif(record_details->>'expires_on','')::date),'kind',saved.kind,'record_status',target,'source','governance','record_version',saved.version)
  where id=saved.work_item_id and tenant_id=p_tenant;
 insert into audit_events(tenant_id,actor_user_id,actor_person_id,action,entity_type,entity_id,before_data,after_data,correlation_id,reason)
  values(p_tenant,p_actor_user,p_actor_person,'governance.'||p_operation,'organization_governance',p_id,to_jsonb(prior),to_jsonb(saved)||case when p_operation='attach' then jsonb_build_object('file_id',p_values->>'file_id') else '{}'::jsonb end,gen_random_uuid(),p_reason);
 return to_jsonb(saved);
end $$;
revoke all on function public.admin_governance_write(uuid,uuid,uuid,uuid,uuid,text,integer,jsonb,text) from public,anon,authenticated;
grant execute on function public.admin_governance_write(uuid,uuid,uuid,uuid,uuid,text,integer,jsonb,text) to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('governance-records','governance-records',false,10485760,array['application/pdf','image/png','image/jpeg','text/plain']) on conflict(id) do nothing;
-- Scope navigation through the existing role grants; preserve all existing links.
do $$ declare nav uuid; admin_role uuid; begin
 select nav_id into nav from hub_navigation where hub_id='admin' and component='GovernanceWorkspace' limit 1;
 if nav is null then insert into hub_navigation(hub_id,label,path,component,sort_order,is_active,description) values('admin','Governance & risk','/admin?view=governance','GovernanceWorkspace',13,false,'Policies, insurance, sanctioning and incident decisions') returning nav_id into nav;end if;
 select role_id into admin_role from admin_roles where role_name='org_admin';
 if admin_role is not null and not exists(select 1 from hub_role_navigation where role_id=admin_role and nav_id=nav) then insert into hub_role_navigation(role_id,nav_id,can_view) values(admin_role,nav,true);end if;
end $$;
