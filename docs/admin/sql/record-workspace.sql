-- Server-only medical record; API enforces role and organization scope.
create table if not exists public.athlete_medical_profiles (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.tenants(id),
 organization_id uuid not null references public.organizations(id),
 athlete_id uuid not null references public.athletes(id),
 allergies text, conditions text, medications text, participation_restrictions text,
 emergency_instructions text, reviewed_on date,
 updated_at timestamptz not null default now(),
 unique(organization_id,athlete_id)
);
alter table public.athlete_medical_profiles enable row level security;
revoke all on public.athlete_medical_profiles from public,anon,authenticated;
grant select,insert,update on public.athlete_medical_profiles to service_role;
create index if not exists athlete_medical_profiles_tenant_idx on public.athlete_medical_profiles(tenant_id);

create or replace function public.admin_save_person_profile(
 p_tenant uuid,p_person uuid,p_actor_user uuid,p_actor_person uuid,
 p_expected_updated_at timestamptz,p_changes jsonb
) returns jsonb language plpgsql security invoker set search_path=public as $$
declare old_row public.people; new_row public.people;
begin
 select * into old_row from public.people where id=p_person and tenant_id=p_tenant for update;
 if not found then raise exception 'Person outside authorized scope'; end if;
 if old_row.updated_at is distinct from p_expected_updated_at then raise exception 'Record changed. Reload before saving.'; end if;
 if exists(select 1 from jsonb_object_keys(p_changes) k where k not in ('first_name','last_name','preferred_name','birth_date','email','phone')) then raise exception 'Unsupported profile field'; end if;
 new_row:=jsonb_populate_record(old_row,p_changes);
 if nullif(trim(new_row.first_name),'') is null or nullif(trim(new_row.last_name),'') is null then raise exception 'First and last name are required'; end if;
 update public.people set first_name=new_row.first_name,last_name=new_row.last_name,preferred_name=new_row.preferred_name,birth_date=new_row.birth_date,email=new_row.email,phone=new_row.phone,updated_at=now() where id=p_person returning * into new_row;
 insert into public.audit_events(tenant_id,actor_user_id,actor_person_id,action,entity_type,entity_id,before_data,after_data,correlation_id,reason)
 values(p_tenant,p_actor_user,p_actor_person,'person.profile_updated','person',p_person,to_jsonb(old_row),to_jsonb(new_row),gen_random_uuid(),'Record drawer profile edit');
 return to_jsonb(new_row);
end $$;
revoke all on function public.admin_save_person_profile(uuid,uuid,uuid,uuid,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public.admin_save_person_profile(uuid,uuid,uuid,uuid,timestamptz,jsonb) to service_role;

create or replace function public.admin_save_medical_profile(
 p_tenant uuid,p_organization uuid,p_athlete uuid,p_actor_user uuid,p_actor_person uuid,
 p_expected_updated_at timestamptz,p_changes jsonb
) returns jsonb language plpgsql security invoker set search_path=public as $$
declare old_row public.athlete_medical_profiles; new_row public.athlete_medical_profiles;
begin
 -- Lock the athlete as well so concurrent first inserts cannot overwrite each other.
 perform 1 from public.athletes a join public.people p on p.id=a.person_id where a.id=p_athlete and p.tenant_id=p_tenant for update of a;
 if not found then raise exception 'Athlete outside authorized tenant'; end if;
 perform 1 from public.organizations where id=p_organization and tenant_id=p_tenant;
 if not found then raise exception 'Organization outside authorized tenant'; end if;
 select * into old_row from public.athlete_medical_profiles where organization_id=p_organization and athlete_id=p_athlete for update;
 if old_row.updated_at is distinct from p_expected_updated_at then raise exception 'Medical record changed. Reload before saving.'; end if;
 if exists(select 1 from jsonb_object_keys(p_changes) k where k not in ('allergies','conditions','medications','participation_restrictions','emergency_instructions','reviewed_on')) then raise exception 'Unsupported medical field'; end if;
 new_row:=jsonb_populate_record(old_row,p_changes);
 insert into public.athlete_medical_profiles(tenant_id,organization_id,athlete_id,allergies,conditions,medications,participation_restrictions,emergency_instructions,reviewed_on)
 values(p_tenant,p_organization,p_athlete,new_row.allergies,new_row.conditions,new_row.medications,new_row.participation_restrictions,new_row.emergency_instructions,new_row.reviewed_on)
 on conflict(organization_id,athlete_id) do update set allergies=excluded.allergies,conditions=excluded.conditions,medications=excluded.medications,participation_restrictions=excluded.participation_restrictions,emergency_instructions=excluded.emergency_instructions,reviewed_on=excluded.reviewed_on,updated_at=now()
 returning * into new_row;
 -- Do not copy health values into the generally visible audit feed.
 insert into public.audit_events(tenant_id,actor_user_id,actor_person_id,action,entity_type,entity_id,after_data,correlation_id,reason)
 values(p_tenant,p_actor_user,p_actor_person,'athlete.medical_updated','athlete',p_athlete,jsonb_build_object('record_id',new_row.id,'changed_fields',(select jsonb_agg(k) from jsonb_object_keys(p_changes) k)),gen_random_uuid(),'Restricted medical section edit');
 return to_jsonb(new_row);
end $$;
revoke all on function public.admin_save_medical_profile(uuid,uuid,uuid,uuid,uuid,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public.admin_save_medical_profile(uuid,uuid,uuid,uuid,uuid,timestamptz,jsonb) to service_role;
