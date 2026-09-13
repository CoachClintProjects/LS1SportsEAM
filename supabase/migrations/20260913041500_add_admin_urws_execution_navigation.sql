insert into public.hub_navigation(hub_id,label,icon,path,component,sort_order,is_active,description)
select 'admin','URWS Financial Execution','WalletCards','/admin?view=urws-financial-execution','AdminURWSExecutionWorkspace',181,true,'Execute authorized URWS financial remedies without conflating approval with completion.'
where not exists(select 1 from public.hub_navigation where hub_id='admin' and path='/admin?view=urws-financial-execution');
