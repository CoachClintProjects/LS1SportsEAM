create or replace view public.v_superuser_urws_authority_metrics as
select
 (select count(*) from public.platform_authority_grants g
   where g.resource_type='urws_case' and g.status='active'
     and g.valid_from<=now() and (g.valid_until is null or g.valid_until>=now())) as active_authority_grants,
 (select count(distinct g.subject_person_id) from public.platform_authority_grants g
   where g.resource_type='urws_case' and g.action='decide' and g.status='active'
     and g.valid_from<=now() and (g.valid_until is null or g.valid_until>=now())) as decision_authority_operators,
 (select count(distinct g.subject_person_id) from public.platform_authority_grants g
   where g.resource_type='urws_case' and g.action='approve_financial_remedy' and g.status='active'
     and g.valid_from<=now() and (g.valid_until is null or g.valid_until>=now())) as remedy_approval_operators,
 (select count(distinct g.subject_person_id) from public.platform_authority_grants g
   where g.resource_type='urws_case' and g.action='execute_financial_remedy' and g.status='active'
     and g.valid_from<=now() and (g.valid_until is null or g.valid_until>=now())) as financial_execution_operators,
 (select count(distinct r.organization_id) from public.urws_authority_rules r
   where r.organization_id is not null and r.action='decide_case' and r.active=true and r.requires_second_approval=true) as organizations_requiring_second_approval,
 (select count(*) from public.urws_authority_rules r
   where r.organization_id is not null and r.action='decide_case' and r.active=true) as organization_decision_rules,
 (select count(*) from public.platform_authority_grants g
   where g.resource_type='urws_case' and g.status='active' and g.valid_until>now() and g.valid_until<=now()+interval '30 days') as authority_grants_expiring_30d;

grant select on public.v_superuser_urws_authority_metrics to authenticated;

insert into public.platform_capability_registry(capability_key,capability_name,domain,criticality,system_of_record,status,description)
select 'urws_authority_control_plane','URWS Authority Control Plane','Governance','integral','Supabase','schema_ready',
 'Explicit organization-scoped authority grants for case decisions, financial-remedy approval and execution, plus governed second-approval policy configuration.'
where not exists(select 1 from public.platform_capability_registry where capability_key='urws_authority_control_plane');

update public.platform_capability_registry
set capability_name='URWS Authority Control Plane',domain='Governance',criticality='integral',system_of_record='Supabase',
 description='Explicit organization-scoped authority grants for case decisions, financial-remedy approval and execution, plus governed second-approval policy configuration.',updated_at=now()
where capability_key='urws_authority_control_plane';
