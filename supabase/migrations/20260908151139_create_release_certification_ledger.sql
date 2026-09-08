create table if not exists public.platform_release_candidates (
  id uuid primary key default gen_random_uuid(),
  hub_id text not null,
  candidate_code text not null unique,
  branch_name text not null,
  commit_sha text not null,
  deployment_id text,
  deployment_url text,
  status text not null default 'DRAFT' check (status in ('DRAFT','BUILD_PENDING','BUILD_FAILED','DEPLOYED','CERTIFYING','CERTIFIED','REJECTED')),
  certification_notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  certified_at timestamptz,
  certified_by uuid,
  unique (hub_id, commit_sha)
);

create table if not exists public.platform_release_verifications (
  id uuid primary key default gen_random_uuid(),
  release_candidate_id uuid not null references public.platform_release_candidates(id) on delete cascade,
  test_key text not null,
  category text not null check (category in ('BUILD','ROUTE','LINK','WORKFLOW','READ','WRITE','AUTHN','AUTHZ','PERMISSION','AUDIT','VALIDATION','LIFECYCLE','DATABASE','RLS','SECURITY','INTEGRATION','BROWSER','RUNTIME','NEGATIVE','COMPETITION_TRUTH','DEPLOYMENT')),
  route_path text,
  workflow_key text,
  expected_result text not null,
  actual_result text,
  result text not null default 'NOT_RUN' check (result in ('NOT_RUN','PASS','FAIL','BLOCKED')),
  evidence jsonb not null default '{}'::jsonb,
  tested_by uuid,
  tested_at timestamptz,
  resolution_commit_sha text,
  retest_result text check (retest_result is null or retest_result in ('NOT_RUN','PASS','FAIL','BLOCKED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (release_candidate_id, test_key)
);

create table if not exists public.platform_release_defects (
  id uuid primary key default gen_random_uuid(),
  release_candidate_id uuid not null references public.platform_release_candidates(id) on delete cascade,
  verification_id uuid references public.platform_release_verifications(id) on delete set null,
  defect_key text not null,
  severity text not null check (severity in ('CRITICAL','HIGH','MEDIUM','LOW')),
  title text not null,
  description text,
  status text not null default 'OPEN' check (status in ('OPEN','IN_PROGRESS','RESOLVED','RETEST_REQUIRED','CLOSED')),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  occurrence_count integer not null default 1 check (occurrence_count > 0),
  resolution_commit_sha text,
  resolution_notes text,
  evidence jsonb not null default '{}'::jsonb,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (release_candidate_id, defect_key)
);

create index if not exists platform_release_candidates_hub_status_idx on public.platform_release_candidates(hub_id, status, created_at desc);
create index if not exists platform_release_verifications_candidate_result_idx on public.platform_release_verifications(release_candidate_id, result, category);
create index if not exists platform_release_defects_candidate_status_idx on public.platform_release_defects(release_candidate_id, status, severity);

alter table public.platform_release_candidates enable row level security;
alter table public.platform_release_verifications enable row level security;
alter table public.platform_release_defects enable row level security;

revoke all on public.platform_release_candidates from anon, authenticated;
revoke all on public.platform_release_verifications from anon, authenticated;
revoke all on public.platform_release_defects from anon, authenticated;

comment on table public.platform_release_candidates is 'Authoritative LS1Sports release-candidate identity and certification state. Exact SHA binding is mandatory.';
comment on table public.platform_release_verifications is 'Evidence ledger for release verification. Certification requires required checks to PASS.';
comment on table public.platform_release_defects is 'Normalized release defects linked to exact release candidates and verification evidence.';
