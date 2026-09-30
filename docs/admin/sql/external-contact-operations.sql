alter table public.entity_contacts add column if not exists organization_id uuid references public.organizations(id);
alter table public.entity_contacts add column if not exists facility_id uuid references public.facilities(id);
create index if not exists entity_contacts_organization_idx on public.entity_contacts(organization_id);
create or replace function public.admin_save_external_contact(p_tenant uuid,p_organization uuid,p_id uuid,p_actor_user uuid,p_actor_person uuid,p_expected_updated_at timestamptz,p_values jsonb)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare old_row public.entity_contacts; saved public.entity_contacts; person_id_value uuid; facility_value uuid; vendor_value uuid; external_value uuid;
begin
 perform 1 from organizations where id=p_organization and tenant_id=p_tenant;
 if not found then raise exception 'Organization outside tenant'; end if;
 if p_id is not null then
 select * into old_row from entity_contacts where id=p_id and tenant_id=p_tenant and organization_id=p_organization for update;
 if not found then raise exception 'Contact outside organization'; end if;
 if old_row.updated_at is distinct from p_expected_updated_at then raise exception 'Contact changed. Reload before saving.'; end if;
 end if;
 if p_values->>'status' not in ('active','inactive') then raise exception 'Invalid contact status'; end if;
 if nullif(trim(p_values->>'first_name'),'') is null or nullif(trim(p_values->>'last_name'),'') is null or nullif(trim(p_values->>'relationship_type'),'') is null then raise exception 'Name and contact type required'; end if;
 facility_value:=nullif(p_values->>'facility_id','')::uuid;vendor_value:=nullif(p_values->>'vendor_id','')::uuid;external_value:=nullif(p_values->>'external_organization_id','')::uuid;
 if facility_value is not null and not exists(select 1 from facilities f join sites s on s.id=f.site_id where f.id=facility_value and s.organization_id=p_organization) then raise exception 'Facility outside organization'; end if;
 if vendor_value is not null and not exists(select 1 from vendors where id=vendor_value and organization_id=p_organization) then raise exception 'Vendor outside organization'; end if;
 if external_value is not null and not exists(select 1 from external_organizations where id=external_value and tenant_id=p_tenant) then raise exception 'External organization outside tenant'; end if;
 if old_row.id is null then
 if nullif(p_values->>'email','') is not null and exists(select 1 from people where tenant_id=p_tenant and email=(p_values->>'email')::citext) then raise exception 'This email already belongs to a person. Link that existing person instead of creating a duplicate.'; end if;
 insert into people(tenant_id,first_name,last_name,email,phone,status) values(p_tenant,trim(p_values->>'first_name'),trim(p_values->>'last_name'),nullif(p_values->>'email',''),nullif(p_values->>'phone',''),'active') returning id into person_id_value;
 insert into entity_contacts(tenant_id,organization_id,person_id,facility_id,vendor_id,external_organization_id,relationship_type,job_title,department,status,notes)
 values(p_tenant,p_organization,person_id_value,facility_value,vendor_value,external_value,p_values->>'relationship_type',p_values->>'job_title',p_values->>'department',p_values->>'status',p_values->>'notes') returning * into saved;
 else
 update people set first_name=trim(p_values->>'first_name'),last_name=trim(p_values->>'last_name'),email=nullif(p_values->>'email',''),phone=nullif(p_values->>'phone',''),updated_at=now() where id=old_row.person_id and tenant_id=p_tenant;
 update entity_contacts set facility_id=facility_value,vendor_id=vendor_value,external_organization_id=external_value,relationship_type=p_values->>'relationship_type',job_title=p_values->>'job_title',department=p_values->>'department',status=p_values->>'status',notes=p_values->>'notes',updated_at=now() where id=p_id returning * into saved;
 end if;
 insert into audit_events(tenant_id,actor_user_id,actor_person_id,action,entity_type,entity_id,before_data,after_data,correlation_id,reason)
 values(p_tenant,p_actor_user,p_actor_person,'external_contact.saved','entity_contact',saved.id,to_jsonb(old_row),to_jsonb(saved),gen_random_uuid(),'External operations contact edit');
 return to_jsonb(saved);
end $$;
revoke all on function public.admin_save_external_contact(uuid,uuid,uuid,uuid,uuid,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public.admin_save_external_contact(uuid,uuid,uuid,uuid,uuid,timestamptz,jsonb) to service_role;
