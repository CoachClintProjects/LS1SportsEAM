update public.admin_role_switcher_options
set role_name='team_engine',display_name='Team Engine Admin',description='Team Engine operations'
where role_name='team_manager'
  and not exists(select 1 from public.admin_role_switcher_options where role_name='team_engine');

update public.admin_roles
set role_name='team_engine',description='Team Engine operations'
where role_name='team_manager'
  and not exists(select 1 from public.admin_roles where role_name='team_engine');

update public.admin_home_role_actions a
set href=n.path
from public.hub_navigation n
where n.hub_id='admin' and n.is_active=true and n.path is not null and (
 (a.action_key='review-work' and n.label='Command Center') or
 (a.action_key='registrations' and n.label='Registrar') or
 (a.action_key='rosters' and n.label='Rosters') or
 (a.action_key='people' and n.label='Membership') or
 (a.action_key='teams' and n.label='Teams') or
 (a.action_key in ('finance','receivables','payables') and n.label='Financial Overview') or
 (a.action_key='reporting' and n.label='Reporting') or
 (a.action_key='facilities' and n.label='Facilities') or
 (a.action_key='payroll' and n.label='Payroll') or
 (a.action_key='compliance' and n.label='Compliance')
);
