insert into public.permission_definitions(tenant_id,code,name,resource,action,description,conditions,is_active)
select null,'finance.read','Read finance','finance','read','Read authorized finance summary and transaction evidence','{}'::jsonb,true
where not exists (select 1 from public.permission_definitions where tenant_id is null and code='finance.read');

insert into public.role_permission_definitions(role_definition_id,permission_definition_id,effect)
select r.id,p.id,'ALLOW'
from public.role_definitions r cross join public.permission_definitions p
where r.tenant_id is null and r.code='SYSTEM_SUPERUSER' and p.tenant_id is null and p.code='finance.read'
and not exists (select 1 from public.role_permission_definitions x where x.role_definition_id=r.id and x.permission_definition_id=p.id and x.tenant_id is null);
