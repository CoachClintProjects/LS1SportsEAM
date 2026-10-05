-- Organization-owned personnel clearance policy. No policies or exceptions are seeded.
create table if not exists public.organization_safety_policies(
 organization_id uuid primary key references public.organizations(id),tenant_id uuid not null references public.tenants(id),
 status text not null default 'draft' check(status in ('draft','active','paused')),
 role_codes text[] not null default '{}',require_background boolean not null default true,require_safesport boolean not null default true,
 validity_months integer not null default 12 check(validity_months between 1 and 60),
 clear_background_results text[] not null default array['clear','passed'],
 override_max_days integer not null default 7 check(override_max_days between 1 and 90),
 version integer not null default 1,updated_at timestamptz not null default now(),updated_by uuid not null
);
create table if not exists public.personnel_safety_overrides(
 id uuid primary key,tenant_id uuid not null references public.tenants(id),organization_id uuid not null references public.organization_safety_policies(organization_id),
 person_id uuid not null references public.people(id),role_code text not null,policy_version integer not null,
 expires_at timestamptz not null,reason text not null,status text not null default 'active' check(status in ('active','revoked')),
 created_by uuid not null,created_at timestamptz not null default now(),revoked_by uuid,revoked_at timestamptz
);
create index if not exists safety_override_lookup on public.personnel_safety_overrides(organization_id,person_id,role_code,policy_version,expires_at) where status='active';
alter table public.organization_safety_policies enable row level security;
alter table public.personnel_safety_overrides enable row level security;
revoke all on public.organization_safety_policies,public.personnel_safety_overrides from public,anon,authenticated;
grant all on public.organization_safety_policies,public.personnel_safety_overrides to service_role;

create or replace function public.admin_safety_evaluate(p_tenant uuid,p_org uuid,p_person uuid,p_role text)
returns jsonb language plpgsql stable security invoker set search_path=public as $$
declare policy organization_safety_policies; missing text[]:='{}'; effective_until date; exception personnel_safety_overrides;
begin
 select * into policy from organization_safety_policies where organization_id=p_org and tenant_id=p_tenant and status='active' and p_role=any(role_codes);
 if not found then return jsonb_build_object('blocked',false,'applies',false,'reasons','[]'::jsonb);end if;
 if policy.require_background then
  select max(least(b.expires_on,(b.completed_at+make_interval(months=>policy.validity_months))::date,coalesce(d.expires_at::date,'infinity'::date))) into effective_until
  from background_checks b join documents d on d.id=b.document_id join document_types t on t.id=d.document_type_id
  where b.person_id=p_person and b.status='completed' and lower(trim(b.result_classification))=any(policy.clear_background_results)
   and b.completed_at<=now() and b.expires_on is not null and d.owner_person_id=p_person and d.tenant_id=p_tenant and d.verification_status='verified' and (d.expires_at is null or d.expires_at>now()) and t.code='BACKGROUND_CHECK';
  if effective_until is null or effective_until<current_date then missing:=array_append(missing,'Current verified background clearance required');end if;
 end if;
 if policy.require_safesport then
  select max(least(s.expires_on,(s.completed_on+make_interval(months=>policy.validity_months))::date,coalesce(d.expires_at::date,'infinity'::date))) into effective_until
  from safesport_records s join documents d on d.id=s.document_id join document_types t on t.id=d.document_type_id
  where s.person_id=p_person and s.status='active' and s.verified_at is not null and s.completed_on<=current_date and s.expires_on is not null
   and d.owner_person_id=p_person and d.tenant_id=p_tenant and d.verification_status='verified' and (d.expires_at is null or d.expires_at>now()) and t.code='SAFE_SPORT';
  if effective_until is null or effective_until<current_date then missing:=array_append(missing,'Current verified SafeSport certificate required');end if;
 end if;
 if cardinality(missing)>0 then
  select * into exception from personnel_safety_overrides where tenant_id=p_tenant and organization_id=p_org and person_id=p_person and role_code=p_role and policy_version=policy.version and status='active' and expires_at>now() order by expires_at desc limit 1;
 end if;
 return jsonb_build_object('applies',true,'blocked',cardinality(missing)>0 and exception.id is null,'reasons',to_jsonb(missing),'policy_version',policy.version,'override_id',exception.id,'override_expires_at',exception.expires_at);
end $$;

create or replace function public.admin_safety_access(p_tenant uuid,p_person uuid)
returns setof jsonb language sql stable security invoker set search_path=public as $$
 select jsonb_build_object('organization_id',r.organization_id,'role_code',d.code)||admin_safety_evaluate(p_tenant,r.organization_id,p_person,d.code)
 from role_assignments r join role_definitions d on d.id=r.role_definition_id join organizations o on o.id=r.organization_id
 where r.tenant_id=p_tenant and o.tenant_id=p_tenant and r.person_id=p_person and r.status='active' and d.is_active
 and (r.starts_at is null or r.starts_at<=now()) and (r.ends_at is null or r.ends_at>now());
