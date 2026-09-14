insert into public.hub_navigation(hub_id,label,icon,path,component,sort_order,is_active,description)
select 'admin','URWS Authority Control','UserCog','/admin?view=urws-authority-control','AdminURWSAuthorityWorkspace',182,true,'Assign explicit URWS decision, remedy approval, and financial execution authority and configure second-approval policy.'
where not exists(select 1 from public.hub_navigation where hub_id='admin' and component='AdminURWSAuthorityWorkspace');

update public.hub_navigation
set path='/admin?view=urws-authority-control',label='URWS Authority Control',sort_order=182,is_active=true,
 description='Assign explicit URWS decision, remedy approval, and financial execution authority and configure second-approval policy.'
where hub_id='admin' and component='AdminURWSAuthorityWorkspace';
