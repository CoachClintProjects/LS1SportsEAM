update public.hub_navigation
set label = 'Team Engine',
    path = '/superuser?view=team-engine',
    description = coalesce(description, 'Team Engine operating control plane')
where hub_id = 'superuser'
  and label = 'Team Manager'
  and parent_id is null;

update public.hub_navigation
set path = '/superuser?view=team-engine'
where hub_id = 'superuser'
  and path = '/superuser?view=team-manager';
