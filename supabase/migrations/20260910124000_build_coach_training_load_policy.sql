create table if not exists public.coach_training_load_policies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  team_id uuid not null,
  coach_person_id uuid not null,
  short_window_days integer not null default 7 check (short_window_days between 3 and 21),
  long_window_days integer not null default 28 check (long_window_days between 14 and 90),
  high_ratio numeric(6,3) not null default 1.500 check (high_ratio > 1),
  low_ratio numeric(6,3) not null default 0.600 check (low_ratio > 0 and low_ratio < 1),
  min_logged_sessions integer not null default 4 check (min_logged_sessions between 1 and 30),
  enabled boolean not null default true,
  rationale text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (coach_person_id, team_id)
);
alter table public.coach_training_load_policies enable row level security;
drop policy if exists coach_training_load_policies_select on public.coach_training_load_policies;
create policy coach_training_load_policies_select on public.coach_training_load_policies for select using (app.can_access_coach_team(team_id) or app.is_superuser());
drop policy if exists coach_training_load_policies_write on public.coach_training_load_policies;
create policy coach_training_load_policies_write on public.coach_training_load_policies for all using ((coach_person_id=app.current_person_id() and app.can_access_coach_team(team_id)) or app.is_superuser()) with check ((coach_person_id=app.current_person_id() and app.can_access_coach_team(team_id)) or app.is_superuser());
comment on table public.coach_training_load_policies is 'Coach-owned monitoring thresholds for operational training-load change; never a medical diagnosis.';
