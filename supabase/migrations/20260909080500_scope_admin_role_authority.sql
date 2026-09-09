create or replace function app.has_admin_role(requested text[])
returns boolean language sql stable security definer set search_path=public,app,auth as $$
 select app.is_superuser() or exists(
  select 1 from public.person_role_assignments pra join public.roles r on r.id=pra.role_id
  where pra.person_id=app.current_person_id() and upper(pra.status)='ACTIVE'
    and case upper(r.code::text)
      when 'ORGANIZATION_ADMIN' then 'org_admin'
      when 'REGISTRAR' then 'registrar'
      when 'TREASURER' then 'treasurer'
      when 'OPERATIONS_ADMIN' then 'operations'
      when 'COMPLIANCE_ADMIN' then 'compliance'
      when 'REPORTING_ADMIN' then 'reporting'
      when 'TEAM_ENGINE_ADMIN' then 'team_engine'
      else lower(r.code::text)
    end=any(requested)
 );
$$;
revoke all on function app.has_admin_role(text[]) from public;
grant execute on function app.has_admin_role(text[]) to authenticated;

alter policy registrations_admin_scope on public.registrations using(app.has_admin_role(array['org_admin','registrar']) and exists(select 1 from public.organizations o where o.id=registrations.organization_id and o.tenant_id in(select app.current_tenant_ids())));
alter policy invoices_admin_scope on public.invoices using(app.has_admin_role(array['org_admin','treasurer']) and exists(select 1 from public.legal_entities le join public.organizations o on o.id=le.organization_id where le.id=invoices.legal_entity_id and o.tenant_id in(select app.current_tenant_ids())));
alter policy vendor_bills_admin_scope on public.vendor_bills using(app.has_admin_role(array['org_admin','treasurer']) and exists(select 1 from public.legal_entities le join public.organizations o on o.id=le.organization_id where le.id=vendor_bills.legal_entity_id and o.tenant_id in(select app.current_tenant_ids())));
alter policy audit_events_admin_scope on public.audit_events using(app.has_admin_role(array['org_admin','compliance','reporting']) and tenant_id in(select app.current_tenant_ids()));
alter policy audit_events_admin_insert on public.audit_events with check(app.is_admin() and tenant_id in(select app.current_tenant_ids()));
alter policy teams_admin_scope on public.teams using(app.has_admin_role(array['org_admin','registrar','operations','team_engine']) and exists(select 1 from public.organizations o where o.id=teams.organization_id and o.tenant_id in(select app.current_tenant_ids())));
