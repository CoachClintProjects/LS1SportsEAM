-- Atomic compliance decisions with organization scope, concurrency and audit history.
alter table public.credentials add column if not exists version integer not null default 1;
alter table public.background_checks add column if not exists version integer not null default 1;
alter table public.safesport_records add column if not exists version integer not null default 1;
create or replace function public.admin_compliance_people(p_tenant uuid,p_orgs uuid[])
returns table(id uuid) language sql stable security invoker set search_path=public as $$
 select p.id from people p where p.tenant_id=p_tenant and (
  exists(select 1 from organizations o where o.tenant_id=p_tenant and o.id=any(p_orgs) and (select count(*) from organizations where tenant_id=p_tenant)=1)
  or exists(select 1 from role_assignments r where r.person_id=p.id and r.tenant_id=p_tenant and r.organization_id=any(p_orgs))
  or exists(select 1 from memberships m join organizations o on o.id=m.organization_id where m.person_id=p.id and o.tenant_id=p_tenant and o.id=any(p_orgs))
  or exists(select 1 from athletes a join registrations r on r.athlete_id=a.id join organizations o on o.id=r.organization_id where a.person_id=p.id and o.tenant_id=p_tenant and o.id=any(p_orgs))
  or exists(select 1 from athletes a join team_memberships m on m.athlete_id=a.id join teams t on t.id=m.team_id join organizations o on o.id=t.organization_id where a.person_id=p.id and o.tenant_id=p_tenant and o.id=any(p_orgs))
 );
