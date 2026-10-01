create or replace function public.admin_budget_account_create(p_tenant uuid,p_org uuid,p_actor_user uuid,p_actor_person uuid,p_entity uuid,p_code text,p_name text,p_type text,p_reason text)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare saved chart_of_accounts;
begin
 if p_actor_user is null or nullif(trim(p_reason),'') is null or nullif(trim(p_code),'') is null or nullif(trim(p_name),'') is null or p_type is null or p_type not in ('asset','liability','equity','revenue','expense') then raise exception 'Account code, name, type and reason required';end if;
 perform 1 from legal_entities l join organizations o on o.id=l.organization_id where l.id=p_entity and o.id=p_org and o.tenant_id=p_tenant;if not found then raise exception 'Legal entity outside organization';end if;
 perform pg_advisory_xact_lock(hashtextextended('account:'||p_entity||':'||trim(p_code),0));
 select * into saved from chart_of_accounts where legal_entity_id=p_entity and account_code=trim(p_code);
 if saved.id is not null then
  if saved.account_name=trim(p_name) and saved.account_type=p_type and saved.active then return to_jsonb(saved);end if;
  raise exception 'Account code already used';
 end if;
 insert into chart_of_accounts(legal_entity_id,account_code,account_name,account_type,active) values(p_entity,trim(p_code),trim(p_name),p_type,true) returning * into saved;
 insert into audit_events(tenant_id,actor_user_id,actor_person_id,action,entity_type,entity_id,after_data,correlation_id,reason) values(p_tenant,p_actor_user,p_actor_person,'finance.account_created','chart_of_accounts',saved.id,to_jsonb(saved),gen_random_uuid(),p_reason);
 return to_jsonb(saved);
end $$;
revoke all on function public.admin_budget_account_create(uuid,uuid,uuid,uuid,uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.admin_budget_account_create(uuid,uuid,uuid,uuid,uuid,text,text,text,text) to service_role;
