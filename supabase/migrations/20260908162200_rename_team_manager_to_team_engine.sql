update public.hub_navigation
set label = 'Team Engine',
    description = coalesce(description, 'Team Engine operations, rosters, memberships, programs, teams, seasons, registrar workflows, and organization context')
where label = 'Team Manager';

update public.hub_navigation
set description = replace(description, 'Team Manager', 'Team Engine')
where description is not null and description like '%Team Manager%';
