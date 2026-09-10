-- LS1Sports Coach Operating System foundation
-- Coach decides. ERP executes. Agents watch.

create table if not exists public.coach_access_assignments (
 id uuid primary key default gen_random_uuid(), tenant_id uuid, organization_id uuid not null references public.organizations(id) on delete cascade,
 coach_person_id uuid not null references public.people(id) on delete cascade, team_id uuid references public.teams(id) on delete cascade,
 program_id uuid references public.programs(id) on delete cascade, role_key text not null default 'coach', is_head_coach boolean not null default false,
 status text not null default 'active', starts_on date, ends_on date, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists coach_access_assignments_person_idx on public.coach_access_assignments(coach_person_id,status);

create table if not exists public.coach_methodologies (
 id uuid primary key default gen_random_uuid(), coach_person_id uuid not null references public.people(id) on delete cascade,
 organization_id uuid references public.organizations(id) on delete cascade, sport_id uuid references public.sports(id) on delete cascade,
 name text not null, philosophy text, training_philosophy jsonb not null default '{}'::jsonb, periodization_preferences jsonb not null default '{}'::jsonb,
 communication_preferences jsonb not null default '{}'::jsonb, development_philosophy jsonb not null default '{}'::jsonb,
 competition_philosophy jsonb not null default '{}'::jsonb, hard_constraints jsonb not null default '{}'::jsonb,
 learned_preferences jsonb not null default '{}'::jsonb, version integer not null default 1, status text not null default 'draft',
 approved_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.coach_season_plans (
 id uuid primary key default gen_random_uuid(), coach_person_id uuid not null references public.people(id) on delete restrict,
 organization_id uuid not null references public.organizations(id) on delete cascade, team_id uuid references public.teams(id) on delete cascade,
 season_id uuid references public.seasons(id) on delete cascade, sport_id uuid references public.sports(id) on delete cascade,
 methodology_id uuid references public.coach_methodologies(id) on delete set null, name text not null, starts_on date not null, ends_on date not null,
 primary_competition_id uuid references public.competitions(id) on delete set null, goals jsonb not null default '[]'::jsonb,
 constraints jsonb not null default '{}'::jsonb, status text not null default 'draft', approval_status text not null default 'coach_review',
 created_by_agent boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check(ends_on>=starts_on)
);

create table if not exists public.coach_training_cycles (
 id uuid primary key default gen_random_uuid(), season_plan_id uuid not null references public.coach_season_plans(id) on delete cascade,
 parent_cycle_id uuid references public.coach_training_cycles(id) on delete cascade,
 cycle_type text not null check(cycle_type in ('macrocycle','mesocycle','microcycle','week','block')), name text not null,
 starts_on date not null, ends_on date not null, objective text, load_target numeric, phase text, definition jsonb not null default '{}'::jsonb,
 sort_order integer not null default 0, status text not null default 'draft', created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check(ends_on>=starts_on)
);

create table if not exists public.coach_session_blocks (
 id uuid primary key default gen_random_uuid(), training_session_id uuid not null references public.training_sessions(id) on delete cascade,
 parent_block_id uuid references public.coach_session_blocks(id) on delete cascade, block_type text not null, title text not null, objective text,
 duration_minutes numeric, distance numeric, distance_unit text, intensity text, interval_definition jsonb not null default '{}'::jsonb,
 equipment jsonb not null default '[]'::jsonb, drill_definition jsonb not null default '{}'::jsonb, sort_order integer not null default 0,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.coach_athlete_session_modifications (
 id uuid primary key default gen_random_uuid(), training_session_id uuid not null references public.training_sessions(id) on delete cascade,
 athlete_id uuid not null references public.athletes(id) on delete cascade, coach_person_id uuid not null references public.people(id) on delete restrict,
 modification_type text not null, reason text, definition jsonb not null default '{}'::jsonb, visibility text not null default 'coach_staff',
 status text not null default 'active', created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(training_session_id,athlete_id,modification_type)
);

create table if not exists public.coach_attention_items (
 id uuid primary key default gen_random_uuid(), tenant_id uuid, organization_id uuid references public.organizations(id) on delete cascade,
 coach_person_id uuid not null references public.people(id) on delete cascade, team_id uuid references public.teams(id) on delete cascade,
 athlete_id uuid references public.athletes(id) on delete cascade, competition_id uuid references public.competitions(id) on delete cascade,
 category text not null, horizon text not null check(horizon in ('now','soon','watch','fyi')), title text not null, summary text,
 severity text not null default 'normal', source_type text not null, source_id uuid, due_at timestamptz, requires_human_judgment boolean not null default false,
 status text not null default 'open', resolved_at timestamptz, resolution_note text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists coach_attention_open_idx on public.coach_attention_items(coach_person_id,status,horizon,due_at);

create table if not exists public.coach_agent_policies (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 coach_person_id uuid references public.people(id) on delete cascade, agent_key text not null, action_class text not null,
 autonomy_level text not null check(autonomy_level in ('observe','recommend','prepare','execute')), requires_approval boolean not null default true,
 minor_restriction text, policy jsonb not null default '{}'::jsonb, status text not null default 'active', created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(organization_id,coach_person_id,agent_key,action_class)
);

create table if not exists public.coach_agent_proposals (
 id uuid primary key default gen_random_uuid(), tenant_id uuid, organization_id uuid not null references public.organizations(id) on delete cascade,
 coach_person_id uuid not null references public.people(id) on delete cascade, agent_key text not null, proposal_type text not null,
 autonomy_level text not null check(autonomy_level in ('observe','recommend','prepare','execute')), subject_type text, subject_id uuid,
 proposal jsonb not null, rationale jsonb not null default '{}'::jsonb, source_evidence jsonb not null default '[]'::jsonb,
 status text not null default 'proposed', reviewed_at timestamptz, reviewed_by_person_id uuid references public.people(id) on delete set null,
 decision_note text, executed_at timestamptz, created_at timestamptz not null default now()
);
create index if not exists coach_agent_proposals_queue_idx on public.coach_agent_proposals(coach_person_id,status,created_at desc);

create table if not exists public.coach_notes (
 id uuid primary key default gen_random_uuid(), organization_id uuid references public.organizations(id) on delete cascade,
 coach_person_id uuid not null references public.people(id) on delete restrict, athlete_id uuid references public.athletes(id) on delete cascade,
 team_id uuid references public.teams(id) on delete cascade, competition_id uuid references public.competitions(id) on delete cascade,
 training_session_id uuid references public.training_sessions(id) on delete cascade, note_type text not null,
 visibility text not null check(visibility in ('private','coach_staff','team_staff','athlete','parent','administrative')),
 body text not null, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.coach_competition_candidates (
 id uuid primary key default gen_random_uuid(), tenant_id uuid, organization_id uuid references public.organizations(id) on delete cascade,
 sport_id uuid references public.sports(id) on delete cascade, source_name text not null, source_url text, source_record_key text,
 name text not null, starts_at timestamptz, ends_at timestamptz, city text, region text, country_code char(2), course text,
 sanctioning_body text, sanction_number text, entry_deadline timestamptz, scratch_deadline timestamptz,
 qualifying_standard_source text, discovered_payload jsonb not null default '{}'::jsonb, validation_status text not null default 'candidate',
 canonical_competition_id uuid references public.competitions(id) on delete set null, reviewed_by_person_id uuid references public.people(id) on delete set null,
 reviewed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(source_name,source_record_key)
);

create table if not exists public.coach_competition_debriefs (
 id uuid primary key default gen_random_uuid(), competition_id uuid not null references public.competitions(id) on delete cascade,
 coach_person_id uuid not null references public.people(id) on delete restrict, team_id uuid references public.teams(id) on delete cascade,
 athlete_id uuid references public.athletes(id) on delete cascade, summary text, what_worked text, what_changed text, development_implications text,
 training_adjustments jsonb not null default '[]'::jsonb, evidence jsonb not null default '[]'::jsonb, status text not null default 'draft',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.coach_community_resources (
 id uuid primary key default gen_random_uuid(), creator_person_id uuid not null references public.people(id) on delete restrict,
 organization_id uuid references public.organizations(id) on delete cascade, sport_id uuid references public.sports(id) on delete set null,
 resource_type text not null, title text not null, body text, age_range jsonb not null default '{}'::jsonb, skill_level text, objective text,
 duration_minutes numeric, equipment jsonb not null default '[]'::jsonb, adaptations jsonb not null default '[]'::jsonb,
 provenance jsonb not null default '{}'::jsonb, visibility text not null default 'organization', status text not null default 'draft',
 published_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.coach_community_ratings (
 id uuid primary key default gen_random_uuid(), resource_id uuid not null references public.coach_community_resources(id) on delete cascade,
 person_id uuid not null references public.people(id) on delete cascade, rating integer not null check(rating between 1 and 5), note text,
 created_at timestamptz not null default now(), unique(resource_id,person_id)
);

create table if not exists public.coach_decision_log (
 id uuid primary key default gen_random_uuid(), tenant_id uuid, organization_id uuid references public.organizations(id) on delete set null,
 coach_person_id uuid references public.people(id) on delete set null, action text not null, entity_type text not null, entity_id uuid,
 decision text, before_data jsonb, after_data jsonb, reason text, source text not null default 'coach_hub', created_at timestamptz not null default now()
);

alter table public.coach_access_assignments enable row level security;
alter table public.coach_methodologies enable row level security;
alter table public.coach_season_plans enable row level security;
alter table public.coach_training_cycles enable row level security;
alter table public.coach_session_blocks enable row level security;
alter table public.coach_athlete_session_modifications enable row level security;
alter table public.coach_attention_items enable row level security;
alter table public.coach_agent_policies enable row level security;
alter table public.coach_agent_proposals enable row level security;
alter table public.coach_notes enable row level security;
alter table public.coach_competition_candidates enable row level security;
alter table public.coach_competition_debriefs enable row level security;
alter table public.coach_community_resources enable row level security;
alter table public.coach_community_ratings enable row level security;
alter table public.coach_decision_log enable row level security;

create or replace function app.can_access_coach_org(p_organization_id uuid) returns boolean language sql stable security definer set search_path=public,app as $$
 select app.is_superuser() or exists(select 1 from public.coach_access_assignments ca where ca.coach_person_id=app.current_person_id() and ca.organization_id=p_organization_id and lower(ca.status)='active' and (ca.starts_on is null or ca.starts_on<=current_date) and (ca.ends_on is null or ca.ends_on>=current_date));
$$;
create or replace function app.can_access_coach_team(p_team_id uuid) returns boolean language sql stable security definer set search_path=public,app as $$
 select app.is_superuser() or exists(select 1 from public.coach_access_assignments ca where ca.coach_person_id=app.current_person_id() and ca.team_id=p_team_id and lower(ca.status)='active' and (ca.starts_on is null or ca.starts_on<=current_date) and (ca.ends_on is null or ca.ends_on>=current_date));
$$;
grant execute on function app.can_access_coach_org(uuid) to authenticated;
grant execute on function app.can_access_coach_team(uuid) to authenticated;

create policy coach_access_assignments_read on public.coach_access_assignments for select to authenticated using(app.is_superuser() or coach_person_id=app.current_person_id());
create policy coach_methodologies_manage on public.coach_methodologies for all to authenticated using(app.is_superuser() or coach_person_id=app.current_person_id()) with check(app.is_superuser() or coach_person_id=app.current_person_id());
create policy coach_season_plans_manage on public.coach_season_plans for all to authenticated using(app.is_superuser() or coach_person_id=app.current_person_id()) with check(app.is_superuser() or coach_person_id=app.current_person_id());
create policy coach_training_cycles_manage on public.coach_training_cycles for all to authenticated using(app.is_superuser() or exists(select 1 from public.coach_season_plans sp where sp.id=season_plan_id and sp.coach_person_id=app.current_person_id())) with check(app.is_superuser() or exists(select 1 from public.coach_season_plans sp where sp.id=season_plan_id and sp.coach_person_id=app.current_person_id()));
create policy coach_session_blocks_manage on public.coach_session_blocks for all to authenticated using(app.is_superuser() or exists(select 1 from public.training_sessions ts join public.training_plans tp on tp.id=ts.training_plan_id where ts.id=training_session_id and app.can_access_coach_team(tp.team_id))) with check(app.is_superuser() or exists(select 1 from public.training_sessions ts join public.training_plans tp on tp.id=ts.training_plan_id where ts.id=training_session_id and app.can_access_coach_team(tp.team_id)));
create policy coach_athlete_session_modifications_manage on public.coach_athlete_session_modifications for all to authenticated using(app.is_superuser() or coach_person_id=app.current_person_id()) with check(app.is_superuser() or coach_person_id=app.current_person_id());
create policy coach_attention_items_manage on public.coach_attention_items for all to authenticated using(app.is_superuser() or coach_person_id=app.current_person_id()) with check(app.is_superuser() or coach_person_id=app.current_person_id());
create policy coach_agent_policies_read on public.coach_agent_policies for select to authenticated using(app.is_superuser() or coach_person_id=app.current_person_id() or (coach_person_id is null and app.can_access_coach_org(organization_id)));
create policy coach_agent_proposals_manage on public.coach_agent_proposals for all to authenticated using(app.is_superuser() or coach_person_id=app.current_person_id()) with check(app.is_superuser() or coach_person_id=app.current_person_id());
create policy coach_notes_manage on public.coach_notes for all to authenticated using(app.is_superuser() or coach_person_id=app.current_person_id()) with check(app.is_superuser() or coach_person_id=app.current_person_id());
create policy coach_competition_candidates_manage on public.coach_competition_candidates for all to authenticated using(app.is_superuser() or (organization_id is not null and app.can_access_coach_org(organization_id))) with check(app.is_superuser() or (organization_id is not null and app.can_access_coach_org(organization_id)));
create policy coach_competition_debriefs_manage on public.coach_competition_debriefs for all to authenticated using(app.is_superuser() or coach_person_id=app.current_person_id()) with check(app.is_superuser() or coach_person_id=app.current_person_id());
create policy coach_community_resources_read on public.coach_community_resources for select to authenticated using(app.is_superuser() or creator_person_id=app.current_person_id() or visibility='public' or (organization_id is not null and app.can_access_coach_org(organization_id)));
create policy coach_community_resources_manage on public.coach_community_resources for insert to authenticated with check(app.is_superuser() or creator_person_id=app.current_person_id());
create policy coach_community_resources_update on public.coach_community_resources for update to authenticated using(app.is_superuser() or creator_person_id=app.current_person_id()) with check(app.is_superuser() or creator_person_id=app.current_person_id());
create policy coach_community_ratings_manage on public.coach_community_ratings for all to authenticated using(app.is_superuser() or person_id=app.current_person_id()) with check(app.is_superuser() or person_id=app.current_person_id());
create policy coach_decision_log_read on public.coach_decision_log for select to authenticated using(app.is_superuser() or coach_person_id=app.current_person_id() or (organization_id is not null and app.can_access_coach_org(organization_id)));
create policy coach_decision_log_insert on public.coach_decision_log for insert to authenticated with check(app.is_superuser() or coach_person_id=app.current_person_id());
revoke update,delete on public.coach_decision_log from authenticated;

update public.platform_capability_registry set status='schema_ready',updated_at=now() where capability_key='coach_decision_engine';
