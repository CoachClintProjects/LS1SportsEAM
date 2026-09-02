-- Seed HPAC workflows, automations and AI event subscriptions
insert into public.workflow_definitions (tenant_id,code,name,version,definition,status)
select t.id,v.code,v.name,1,v.definition,'active'
from public.tenants t cross join (values
('ATHLETE_ONBOARDING','Athlete Onboarding',jsonb_build_object('stages',jsonb_build_array('identity','guardian-consent','eligibility','program-placement','activation'))),
('MEET_RESULT_RECONCILIATION','Meet Result Reconciliation',jsonb_build_object('stages',jsonb_build_array('ingest','parse','validate','reconcile','publish'))),
('SAFEGUARDING_ESCALATION','Safeguarding Escalation',jsonb_build_object('stages',jsonb_build_array('intake','triage','restricted-review','decision','closure'))),
('SUPPORT_CASE','Support Case Resolution',jsonb_build_object('stages',jsonb_build_array('intake','triage','investigate','resolve','verify')))
) v(code,name,definition)
where t.code='HPAC' and not exists (select 1 from public.workflow_definitions d where d.tenant_id=t.id and d.code=v.code);

insert into public.automation_definitions (tenant_id,code,name,description,trigger_definition,condition_definition,action_definition,retry_policy,concurrency_policy,enabled)
select t.id,v.code,v.name,v.description,v.trigger_definition,'{}'::jsonb,v.action_definition,jsonb_build_object('max_attempts',3,'backoff_seconds',30),jsonb_build_object('mode','idempotent'),true
from public.tenants t cross join (values
('ATHLETE_PROGRESS_REFRESH','Refresh athlete progression','Refresh age/skill projection after canonical athlete data changes',jsonb_build_object('event_pattern','athlete.*'),jsonb_build_object('handler','athlete_progress_refresh')),
('RESULT_RECONCILIATION','Reconcile competition results','Validate parsed result records before publication',jsonb_build_object('event_pattern','competition.result.*'),jsonb_build_object('handler','competition_reconcile')),
('DATA_QUALITY_TRIAGE','Triage data quality issues','Route high-confidence data issues for review',jsonb_build_object('event_pattern','data_quality.issue.created'),jsonb_build_object('handler','data_quality_triage')),
('SUPPORT_TRIAGE','Triage support tickets','Classify and route support cases without autonomous closure',jsonb_build_object('event_pattern','support.ticket.created'),jsonb_build_object('handler','support_triage'))
) v(code,name,description,trigger_definition,action_definition)
where t.code='HPAC' and not exists (select 1 from public.automation_definitions a where a.tenant_id=t.id and a.code=v.code);

insert into public.event_subscriptions (tenant_id,event_pattern,subscriber_type,subscriber_id,handler_key,enabled,configuration)
select t.id,'competition.import.completed','ai_agent',a.id,'competition_import_review',true,jsonb_build_object('approval_required',true) from public.tenants t join public.ai_agents a on a.code='COMPETITIONAI' where t.code='HPAC' and not exists (select 1 from public.event_subscriptions s where s.tenant_id=t.id and s.event_pattern='competition.import.completed' and s.handler_key='competition_import_review');
insert into public.event_subscriptions (tenant_id,event_pattern,subscriber_type,subscriber_id,handler_key,enabled,configuration)
select t.id,'data_quality.issue.created','ai_agent',a.id,'data_quality_review',true,jsonb_build_object('approval_required',true) from public.tenants t join public.ai_agents a on a.code='DATA_STEWARDAI' where t.code='HPAC' and not exists (select 1 from public.event_subscriptions s where s.tenant_id=t.id and s.event_pattern='data_quality.issue.created' and s.handler_key='data_quality_review');
insert into public.event_subscriptions (tenant_id,event_pattern,subscriber_type,subscriber_id,handler_key,enabled,configuration)
select t.id,'safeguarding.case.created','ai_agent',a.id,'safeguarding_assist',true,jsonb_build_object('approval_required',true,'autonomous_action',false) from public.tenants t join public.ai_agents a on a.code='COMPLIANCEAI' where t.code='HPAC' and not exists (select 1 from public.event_subscriptions s where s.tenant_id=t.id and s.event_pattern='safeguarding.case.created' and s.handler_key='safeguarding_assist');