$$;

create or replace function public.admin_safety_roster(p_tenant uuid,p_org uuid)
returns setof jsonb language sql stable security invoker set search_path=public as $$
 select jsonb_build_object('person_id',p.id,'person_name',concat_ws(' ',coalesce(p.preferred_name,p.first_name),p.last_name),'role_code',d.code,'role_name',d.name,'organization_id',p_org)||admin_safety_evaluate(p_tenant,p_org,p.id,d.code)
 from (select distinct person_id,role_definition_id from role_assignments where tenant_id=p_tenant and organization_id=p_org and status='active' and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>now())) r
 join people p on p.id=r.person_id and p.tenant_id=p_tenant join role_definitions d on d.id=r.role_definition_id and d.is_active
 join organization_safety_policies policy on policy.organization_id=p_org and policy.tenant_id=p_tenant and policy.status='active' and d.code=any(policy.role_codes)
 order by p.last_name,p.first_name,d.name;
$$;

create or replace function public.admin_safety_policy_write(p_tenant uuid,p_org uuid,p_actor_user uuid,p_actor_person uuid,p_operation text,p_expected_version integer,p_values jsonb,p_reason text)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare prior organization_safety_policies; saved organization_safety_policies; codes text[]; results text[];
begin
 if length(trim(coalesce(p_reason,'')))<5 then raise exception 'Policy decision reason required';end if;
 if not exists(select 1 from organizations where id=p_org and tenant_id=p_tenant) then raise exception 'Organization outside tenant';end if;
 perform pg_advisory_xact_lock(hashtextextended('safety-policy:'||p_org,0));
 select * into prior from organization_safety_policies where organization_id=p_org and tenant_id=p_tenant for update;
 if coalesce(prior.version,0) is distinct from p_expected_version then raise exception 'Safety policy changed; reload before deciding';end if;
 if p_operation='save' then
  if prior.status='active' then raise exception 'Pause the policy before changing its requirements';end if;
  select array_agg(distinct upper(value)) into codes from jsonb_array_elements_text(p_values->'role_codes');
  if coalesce(cardinality(codes),0)=0 then raise exception 'Select affected personnel roles';end if;
  if exists(select 1 from unnest(codes) c where c in ('ORGANIZATION_ADMIN','ORG_ADMIN','CLIENT_SUPERADMIN','SYSTEM_SUPERUSER','ATHLETE','ATHLETE_ASSET','PARENT','PARENT_GUARDIAN','GUARDIAN') or not exists(select 1 from role_definitions where code=c and is_active and (tenant_id is null or tenant_id=p_tenant))) then raise exception 'Select supported personnel roles; executive recovery authority must remain available';end if;
  select array_agg(distinct lower(trim(value))) into results from jsonb_array_elements_text(p_values->'clear_background_results') where trim(value)<>'';
  if not coalesce((p_values->>'require_background')::boolean,false) and not coalesce((p_values->>'require_safesport')::boolean,false) then raise exception 'At least one clearance requirement is required';end if;
  if (p_values->>'require_background')::boolean and coalesce(cardinality(results),0)=0 then raise exception 'Accepted background result classifications required';end if;
  insert into organization_safety_policies(organization_id,tenant_id,status,role_codes,require_background,require_safesport,validity_months,clear_background_results,override_max_days,version,updated_by)
   values(p_org,p_tenant,'draft',codes,(p_values->>'require_background')::boolean,(p_values->>'require_safesport')::boolean,(p_values->>'validity_months')::integer,coalesce(results,'{}'),(p_values->>'override_max_days')::integer,coalesce(prior.version,0)+1,p_actor_user)
   on conflict(organization_id) do update set status='draft',role_codes=excluded.role_codes,require_background=excluded.require_background,require_safesport=excluded.require_safesport,validity_months=excluded.validity_months,clear_background_results=excluded.clear_background_results,override_max_days=excluded.override_max_days,version=excluded.version,updated_by=excluded.updated_by,updated_at=now() returning * into saved;
 elsif p_operation='activate' then
  if prior.status is null or prior.status not in ('draft','paused') then raise exception 'A saved draft or paused policy is required';end if;
  update organization_safety_policies set status='active',version=version+1,updated_by=p_actor_user,updated_at=now() where organization_id=p_org returning * into saved;
 elsif p_operation='pause' then
  if prior.status is distinct from 'active' then raise exception 'Policy is not active';end if;
  update organization_safety_policies set status='paused',version=version+1,updated_by=p_actor_user,updated_at=now() where organization_id=p_org returning * into saved;
 else raise exception 'Unsupported policy operation';end if;
 insert into audit_events(tenant_id,actor_user_id,actor_person_id,action,entity_type,entity_id,before_data,after_data,correlation_id,reason)
 values(p_tenant,p_actor_user,p_actor_person,'safety_policy.'||p_operation,'organization_safety_policy',p_org,to_jsonb(prior),to_jsonb(saved),gen_random_uuid(),trim(p_reason));
 return to_jsonb(saved);
