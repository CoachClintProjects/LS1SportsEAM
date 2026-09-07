create table if not exists public.platform_implementation_gates (
  code text primary key,
  name text not null,
  description text not null,
  sort_order integer not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_milestone_gate_status (
  id uuid primary key default gen_random_uuid(),
  milestone_id uuid not null references public.platform_milestones(id) on delete cascade,
  gate_code text not null references public.platform_implementation_gates(code),
  passed boolean not null default false,
  status text not null default 'UNVERIFIED',
  evidence_source text,
  evidence_ref text,
  evidence jsonb not null default '{}'::jsonb,
  verified_at timestamptz,
  verified_by_person_id uuid references public.people(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (milestone_id, gate_code),
  check (status in ('UNVERIFIED','FAILED','PARTIAL','PASSED'))
);

create index if not exists platform_milestone_gate_status_milestone_idx on public.platform_milestone_gate_status(milestone_id);
create index if not exists platform_milestone_gate_status_gate_idx on public.platform_milestone_gate_status(gate_code);

insert into public.platform_implementation_gates(code,name,description,sort_order) values
 ('DB','DB','Required canonical schema/data model exists for the domain.',10),
 ('API','API','Server/service API contract exists for operational domain actions.',20),
 ('UI','UI','Role workspace renders real records and exposes required actions.',30),
 ('LIFECYCLE','Lifecycle writes','Create/change/lifecycle transactions persist with ERP-safe semantics.',40),
 ('AUTHORIZATION','Authorization','Authenticated identity, role, action, scope and record/field policy are enforced server-side.',50),
 ('AUDIT','Audit','Mutations and privileged actions create traceable audit evidence.',60),
 ('INTEGRATION','Integration','Cross-domain/external integration is wired and evidence-backed.',70),
 ('VALIDATION','Tests / validation','Positive, negative, persistence, regression and domain validation gates pass.',80)
on conflict (code) do update set name=excluded.name,description=excluded.description,sort_order=excluded.sort_order,is_active=true,updated_at=now();

insert into public.platform_milestone_gate_status(milestone_id,gate_code)
select m.id,g.code from public.platform_milestones m cross join public.platform_implementation_gates g
where g.is_active
on conflict (milestone_id,gate_code) do nothing;

-- Conservative re-baseline: only credit gates for which current database evidence is directly verifiable.
update public.platform_milestone_gate_status s
set passed=true,status='PASSED',evidence_source='Supabase schema inspection',evidence=jsonb_build_object('basis','canonical domain schema exists in production'),verified_at=now(),updated_at=now()
from public.platform_milestones m
where s.milestone_id=m.id and s.gate_code='DB' and m.code in ('M01','M02','M03','M04','M05','M06','M07','M08','M09','M10','M11','M12','M13');

-- Competition receives separate integration credit because the production source/import bridge and real result ingestion evidence exist.
update public.platform_milestone_gate_status s
set passed=true,status='PASSED',evidence_source='LS1Sports production competition import evidence',evidence=jsonb_build_object('competition_table_count',(select count(*) from information_schema.tables where table_schema='public' and (table_name like 'competition_%' or table_name like 'swim_%')),'competition_result_count',(select count(*) from public.competition_results),'import_file_count',(select count(*) from public.competition_import_files)),verified_at=now(),updated_at=now()
from public.platform_milestones m
where s.milestone_id=m.id and s.gate_code='INTEGRATION' and m.code='M11';

create or replace view public.v_platform_milestone_gate_progress as
select
  m.id as milestone_id,
  m.code,
  m.name,
  m.domain,
  count(s.id) filter (where g.is_active) as denominator,
  count(s.id) filter (where g.is_active and s.passed) as passed_gates,
  round(100.0 * count(s.id) filter (where g.is_active and s.passed) / nullif(count(s.id) filter (where g.is_active),0),2) as percent_complete,
  jsonb_agg(jsonb_build_object('code',g.code,'name',g.name,'sort_order',g.sort_order,'passed',s.passed,'status',s.status,'evidence_source',s.evidence_source,'evidence_ref',s.evidence_ref,'evidence',s.evidence,'verified_at',s.verified_at) order by g.sort_order) filter (where g.is_active) as gates
from public.platform_milestones m
join public.platform_milestone_gate_status s on s.milestone_id=m.id
join public.platform_implementation_gates g on g.code=s.gate_code
group by m.id,m.code,m.name,m.domain;

create table if not exists public.role_permission_definitions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  role_definition_id uuid not null references public.role_definitions(id) on delete cascade,
  permission_definition_id uuid not null references public.permission_definitions(id) on delete cascade,
  effect text not null default 'ALLOW' check (effect in ('ALLOW','DENY')),
  field_rules jsonb not null default '{}'::jsonb,
  conditions jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(role_definition_id,permission_definition_id,tenant_id)
);

create index if not exists role_permission_definitions_role_idx on public.role_permission_definitions(role_definition_id);
create index if not exists role_permission_definitions_permission_idx on public.role_permission_definitions(permission_definition_id);

-- Resource/action permissions used by the first protected ERP vertical slices.
insert into public.permission_definitions(tenant_id,code,name,resource,action,description,conditions,is_active)
select null,v.code,v.name,v.resource,v.action,v.description,'{}'::jsonb,true
from (values
 ('organizations.read','Read organizations','organizations','read','Read organization master records'),
 ('organizations.create','Create organizations','organizations','create','Create organization master records'),
 ('organizations.update','Update organizations','organizations','update','Change organization master records'),
 ('organizations.archive','Archive organizations','organizations','archive','Archive or restore organization master records'),
 ('admin_tasks.read','Read admin tasks','admin_tasks','read','Read ADMIN_TASK work items'),
 ('admin_tasks.create','Create admin tasks','admin_tasks','create','Create ADMIN_TASK work items'),
 ('admin_tasks.update','Update admin tasks','admin_tasks','update','Edit/complete/reopen ADMIN_TASK work items'),
 ('admin_tasks.delete','Delete admin tasks','admin_tasks','delete','Delete disposable ADMIN_TASK work items'),
 ('teams.read','Read teams','teams','read','Read team and squad master records'),
 ('teams.create','Create teams','teams','create','Create team and squad master records'),
 ('teams.update','Update teams','teams','update','Change team and squad master records'),
 ('teams.archive','Archive teams','teams','archive','Archive team and squad master records'),
 ('rosters.read','Read rosters','rosters','read','Read team roster memberships'),
 ('rosters.update','Manage rosters','rosters','update','Enroll, move and lifecycle roster memberships'),
 ('registrations.read','Read registrations','registrations','read','Read registration and eligibility records'),
 ('registrations.approve','Approve registrations','registrations','approve','Approve or reject registration eligibility'),
 ('attendance.read','Read attendance','attendance','read','Read practice and attendance records'),
 ('attendance.update','Manage attendance','attendance','update','Capture and correct attendance'),
 ('training.read','Read training','training','read','Read training plans and sessions'),
 ('training.update','Manage training','training','update','Create/change training plans and sessions'),
 ('communications.read','Read communications','communications','read','Read authorized team/family communications'),
 ('communications.send','Send communications','communications','send','Create and deliver authorized communications'),
 ('waivers.read','Read waivers','waivers','read','Read waiver/document compliance state'),
 ('waivers.update','Manage waivers','waivers','update','Assign and lifecycle waiver/document compliance'),
 ('competition_entries.read','Read competition entries','competition_entries','read','Read competition eligibility and entries'),
 ('competition_entries.update','Manage competition entries','competition_entries','update','Build and lifecycle competition entries')
) as v(code,name,resource,action,description)
where not exists (select 1 from public.permission_definitions p where p.tenant_id is null and p.code=v.code);

-- System SuperUser receives the protected vertical-slice permissions through DB configuration, not code constants.
insert into public.role_permission_definitions(role_definition_id,permission_definition_id,effect)
select r.id,p.id,'ALLOW'
from public.role_definitions r cross join public.permission_definitions p
where r.tenant_id is null and r.code='SYSTEM_SUPERUSER' and p.tenant_id is null and p.code in (
 'organizations.read','organizations.create','organizations.update','organizations.archive',
 'admin_tasks.read','admin_tasks.create','admin_tasks.update','admin_tasks.delete',
 'teams.read','teams.create','teams.update','teams.archive','rosters.read','rosters.update',
 'registrations.read','registrations.approve','attendance.read','attendance.update','training.read','training.update',
 'communications.read','communications.send','waivers.read','waivers.update','competition_entries.read','competition_entries.update')
and not exists (
 select 1 from public.role_permission_definitions x
 where x.role_definition_id=r.id and x.permission_definition_id=p.id and x.tenant_id is null
);

-- Team Manager is intentionally scoped to team operations. Organization-master and destructive admin privileges are not granted.
insert into public.role_permission_definitions(role_definition_id,permission_definition_id,effect)
select r.id,p.id,'ALLOW'
from public.role_definitions r cross join public.permission_definitions p
where r.tenant_id is null and r.code='TEAM_MANAGER' and p.tenant_id is null and p.code in (
 'teams.read','teams.create','teams.update','teams.archive','rosters.read','rosters.update',
 'registrations.read','attendance.read','attendance.update','training.read','training.update',
 'communications.read','communications.send','waivers.read','waivers.update','competition_entries.read','competition_entries.update')
and not exists (
 select 1 from public.role_permission_definitions x
 where x.role_definition_id=r.id and x.permission_definition_id=p.id and x.tenant_id is null
);
