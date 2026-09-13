create table if not exists public.urws_financial_dispositions (
 id uuid primary key default gen_random_uuid(), tenant_id uuid, organization_id uuid not null references public.organizations(id) on delete cascade,
 case_id uuid not null references public.urws_cases(id) on delete cascade, decision_id uuid references public.urws_decisions(id) on delete set null, remedy_id uuid references public.urws_remedies(id) on delete set null,
 disposition_type text not null check (disposition_type in ('refund','credit','fee_waiver','organization_absorbed','family_charge','transfer','write_off','payment_plan','service_credit','operational_correction','other')),
 amount numeric(12,2) check (amount is null or amount>=0), currency char(3) not null default 'CAD', status text not null default 'authorized' check (status in ('authorized','executing','completed','failed','cancelled')),
 invoice_id uuid references public.invoices(id) on delete set null, payment_id uuid references public.payments(id) on delete set null, refund_id uuid references public.refunds(id) on delete set null,
 external_reference text, execution_note text, authorized_at timestamptz not null default now(), execution_started_at timestamptz, completed_at timestamptz, failed_at timestamptz,
 executed_by_person_id uuid, executed_by_auth_user_id uuid, executed_by_operator_id uuid references public.platform_superuser_operators(id) on delete set null,
 metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check (executed_by_person_id is not null or executed_by_auth_user_id is not null or executed_by_operator_id is not null or status='authorized')
);
create index if not exists urws_financial_dispositions_case_idx on public.urws_financial_dispositions(case_id,status,created_at desc);
create index if not exists urws_financial_dispositions_remedy_idx on public.urws_financial_dispositions(remedy_id) where remedy_id is not null;
create unique index if not exists urws_financial_dispositions_refund_uidx on public.urws_financial_dispositions(refund_id) where refund_id is not null;
alter table public.urws_financial_dispositions enable row level security;
do $$ begin if not exists(select 1 from pg_policies where schemaname='public' and tablename='urws_financial_dispositions' and policyname='urws_financial_dispositions_superuser') then create policy urws_financial_dispositions_superuser on public.urws_financial_dispositions for all using (app.is_superuser()) with check (app.is_superuser()); end if; end $$;

-- Execution is deliberately separate from authorization. A remedy may be approved without being completed.
-- public.urws_begin_financial_execution requires execute_financial_remedy authority and, for refunds, a canonical refunds record.
-- public.urws_complete_financial_execution refuses to complete a refund until refunds.status is processed/completed/succeeded/refunded and processed_at is populated.
-- Both functions stamp authenticated actor identity, update remedy execution state, and emit platform_event_outbox events.

grant select on public.urws_financial_dispositions to authenticated;
