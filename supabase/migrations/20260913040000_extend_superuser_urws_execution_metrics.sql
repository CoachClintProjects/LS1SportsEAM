create or replace view public.v_superuser_urws_metrics as
select
 (select count(*) from public.urws_cases where status not in ('resolved','closed','cancelled')) as open_cases,
 (select count(*) from public.urws_cases where status not in ('resolved','closed','cancelled') and priority in ('urgent','critical')) as urgent_or_critical_cases,
 coalesce((select sum(financial_impact) from public.urws_cases where status not in ('resolved','closed','cancelled')),0) as open_case_financial_impact,
 (select count(*) from public.urws_financial_commitments where status not in ('recovered','cancelled','void')) as open_financial_commitments,
 coalesce((select sum(greatest(amount-recovered_amount,0)) from public.urws_financial_commitments where status not in ('cancelled','void')),0) as unrecovered_commitment_amount,
 (select count(*) from public.urws_expected_transitions where status in ('overdue','escalated')) as overdue_expected_transitions,
 (select count(*) from public.urws_decisions where policy_overridden is true) as policy_override_decisions,
 (select count(*) from public.urws_event_rules where active is true) as enabled_detection_rules,
 (select count(*) from public.urws_case_types where active is true) as active_case_types,
 (select count(*) from public.urws_evidence_items) as evidence_items,
 (select count(*) from public.urws_decisions) as decisions,
 (select count(*) from public.urws_financial_recoveries) as financial_recoveries,
 (select count(*) from public.urws_remedies where status='approved') as approved_remedies_awaiting_execution,
 (select count(*) from public.urws_financial_dispositions where status='executing') as financial_executions_in_progress,
 (select count(*) from public.urws_financial_dispositions where status='failed') as failed_financial_executions,
 (select count(*) from public.urws_financial_dispositions where status='completed') as completed_financial_dispositions,
 coalesce((select sum(amount) from public.urws_financial_dispositions where status in ('authorized','executing') and amount is not null),0) as financial_amount_awaiting_completion,
 (select count(*) from public.refund_requests where status='approved' and resulting_refund_id is null) as approved_refund_requests_not_executed;

-- v_superuser_core_metrics is extended in the live migration with the URWS execution fields above.
