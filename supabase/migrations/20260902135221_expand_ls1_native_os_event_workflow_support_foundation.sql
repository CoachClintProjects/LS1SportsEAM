-- LS1Sports OS Phase 0: native LS1 package standard, event/workflow spine, support and client operations
create table if not exists public.ls1_package_specs (
  id uuid primary key default gen_random_uuid(), code text not null unique, name text not null, version text not null,
  media_type text not null default 'application/vnd.ls1.package+zip', schema_definition jsonb not null default '{}'::jsonb,
  compatibility jsonb not null default '{}'::jsonb, status text not null default 'active' check (status in ('draft','active','deprecated','retired')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.ls1_packages (
  id uuid primary key default gen_random_uuid(), tenant_id uuid references public.tenants(id) on delete cascade,
  spec_id uuid not null references public.ls1_package_specs(id), package_code text not null, package_name text not null,
  source_type text not null check (source_type in ('native','import','export','snapshot','validation')),
  lifecycle_status text not null default 'draft' check (lifecycle_status in ('draft','validated','published','superseded','archived','rejected')),
  checksum_sha256 text, storage_path text, manifest jsonb not null default '{}'::jsonb, provenance jsonb not null default '{}'::jsonb,
  created_by uuid references public.people(id), created_at timestamptz not null default now(), validated_at timestamptz, published_at timestamptz,
  unique (tenant_id, package_code)
);
create table if not exists public.ls1_package_entities (
  id uuid primary key default gen_random_uuid(), package_id uuid not null references public.ls1_packages(id) on delete cascade,
  entity_type text not null, entity_key text not null, canonical_table text, canonical_id uuid, payload jsonb not null default '{}'::jsonb,
  validation_status text not null default 'pending' check (validation_status in ('pending','valid','warning','error')),
  validation_messages jsonb not null default '[]'::jsonb, created_at timestamptz not null default now(),
  unique (package_id, entity_type, entity_key)
);
create table if not exists public.platform_events (
  id uuid primary key default gen_random_uuid(), tenant_id uuid references public.tenants(id) on delete cascade,
  event_type text not null, aggregate_type text not null, aggregate_id uuid, actor_person_id uuid references public.people(id),
  correlation_id uuid, causation_id uuid, payload jsonb not null default '{}'::jsonb, occurred_at timestamptz not null default now(),
  processed_at timestamptz, processing_status text not null default 'pending' check (processing_status in ('pending','processing','processed','failed','dead_letter'))
);
create table if not exists public.workflow_transition_history (
  id uuid primary key default gen_random_uuid(), workflow_instance_id uuid not null references public.workflow_instances(id) on delete cascade,
  from_state text, to_state text not null, transition_code text, actor_person_id uuid references public.people(id),
  reason text, metadata jsonb not null default '{}'::jsonb, occurred_at timestamptz not null default now()
);
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(), tenant_id uuid references public.tenants(id) on delete cascade,
  ticket_number bigint generated always as identity unique, title text not null, description text,
  category text not null default 'platform', severity text not null default 'normal' check (severity in ('low','normal','high','critical')),
  status text not null default 'open' check (status in ('open','triaged','in_progress','waiting','resolved','closed')),
  requester_person_id uuid references public.people(id), owner_person_id uuid references public.people(id),
  related_entity_type text, related_entity_id uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), resolved_at timestamptz
);
create table if not exists public.support_ticket_events (
  id uuid primary key default gen_random_uuid(), ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  event_type text not null, actor_person_id uuid references public.people(id), message text,
  metadata jsonb not null default '{}'::jsonb, occurred_at timestamptz not null default now()
);
create table if not exists public.client_health_snapshots (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
  health_score numeric(5,2) check (health_score between 0 and 100), status text not null check (status in ('healthy','watch','at_risk','critical','unknown')),
  signals jsonb not null default '{}'::jsonb, calculated_at timestamptz not null default now(), source text not null default 'system'
);
create index if not exists idx_platform_events_tenant_status on public.platform_events(tenant_id, processing_status, occurred_at);
create index if not exists idx_platform_events_aggregate on public.platform_events(aggregate_type, aggregate_id, occurred_at desc);
create index if not exists idx_ls1_packages_tenant_status on public.ls1_packages(tenant_id, lifecycle_status, created_at desc);
create index if not exists idx_ls1_package_entities_package_type on public.ls1_package_entities(package_id, entity_type);
create index if not exists idx_support_tickets_tenant_status on public.support_tickets(tenant_id, status, severity);
create index if not exists idx_client_health_snapshots_tenant_time on public.client_health_snapshots(tenant_id, calculated_at desc);
alter table public.ls1_package_specs enable row level security;
alter table public.ls1_packages enable row level security;
alter table public.ls1_package_entities enable row level security;
alter table public.platform_events enable row level security;
alter table public.workflow_transition_history enable row level security;
alter table public.support_tickets enable row level security;
alter table public.support_ticket_events enable row level security;
alter table public.client_health_snapshots enable row level security;
