create table if not exists public.urws_case_status_history (
 id uuid primary key default gen_random_uuid(), case_id uuid not null references public.urws_cases(id) on delete cascade, from_status text, to_status text not null, changed_by_person_id uuid, reason text, changed_at timestamptz not null default now(), metadata jsonb not null default '{}'::jsonb
);
create table if not exists public.urws_case_participants (
 id uuid primary key default gen_random_uuid(), case_id uuid not null references public.urws_cases(id) on delete cascade, person_id uuid not null, participant_role text not null, authority_scope text, visibility_scope text not null default 'standard', valid_from timestamptz not null default now(), valid_until timestamptz, metadata jsonb not null default '{}'::jsonb, unique(case_id, person_id, participant_role, valid_from)
);
create table if not exists public.urws_case_obligations (
 id uuid primary key default gen_random_uuid(), tenant_id uuid, organization_id uuid not null references public.organizations(id) on delete cascade, case_id uuid references public.urws_cases(id) on delete cascade, subject_type text not null, subject_id uuid, obligation_key text not null, obligation_type text not null, owner_person_id uuid, owner_role text, due_at timestamptz, status text not null default 'open' check (status in ('open','due_soon','overdue','satisfied','waived','cancelled')), satisfied_at timestamptz, satisfied_by_type text, satisfied_by_id uuid, source_policy_version_id uuid references public.urws_policy_versions(id), metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.urws_case_remedies (
 id uuid primary key default gen_random_uuid(), tenant_id uuid, organization_id uuid not null references public.organizations(id) on delete cascade, case_id uuid not null references public.urws_cases(id) on delete cascade, remedy_type text not null, status text not null default 'proposed' check (status in ('proposed','approved','declined','executing','completed','failed','cancelled')), amount numeric(12,2), currency char(3) default 'CAD', effective_at timestamptz, target_type text, target_id uuid, approved_by_person_id uuid, approved_at timestamptz, executed_by_person_id uuid, executed_at timestamptz, result_reference_type text, result_reference_id uuid, rationale text, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.urws_policy_evaluations (
 id uuid primary key default gen_random_uuid(), tenant_id uuid, organization_id uuid not null references public.organizations(id) on delete cascade, case_id uuid not null references public.urws_cases(id) on delete cascade, policy_version_id uuid not null references public.urws_policy_versions(id), evaluated_at timestamptz not null default now(), evaluator_type text not null default 'system', evaluator_person_id uuid, outcome text not null, matched_rules jsonb not null default '[]'::jsonb, failed_rules jsonb not null default '[]'::jsonb, calculations jsonb not null default '{}'::jsonb, evidence_snapshot jsonb not null default '[]'::jsonb, explanation text, supersedes_evaluation_id uuid references public.urws_policy_evaluations(id), created_at timestamptz not null default now()
);
create table if not exists public.urws_precedent_links (
 id uuid primary key default gen_random_uuid(), case_id uuid not null references public.urws_cases(id) on delete cascade, precedent_case_id uuid not null references public.urws_cases(id) on delete cascade, similarity_score numeric(5,4), similarity_basis jsonb not null default '{}'::jsonb, surfaced_at timestamptz not null default now(), surfaced_by text not null default 'system', dismissed_at timestamptz, metadata jsonb not null default '{}'::jsonb, check (case_id <> precedent_case_id), unique(case_id, precedent_case_id)
);
create table if not exists public.urws_external_recoveries (
 id uuid primary key default gen_random_uuid(), tenant_id uuid, organization_id uuid not null references public.organizations(id) on delete cascade, commitment_id uuid not null references public.urws_financial_commitments(id) on delete cascade, recovery_type text not null, counterparty_type text, counterparty_id uuid, amount numeric(12,2) not null check (amount >= 0), currency char(3) not null default 'CAD', status text not null default 'expected' check (status in ('expected','requested','approved','received','denied','written_off')), expected_at timestamptz, received_at timestamptz, payment_id uuid references public.payments(id), evidence jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.urws_case_communications (
 id uuid primary key default gen_random_uuid(), tenant_id uuid, organization_id uuid not null references public.organizations(id) on delete cascade, case_id uuid not null references public.urws_cases(id) on delete cascade, communication_type text not null, audience_type text not null, audience_id uuid, channel text, status text not null default 'prepared' check (status in ('prepared','approved','sent','delivered','failed','cancelled')), subject text, body_snapshot text, policy_disclaimer text, sent_at timestamptz, delivered_at timestamptz, source_type text, source_id uuid, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create index if not exists urws_case_status_history_case_idx on public.urws_case_status_history(case_id, changed_at desc);
create index if not exists urws_case_participants_case_idx on public.urws_case_participants(case_id, participant_role);
create index if not exists urws_case_obligations_status_due_idx on public.urws_case_obligations(status, due_at);
create index if not exists urws_case_remedies_case_idx on public.urws_case_remedies(case_id, status);
create index if not exists urws_policy_evaluations_case_idx on public.urws_policy_evaluations(case_id, evaluated_at desc);
create index if not exists urws_external_recoveries_commitment_idx on public.urws_external_recoveries(commitment_id, status);
create index if not exists urws_case_communications_case_idx on public.urws_case_communications(case_id, created_at desc);
alter table public.urws_case_status_history enable row level security;
alter table public.urws_case_participants enable row level security;
alter table public.urws_case_obligations enable row level security;
alter table public.urws_case_remedies enable row level security;
alter table public.urws_policy_evaluations enable row level security;
alter table public.urws_precedent_links enable row level security;
alter table public.urws_external_recoveries enable row level security;
alter table public.urws_case_communications enable row level security;
create policy urws_case_status_history_superuser on public.urws_case_status_history for all to authenticated using (app.is_superuser()) with check(app.is_superuser());
create policy urws_case_participants_superuser on public.urws_case_participants for all to authenticated using (app.is_superuser()) with check(app.is_superuser());
create policy urws_case_obligations_superuser on public.urws_case_obligations for all to authenticated using (app.is_superuser()) with check(app.is_superuser());
create policy urws_case_remedies_superuser on public.urws_case_remedies for all to authenticated using (app.is_superuser()) with check(app.is_superuser());
create policy urws_policy_evaluations_superuser on public.urws_policy_evaluations for all to authenticated using (app.is_superuser()) with check(app.is_superuser());
create policy urws_precedent_links_superuser on public.urws_precedent_links for all to authenticated using (app.is_superuser()) with check(app.is_superuser());
create policy urws_external_recoveries_superuser on public.urws_external_recoveries for all to authenticated using (app.is_superuser()) with check(app.is_superuser());
create policy urws_case_communications_superuser on public.urws_case_communications for all to authenticated using (app.is_superuser()) with check(app.is_superuser());
insert into public.urws_case_types(code,name,domain,description,sensitivity,default_owner_role) values
('membership_refund_dispute','Membership Refund Dispute','membership','Retroactive refund, cancellation, pause, or billing dispute tied to membership.','standard','admin'),
('membership_pause_exception','Membership Pause Exception','membership','Requested or approved pause outside normal membership policy.','restricted','admin'),
('billing_error','Billing Error','finance','Incorrect, duplicate, missing, or misapplied charge or payment.','standard','finance'),
('payment_failure','Payment Failure','finance','Failed or delinquent payment requiring recovery or exception handling.','standard','finance'),
('chargeback_dispute','Chargeback Dispute','finance','External payment dispute requiring evidence and financial response.','restricted','finance'),
('financial_hardship','Financial Hardship','finance','Confidential assistance, scholarship, installment, or hardship request.','restricted','finance'),
('competition_fee_dispute','Competition Fee Dispute','competition','Entry, scratch, host refund, no-show, or competition fee dispute.','standard','competition_admin'),
('competition_entry_exception','Competition Entry Exception','competition','Late entry, eligibility, event limit, scratch, relay, or host exception.','standard','competition_admin'),
('travel_commitment_exception','Travel Commitment Exception','travel','Irrecoverable or disputed travel commitment, withdrawal, or reimbursement issue.','standard','admin'),
('guardian_authority_dispute','Guardian Authority Dispute','family','Disagreement or restriction concerning who can authorize, cancel, pay, or receive information.','highly_restricted','admin'),
('registration_exception','Registration Exception','registration','Late, incomplete, duplicate, waitlist, capacity, or eligibility registration exception.','standard','registrar'),
('attendance_dispute','Attendance Dispute','operations','Disputed participation, missed service, or attendance-related exception.','standard','admin'),
('facility_disruption','Facility Disruption','facilities','Closure, reduced capacity, relocation, double booking, or service interruption.','standard','operations'),
('staff_compliance_lapse','Staff Compliance Lapse','workforce','Expired credential, background check, authorization, staffing, or access issue.','restricted','admin'),
('equipment_loss_damage','Equipment Loss or Damage','assets','Lost, damaged, unreturned, or disputed equipment and associated financial responsibility.','standard','operations'),
('safeguarding_report','Safeguarding Report','safeguarding','Controlled welfare, behavior, safety, or safeguarding report requiring restricted routing.','highly_restricted','safeguarding'),
('record_correction','Record Correction','governance','Material correction to athlete, result, registration, financial, guardian, or operational record.','standard','admin'),
('policy_exception','Policy Exception','governance','Authorized discretionary exception from an otherwise applicable organizational rule.','standard','admin'),
('service_failure','Expected Service Failure','operations','Something expected did not happen by the required time and needs escalation.','standard','operations'),
('organization_service_disruption','Organization Service Disruption','operations','Organization-caused cancellation or degradation that may require credits, refunds, or remediation.','standard','admin')
on conflict (code) do update set name=excluded.name,domain=excluded.domain,description=excluded.description,sensitivity=excluded.sensitivity,default_owner_role=excluded.default_owner_role,active=true;