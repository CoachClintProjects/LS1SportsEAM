insert into public.hub_navigation(hub_id,label,icon,path,component,sort_order,is_active,description)
select 'admin','URWS Cases','AlertTriangle','/admin?view=urws','AdminURWSWorkspace',180,true,'Policy-aware exception, evidence, decision, obligation, remedy, and audit workspace.'
where not exists(select 1 from public.hub_navigation where hub_id='admin' and component='AdminURWSWorkspace');

update public.hub_navigation set path='/admin?view=urws',label='URWS Cases',sort_order=180,is_active=true,description='Policy-aware exception, evidence, decision, obligation, remedy, and audit workspace.' where hub_id='admin' and component='AdminURWSWorkspace';
