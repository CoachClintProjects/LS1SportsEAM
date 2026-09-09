create table if not exists public.competition_participation_responses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  organization_id uuid null references public.organizations(id) on delete cascade,
  competition_id uuid not null references public.competitions(id) on delete cascade,
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  eligibility_decision_id uuid null references public.competition_eligibility_decisions(id) on delete set null,
  recipient_person_id uuid null references public.people(id) on delete set null,
  invitation_status text not null default 'eligible',
  response_status text not null default 'awaiting_response',
  notified_at timestamptz null,
  responded_at timestamptz null,
  reminder_count integer not null default 0,
  last_reminded_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (competition_id, athlete_id),
  check (response_status in ('awaiting_response','going','not_going')),
  check (invitation_status in ('eligible','notified','closed'))
);

create table if not exists public.competition_logistics_requirements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  organization_id uuid null references public.organizations(id) on delete cascade,
  competition_id uuid not null references public.competitions(id) on delete cascade,
  requirement_key text not null,
  label text not null,
  requirement_state text not null default 'unknown',
  fulfillment_status text not null default 'unresolved',
  quantity numeric null,
  vendor_id uuid null references public.vendors(id) on delete set null,
  owner_person_id uuid null references public.people(id) on delete set null,
  due_at timestamptz null,
  notes text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (competition_id, requirement_key),
  check (requirement_state in ('unknown','required','not_required')),
  check (fulfillment_status in ('unresolved','planned','confirmed','complete','not_applicable'))
);

alter table public.competition_participation_responses enable row level security;
alter table public.competition_logistics_requirements enable row level security;

drop policy if exists admin_competition_participation_select on public.competition_participation_responses;
create policy admin_competition_participation_select on public.competition_participation_responses for select to authenticated using (app.is_superuser() or (tenant_id in (select app.current_tenant_ids()) and app.has_admin_role(array['org_admin','registrar','operations','team_engine'])));
drop policy if exists admin_competition_participation_write on public.competition_participation_responses;
create policy admin_competition_participation_write on public.competition_participation_responses for all to authenticated using (app.is_superuser() or (tenant_id in (select app.current_tenant_ids()) and app.has_admin_role(array['org_admin','registrar','operations','team_engine']))) with check (app.is_superuser() or (tenant_id in (select app.current_tenant_ids()) and app.has_admin_role(array['org_admin','registrar','operations','team_engine'])));

drop policy if exists admin_competition_logistics_select on public.competition_logistics_requirements;
create policy admin_competition_logistics_select on public.competition_logistics_requirements for select to authenticated using (app.is_superuser() or (tenant_id in (select app.current_tenant_ids()) and app.has_admin_role(array['org_admin','operations','team_engine'])));
drop policy if exists admin_competition_logistics_write on public.competition_logistics_requirements;
create policy admin_competition_logistics_write on public.competition_logistics_requirements for all to authenticated using (app.is_superuser() or (tenant_id in (select app.current_tenant_ids()) and app.has_admin_role(array['org_admin','operations','team_engine']))) with check (app.is_superuser() or (tenant_id in (select app.current_tenant_ids()) and app.has_admin_role(array['org_admin','operations','team_engine'])));

drop policy if exists admin_competition_eligibility_read on public.competition_eligibility_decisions;
create policy admin_competition_eligibility_read on public.competition_eligibility_decisions for select to authenticated using (app.is_superuser() or exists (select 1 from public.competitions c where c.id=competition_eligibility_decisions.competition_id and c.tenant_id in (select app.current_tenant_ids()) and app.has_admin_role(array['org_admin','registrar','operations','team_engine'])));
drop policy if exists admin_competition_deadlines_read on public.competition_deadlines;
create policy admin_competition_deadlines_read on public.competition_deadlines for select to authenticated using (app.is_superuser() or exists (select 1 from public.competitions c where c.id=competition_deadlines.competition_id and c.tenant_id in (select app.current_tenant_ids()) and app.has_admin_role(array['org_admin','registrar','operations','team_engine'])));
drop policy if exists admin_competition_exceptions_read on public.competition_exceptions;
create policy admin_competition_exceptions_read on public.competition_exceptions for select to authenticated using (app.is_superuser() or exists (select 1 from public.competitions c where c.id=competition_exceptions.competition_id and c.tenant_id in (select app.current_tenant_ids()) and app.has_admin_role(array['org_admin','registrar','operations','team_engine'])));

