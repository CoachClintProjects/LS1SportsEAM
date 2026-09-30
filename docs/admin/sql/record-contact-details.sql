alter table public.people add column if not exists address_line1 text;
alter table public.people add column if not exists address_line2 text;
alter table public.people add column if not exists city text;
alter table public.people add column if not exists region text;
alter table public.people add column if not exists postal_code text;
alter table public.people add column if not exists country_code text;
alter table public.people add column if not exists preferred_contact_method text;
create or replace function public.admin_save_person_profile(
 p_tenant uuid,p_person uuid,p_actor_user uuid,p_actor_person uuid,
 p_expected_updated_at timestamptz,p_changes jsonb
) returns jsonb language plpgsql security invoker set search_path=public as $$
declare old_row public.people; new_row public.people;
begin
 select * into old_row from public.people where id=p_person and tenant_id=p_tenant for update;
 if not found then raise exception 'Person outside authorized scope'; end if;
 if old_row.updated_at is distinct from p_expected_updated_at then raise exception 'Record changed. Reload before saving.'; end if;
 if exists(select 1 from jsonb_object_keys(p_changes) k where k not in ('first_name','last_name','preferred_name','birth_date','email','phone','address_line1','address_line2','city','region','postal_code','country_code','preferred_contact_method')) then raise exception 'Unsupported profile field'; end if;
 new_row:=jsonb_populate_record(old_row,p_changes);
 if nullif(trim(new_row.first_name),'') is null or nullif(trim(new_row.last_name),'') is null then raise exception 'First and last name are required'; end if;
 update public.people set first_name=new_row.first_name,last_name=new_row.last_name,preferred_name=new_row.preferred_name,birth_date=new_row.birth_date,email=new_row.email,phone=new_row.phone,address_line1=new_row.address_line1,address_line2=new_row.address_line2,city=new_row.city,region=new_row.region,postal_code=new_row.postal_code,country_code=new_row.country_code,preferred_contact_method=new_row.preferred_contact_method,updated_at=now() where id=p_person returning * into new_row;
 insert into public.audit_events(tenant_id,actor_user_id,actor_person_id,action,entity_type,entity_id,before_data,after_data,correlation_id,reason)
 values(p_tenant,p_actor_user,p_actor_person,'person.profile_updated','person',p_person,to_jsonb(old_row),to_jsonb(new_row),gen_random_uuid(),'Record drawer profile edit');
 return to_jsonb(new_row);
end $$;
revoke all on function public.admin_save_person_profile(uuid,uuid,uuid,uuid,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public.admin_save_person_profile(uuid,uuid,uuid,uuid,timestamptz,jsonb) to service_role;

