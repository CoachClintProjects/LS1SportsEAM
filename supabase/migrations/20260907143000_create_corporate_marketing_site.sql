-- LS1Sports corporate website: database-driven identity, content, navigation and pricing.
-- No website feature/copy/pricing tier is sourced from React component constants.

create table if not exists public.marketing_sites (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  brand_name text not null,
  wordmark text not null,
  meta_title text not null,
  meta_description text not null,
  theme jsonb not null default '{}'::jsonb,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketing_navigation (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.marketing_sites(id) on delete cascade,
  label text not null,
  href text not null,
  item_type text not null default 'link',
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.marketing_sections (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.marketing_sites(id) on delete cascade,
  section_key text not null,
  section_type text not null,
  eyebrow text,
  headline text,
  body text,
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  settings jsonb not null default '{}'::jsonb,
  unique (site_id, section_key)
);

create table if not exists public.marketing_items (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.marketing_sections(id) on delete cascade,
  item_key text not null,
  title text,
  description text,
  kicker text,
  value text,
  href text,
  cta_label text,
  icon_key text,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  unique (section_id, item_key)
);

create table if not exists public.marketing_pricing (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.marketing_sites(id) on delete cascade,
  plan_key text not null,
  name text not null,
  price_amount numeric,
  price_label text not null,
  currency_code text not null default 'CAD',
  billing_period text,
  description text not null,
  cta_label text not null,
  cta_href text not null,
  all_features_included boolean not null default true,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  unique (site_id, plan_key)
);

alter table public.marketing_sites enable row level security;
alter table public.marketing_navigation enable row level security;
alter table public.marketing_sections enable row level security;
alter table public.marketing_items enable row level security;
alter table public.marketing_pricing enable row level security;

grant select on public.marketing_sites to anon, authenticated;
grant select on public.marketing_navigation to anon, authenticated;
grant select on public.marketing_sections to anon, authenticated;
grant select on public.marketing_items to anon, authenticated;
grant select on public.marketing_pricing to anon, authenticated;

drop policy if exists marketing_sites_public_read on public.marketing_sites;
create policy marketing_sites_public_read
on public.marketing_sites for select
to anon, authenticated
using (is_published = true);

drop policy if exists marketing_navigation_public_read on public.marketing_navigation;
create policy marketing_navigation_public_read
on public.marketing_navigation for select
to anon, authenticated
using (
  exists (
    select 1 from public.marketing_sites s
    where s.id = marketing_navigation.site_id
      and s.is_published = true
  )
);

drop policy if exists marketing_sections_public_read on public.marketing_sections;
create policy marketing_sections_public_read
on public.marketing_sections for select
to anon, authenticated
using (
  is_visible = true
  and exists (
    select 1 from public.marketing_sites s
    where s.id = marketing_sections.site_id
      and s.is_published = true
  )
);

drop policy if exists marketing_items_public_read on public.marketing_items;
create policy marketing_items_public_read
on public.marketing_items for select
to anon, authenticated
using (
  exists (
    select 1
    from public.marketing_sections ms
    join public.marketing_sites s on s.id = ms.site_id
    where ms.id = marketing_items.section_id
      and ms.is_visible = true
      and s.is_published = true
  )
);

drop policy if exists marketing_pricing_public_read on public.marketing_pricing;
create policy marketing_pricing_public_read
on public.marketing_pricing for select
to anon, authenticated
using (
  is_active = true
  and exists (
    select 1 from public.marketing_sites s
    where s.id = marketing_pricing.site_id
      and s.is_published = true
  )
);

do $$
declare
  v_site_id uuid;
  v_hero uuid;
  v_platform uuid;
  v_roles uuid;
  v_architecture uuid;
  v_ai uuid;
  v_pricing uuid;
begin
  insert into public.marketing_sites (
    slug, brand_name, wordmark, meta_title, meta_description, theme, is_published
  ) values (
    'ls1sports',
    'LS1Sports',
    'LS1SPORTS',
    'LS1Sports — The operating system for sports organizations',
    'One connected operating system for sports organizations: people, programs, competition, athlete development, finance, facilities, compliance, communication and intelligence.',
    '{"line":"#242B26","text":"#F5F5F0","muted":"#9CA49E","accent":"#FA4616","surface":"#0E1210","max_width":"1180px","background":"#070A09","accent_soft":"#2B140C","surface_alt":"#121714"}'::jsonb,
    true
  )
  on conflict (slug) do update set
    brand_name = excluded.brand_name,
    wordmark = excluded.wordmark,
    meta_title = excluded.meta_title,
    meta_description = excluded.meta_description,
    theme = excluded.theme,
    is_published = excluded.is_published,
    updated_at = now()
  returning id into v_site_id;

  delete from public.marketing_navigation where site_id = v_site_id;
  insert into public.marketing_navigation (site_id, label, href, item_type, sort_order, is_visible, metadata) values
    (v_site_id, 'Platform', '#platform', 'link', 10, true, '{}'::jsonb),
    (v_site_id, 'Who it serves', '#roles', 'link', 20, true, '{}'::jsonb),
    (v_site_id, 'Architecture', '#architecture', 'link', 30, true, '{}'::jsonb),
    (v_site_id, 'Pricing', '#pricing', 'link', 40, true, '{}'::jsonb),
    (v_site_id, 'Open platform', '/admin', 'cta', 50, true, '{"variant":"primary"}'::jsonb);

  insert into public.marketing_sections (site_id, section_key, section_type, eyebrow, headline, body, sort_order, is_visible, settings) values
    (v_site_id, 'hero', 'hero', 'SPORTS OPERATIONS, CONNECTED', 'Run the organization. Develop the athlete. Operate the competition.', 'LS1Sports brings the work of a sports organization into one connected system of record—without forcing administrators, coaches, families, officials and athletes into the same interface.', 10, true, '{"primary_cta_href":"#platform","primary_cta_label":"Explore the platform","secondary_cta_href":"#pricing","secondary_cta_label":"See pricing"}'::jsonb),
    (v_site_id, 'principle', 'statement', 'ONE SYSTEM OF RECORD', 'The same truth. The right view for each person.', 'A roster change should not need to be re-entered in registration, finance, communications and meet software. A result should not stop at a results screen. LS1Sports connects operational records so the system can carry context forward.', 20, true, '{}'::jsonb),
    (v_site_id, 'platform', 'feature_grid', 'THE PLATFORM', 'One operating layer across the organization.', 'Each workspace is purpose-built for the person using it. Underneath, they share identity, permissions, rules, workflows and authoritative records.', 30, true, '{"columns":3}'::jsonb),
    (v_site_id, 'roles', 'role_grid', 'ROLE-DRIVEN BY DESIGN', 'One person can wear five hats. The system should understand that.', 'People switch operating context without duplicating identity or fragmenting records.', 40, true, '{"columns":4}'::jsonb),
    (v_site_id, 'architecture', 'architecture', 'CONFIGURATION OVER CODE', 'The platform is designed to change without being rewritten.', 'Navigation, permissions, rules, workflows, metrics, parsers, templates and UI definitions resolve from database configuration so organizations can evolve without feature-flag archaeology.', 50, true, '{}'::jsonb),
    (v_site_id, 'ai', 'split', 'AI WITH OPERATING CONTEXT', 'Assistance that can explain itself—and knows when a human must decide.', 'AI is an operating layer across real platform data, policies and permissions. Recommendations can become actions only through defined authorization and approval paths.', 60, true, '{"alignment":"right"}'::jsonb),
    (v_site_id, 'pricing', 'pricing', 'SIMPLE BY POLICY', 'One organization subscription. Everything is on.', 'No module maze. No feature withholding. Every organization gets the complete platform capability set; the commercial relationship does not decide which operational tools your people are allowed to use.', 70, true, '{}'::jsonb),
    (v_site_id, 'closing', 'cta', 'BUILD A BETTER OPERATING MODEL', 'Less software administration. More organizational control.', 'The goal is not another dashboard. It is a sports-native operating system that makes the organization easier to run while improving the athlete, competition and governance experience.', 80, true, '{"primary_cta_href":"/admin","primary_cta_label":"Open LS1Sports"}'::jsonb)
  on conflict (site_id, section_key) do update set
    section_type = excluded.section_type,
    eyebrow = excluded.eyebrow,
    headline = excluded.headline,
    body = excluded.body,
    sort_order = excluded.sort_order,
    is_visible = excluded.is_visible,
    settings = excluded.settings;

  select id into v_hero from public.marketing_sections where site_id=v_site_id and section_key='hero';
  select id into v_platform from public.marketing_sections where site_id=v_site_id and section_key='platform';
  select id into v_roles from public.marketing_sections where site_id=v_site_id and section_key='roles';
  select id into v_architecture from public.marketing_sections where site_id=v_site_id and section_key='architecture';
  select id into v_ai from public.marketing_sections where site_id=v_site_id and section_key='ai';
  select id into v_pricing from public.marketing_sections where site_id=v_site_id and section_key='pricing';

  delete from public.marketing_items
  where section_id in (select id from public.marketing_sections where site_id=v_site_id);

  insert into public.marketing_items (section_id, item_key, title, description, kicker, value, icon_key, sort_order) values
    (v_hero, 'proof-1', 'One identity', 'People, roles and permissions stay connected across every workspace.', null, null, 'Fingerprint', 10),
    (v_hero, 'proof-2', 'One operational record', 'Organization, athlete, competition and financial context stays linked.', null, null, 'Database', 20),
    (v_hero, 'proof-3', 'Every capability included', 'Pricing does not decide which modules an organization can use.', null, null, 'Unlock', 30),
    (v_platform, 'admin', 'Organization Operations', 'Roster, registration, membership, programs, teams, staff, communications, compliance, reporting and client operations.', 'ADMIN', null, 'Building2', 10),
    (v_platform, 'coach', 'Coaching & Development', 'Training plans, attendance, development goals, assessments, competition preparation and athlete intelligence.', 'COACH', null, 'ClipboardCheck', 20),
    (v_platform, 'athlete', 'Athlete Passport', 'A longitudinal athlete record across development stages, sports, performance, schedules, entries, goals and achievements.', 'ATHLETE', null, 'Activity', 30),
    (v_platform, 'parent', 'Family Operations', 'Family schedules, authorizations, communications, tasks, logistics and the athlete context families actually need.', 'FAMILY', null, 'Users', 40),
    (v_platform, 'competition', 'Competition Operations', 'Rules, eligibility, entries, seeding, officials, timing, results, records, publications, reconciliation and exceptions.', 'COMPETITION', null, 'Timer', 50),
    (v_platform, 'finance', 'Finance & EAM', 'AR, AP, payments, budgets, procurement, assets, facilities, work orders and the operational dependencies behind sport delivery.', 'OPERATIONS', null, 'Landmark', 60),
    (v_roles, 'role-admin', 'Organization Admin', 'Organization, sites, facilities, programs, people, membership, configuration and governance.', null, null, null, 10),
    (v_roles, 'role-team', 'Team Manager', 'Teams, rosters, groups, staff, attendance, training, communication and competition preparation.', null, null, null, 20),
    (v_roles, 'role-registrar', 'Registrar', 'Registration queues, eligibility, membership, transfers, documents, waivers and approvals.', null, null, null, 30),
    (v_roles, 'role-treasurer', 'Treasurer', 'Revenue, receivables, payables, expenses, budgets, reconciliation and financial reporting.', null, null, null, 40),
    (v_roles, 'role-official', 'Official', 'Assignments, check-in, credentials, rules, events, heats, results, DQs, rulings and audit history.', null, null, null, 50),
    (v_roles, 'role-coach', 'Coach', 'Athlete development, training, attendance, competition preparation and performance intelligence.', null, null, null, 60),
    (v_roles, 'role-parent', 'Parent / Guardian', 'Family calendar, athlete context, communications, authorizations, logistics and tasks.', null, null, null, 70),
    (v_roles, 'role-athlete', 'Athlete', 'A stage-appropriate experience for development, results, goals, schedule and progression.', null, null, null, 80),
    (v_architecture, 'db-ui', 'Database-defined UI', 'Workspaces, views, fields, actions and navigation resolve from canonical configuration.', null, null, 'PanelsTopLeft', 10),
    (v_architecture, 'rbac', 'Database-defined security', 'Roles, permissions, assignments and scopes are data—not scattered conditionals.', null, null, 'ShieldCheck', 20),
    (v_architecture, 'rules', 'Rules & validation', 'Business rules, sport rules and validation logic are versionable definitions.', null, null, 'Workflow', 30),
    (v_architecture, 'workflows', 'Workflow engine', 'State transitions, approvals and human handoffs are modeled explicitly.', null, null, 'GitBranch', 40),
    (v_architecture, 'ingestion', 'Parser registry', 'Imports and external systems map into normalized records through defined parser profiles.', null, null, 'Cable', 50),
    (v_architecture, 'metrics', 'Metric engine', 'Metrics, sources and thresholds are defined centrally and reused across experiences.', null, null, 'Gauge', 60),
    (v_ai, 'ai-1', 'Permission-aware', 'AI operates inside the same authorization model as the rest of the platform.', null, null, 'Shield', 10),
    (v_ai, 'ai-2', 'Human-governed', 'Authoritative changes can require review, approval and explicit execution.', null, null, 'UserCheck', 20),
    (v_ai, 'ai-3', 'Auditable', 'Recommendations, actions, authorization results and execution outcomes can be recorded.', null, null, 'ScrollText', 30),
    (v_pricing, 'included-1', 'Organization operations', 'Included', null, 'Included', 'Check', 10),
    (v_pricing, 'included-2', 'Athlete, coach & family experiences', 'Included', null, 'Included', 'Check', 20),
    (v_pricing, 'included-3', 'Competition & official operations', 'Included', null, 'Included', 'Check', 30),
    (v_pricing, 'included-4', 'Finance, facilities & asset operations', 'Included', null, 'Included', 'Check', 40),
    (v_pricing, 'included-5', 'AI, automation & intelligence', 'Included', null, 'Included', 'Check', 50),
    (v_pricing, 'included-6', 'Security, compliance & audit', 'Included', null, 'Included', 'Check', 60),
    (v_pricing, 'included-7', 'Integrations, imports & data operations', 'Included', null, 'Included', 'Check', 70),
    (v_pricing, 'included-8', 'Every future standard platform capability', 'Included', null, 'Included', 'Check', 80);

  insert into public.marketing_pricing (
    site_id, plan_key, name, price_amount, price_label, currency_code, billing_period,
    description, cta_label, cta_href, all_features_included, is_active, sort_order, metadata
  ) values (
    v_site_id, 'organization', 'LS1Sports Organization', null, 'One organization price', 'CAD', null,
    'The complete LS1Sports platform for the organization. No feature tiers and no locked modules.',
    'Open LS1Sports', '/admin', true, true, 10,
    '{"note":"Set price_amount and billing_period when commercial pricing is approved.","pricing_status":"amount_tbd"}'::jsonb
  )
  on conflict (site_id, plan_key) do update set
    name = excluded.name,
    price_amount = excluded.price_amount,
    price_label = excluded.price_label,
    currency_code = excluded.currency_code,
    billing_period = excluded.billing_period,
    description = excluded.description,
    cta_label = excluded.cta_label,
    cta_href = excluded.cta_href,
    all_features_included = excluded.all_features_included,
    is_active = excluded.is_active,
    sort_order = excluded.sort_order,
    metadata = excluded.metadata;
end
$$;
