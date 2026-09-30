create or replace function public.admin_save_emergency_contact(p_tenant uuid,p_athlete uuid,p_contact uuid,p_actor_user uuid,p_actor_person uuid,p_expected_updated_at timestamptz,p_changes jsonb)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare old_row public.emergency_contacts; new_row public.emergency_contacts;
begin
 perform 1 from public.athletes a join public.people p on p.id=a.person_id where a.id=p_athlete and p.tenant_id=p_tenant for update of a;
 if not found then raise exception 'Athlete outside tenant'; end if;
 if p_contact is not null then
 select * into old_row from public.emergency_contacts where contact_id=p_contact and athlete_id=p_athlete for update;
 if not found then raise exception 'Contact outside athlete record'; end if;
 if old_row.updated_at is distinct from p_expected_updated_at then raise exception 'Contact changed. Reload before saving.'; end if;
 end if;
 if exists(select 1 from jsonb_object_keys(p_changes) k where k not in ('name','relationship','phone_primary','phone_secondary','email')) then raise exception 'Unsupported contact field'; end if;
 new_row:=jsonb_populate_record(old_row,p_changes);
 if nullif(trim(new_row.name),'') is null or nullif(trim(new_row.relationship),'') is null or nullif(trim(new_row.phone_primary),'') is null then raise exception 'Name, relationship and primary phone are required'; end if;
 if p_contact is null then
 insert into public.emergency_contacts(athlete_id,name,relationship,phone_primary,phone_secondary,email) values(p_athlete,new_row.name,new_row.relationship,new_row.phone_primary,new_row.phone_secondary,new_row.email) returning * into new_row;
 else
 update public.emergency_contacts set name=new_row.name,relationship=new_row.relationship,phone_primary=new_row.phone_primary,phone_secondary=new_row.phone_secondary,email=new_row.email,updated_at=now() where contact_id=p_contact returning * into new_row;
 end if;
 insert into public.audit_events(tenant_id,actor_user_id,actor_person_id,action,entity_type,entity_id,before_data,after_data,correlation_id,reason)
 values(p_tenant,p_actor_user,p_actor_person,'athlete.emergency_contact_updated','athlete',p_athlete,to_jsonb(old_row),to_jsonb(new_row),gen_random_uuid(),'Emergency contact edit');
 return to_jsonb(new_row);
end $$;
revoke all on function public.admin_save_emergency_contact(uuid,uuid,uuid,uuid,uuid,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public.admin_save_emergency_contact(uuid,uuid,uuid,uuid,uuid,timestamptz,jsonb) to service_role;