end $$;

create or replace function public.admin_safety_override_write(p_tenant uuid,p_org uuid,p_actor_user uuid,p_actor_person uuid,p_id uuid,p_person uuid,p_role text,p_expires_at timestamptz,p_operation text,p_expected_policy_version integer,p_reason text)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare policy organization_safety_policies; prior personnel_safety_overrides; saved personnel_safety_overrides;
begin
 if length(trim(coalesce(p_reason,'')))<5 then raise exception 'Override decision reason required';end if;
 perform pg_advisory_xact_lock(hashtextextended('safety-policy:'||p_org,0));
 select * into policy from organization_safety_policies where organization_id=p_org and tenant_id=p_tenant for update;
 if not found or policy.version is distinct from p_expected_policy_version then raise exception 'Safety policy changed; reload before deciding';end if;
 select * into prior from personnel_safety_overrides where id=p_id for update;
 if p_operation='grant' then
  if policy.status<>'active' or not p_role=any(policy.role_codes) then raise exception 'Active policy and affected role required';end if;
  if p_expires_at is null or p_expires_at<=now() or p_expires_at>now()+make_interval(days=>policy.override_max_days) then raise exception 'Expiry must be within the policy override duration';end if;
  if not exists(select 1 from role_assignments r join role_definitions d on d.id=r.role_definition_id join people p on p.id=r.person_id where r.tenant_id=p_tenant and p.tenant_id=p_tenant and r.organization_id=p_org and r.person_id=p_person and r.status='active' and d.code=p_role and d.is_active and (r.starts_at is null or r.starts_at<=now()) and (r.ends_at is null or r.ends_at>now())) then raise exception 'Active scoped personnel assignment required';end if;
  if prior.id is not null then
   if prior.tenant_id=p_tenant and prior.organization_id=p_org and prior.person_id=p_person and prior.role_code=p_role and prior.expires_at=p_expires_at and prior.reason=trim(p_reason) and prior.created_by=p_actor_user then return to_jsonb(prior);end if;
   raise exception 'Override ID already used for another decision';
  end if;
  if not coalesce((admin_safety_evaluate(p_tenant,p_org,p_person,p_role)->>'blocked')::boolean,false) then raise exception 'No unresolved clearance restriction requires an override';end if;
  insert into personnel_safety_overrides(id,tenant_id,organization_id,person_id,role_code,policy_version,expires_at,reason,created_by)
   values(p_id,p_tenant,p_org,p_person,p_role,policy.version,p_expires_at,trim(p_reason),p_actor_user) returning * into saved;
 elsif p_operation='revoke' then
  if prior.id is null or prior.tenant_id<>p_tenant or prior.organization_id<>p_org then raise exception 'Override outside organization';end if;
  if prior.status='revoked' then return to_jsonb(prior);end if;
  update personnel_safety_overrides set status='revoked',revoked_by=p_actor_user,revoked_at=now() where id=p_id returning * into saved;
 else raise exception 'Unsupported override operation';end if;
 insert into audit_events(tenant_id,actor_user_id,actor_person_id,action,entity_type,entity_id,before_data,after_data,correlation_id,reason)
 values(p_tenant,p_actor_user,p_actor_person,'safety_override.'||p_operation,'personnel_safety_override',p_id,to_jsonb(prior),to_jsonb(saved),gen_random_uuid(),trim(p_reason));
 return to_jsonb(saved);
end $$;

revoke all on function public.admin_safety_evaluate(uuid,uuid,uuid,text),public.admin_safety_access(uuid,uuid),public.admin_safety_roster(uuid,uuid),public.admin_safety_policy_write(uuid,uuid,uuid,uuid,text,integer,jsonb,text),public.admin_safety_override_write(uuid,uuid,uuid,uuid,uuid,uuid,text,timestamptz,text,integer,text) from public,anon,authenticated;
grant execute on function public.admin_safety_evaluate(uuid,uuid,uuid,text),public.admin_safety_access(uuid,uuid),public.admin_safety_roster(uuid,uuid),public.admin_safety_policy_write(uuid,uuid,uuid,uuid,text,integer,jsonb,text),public.admin_safety_override_write(uuid,uuid,uuid,uuid,uuid,uuid,text,timestamptz,text,integer,text) to service_role;
