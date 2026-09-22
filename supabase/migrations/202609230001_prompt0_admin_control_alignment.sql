-- Prompt 0 control alignment: preserve the eight Blueprint Admin contexts and keep URWS out of navigation.
begin;

update admin_roles set role_name='team_manager', description='Team Manager operations' where role_name='team_engine';
update admin_role_switcher_options set role_name='team_manager', display_name='Team Manager', description='Team, roster and competition preparation' where role_name='team_engine';

update admin_roles set role_name='volunteer_coordinator', description='Volunteer Coordinator operations' where role_name='operations';
update admin_role_switcher_options set role_name='volunteer_coordinator', display_name='Volunteer Coordinator', description='Volunteers, availability, assignments, credentials, hours and event staffing' where role_name='operations';

insert into admin_roles(role_name,description)
select 'communications','Communications operations'
where not exists(select 1 from admin_roles where role_name='communications');

insert into admin_role_switcher_options(role_name,display_name,description,icon,sort_order)
select 'communications','Communications','Announcements, email, SMS, templates, audiences, scheduled messages and history','message-square',60
where not exists(select 1 from admin_role_switcher_options where role_name='communications');

update admin_role_switcher_options set sort_order=70 where role_name='compliance';
update admin_role_switcher_options set sort_order=80 where role_name='reporting';

update hub_navigation
set is_active=false
where hub_id='admin' and (label ilike 'URWS %' or label='URWS Cases');

delete from hub_role_navigation
where nav_id in (
  select nav_id from hub_navigation
  where hub_id='admin' and is_active=false and (label ilike 'URWS %' or label='URWS Cases')
);

commit;
