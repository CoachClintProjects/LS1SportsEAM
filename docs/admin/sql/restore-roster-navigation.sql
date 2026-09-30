-- Restore the existing roster route; preserve role navigation grants.
-- The API excludes inactive rows before applying display labels.
update public.hub_navigation
set is_active = true,
    label = 'Roster',
    parent_id = null,
    sort_order = coalesce((
      select sort_order from public.hub_navigation
      where hub_id = 'admin' and component = 'OrganizationArchitecture'
      limit 1
    ), 2)
where hub_id = 'admin' and component = 'RostersView';

-- Release check: Org Admin must receive exactly one active roster route.
do $$
begin
  if (select count(*) from public.hub_navigation n
      join public.hub_role_navigation g on g.nav_id = n.nav_id
      join public.admin_roles r on r.role_id = g.role_id
      where n.hub_id = 'admin' and n.component = 'RostersView'
        and n.is_active and n.parent_id is null and n.path is not null
        and g.can_view and r.role_name = 'org_admin') <> 1 then
    raise exception 'Organization Admin roster navigation is unavailable';
  end if;
end $$;
