create or replace function app.is_admin()
returns boolean language sql stable security definer set search_path=public,app,auth as $$
 select app.is_superuser() or exists(
  select 1 from public.person_role_assignments pra join public.roles r on r.id=pra.role_id
  where pra.person_id=app.current_person_id() and upper(pra.status)='ACTIVE'
    and upper(r.code::text) in ('ORGANIZATION_ADMIN','REGISTRAR','TREASURER','OPERATIONS_ADMIN','COMPLIANCE_ADMIN','REPORTING_ADMIN','TEAM_ENGINE_ADMIN')
 );
$$;
revoke all on function app.is_admin() from public;
grant execute on function app.is_admin() to authenticated;

create table if not exists public.admin_home_role_actions(
 id uuid primary key default gen_random_uuid(),role_name text not null,action_key text not null,label text not null,description text,href text not null,sort_order integer not null default 100,is_active boolean not null default true,unique(role_name,action_key)
);
alter table public.admin_home_role_actions enable row level security;
grant select on public.admin_home_role_actions to authenticated;
drop policy if exists admin_home_role_actions_admin_read on public.admin_home_role_actions;
create policy admin_home_role_actions_admin_read on public.admin_home_role_actions for select to authenticated using(app.is_admin());

insert into public.admin_home_role_actions(role_name,action_key,label,description,href,sort_order) values
('org_admin','review-work','Review priority work','Open organization-wide Admin work requiring action.','/admin',10),
('org_admin','people','People & memberships','Review people, memberships and organization records.','/admin',20),
('org_admin','teams','Team Engine','Review programs, seasons, teams and rosters.','/admin',30),
('org_admin','finance','Finance','Review balances, invoices and financial exceptions.','/admin',40),
('registrar','registrations','Registration queue','Review submitted registrations and eligibility exceptions.','/admin',10),
('registrar','rosters','Rosters','Review roster assignments and membership exceptions.','/admin',20),
('registrar','people','People','Resolve athlete/person data quality issues.','/admin',30),
('treasurer','receivables','Receivables','Review open invoices and past-due balances.','/admin',10),
('treasurer','payables','Payables','Review vendor bills and payment obligations.','/admin',20),
('treasurer','reporting','Financial reporting','Open current finance reports and reconciliation work.','/admin',30),
('operations','facilities','Facilities','Review facilities, bookings and operating issues.','/admin',10),
('operations','payroll','Payroll','Review workforce and payroll operating work.','/admin',20),
('compliance','compliance','Compliance','Review compliance and governance exceptions.','/admin',10),
('reporting','reporting','Reporting','Open reporting and analytics workflows.','/admin',10)
on conflict(role_name,action_key) do update set label=excluded.label,description=excluded.description,href=excluded.href,sort_order=excluded.sort_order,is_active=true;

grant select on public.users,public.person_role_assignments,public.roles,public.calendar_events,public.operational_tasks,public.work_items,public.registrations,public.invoices,public.vendor_bills,public.audit_events,public.teams,public.athletes,public.organizations,public.legal_entities to authenticated;
grant insert,update on public.operational_tasks,public.work_items to authenticated;
grant insert on public.audit_events to authenticated;

drop policy if exists registrations_admin_scope on public.registrations;
create policy registrations_admin_scope on public.registrations for select to authenticated using(app.is_admin() and exists(select 1 from public.organizations o where o.id=registrations.organization_id and o.tenant_id in(select app.current_tenant_ids())));
drop policy if exists invoices_admin_scope on public.invoices;
create policy invoices_admin_scope on public.invoices for select to authenticated using(app.is_admin() and exists(select 1 from public.legal_entities le join public.organizations o on o.id=le.organization_id where le.id=invoices.legal_entity_id and o.tenant_id in(select app.current_tenant_ids())));
drop policy if exists vendor_bills_admin_scope on public.vendor_bills;
create policy vendor_bills_admin_scope on public.vendor_bills for select to authenticated using(app.is_admin() and exists(select 1 from public.legal_entities le join public.organizations o on o.id=le.organization_id where le.id=vendor_bills.legal_entity_id and o.tenant_id in(select app.current_tenant_ids())));
drop policy if exists audit_events_admin_scope on public.audit_events;
create policy audit_events_admin_scope on public.audit_events for select to authenticated using(app.is_admin() and tenant_id in(select app.current_tenant_ids()));
drop policy if exists audit_events_admin_insert on public.audit_events;
create policy audit_events_admin_insert on public.audit_events for insert to authenticated with check(app.is_admin() and tenant_id in(select app.current_tenant_ids()));
drop policy if exists teams_admin_scope on public.teams;
create policy teams_admin_scope on public.teams for select to authenticated using(app.is_admin() and exists(select 1 from public.organizations o where o.id=teams.organization_id and o.tenant_id in(select app.current_tenant_ids())));
