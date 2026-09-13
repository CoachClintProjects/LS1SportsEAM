insert into public.hub_navigation(hub_id,label,icon,path,component,sort_order,is_active,description)
select 'admin','URWS Travel','Route','/admin?view=urws-travel','AdminURWSTravelWorkspace',182,true,'Travel commitment exception intake routed through URWS without inventing financial commitments.'
where not exists(select 1 from public.hub_navigation where hub_id='admin' and component='AdminURWSTravelWorkspace');
update public.hub_navigation set path='/admin?view=urws-travel',label='URWS Travel',sort_order=182,is_active=true,description='Travel commitment exception intake routed through URWS without inventing financial commitments.' where hub_id='admin' and component='AdminURWSTravelWorkspace';
