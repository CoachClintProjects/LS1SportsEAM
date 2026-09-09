-- Align Admin UI authority with database RLS. All policies remain tenant-scoped and caller-JWT based.

create policy "sites_admin_scope" on public.sites for all to authenticated
using (
  app.has_admin_role(array['org_admin','operations']) and exists (
    select 1 from public.organizations o where o.id = sites.organization_id and o.tenant_id in (select app.current_tenant_ids())
  )
)
with check (
  app.has_admin_role(array['org_admin','operations']) and exists (
    select 1 from public.organizations o where o.id = sites.organization_id and o.tenant_id in (select app.current_tenant_ids())
  )
);

create policy "legal_entities_admin_scope" on public.legal_entities for all to authenticated
using (
  app.has_admin_role(array['org_admin','treasurer']) and exists (
    select 1 from public.organizations o where o.id = legal_entities.organization_id and o.tenant_id in (select app.current_tenant_ids())
  )
)
with check (
  app.has_admin_role(array['org_admin','treasurer']) and exists (
    select 1 from public.organizations o where o.id = legal_entities.organization_id and o.tenant_id in (select app.current_tenant_ids())
  )
);

create policy "facilities_admin_scope" on public.facilities for all to authenticated
using (
  app.has_admin_role(array['org_admin','operations']) and exists (
    select 1 from public.sites s join public.organizations o on o.id=s.organization_id
    where s.id=facilities.site_id and o.tenant_id in (select app.current_tenant_ids())
  )
)
with check (
  app.has_admin_role(array['org_admin','operations']) and exists (
    select 1 from public.sites s join public.organizations o on o.id=s.organization_id
    where s.id=facilities.site_id and o.tenant_id in (select app.current_tenant_ids())
  )
);

create policy "facility_bookings_admin_scope" on public.facility_bookings for all to authenticated
using (
  app.has_admin_role(array['org_admin','operations','team_engine']) and exists (
    select 1 from public.facilities f join public.sites s on s.id=f.site_id join public.organizations o on o.id=s.organization_id
    where f.id=facility_bookings.facility_id and o.tenant_id in (select app.current_tenant_ids())
  )
)
with check (
  app.has_admin_role(array['org_admin','operations','team_engine']) and exists (
    select 1 from public.facilities f join public.sites s on s.id=f.site_id join public.organizations o on o.id=s.organization_id
    where f.id=facility_bookings.facility_id and o.tenant_id in (select app.current_tenant_ids())
  )
);

create policy "payroll_runs_admin_scope" on public.payroll_runs for all to authenticated
using (
  app.has_admin_role(array['org_admin','treasurer']) and exists (
    select 1 from public.legal_entities le join public.organizations o on o.id=le.organization_id
    where le.id=payroll_runs.legal_entity_id and o.tenant_id in (select app.current_tenant_ids())
  )
)
with check (
  app.has_admin_role(array['org_admin','treasurer']) and exists (
    select 1 from public.legal_entities le join public.organizations o on o.id=le.organization_id
    where le.id=payroll_runs.legal_entity_id and o.tenant_id in (select app.current_tenant_ids())
  )
);

create policy "payroll_lines_admin_scope" on public.payroll_lines for all to authenticated
using (
  app.has_admin_role(array['org_admin','treasurer']) and exists (
    select 1 from public.payroll_runs pr join public.legal_entities le on le.id=pr.legal_entity_id join public.organizations o on o.id=le.organization_id
    where pr.id=payroll_lines.payroll_run_id and o.tenant_id in (select app.current_tenant_ids())
  )
)
with check (
  app.has_admin_role(array['org_admin','treasurer']) and exists (
    select 1 from public.payroll_runs pr join public.legal_entities le on le.id=pr.legal_entity_id join public.organizations o on o.id=le.organization_id
    where pr.id=payroll_lines.payroll_run_id and o.tenant_id in (select app.current_tenant_ids())
  )
);

-- Compliance requirements are global platform reference data; regular tenant admins may read them,
-- but only SuperUser can mutate them. Tenant compliance admins manage tenant-scoped evidence below.
create policy "background_checks_admin_scope" on public.background_checks for all to authenticated
using (
  app.has_admin_role(array['org_admin','compliance']) and exists (
    select 1 from public.people p where p.id=background_checks.person_id and p.tenant_id in (select app.current_tenant_ids())
  )
)
with check (
  app.has_admin_role(array['org_admin','compliance']) and exists (
    select 1 from public.people p where p.id=background_checks.person_id and p.tenant_id in (select app.current_tenant_ids())
  )
);

create policy "report_runs_admin_scope" on public.report_runs for all to authenticated
using (
  app.has_admin_role(array['org_admin','reporting']) and exists (
    select 1 from public.report_definitions rd where rd.id=report_runs.report_id and rd.tenant_id in (select app.current_tenant_ids())
  )
)
with check (
  app.has_admin_role(array['org_admin','reporting']) and exists (
    select 1 from public.report_definitions rd where rd.id=report_runs.report_id and rd.tenant_id in (select app.current_tenant_ids())
  )
);

create policy "customers_admin_scope" on public.customers for all to authenticated
using (
  app.has_admin_role(array['org_admin','treasurer']) and exists (
    select 1 from public.organizations o where o.id=customers.organization_id and o.tenant_id in (select app.current_tenant_ids())
  )
)
with check (
  app.has_admin_role(array['org_admin','treasurer']) and exists (
    select 1 from public.organizations o where o.id=customers.organization_id and o.tenant_id in (select app.current_tenant_ids())
  )
);

