-- Write-capable interaction foundation for Athlete and Family OS.
create table if not exists public.contracts (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid references public.tenants(id) on delete set null,
 organization_id uuid references public.organizations(id) on delete set null,
 athlete_id uuid references public.athletes(id) on delete set null,
 person_id uuid references public.people(id) on delete set null,
 contract_type text not null,
 title text not null,
 status text not null default 'draft',
 effective_on date,
 expires_on date,
 counterparty_name text,
 classification text not null default 'restricted',
 current_version integer not null default 1,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.contract_versions (
 id uuid primary key default gen_random_uuid(),
 contract_id uuid not null references public.contracts(id) on delete cascade,
 version_no integer not null,
 storage_path text,
 checksum text,
 terms jsonb not null default '{}'::jsonb,
 uploaded_by uuid references public.people(id) on delete set null,
 created_at timestamptz not null default now(),
 unique(contract_id,version_no)
);
create table if not exists public.athlete_reflections (
 id uuid primary key default gen_random_uuid(),
 athlete_id uuid not null references public.athletes(id) on delete cascade,
 reflection_type text not null default 'general',
 title text not null,
 body text,
 occurred_on date not null default current_date,
 visibility text not null default 'athlete',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists idx_contracts_athlete on public.contracts(athlete_id);
create index if not exists idx_reflections_athlete on public.athlete_reflections(athlete_id,occurred_on desc);
alter table public.contracts enable row level security;
alter table public.contract_versions enable row level security;
alter table public.athlete_reflections enable row level security;