$$;
revoke all on function public.admin_compliance_people(uuid,uuid[]) from public,anon,authenticated;
grant execute on function public.admin_compliance_people(uuid,uuid[]) to service_role;
create or replace function public.admin_compliance_decide(p_tenant uuid,p_orgs uuid[],p_actor_user uuid,p_actor_person uuid,p_domain text,p_id uuid,p_version integer,p_changes jsonb,p_reason text)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare tab text; prior jsonb; saved jsonb; merged jsonb; fields text[]; assignments text; k text;
begin
 if length(trim(coalesce(p_reason,'')))<5 then raise exception 'A decision reason of at least five characters is required';end if;
 if p_domain='credentials' then tab:='credentials'; fields:=array['issuer','credential_number','issued_on','expires_on','status','verification_status','verified_at','document_id'];
 elsif p_domain='backgroundChecks' then tab:='background_checks';fields:=array['provider','reference_number','submitted_at','completed_at','expires_on','status','result_classification','document_id'];
 elsif p_domain='safeSport' then tab:='safesport_records';fields:=array['certificate_id','completed_on','expires_on','status','source','verified_at','document_id'];
 else raise exception 'Unsupported compliance domain';end if;
 if jsonb_typeof(p_changes) is distinct from 'object' or p_changes='{}'::jsonb then raise exception 'Compliance changes required';end if;
 for k in select jsonb_object_keys(p_changes) loop
  if not k=any(fields) then raise exception 'Unsupported compliance field: %',k;end if;
 end loop;
 execute format('select to_jsonb(r) from %I r where id=$1 for update',tab) into prior using p_id;
 if prior is null then raise exception 'Compliance record not found';end if;
 if not exists(select 1 from admin_compliance_people(p_tenant,p_orgs) p where p.id=(prior->>'person_id')::uuid) then raise exception 'Compliance record is outside authorized organization';end if;
 if p_version is null or p_version<>(prior->>'version')::integer then raise exception 'Compliance record changed; reload before deciding';end if;
 if p_changes-array['status','verification_status','verified_at']<>'{}'::jsonb then
  if p_changes ?| array['status','verification_status','verified_at'] then raise exception 'Save evidence properties before recording a review decision';end if;
  p_changes:=p_changes||jsonb_build_object('status','pending');
  if p_domain<>'backgroundChecks' then p_changes:=p_changes||jsonb_build_object('verified_at',null);end if;
  if p_domain='credentials' then p_changes:=p_changes||jsonb_build_object('verification_status','unverified');end if;
 end if;
 merged:=prior||p_changes;
 if nullif(merged->>'document_id','') is not null and not exists(select 1 from documents where id=(merged->>'document_id')::uuid and tenant_id=p_tenant and owner_person_id=(prior->>'person_id')::uuid) then raise exception 'Supporting document outside person record';end if;
 if merged->>'status' in ('active','completed') then
  if not exists(select 1 from documents d join document_types t on t.id=d.document_type_id where d.id=nullif(merged->>'document_id','')::uuid and d.tenant_id=p_tenant and d.owner_person_id=(prior->>'person_id')::uuid and d.verification_status='verified' and (d.expires_at is null or d.expires_at>now()) and (p_domain='credentials' or (p_domain='safeSport' and t.code='SAFE_SPORT') or (p_domain='backgroundChecks' and t.code='BACKGROUND_CHECK'))) then raise exception 'A verified, current supporting document is required';end if;
 end if;
 if p_changes ? 'status' and coalesce(merged->>'status','') not in ('active','expired','completed','pending','revoked','rejected') then raise exception 'Unsupported compliance status';end if;
 if merged->>'status' in ('active','completed') then
  if nullif(merged->>'expires_on','') is null or (merged->>'expires_on')::date<current_date then raise exception 'A current expiry date is required';end if;
  if p_domain='safeSport' and (nullif(merged->>'completed_on','') is null or (merged->>'completed_on')::date>current_date or nullif(merged->>'certificate_id','') is null) then raise exception 'Certificate and valid completion date required';end if;
  if p_domain='backgroundChecks' and (nullif(merged->>'completed_at','') is null or (merged->>'completed_at')::timestamptz>now() or nullif(merged->>'result_classification','') is null) then raise exception 'Completion date and check result required';end if;
 end if;
 if p_changes ? 'verification_status' and coalesce(p_changes->>'verification_status','') not in ('verified','unverified','pending','rejected') then raise exception 'Unsupported verification decision';end if;
 if p_changes->>'verification_status'='verified' or (p_changes ? 'verified_at' and p_changes->>'verified_at' is not null) then
  if merged->>'status'<>'active' or nullif(merged->>'expires_on','') is null or (merged->>'expires_on')::date<current_date then raise exception 'Only current active evidence can be verified';end if;
  p_changes:=p_changes||jsonb_build_object('verified_at',now());
 end if;
 select string_agg(format('%I = v.%I',key,key),',') into assignments from jsonb_object_keys(p_changes) key;
 execute format('update %I r set %s, version=r.version+1 from jsonb_populate_record(null::%I,$1) v where r.id=$2 returning to_jsonb(r)',tab,assignments,tab) into saved using prior||p_changes,p_id;
 update work_items set status=case when saved->>'status'='revoked' or (p_domain='credentials' and saved->>'status'='active' and saved->>'verification_status'='verified') or (p_domain='safeSport' and saved->>'status'='active' and saved->>'verified_at' is not null) or (p_domain='backgroundChecks' and saved->>'status'='completed') then 'completed' else 'open' end,
  payload=coalesce(payload,'{}'::jsonb)||jsonb_build_object('record_status',saved->>'status','record_version',saved->'version','due_on',saved->>'expires_on')
  where tenant_id=p_tenant and entity_type=p_domain and entity_id=p_id and work_type='COMPLIANCE_REVIEW';
 insert into audit_events(tenant_id,actor_user_id,actor_person_id,action,entity_type,entity_id,before_data,after_data,correlation_id,reason)
 values(p_tenant,p_actor_user,p_actor_person,'compliance_record.updated',p_domain,p_id,prior,saved,gen_random_uuid(),trim(p_reason));
 return saved;
end $$;
revoke all on function public.admin_compliance_decide(uuid,uuid[],uuid,uuid,text,uuid,integer,jsonb,text) from public,anon,authenticated;
grant execute on function public.admin_compliance_decide(uuid,uuid[],uuid,uuid,text,uuid,integer,jsonb,text) to service_role;