create policy "billing_accounts_admin_scope" on public.billing_accounts for all to authenticated
using (
  app.has_admin_role(array['org_admin','treasurer']) and exists (
    select 1 from public.customers c join public.organizations o on o.id=c.organization_id
    where c.id=billing_accounts.customer_id and o.tenant_id in (select app.current_tenant_ids())
  )
)
with check (
  app.has_admin_role(array['org_admin','treasurer']) and exists (
    select 1 from public.customers c join public.organizations o on o.id=c.organization_id
    where c.id=billing_accounts.customer_id and o.tenant_id in (select app.current_tenant_ids())
  )
);

create policy "invoices_admin_write_scope" on public.invoices for all to authenticated
using (
  app.has_admin_role(array['org_admin','treasurer']) and (
    exists (select 1 from public.legal_entities le join public.organizations o on o.id=le.organization_id where le.id=invoices.legal_entity_id and o.tenant_id in (select app.current_tenant_ids()))
    or exists (select 1 from public.customers c join public.organizations o on o.id=c.organization_id where c.id=invoices.customer_id and o.tenant_id in (select app.current_tenant_ids()))
  )
)
with check (
  app.has_admin_role(array['org_admin','treasurer']) and (
    exists (select 1 from public.legal_entities le join public.organizations o on o.id=le.organization_id where le.id=invoices.legal_entity_id and o.tenant_id in (select app.current_tenant_ids()))
    or exists (select 1 from public.customers c join public.organizations o on o.id=c.organization_id where c.id=invoices.customer_id and o.tenant_id in (select app.current_tenant_ids()))
  )
);

create policy "payments_admin_scope" on public.payments for all to authenticated
using (
  app.has_admin_role(array['org_admin','treasurer']) and (
    exists (select 1 from public.invoices i join public.customers c on c.id=i.customer_id join public.organizations o on o.id=c.organization_id where i.id=payments.invoice_id and o.tenant_id in (select app.current_tenant_ids()))
    or exists (select 1 from public.customers c join public.organizations o on o.id=c.organization_id where c.id=payments.customer_id and o.tenant_id in (select app.current_tenant_ids()))
  )
)
with check (
  app.has_admin_role(array['org_admin','treasurer']) and (
    exists (select 1 from public.invoices i join public.customers c on c.id=i.customer_id join public.organizations o on o.id=c.organization_id where i.id=payments.invoice_id and o.tenant_id in (select app.current_tenant_ids()))
    or exists (select 1 from public.customers c join public.organizations o on o.id=c.organization_id where c.id=payments.customer_id and o.tenant_id in (select app.current_tenant_ids()))
  )
);

create policy "programs_admin_scope" on public.programs for all to authenticated
using (
  app.has_admin_role(array['org_admin','registrar','team_engine']) and exists (
    select 1 from public.organizations o where o.id=programs.organization_id and o.tenant_id in (select app.current_tenant_ids())
  )
)
with check (
  app.has_admin_role(array['org_admin','registrar','team_engine']) and exists (
    select 1 from public.organizations o where o.id=programs.organization_id and o.tenant_id in (select app.current_tenant_ids())
  )
);

create policy "seasons_admin_scope" on public.seasons for all to authenticated
using (
  app.has_admin_role(array['org_admin','registrar','team_engine']) and exists (
    select 1 from public.organizations o where o.id=seasons.organization_id and o.tenant_id in (select app.current_tenant_ids())
  )
)
with check (
  app.has_admin_role(array['org_admin','registrar','team_engine']) and exists (
    select 1 from public.organizations o where o.id=seasons.organization_id and o.tenant_id in (select app.current_tenant_ids())
  )
);

create policy "teams_admin_write_scope" on public.teams for all to authenticated
using (
  app.has_admin_role(array['org_admin','registrar','operations','team_engine']) and exists (
    select 1 from public.organizations o where o.id=teams.organization_id and o.tenant_id in (select app.current_tenant_ids())
  )
)
with check (
  app.has_admin_role(array['org_admin','registrar','operations','team_engine']) and exists (
    select 1 from public.organizations o where o.id=teams.organization_id and o.tenant_id in (select app.current_tenant_ids())
  )
);

create policy "memberships_admin_scope" on public.memberships for all to authenticated
using (
  app.has_admin_role(array['org_admin','registrar','team_engine']) and exists (
    select 1 from public.organizations o where o.id=memberships.organization_id and o.tenant_id in (select app.current_tenant_ids())
  )
)
with check (
  app.has_admin_role(array['org_admin','registrar','team_engine']) and exists (
    select 1 from public.organizations o where o.id=memberships.organization_id and o.tenant_id in (select app.current_tenant_ids())
  )
);

create policy "registrations_admin_write_scope" on public.registrations for all to authenticated
using (
  app.has_admin_role(array['org_admin','registrar']) and exists (
    select 1 from public.organizations o where o.id=registrations.organization_id and o.tenant_id in (select app.current_tenant_ids())
  )
)
with check (
  app.has_admin_role(array['org_admin','registrar']) and exists (
    select 1 from public.organizations o where o.id=registrations.organization_id and o.tenant_id in (select app.current_tenant_ids())
  )
);