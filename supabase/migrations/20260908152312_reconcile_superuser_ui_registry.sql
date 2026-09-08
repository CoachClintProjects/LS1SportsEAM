with superuser_workspace as (
  select id from public.ui_workspace_registry where hub_id='superuser' and code='root' limit 1
), source_rows as (
  select
    w.id as workspace_id,
    n.nav_id::text as code,
    n.label as name,
    n.description,
    'workspace_view'::text as view_type,
    coalesce(n.component,'SuperUserModuleWorkspace') as component_key,
    jsonb_build_object(
      'path', n.path,
      'parent_id', n.parent_id,
      'navigation_id', n.nav_id
    ) as data_source,
    jsonb_build_object(
      'icon', n.icon,
      'switcher_type', n.switcher_type
    ) as display_definition,
    coalesce(n.sort_order,0) as sort_order,
    coalesce(n.is_active,true) as is_active
  from public.hub_navigation n
  cross join superuser_workspace w
  where n.hub_id='superuser'
)
insert into public.ui_view_registry(
  workspace_id, code, name, description, view_type, component_key,
  data_source, display_definition, sort_order, is_active, updated_at
)
select
  workspace_id, code, name, description, view_type, component_key,
  data_source, display_definition, sort_order, is_active, now()
from source_rows
on conflict (workspace_id, code) do update set
  name = excluded.name,
  description = excluded.description,
  view_type = excluded.view_type,
  component_key = excluded.component_key,
  data_source = excluded.data_source,
  display_definition = coalesce(public.ui_view_registry.display_definition,'{}'::jsonb) || excluded.display_definition,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  updated_at = now();
