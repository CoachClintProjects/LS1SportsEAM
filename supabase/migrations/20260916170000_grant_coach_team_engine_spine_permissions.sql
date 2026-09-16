insert into public.permission_grants(role_definition_id,permission_definition_id,effect,conditions)
select r.id,p.id,'allow','{}'::jsonb
from public.role_definitions r
cross join public.permission_definitions p
where r.code='COACH'
  and r.is_active=true
  and p.is_active=true
  and p.code in (
    'teams.read','rosters.read','rosters.update',
    'training.read','training.update',
    'attendance.read','attendance.update',
    'record.read','record.create','record.update'
  )
  and not exists (
    select 1 from public.permission_grants g
    where g.role_definition_id=r.id
      and g.permission_definition_id=p.id
  );
