create table if not exists public.competition_entry_assurance (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  competition_id uuid not null references public.competitions(id) on delete cascade,
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  entry_state text not null default 'not_prepared' check (entry_state in ('not_prepared','prepared','submitted','verified','rejected','scratched')),
  clearance_state text not null default 'not_cleared' check (clearance_state in ('not_cleared','cleared','manual_override')),
  submission_artifact_id uuid references public.competition_source_artifacts(id) on delete set null,
  external_reference text,
  submitted_at timestamptz,
  verified_at timestamptz,
  verification_method text,
  evidence jsonb not null default '{}'::jsonb,
  mismatch_code text,
  mismatch_detail text,
  last_reconciled_at timestamptz,
  manual_override_reason text,
  manual_override_by uuid references public.people(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (competition_id, athlete_id),
  check (clearance_state <> 'cleared' or entry_state = 'verified'),
  check (clearance_state <> 'manual_override' or manual_override_reason is not null)
);
create index if not exists idx_comp_entry_assurance_competition on public.competition_entry_assurance(competition_id, entry_state, clearance_state);
create index if not exists idx_comp_entry_assurance_athlete on public.competition_entry_assurance(athlete_id);

create table if not exists public.competition_communication_attempts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  competition_id uuid not null references public.competitions(id) on delete cascade,
  athlete_id uuid references public.athletes(id) on delete cascade,
  recipient_person_id uuid references public.people(id) on delete set null,
  participation_response_id uuid references public.competition_participation_responses(id) on delete set null,
  channel text not null check (channel in ('in_app','email','sms','phone','push')),
  purpose text not null,
  destination_hint text,
  delivery_state text not null default 'queued' check (delivery_state in ('queued','accepted','delivered','read','failed','bounced','cancelled','manual_contact_required')),
  provider_reference text,
  provider_response jsonb not null default '{}'::jsonb,
  attempted_at timestamptz not null default now(),
  accepted_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  failed_at timestamptz,
  failure_reason text,
  created_at timestamptz not null default now()
);
create index if not exists idx_comp_comm_attempts_competition on public.competition_communication_attempts(competition_id, delivery_state, attempted_at desc);
create index if not exists idx_comp_comm_attempts_response on public.competition_communication_attempts(participation_response_id, attempted_at desc);

alter table public.competition_entry_assurance enable row level security;
alter table public.competition_communication_attempts enable row level security;

drop policy if exists admin_competition_entry_assurance_select on public.competition_entry_assurance;
create policy admin_competition_entry_assurance_select on public.competition_entry_assurance for select to authenticated using (app.is_superuser() or (app.is_admin() and tenant_id in (select app.current_tenant_ids())));
drop policy if exists admin_competition_entry_assurance_write on public.competition_entry_assurance;
create policy admin_competition_entry_assurance_write on public.competition_entry_assurance for all to authenticated using (app.is_superuser() or (app.is_admin() and tenant_id in (select app.current_tenant_ids()))) with check (app.is_superuser() or (app.is_admin() and tenant_id in (select app.current_tenant_ids())));
drop policy if exists admin_competition_communication_attempts_select on public.competition_communication_attempts;
create policy admin_competition_communication_attempts_select on public.competition_communication_attempts for select to authenticated using (app.is_superuser() or (app.is_admin() and tenant_id in (select app.current_tenant_ids())));
drop policy if exists admin_competition_communication_attempts_write on public.competition_communication_attempts;
create policy admin_competition_communication_attempts_write on public.competition_communication_attempts for insert to authenticated with check (app.is_superuser() or (app.is_admin() and tenant_id in (select app.current_tenant_ids())));

grant select,insert,update on public.competition_entry_assurance to authenticated;
grant select,insert on public.competition_communication_attempts to authenticated;
