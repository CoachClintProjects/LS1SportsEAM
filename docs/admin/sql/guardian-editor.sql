-- Atomic contact and family relationship edit. Server validates operator permissions.
create or replace function public.admin_save_guardian(p_tenant uuid,p_org uuid,p_athlete uuid,p_actor_user uuid,p_actor_person uuid,p_values jsonb)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare a public.athletes; g public.people; person_before jsonb; link_before jsonb; related uuid; result jsonb;
begin
 select at.* into a from athletes at join people p on p.id=at.person_id where at.id=p_athlete and p.tenant_id=p_tenant for update of at;
 if not found then raise exception 'Athlete outside tenant';end if;
 if not exists(select 1 from organizations where id=p_org and tenant_id=p_tenant) or not (
 exists(select 1 from team_memberships m join teams t on t.id=m.team_id where m.athlete_id=p_athlete and t.organization_id=p_org)
 or exists(select 1 from registrations where athlete_id=p_athlete and organization_id=p_org)) then raise exception 'Athlete outside organization';end if;
 if nullif(trim(p_values->>'reason'),'') is null then raise exception 'A reason is required';end if;
 if p_values->>'relationship_type' not in ('parent','guardian','mother','father','step_parent','foster_parent','grandparent_guardian') then raise exception 'Choose a parent or guardian relationship';end if;
 related:=(p_values->>'person_id')::uuid;
 if related is null or related=a.person_id then raise exception 'Select a different person';end if;
 if p_values->>'mode'='new' then
  if nullif(trim(p_values->>'first_name'),'') is null or nullif(trim(p_values->>'last_name'),'') is null then raise exception 'First and last names are required';end if;
  if exists(select 1 from people where id=related) then raise exception 'This submission may already be saved. Reload before retrying';end if;
  if nullif(trim(p_values->>'email'),'') is not null and exists(select 1 from people where tenant_id=p_tenant and email=trim(p_values->>'email')) then raise exception 'A person with this email exists. Link the existing person';end if;
  insert into people(id,tenant_id,first_name,last_name,email,phone) values(related,p_tenant,trim(p_values->>'first_name'),trim(p_values->>'last_name'),nullif(trim(p_values->>'email'),''),nullif(trim(p_values->>'phone'),'')) returning * into g;
 else
  select * into g from people where id=related and tenant_id=p_tenant for update;
  if not found then raise exception 'Person outside tenant';end if;
  person_before:=to_jsonb(g);
  if p_values->>'mode'='edit' then
   select to_jsonb(m) into link_before from family_members m where m.family_id=a.primary_family_id and m.person_id=related;
   if link_before is null then raise exception 'Guardian relationship changed. Reload';end if;
   if g.updated_at is distinct from (p_values->>'expected_updated_at')::timestamptz or
      (link_before->>'relationship_type') is distinct from (p_values->>'expected_relationship') or
      (link_before->>'is_primary_guardian') is distinct from (p_values->>'expected_primary') then raise exception 'Record changed. Reload before saving';end if;
   if nullif(trim(p_values->>'first_name'),'') is null or nullif(trim(p_values->>'last_name'),'') is null then raise exception 'First and last names are required';end if;
   update people set first_name=trim(p_values->>'first_name'),last_name=trim(p_values->>'last_name'),email=nullif(trim(p_values->>'email'),''),phone=nullif(trim(p_values->>'phone'),''),updated_at=now() where id=related returning * into g;
  elsif p_values->>'mode' is distinct from 'link' then raise exception 'Unsupported guardian action';end if;
 end if;
 result:=admin_athlete_relationship(p_tenant,p_org,p_athlete,p_actor_user,p_actor_person,'guardian_link',p_values);
 insert into audit_events(tenant_id,actor_user_id,actor_person_id,action,entity_type,entity_id,before_data,after_data,correlation_id,reason)
 values(p_tenant,p_actor_user,p_actor_person,'guardian.contact_saved','person',related,person_before,to_jsonb(g),gen_random_uuid(),p_values->>'reason');
 return result;
end $$;
revoke all on function public.admin_save_guardian(uuid,uuid,uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.admin_save_guardian(uuid,uuid,uuid,uuid,uuid,jsonb) to service_role;
