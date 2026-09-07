create table if not exists public.waiver_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  waiver_id uuid not null references public.waivers(id) on delete restrict,
  person_id uuid not null references public.people(id) on delete cascade,
  athlete_id uuid references public.athletes(id) on delete cascade,
  registration_id uuid references public.registrations(id) on delete cascade,
  team_id uuid references public.teams(id) on delete cascade,
  status text not null default 'assigned',
  assigned_by uuid references public.people(id),
  assigned_at timestamptz not null default now(),
  due_at timestamptz,
  completed_at timestamptz,
  waived_at timestamptz,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status in ('assigned','pending','completed','waived','expired','revoked'))
);
create index if not exists waiver_assignments_org_status_idx on public.waiver_assignments(organization_id,status);
create index if not exists waiver_assignments_person_idx on public.waiver_assignments(person_id);
create index if not exists waiver_assignments_athlete_idx on public.waiver_assignments(athlete_id);
create index if not exists waiver_assignments_registration_idx on public.waiver_assignments(registration_id);
create index if not exists waiver_assignments_team_idx on public.waiver_assignments(team_id);
create unique index if not exists waiver_assignments_open_unique_idx on public.waiver_assignments(waiver_id,person_id,coalesce(team_id,'00000000-0000-0000-0000-000000000000'::uuid),coalesce(registration_id,'00000000-0000-0000-0000-000000000000'::uuid)) where status in ('assigned','pending');
