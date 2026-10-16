-- Role/configuration data only. No schemas, tables or staff assignments are created.
begin;
select pg_advisory_xact_lock(hashtextextended('ls1-general-manager-role',0));
insert into public.roles(code,name,description,privilege_level)
select 'GENERAL_MANAGER','General Manager (Operations)','Club operations across delegated staff workspaces; no root governance or finance-policy authority',60
where not exists(select 1 from public.roles where code='GENERAL_MANAGER');
insert into public.role_definitions(source_role_id,code,name,description,privilege_level,role_type,config,is_active)
select r.id,'GENERAL_MANAGER',r.name,r.description,r.privilege_level,
 coalesce((select role_type from public.role_definitions where code='TEAM_MANAGER' limit 1),'operational'),
 '{"hub_access":["admin"],"admin_context":"general_manager","operational_director":true}'::jsonb,true
from public.roles r where r.code='GENERAL_MANAGER' and not exists(select 1 from public.role_definitions where code='GENERAL_MANAGER' and tenant_id is null);
insert into public.permission_grants(role_definition_id,permission_definition_id,effect)
select r.id,p.id,'allow' from public.role_definitions r cross join public.permission_definitions p
where r.code='GENERAL_MANAGER' and r.tenant_id is null and p.is_active and p.code in ('record.read','record.create','record.update','record.export','rosters.read','rosters.update','finance.read','workflow.execute','admin_tasks.read','admin_tasks.create','admin_tasks.update','competition_entries.read','competition_entries.update')
and not exists(select 1 from public.permission_grants g where g.role_definition_id=r.id and g.permission_definition_id=p.id);
insert into public.admin_roles(role_name,description) select 'general_manager','Club-wide operational oversight; protected root controls excluded' where not exists(select 1 from public.admin_roles where role_name='general_manager');
insert into public.admin_role_switcher_options(role_name,display_name,description,icon,sort_order)
select 'general_manager','General Manager (Operations)','Programs, capacity, incidents and staff workflows','briefcase',2
where not exists(select 1 from public.admin_role_switcher_options where role_name='general_manager');
commit;
