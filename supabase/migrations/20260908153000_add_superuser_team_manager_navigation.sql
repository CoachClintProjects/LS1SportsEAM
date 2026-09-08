do $$
declare
  team_manager_id uuid;
begin
  select nav_id into team_manager_id
  from public.hub_navigation
  where hub_id = 'superuser' and label = 'Team Manager' and parent_id is null
  order by created_at asc
  limit 1;

  if team_manager_id is null then
    insert into public.hub_navigation (hub_id, label, path, component, sort_order, is_active, description)
    values (
      'superuser',
      'Team Manager',
      '/superuser?view=team-manager',
      'SuperUserModuleWorkspace',
      80,
      true,
      'Canonical organization, people, roster, membership, program, team and season operating control.'
    )
    returning nav_id into team_manager_id;
  else
    update public.hub_navigation
    set path = '/superuser?view=team-manager',
        component = 'SuperUserModuleWorkspace',
        sort_order = 80,
        is_active = true,
        description = 'Canonical organization, people, roster, membership, program, team and season operating control.'
    where nav_id = team_manager_id;
  end if;

  update public.hub_navigation
  set parent_id = team_manager_id, sort_order = 20
  where hub_id = 'superuser' and label = 'Organizations';

  update public.hub_navigation
  set parent_id = team_manager_id, sort_order = 30
  where hub_id = 'superuser' and label = 'People';

  insert into public.hub_navigation (hub_id, parent_id, label, path, component, sort_order, is_active, description)
  select 'superuser', team_manager_id, 'Overview', '/superuser?view=team-manager', 'SuperUserModuleWorkspace', 10, true,
         'Live Team Manager operating overview and canonical record counts.'
  where not exists (
    select 1 from public.hub_navigation
    where hub_id = 'superuser' and parent_id = team_manager_id and path = '/superuser?view=team-manager'
  );

  insert into public.hub_navigation (hub_id, parent_id, label, path, component, sort_order, is_active, description)
  select 'superuser', team_manager_id, 'Registrar & Validation', '/superuser?view=registrar', 'SuperUserModuleWorkspace', 40, true,
         'Registration, membership readiness, data quality and exception validation.'
  where not exists (
    select 1 from public.hub_navigation where hub_id = 'superuser' and path = '/superuser?view=registrar'
  );

  insert into public.hub_navigation (hub_id, parent_id, label, path, component, sort_order, is_active, description)
  select 'superuser', team_manager_id, 'Rosters', '/superuser?view=rosters', 'SuperUserModuleWorkspace', 50, true,
         'Team roster assignments, active membership and roster lifecycle state.'
  where not exists (
    select 1 from public.hub_navigation where hub_id = 'superuser' and path = '/superuser?view=rosters'
  );

  insert into public.hub_navigation (hub_id, parent_id, label, path, component, sort_order, is_active, description)
  select 'superuser', team_manager_id, 'Memberships', '/superuser?view=memberships', 'SuperUserModuleWorkspace', 60, true,
         'Organization and governing-body membership records and lifecycle state.'
  where not exists (
    select 1 from public.hub_navigation where hub_id = 'superuser' and path = '/superuser?view=memberships'
  );

  insert into public.hub_navigation (hub_id, parent_id, label, path, component, sort_order, is_active, description)
  select 'superuser', team_manager_id, 'Programs', '/superuser?view=programs', 'SuperUserModuleWorkspace', 70, true,
         'Organization programs, sport context and operating state.'
  where not exists (
    select 1 from public.hub_navigation where hub_id = 'superuser' and path = '/superuser?view=programs'
  );

  insert into public.hub_navigation (hub_id, parent_id, label, path, component, sort_order, is_active, description)
  select 'superuser', team_manager_id, 'Teams', '/superuser?view=teams', 'SuperUserModuleWorkspace', 80, true,
         'Canonical team master records, program/season context and operating status.'
  where not exists (
    select 1 from public.hub_navigation where hub_id = 'superuser' and path = '/superuser?view=teams'
  );

  insert into public.hub_navigation (hub_id, parent_id, label, path, component, sort_order, is_active, description)
  select 'superuser', team_manager_id, 'Seasons', '/superuser?view=seasons', 'SuperUserModuleWorkspace', 90, true,
         'Season definitions, date boundaries and lifecycle state.'
  where not exists (
    select 1 from public.hub_navigation where hub_id = 'superuser' and path = '/superuser?view=seasons'
  );
end $$;
