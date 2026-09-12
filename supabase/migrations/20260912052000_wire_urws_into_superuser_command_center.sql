insert into public.platform_capability_registry
(capability_key, capability_name, domain, criticality, system_of_record, status, description, updated_at)
values
('urws_exception_decision_engine','URWS Exception & Decision Engine','Platform','integral','urws_cases/urws_decisions','schema_ready','Cross-platform ugly real-world scenario case handling with policy outcome, human authority, evidence, precedent and auditable decisions.',now()),
('urws_policy_evidence_engine','URWS Policy & Evidence Engine','Governance','integral','urws_policy_versions/urws_policy_acceptances/urws_evidence_items','schema_ready','Versioned operational policy, acknowledgements and preserved decision evidence for consequential workflows.',now()),
('urws_financial_commitment_recovery','URWS Financial Commitment & Recovery','Finance','integral','urws_financial_commitments/urws_financial_recoveries','schema_ready','Tracks committed third-party and organizational costs, refundability, recoveries and unrecovered exposure separately from customer refunds.',now()),
('urws_expected_transition_overwatch','URWS Expected Transition Overwatch','Platform','integral','urws_expected_transitions/urws_event_rules','schema_ready','Detects expected events that fail to happen and canonical events that should open an exception case, without fabricating operational evidence.',now())
on conflict (capability_key) do update set
 capability_name=excluded.capability_name,
 domain=excluded.domain,
 criticality=excluded.criticality,
 system_of_record=excluded.system_of_record,
 status=excluded.status,
 description=excluded.description,
 updated_at=now();

create or replace view public.v_superuser_urws_metrics as
select
 (select count(*) from public.urws_cases where status not in ('resolved','closed','cancelled'))::bigint as open_cases,
 (select count(*) from public.urws_cases where status not in ('resolved','closed','cancelled') and priority in ('urgent','critical'))::bigint as urgent_or_critical_cases,
 coalesce((select sum(financial_impact) from public.urws_cases where status not in ('resolved','closed','cancelled')),0)::numeric as open_case_financial_impact,
 (select count(*) from public.urws_financial_commitments where status not in ('recovered','cancelled','void'))::bigint as open_financial_commitments,
 coalesce((select sum(greatest(amount-recovered_amount,0)) from public.urws_financial_commitments where status not in ('cancelled','void')),0)::numeric as unrecovered_commitment_amount,
 (select count(*) from public.urws_expected_transitions where status in ('overdue','escalated'))::bigint as overdue_expected_transitions,
 (select count(*) from public.urws_decisions where policy_overridden is true)::bigint as policy_override_decisions,
 (select count(*) from public.urws_event_rules where active is true)::bigint as enabled_detection_rules,
 (select count(*) from public.urws_case_types where active is true)::bigint as active_case_types,
 (select count(*) from public.urws_evidence_items)::bigint as evidence_items,
 (select count(*) from public.urws_decisions)::bigint as decisions,
 (select count(*) from public.urws_financial_recoveries)::bigint as financial_recoveries;

create or replace view public.v_superuser_core_metrics as
select
 (select count(*) from public.tenants where status='active') as active_tenants,
 (select count(*) from public.organizations where status='active') as active_organizations,
 (select count(*) from public.people where status='active') as people,
 (select count(*) from public.athletes where athlete_status='active') as athletes,
 (select count(*) from public.teams where status='active') as teams,
 (select count(*) from public.programs where status='active') as programs,
 (select count(*) from public.seasons where status in ('planned','active')) as seasons,
 (select count(*) from public.competitions where status not in ('cancelled','archived')) as competitions,
 (select count(*) from public.communication_threads where status='active') as active_threads,
 (select count(*) from public.data_quality_issues where status='open') as open_data_quality_issues,
 (select count(*) from public.safeguarding_cases where status='open') as open_safeguarding_cases,
 (select count(*) from public.integration_runs where status='failed') as failed_integrations,
 (select count(*) from public.workflow_tasks where status='pending') as pending_workflow_tasks,
 u.open_cases as urws_open_cases,
 u.urgent_or_critical_cases as urws_urgent_or_critical_cases,
 u.open_case_financial_impact as urws_open_case_financial_impact,
 u.unrecovered_commitment_amount as urws_unrecovered_commitment_amount,
 u.overdue_expected_transitions as urws_overdue_expected_transitions,
 u.policy_override_decisions as urws_policy_override_decisions
from public.v_superuser_urws_metrics u;
