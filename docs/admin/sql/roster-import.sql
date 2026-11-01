-- Atomic roster import with read-only preview, serialized duplicate checks and replay protection.
create or replace function public.admin_import_roster(p_tenant uuid,p_org uuid,p_actor_user uuid,p_actor_person uuid,p_source text,p_key text,p_rows jsonb,p_commit boolean default false)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare r jsonb; n int:=0; errors jsonb:='[]'; results jsonb:='[]'; seen text[]:='{}'; identity_key text; dob date; team uuid; existing uuid; person_id uuid; athlete_id uuid; job uuid; created int:=0; skipped int:=0; err text; item jsonb; prior public.import_jobs;
begin
 if p_actor_user is null or p_actor_person is null or p_key is null then raise exception 'Actor and import key required';end if;
 perform 1 from organizations where id=p_org and tenant_id=p_tenant for update;
 if not found then raise exception 'Club outside authorized tenant';end if;
 if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows) not between 1 and 1000 then raise exception 'Supply 1–1,000 rows';end if;
 select * into prior from import_jobs where tenant_id=p_tenant and idempotency_key=p_key;
 if found then return jsonb_build_object('ok',true,'alreadyImported',true,'created',prior.records_created,'skipped',prior.records_read-prior.records_created,'rows','[]'::jsonb,'errors','[]'::jsonb);end if;
 for r in select value from jsonb_array_elements(p_rows) loop
  n:=n+1;err:=null;dob:=null;team:=null;existing:=null;
  begin
   if nullif(trim(r->>'first_name'),'') is null or nullif(trim(r->>'last_name'),'') is null then raise exception 'First and last names are required';end if;
   if coalesce(r->>'birth_date','') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Date of birth must be YYYY-MM-DD';end if;
   dob:=(r->>'birth_date')::date;
   if dob>current_date then raise exception 'Date of birth is in the future';end if;
   if nullif(r->>'email','') is not null and r->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Email address is invalid';end if;
   select id into team from teams where organization_id=p_org and status='active' and (id::text=r->>'team' or lower(code::text)=lower(trim(r->>'team')) or lower(name)=lower(trim(r->>'team')));
   if team is null then raise exception 'Squad does not match an active club squad';end if;
   if (select count(*) from teams where organization_id=p_org and status='active' and (id::text=r->>'team' or lower(code::text)=lower(trim(r->>'team')) or lower(name)=lower(trim(r->>'team'))))<>1 then raise exception 'Squad name is ambiguous; use its code';end if;
   identity_key:=lower(trim(r->>'first_name'))||'|'||lower(trim(r->>'last_name'))||'|'||dob::text;
   if identity_key=any(seen) then raise exception 'Repeated athlete in this file';end if;seen:=array_append(seen,identity_key);
   if nullif(trim(r->>'athlete_number'),'') is not null then
    if ('number:'||lower(trim(r->>'athlete_number')))=any(seen) then raise exception 'Repeated athlete number in this file';end if;
    seen:=array_append(seen,'number:'||lower(trim(r->>'athlete_number')));
    if exists(select 1 from athletes a join people p on p.id=a.person_id where p.tenant_id=p_tenant and a.athlete_number=trim(r->>'athlete_number') and not(lower(p.first_name)=lower(trim(r->>'first_name')) and lower(p.last_name)=lower(trim(r->>'last_name')) and p.birth_date=dob)) then raise exception 'Athlete number belongs to a different record; review before importing';end if;
   end if;
   select p.id into existing from people p where p.tenant_id=p_tenant and lower(p.first_name)=lower(trim(r->>'first_name')) and lower(p.last_name)=lower(trim(r->>'last_name')) and p.birth_date=dob limit 1;
   if existing is null and nullif(trim(r->>'email'),'') is not null and exists(select 1 from people where tenant_id=p_tenant and email=trim(r->>'email')) then raise exception 'Email matches another person; review the contact before importing';end if;
  exception when others then err:=sqlerrm;
  end;
  if err is not null then errors:=errors||jsonb_build_array(jsonb_build_object('row',n+1,'error',err));end if;
  results:=results||jsonb_build_array(jsonb_build_object('row',n+1,'name',concat_ws(' ',r->>'first_name',r->>'last_name'),'status',case when err is not null then 'error' when existing is not null then 'skip' else 'create' end,'team_id',team,'values',r));
 end loop;
 if jsonb_array_length(errors)>0 or not p_commit then return jsonb_build_object('ok',jsonb_array_length(errors)=0,'rows',results,'errors',errors);end if;
 for item in select value from jsonb_array_elements(results) loop
  if item->>'status'='skip' then skipped:=skipped+1;continue;end if;
  r:=item->'values';
  insert into people(tenant_id,first_name,last_name,preferred_name,birth_date,email,phone,status) values(p_tenant,trim(r->>'first_name'),trim(r->>'last_name'),nullif(trim(r->>'preferred_name'),''),(r->>'birth_date')::date,nullif(trim(r->>'email'),''),nullif(trim(r->>'phone'),''),'active') returning id into person_id;
  insert into athletes(person_id,athlete_number,athlete_status,privacy_level,status) values(person_id,nullif(trim(r->>'athlete_number'),''),'active','private','ACTIVE') returning id into athlete_id;
  insert into team_memberships(team_id,athlete_id,person_id,membership_type,status,starts_on) values((item->>'team_id')::uuid,athlete_id,person_id,'athlete','active',current_date);
  insert into audit_events(tenant_id,actor_user_id,actor_person_id,action,entity_type,entity_id,after_data,correlation_id,reason) values(p_tenant,p_actor_user,p_actor_person,'athlete.imported','athlete',athlete_id,jsonb_build_object('source',p_source,'row',item->'row','team_id',item->>'team_id'),gen_random_uuid(),'Roster CSV import');
  created:=created+1;
 end loop;
 insert into import_jobs(tenant_id,source_system,source_file,entity_type,status,records_read,records_valid,records_rejected,records_created,records_updated,completed_at,idempotency_key) values(p_tenant,'roster_csv',p_source,'athlete','completed',n,n,0,created,0,now(),p_key) returning id into job;
 return jsonb_build_object('ok',true,'jobId',job,'created',created,'skipped',skipped,'errors','[]'::jsonb);
end $$;
revoke all on function public.admin_import_roster(uuid,uuid,uuid,uuid,text,text,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.admin_import_roster(uuid,uuid,uuid,uuid,text,text,jsonb,boolean) to service_role;
