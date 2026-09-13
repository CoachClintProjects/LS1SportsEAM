insert into public.hub_navigation(hub_id,label,icon,path,component,sort_order,is_active,description)
select 'admin','URWS Workforce','ShieldCheck','/admin?view=urws-workforce','AdminURWSWorkforceWorkspace',184,true,'Staff credential lapse detection and assignment evidence routed through URWS.'
where not exists(select 1 from public.hub_navigation where hub_id='admin' and component='AdminURWSWorkforceWorkspace');
update public.hub_navigation set path='/admin?view=urws-workforce',label='URWS Workforce',sort_order=184,is_active=true,description='Staff credential lapse detection and assignment evidence routed through URWS.' where hub_id='admin' and component='AdminURWSWorkforceWorkspace';
