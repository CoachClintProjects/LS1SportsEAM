insert into public.hub_navigation(hub_id,label,icon,path,component,sort_order,is_active,description)
select 'admin','URWS Facilities','Building2','/admin?view=urws-facilities','AdminURWSFacilityWorkspace',183,true,'Facility closure impact and disruption evidence routed through URWS.'
where not exists(select 1 from public.hub_navigation where hub_id='admin' and component='AdminURWSFacilityWorkspace');
update public.hub_navigation set path='/admin?view=urws-facilities',label='URWS Facilities',sort_order=183,is_active=true,description='Facility closure impact and disruption evidence routed through URWS.' where hub_id='admin' and component='AdminURWSFacilityWorkspace';
