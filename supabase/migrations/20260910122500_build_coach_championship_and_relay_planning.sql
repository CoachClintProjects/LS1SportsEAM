create table if not exists public.coach_championship_targets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  organization_id uuid not null,
  team_id uuid not null,
  coach_person_id uuid not null,
  athlete_id uuid not null,
  competition_id uuid not null,
  event_code text not null,
  priority text not null default 'secondary' check (priority in ('primary','secondary','developmental')),
  target_type text not null default 'qualification' check (target_type in ('qualification','final','podium','placement','development')),
  target_standard_name text,
  target_time_ms integer,
  source_standard_id uuid references public.swim_time_standards(id) on delete set null,
  status text not null default 'active' check (status in ('active','achieved','missed','withdrawn','archived')),
  coach_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (coach_person_id, athlete_id, competition_id, event_code, target_type)
);
create index if not exists coach_championship_targets_team_idx on public.coach_championship_targets(team_id,competition_id,status);
create index if not exists coach_championship_targets_athlete_idx on public.coach_championship_targets(athlete_id,status);

create table if not exists public.coach_relay_scenarios (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  organization_id uuid not null,
  team_id uuid not null,
  coach_person_id uuid not null,
  competition_id uuid not null,
  competition_event_id uuid references public.competition_events(id) on delete cascade,
  name text not null,
  relay_type text,
  scenario_type text not null default 'candidate' check (scenario_type in ('candidate','preferred','alternate','final')),
  projected_time_ms integer,
  objective text,
  rationale jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft','approved','rejected','archived')),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists coach_relay_scenarios_comp_idx on public.coach_relay_scenarios(team_id,competition_id,status);

create table if not exists public.coach_relay_scenario_legs (
  id uuid primary key default gen_random_uuid(),
  relay_scenario_id uuid not null references public.coach_relay_scenarios(id) on delete cascade,
  leg_no integer not null check (leg_no between 1 and 8),
  athlete_id uuid not null,
  stroke_code text,
  projected_split_ms integer,
  source_result_id uuid references public.competition_results(id) on delete set null,
  rationale jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (relay_scenario_id, leg_no),
  unique (relay_scenario_id, athlete_id)
);

alter table public.coach_championship_targets enable row level security;
alter table public.coach_relay_scenarios enable row level security;
alter table public.coach_relay_scenario_legs enable row level security;

drop policy if exists coach_championship_targets_select on public.coach_championship_targets;
create policy coach_championship_targets_select on public.coach_championship_targets for select using (app.can_access_coach_team(team_id) or app.is_superuser());
drop policy if exists coach_championship_targets_write on public.coach_championship_targets;
create policy coach_championship_targets_write on public.coach_championship_targets for all using ((coach_person_id=app.current_person_id() and app.can_access_coach_team(team_id)) or app.is_superuser()) with check ((coach_person_id=app.current_person_id() and app.can_access_coach_team(team_id)) or app.is_superuser());

drop policy if exists coach_relay_scenarios_select on public.coach_relay_scenarios;
create policy coach_relay_scenarios_select on public.coach_relay_scenarios for select using (app.can_access_coach_team(team_id) or app.is_superuser());
drop policy if exists coach_relay_scenarios_write on public.coach_relay_scenarios;
create policy coach_relay_scenarios_write on public.coach_relay_scenarios for all using ((coach_person_id=app.current_person_id() and app.can_access_coach_team(team_id)) or app.is_superuser()) with check ((coach_person_id=app.current_person_id() and app.can_access_coach_team(team_id)) or app.is_superuser());

drop policy if exists coach_relay_scenario_legs_select on public.coach_relay_scenario_legs;
create policy coach_relay_scenario_legs_select on public.coach_relay_scenario_legs for select using (exists (select 1 from public.coach_relay_scenarios s where s.id=relay_scenario_id and (app.can_access_coach_team(s.team_id) or app.is_superuser())));
drop policy if exists coach_relay_scenario_legs_write on public.coach_relay_scenario_legs;
create policy coach_relay_scenario_legs_write on public.coach_relay_scenario_legs for all using (exists (select 1 from public.coach_relay_scenarios s where s.id=relay_scenario_id and ((s.coach_person_id=app.current_person_id() and app.can_access_coach_team(s.team_id)) or app.is_superuser()))) with check (exists (select 1 from public.coach_relay_scenarios s where s.id=relay_scenario_id and ((s.coach_person_id=app.current_person_id() and app.can_access_coach_team(s.team_id)) or app.is_superuser())));

comment on table public.coach_championship_targets is 'Coach-owned championship goals layered over canonical athlete, competition and standards truth.';
comment on table public.coach_relay_scenarios is 'Coach decision scenarios only; authoritative competition relay objects remain in swim_relays.';
