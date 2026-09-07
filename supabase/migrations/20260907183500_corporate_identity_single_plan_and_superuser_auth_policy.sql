-- LS1Sports corporate identity, single-plan commercial model, and SuperUser auth policy.
-- Public website copy/configuration lives in the database. The React layer renders it.

create table if not exists public.corporate_site_config (
  key text primary key,
  value jsonb not null,
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.corporate_navigation (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null,
  href text not null,
  sort_order integer not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.corporate_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  eyebrow text,
  title text not null,
  summary text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.corporate_page_sections (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.corporate_pages(id) on delete cascade,
  code text not null,
  section_type text not null default 'CONTENT',
  eyebrow text,
  title text,
  body text,
  items jsonb not null default '[]'::jsonb,
  primary_action jsonb,
  secondary_action jsonb,
  sort_order integer not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(page_id, code)
);

create table if not exists public.corporate_pricing_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  price_amount numeric(12,2),
  currency text,
  billing_period text,
  price_label text,
  description text,
  all_features_enabled boolean not null default true,
  cta_label text not null,
  cta_href text not null,
  sort_order integer not null default 10,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.corporate_plan_feature_statements (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.corporate_pricing_plans(id) on delete cascade,
  statement text not null,
  sort_order integer not null,
  is_active boolean not null default true,
  unique(plan_id, sort_order)
);

create table if not exists public.platform_auth_configuration (
  code text primary key,
  sso_enabled boolean not null default false,
  sso_domain text,
  magic_link_enabled boolean not null default true,
  require_mfa boolean not null default true,
  required_aal text not null default 'aal2',
  session_max_age_seconds integer not null default 3600,
  is_active boolean not null default true,
  updated_at timestamptz not null default now(),
  check (required_aal in ('aal1','aal2')),
  check (session_max_age_seconds between 300 and 86400)
);

alter table public.corporate_site_config enable row level security;
alter table public.corporate_navigation enable row level security;
alter table public.corporate_pages enable row level security;
alter table public.corporate_page_sections enable row level security;
alter table public.corporate_pricing_plans enable row level security;
alter table public.corporate_plan_feature_statements enable row level security;
alter table public.platform_auth_configuration enable row level security;

drop policy if exists corporate_site_config_public_read on public.corporate_site_config;
create policy corporate_site_config_public_read on public.corporate_site_config
  for select to anon, authenticated using (is_active = true);

drop policy if exists corporate_navigation_public_read on public.corporate_navigation;
create policy corporate_navigation_public_read on public.corporate_navigation
  for select to anon, authenticated using (is_active = true);

drop policy if exists corporate_pages_public_read on public.corporate_pages;
create policy corporate_pages_public_read on public.corporate_pages
  for select to anon, authenticated using (is_active = true);

drop policy if exists corporate_page_sections_public_read on public.corporate_page_sections;
create policy corporate_page_sections_public_read on public.corporate_page_sections
  for select to anon, authenticated using (is_active = true);

drop policy if exists corporate_pricing_plans_public_read on public.corporate_pricing_plans;
create policy corporate_pricing_plans_public_read on public.corporate_pricing_plans
  for select to anon, authenticated using (is_active = true);

drop policy if exists corporate_plan_feature_statements_public_read on public.corporate_plan_feature_statements;
create policy corporate_plan_feature_statements_public_read on public.corporate_plan_feature_statements
  for select to anon, authenticated using (is_active = true);

-- Auth policy is read through the server. No anonymous direct access.

insert into public.corporate_site_config(key,value,is_active) values
  ('brand', jsonb_build_object(
    'name','LS1Sports',
    'descriptor','Enterprise Sports EAM / ERP',
    'mark','LS1',
    'accent','#FA4616'
  ), true),
  ('primary_cta', jsonb_build_object(
    'label','Open Sandbox / Demo',
    'href','/sign-in?environment=demo'
  ), true),
  ('login_cta', jsonb_build_object(
    'label','Sign in',
    'href','/sign-in'
  ), true),
  ('footer', jsonb_build_object(
    'statement','LS1Sports — the operational system of record for sport.'
  ), true)
on conflict (key) do update set value=excluded.value,is_active=true,updated_at=now();

insert into public.corporate_navigation(code,label,href,sort_order,is_active) values
  ('PLATFORM','Platform','/platform',10,true),
  ('COMPETITION','Competition','/competition',20,true),
  ('SECURITY','Security','/security',30,true),
  ('PRICING','Pricing','/pricing',40,true)
on conflict (code) do update set label=excluded.label,href=excluded.href,sort_order=excluded.sort_order,is_active=true,updated_at=now();

insert into public.corporate_pages(slug,eyebrow,title,summary,is_active) values
  ('home','Enterprise sports operations','One system. One operational truth.','LS1Sports is building the sports EAM / ERP from athlete administration through competition truth.',true),
  ('platform','Platform','ERP discipline without legacy friction.','Configuration, lifecycle, workflow, security, audit and enterprise relationships are first-class product capabilities.',true),
  ('competition','Competition Engine','Run the competition. Prove the truth.','LS1Sports is being built to own the competition lifecycle and produce an independently verifiable source of truth.',true),
  ('security','Security','Security is part of every transaction.','Identity, role, action, scope, record and field controls belong in the operating model—not in a decorative permissions screen.',true),
  ('pricing','Pricing','One organization plan. Every capability enabled.','LS1Sports does not use feature tiers to hide operational capability from an organization.',true)
on conflict (slug) do update set eyebrow=excluded.eyebrow,title=excluded.title,summary=excluded.summary,is_active=true,updated_at=now();

with p as (select id from public.corporate_pages where slug='home')
insert into public.corporate_page_sections(page_id,code,section_type,eyebrow,title,body,items,primary_action,secondary_action,sort_order,is_active)
select p.id,v.code,v.section_type,v.eyebrow,v.title,v.body,v.items,v.primary_action,v.secondary_action,v.sort_order,true
from p cross join (values
  ('POSITION','STATEMENT','THE POSITION','Built to displace fragmented sports systems.','LS1Sports is not a dashboard layered over disconnected tools. The operating model is database-driven, transactional and auditable from the record through the workflow.',
   '["Configuration-driven behavior","Canonical enterprise relationships","Lifecycle-controlled transactions","Workflow, audit and integration by design"]'::jsonb,
   null::jsonb,null::jsonb,10),
  ('COMPETITION','FEATURE','THE PROOF','Competition has to prove the system.','Team management is necessary. It is not sufficient. The Competition Engine is where LS1Sports must prove that its result can stand as the reliable source of truth.',
   '["Entries and eligibility","Seeding and heats / lanes","Timing evidence and DQs","Results, scoring, records and reconciliation"]'::jsonb,
   '{"label":"Competition Engine","href":"/competition"}'::jsonb,null::jsonb,20),
  ('OPERATING_MODEL','FEATURE','THE OPERATING MODEL','Enterprise controls. Sports-native execution.','The platform takes the disciplines mature EAM / ERP products get right and applies them to the sports lifecycle without inheriting needless operational friction.',
   '["Database-driven configuration","Granular authorization and scope","Workflow and exception handling","Evidence-backed audit history"]'::jsonb,
   '{"label":"Explore the platform","href":"/platform"}'::jsonb,null::jsonb,30)
) as v(code,section_type,eyebrow,title,body,items,primary_action,secondary_action,sort_order)
on conflict (page_id,code) do update set section_type=excluded.section_type,eyebrow=excluded.eyebrow,title=excluded.title,body=excluded.body,items=excluded.items,primary_action=excluded.primary_action,secondary_action=excluded.secondary_action,sort_order=excluded.sort_order,is_active=true,updated_at=now();

with p as (select id from public.corporate_pages where slug='platform')
insert into public.corporate_page_sections(page_id,code,section_type,eyebrow,title,body,items,sort_order,is_active)
select p.id,v.code,'FEATURE',v.eyebrow,v.title,v.body,v.items,v.sort_order,true
from p cross join (values
  ('CONFIG','CONTROL PLANE','Configuration is an operating capability.','Business configuration belongs in the database and control plane. React renders the governed state; it does not become the source of business truth.','["DB-driven navigation and workspace registry","Lookups, rules, metrics and parser profiles","Role and permission definitions","Feature and workflow configuration"]'::jsonb,10),
  ('TRANSACTIONS','TRANSACTIONS','The record has a lifecycle.','Create, change, approve, reject, archive, void, reverse and restore actions follow explicit lifecycle rules with persistence and audit evidence.','["Canonical records","Lifecycle-safe writes","Approvals and exceptions","Persistent audit evidence"]'::jsonb,20),
  ('INTEGRATION','INTEGRATION','External systems stay at the boundary.','Source formats and external products are adapters. They can be imported, reconciled and exported without becoming LS1Sports internal data model.','["Adapter-based ingestion","Immutable source evidence","Normalized canonical records","Deterministic reconciliation"]'::jsonb,30)
) as v(code,eyebrow,title,body,items,sort_order)
on conflict (page_id,code) do update set section_type=excluded.section_type,eyebrow=excluded.eyebrow,title=excluded.title,body=excluded.body,items=excluded.items,sort_order=excluded.sort_order,is_active=true,updated_at=now();

with p as (select id from public.corporate_pages where slug='competition')
insert into public.corporate_page_sections(page_id,code,section_type,eyebrow,title,body,items,sort_order,is_active)
select p.id,v.code,'FEATURE',v.eyebrow,v.title,v.body,v.items,v.sort_order,true
from p cross join (values
  ('LIFECYCLE','COMPETITION LIFECYCLE','The meet is a governed transaction chain.','Competition setup through official results must remain one traceable operational lifecycle.','["Meet package and configuration","Sessions, events and entries","Seeding, heats and lanes","Deck, timing, DQs and revisions","Results, scoring, records and publication"]'::jsonb,10),
  ('TRUTH','SOURCE OF TRUTH','Every result needs evidence.','When LS1Sports and an incumbent disagree during parallel validation, the system must expose the source evidence and rule path that explain the difference.','["Source provenance","Timing evidence","Rule and DQ history","Result revisions","Reconciliation evidence"]'::jsonb,20),
  ('NATIVE','NATIVE COMPETITION MODEL','Incumbent formats are adapters—not the model.','The Competition Engine owns its canonical model and native portable package. Legacy formats exist for migration, interoperability and proof during displacement.','["Versioned competition package","Self-describing schema","Integrity and provenance","Sport-neutral core with sport extensions"]'::jsonb,30)
) as v(code,eyebrow,title,body,items,sort_order)
on conflict (page_id,code) do update set section_type=excluded.section_type,eyebrow=excluded.eyebrow,title=excluded.title,body=excluded.body,items=excluded.items,sort_order=excluded.sort_order,is_active=true,updated_at=now();

with p as (select id from public.corporate_pages where slug='security')
insert into public.corporate_page_sections(page_id,code,section_type,eyebrow,title,body,items,sort_order,is_active)
select p.id,v.code,'FEATURE',v.eyebrow,v.title,v.body,v.items,v.sort_order,true
from p cross join (values
  ('AUTHZ','AUTHORIZATION','Identity is only the beginning.','A permitted transaction is resolved through authenticated identity, role, action, organization and scope, record rules and field rules before the write is accepted.','["Role and action permissions","Organization and team scope","Record and field controls","Negative authorization testing"]'::jsonb,10),
  ('MINORS','SAFE SPORT OPERATIONS','Minor data requires stricter boundaries.','Family relationships, guardian access, communications and sensitive records require explicit authorization and evidence.','["Relationship-aware access","Minor-safe communication rules","Server-side enforcement","Auditable exceptions"]'::jsonb,20),
  ('MFA','PLATFORM ACCESS','Privileged access requires stronger assurance.','SuperUser access is restricted to configured platform operators and requires multi-factor authentication according to the database-driven auth policy.','["Configured operators only","SSO policy","TOTP multi-factor authentication","Short-lived privileged session"]'::jsonb,30)
) as v(code,eyebrow,title,body,items,sort_order)
on conflict (page_id,code) do update set section_type=excluded.section_type,eyebrow=excluded.eyebrow,title=excluded.title,body=excluded.body,items=excluded.items,sort_order=excluded.sort_order,is_active=true,updated_at=now();

insert into public.corporate_pricing_plans(code,name,price_amount,currency,billing_period,price_label,description,all_features_enabled,cta_label,cta_href,sort_order,is_active)
values ('ORGANIZATION','LS1Sports Organization',null,null,null,'One plan','Every LS1Sports capability delivered to an organization is enabled. No feature tiers. No capability gates.',true,'Open Sandbox / Demo','/sign-in?environment=demo',10,true)
on conflict (code) do update set name=excluded.name,price_amount=excluded.price_amount,currency=excluded.currency,billing_period=excluded.billing_period,price_label=excluded.price_label,description=excluded.description,all_features_enabled=true,cta_label=excluded.cta_label,cta_href=excluded.cta_href,sort_order=excluded.sort_order,is_active=true,updated_at=now();

with plan as (select id from public.corporate_pricing_plans where code='ORGANIZATION')
insert into public.corporate_plan_feature_statements(plan_id,statement,sort_order,is_active)
select plan.id,v.statement,v.sort_order,true
from plan cross join (values
  ('All platform capabilities are enabled for the organization.',10),
  ('No operational module is withheld behind a higher feature tier.',20),
  ('Permissions still govern who can see and do what inside the organization.',30),
  ('New capabilities become available under the same organization entitlement model.',40)
) as v(statement,sort_order)
on conflict (plan_id,sort_order) do update set statement=excluded.statement,is_active=true;

with p as (select id from public.corporate_pages where slug='pricing')
insert into public.corporate_page_sections(page_id,code,section_type,eyebrow,title,body,items,sort_order,is_active)
select p.id,'MODEL','PRICING','THE MODEL','One organization entitlement.','Commercial packaging does not change the application into a maze of feature flags. Every organization receives the complete LS1Sports capability set; role and scope security determine access inside that organization.','[]'::jsonb,10,true
from p
on conflict (page_id,code) do update set section_type=excluded.section_type,eyebrow=excluded.eyebrow,title=excluded.title,body=excluded.body,items=excluded.items,sort_order=excluded.sort_order,is_active=true,updated_at=now();

insert into public.platform_auth_configuration(code,sso_enabled,sso_domain,magic_link_enabled,require_mfa,required_aal,session_max_age_seconds,is_active)
values ('SUPERUSER',true,'ls1sports.io',true,true,'aal2',3600,true)
on conflict (code) do update set sso_enabled=excluded.sso_enabled,sso_domain=excluded.sso_domain,magic_link_enabled=excluded.magic_link_enabled,require_mfa=excluded.require_mfa,required_aal=excluded.required_aal,session_max_age_seconds=excluded.session_max_age_seconds,is_active=true,updated_at=now();

-- Keep SuperUser membership in the existing operator registry rather than code constants.
update public.platform_superuser_operators
set active=true,can_onboard_clients=true,can_manage_platform_settings=true
where lower(email) in ('kondo@ls1sports.io','admin@ls1sports.io');

insert into public.platform_superuser_operators(email,display_name,active,can_onboard_clients,can_manage_platform_settings)
select v.email,v.display_name,true,true,true
from (values
  ('kondo@ls1sports.io','Kondo'),
  ('admin@ls1sports.io','LS1Sports Admin')
) as v(email,display_name)
where not exists (
  select 1 from public.platform_superuser_operators x where lower(x.email)=lower(v.email)
);