grant select,insert,update on public.competition_participation_responses to authenticated;
grant select,insert,update on public.competition_logistics_requirements to authenticated;
grant select on public.competition_eligibility_decisions,public.competition_deadlines,public.competition_exceptions to authenticated;

insert into public.competitions (tenant_id,organization_id,sport_id,name,competition_type,starts_at,ends_at,timezone,city,region,country_code,status)
select o.tenant_id,o.id,s.id,'2026 Sienna Splash','swim_meet','2026-09-19 08:00:00-05','2026-09-20 18:00:00-05','America/Chicago',null,'Texas','US','planned'
from public.organizations o cross join public.sports s
where o.name='HPAC' and s.code='SWIM' and not exists (select 1 from public.competitions c where c.name='2026 Sienna Splash');

insert into public.competitions (tenant_id,organization_id,sport_id,name,competition_type,starts_at,ends_at,timezone,city,region,country_code,status)
select o.tenant_id,o.id,s.id,'2026 Open Water Banana Slug Splash','open_water','2026-10-17 08:00:00-05','2026-10-18 18:00:00-05','America/Chicago','Marble Falls','Texas','US','planned'
from public.organizations o cross join public.sports s
where o.name='HPAC' and s.code='SWIM' and not exists (select 1 from public.competitions c where c.name='2026 Open Water Banana Slug Splash');

insert into public.competitions (tenant_id,organization_id,sport_id,name,competition_type,starts_at,ends_at,timezone,city,region,country_code,status)
select o.tenant_id,o.id,s.id,'2026 HPAC Festivus Winterfest','swim_meet','2026-12-05 08:00:00-06','2026-12-06 18:00:00-06','America/Chicago',null,'Texas','US','planned'
from public.organizations o cross join public.sports s
where o.name='HPAC' and s.code='SWIM' and not exists (select 1 from public.competitions c where c.name='2026 HPAC Festivus Winterfest');

insert into public.competitions (tenant_id,organization_id,sport_id,name,competition_type,starts_at,ends_at,timezone,city,region,country_code,status)
select o.tenant_id,o.id,s.id,'2028 Southern Zone Open Water Championship','open_water','2028-05-05 08:00:00-05','2028-05-07 18:00:00-05','America/Chicago','Marble Falls','Texas','US','planned'
from public.organizations o cross join public.sports s
where o.name='HPAC' and s.code='SWIM' and not exists (select 1 from public.competitions c where c.name='2028 Southern Zone Open Water Championship');

insert into public.competition_logistics_requirements (tenant_id,organization_id,competition_id,requirement_key,label,requirement_state,fulfillment_status,notes)
select c.tenant_id,c.organization_id,c.id,x.key,x.label,'unknown','unresolved','Organizer decision required before operational confirmation.'
from public.competitions c
cross join (values ('ems','EMS support'),('lifeguards','Lifeguards'),('boats','Safety / operations boats'),('vendors','Event vendors')) as x(key,label)
where c.name in ('2026 Open Water Banana Slug Splash','2028 Southern Zone Open Water Championship')
on conflict (competition_id,requirement_key) do nothing;

insert into public.hub_navigation (hub_id,parent_id,label,icon,path,component,sort_order,is_active,description)
select 'admin',null,'Competitions','Trophy','/admin?view=competitions','AdminCompetitionOperations',175,true,'Competition-facing administrative operations: eligibility responses, attendance confirmation, deadlines and logistics. Competition Engine remains separate.'
where not exists (select 1 from public.hub_navigation where hub_id='admin' and label='Competitions');

insert into public.hub_role_navigation (role_id,nav_id,can_view)
select r.role_id,n.nav_id,true
from public.admin_roles r
join public.hub_navigation n on n.hub_id='admin' and n.label='Competitions'
where r.role_name in ('org_admin','registrar','operations','team_engine')
and not exists (select 1 from public.hub_role_navigation x where x.role_id=r.role_id and x.nav_id=n.nav_id);
