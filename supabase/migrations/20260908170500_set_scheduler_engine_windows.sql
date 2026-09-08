with project as (
  select id from public.platform_projects
  where code='LS1SPORTS-IMPLEMENTATION'
  order by created_at desc
  limit 1
), bounds as (
  select min(start_date) as start_date, max(target_date) as target_date
  from public.platform_project_tasks
  where project_id=(select id from project)
    and code not like 'ENGINE-%'
)
update public.platform_project_tasks t
set start_date=coalesce(t.start_date,b.start_date,current_date),
    target_date=coalesce(t.target_date,b.target_date,current_date),
    updated_at=now()
from bounds b
where t.project_id=(select id from project)
  and t.code like 'ENGINE-%';

update public.platform_project_tasks child
set start_date=coalesce(child.start_date,parent.start_date),
    target_date=coalesce(child.target_date,parent.target_date),
    updated_at=now()
from public.platform_project_tasks parent
where child.parent_task_id=parent.id
  and (child.start_date is null or child.target_date is null);
