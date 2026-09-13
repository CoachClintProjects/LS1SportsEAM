insert into public.hub_navigation(hub_id,label,icon,path,component,sort_order,is_active,description)
select 'admin','URWS Decision Governance','ShieldCheck','/admin?view=urws-decision-governance','AdminURWSDecisionGovernanceWorkspace',181,true,'Governed URWS decision proposals, second approval, execution, and immutable decision evidence.'
where not exists(select 1 from public.hub_navigation where hub_id='admin' and component='AdminURWSDecisionGovernanceWorkspace');

update public.hub_navigation set path='/admin?view=urws-decision-governance',label='URWS Decision Governance',sort_order=181,is_active=true,description='Governed URWS decision proposals, second approval, execution, and immutable decision evidence.' where hub_id='admin' and component='AdminURWSDecisionGovernanceWorkspace';
