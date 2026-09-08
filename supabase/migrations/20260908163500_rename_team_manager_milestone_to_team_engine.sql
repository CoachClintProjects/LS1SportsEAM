update public.platform_milestones
set name = 'Team Engine'
where code::text = 'M05'
  and name = 'Team Manager';

update public.platform_project_tasks
set name = replace(name, 'Team Manager', 'Team Engine'),
    description = case when description is null then null else replace(description, 'Team Manager', 'Team Engine') end,
    updated_at = now()
where milestone_id = (select id from public.platform_milestones where code::text = 'M05' limit 1)
  and (name like '%Team Manager%' or description like '%Team Manager%');
