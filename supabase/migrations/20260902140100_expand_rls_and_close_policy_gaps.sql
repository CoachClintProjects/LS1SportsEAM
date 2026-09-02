-- Expand tenant-aware policies and close remaining RLS policy gaps.
do $$
declare r record;
begin
  for r in select c.table_name from information_schema.columns c where c.table_schema='public' and c.column_name='tenant_id' and not exists (select 1 from pg_policies p where p.schemaname='public' and p.tablename=c.table_name)
  loop
    execute format('create policy %I on public.%I for all to authenticated using (app.is_superuser() or tenant_id in (select app.current_tenant_ids())) with check (app.is_superuser() or tenant_id in (select app.current_tenant_ids()))', r.table_name || '_tenant_access', r.table_name);
  end loop;
end $$;

create policy athletes_tenant_access on public.athletes for all to authenticated using (app.is_superuser() or exists (select 1 from public.people p where p.id=athletes.person_id and p.tenant_id in (select app.current_tenant_ids()))) with check (app.is_superuser() or exists (select 1 from public.people p where p.id=athletes.person_id and p.tenant_id in (select app.current_tenant_ids())));
create policy athlete_sport_participation_access on public.athlete_sport_participation for all to authenticated using (app.is_superuser() or exists (select 1 from public.athletes a join public.people p on p.id=a.person_id where a.id=athlete_sport_participation.athlete_id and p.tenant_id in (select app.current_tenant_ids()))) with check (app.is_superuser() or exists (select 1 from public.athletes a join public.people p on p.id=a.person_id where a.id=athlete_sport_participation.athlete_id and p.tenant_id in (select app.current_tenant_ids())));
create policy athlete_asset_ledger_access on public.athlete_asset_ledger for all to authenticated using (app.is_superuser() or exists (select 1 from public.athletes a join public.people p on p.id=a.person_id where a.id=athlete_asset_ledger.athlete_id and p.tenant_id in (select app.current_tenant_ids()))) with check (app.is_superuser() or exists (select 1 from public.athletes a join public.people p on p.id=a.person_id where a.id=athlete_asset_ledger.athlete_id and p.tenant_id in (select app.current_tenant_ids())));
create policy team_memberships_access on public.team_memberships for all to authenticated using (app.is_superuser() or exists (select 1 from public.teams t join public.organizations o on o.id=t.organization_id where t.id=team_memberships.team_id and o.tenant_id in (select app.current_tenant_ids()))) with check (app.is_superuser() or exists (select 1 from public.teams t join public.organizations o on o.id=t.organization_id where t.id=team_memberships.team_id and o.tenant_id in (select app.current_tenant_ids())));
create policy users_self_or_superuser on public.users for select to authenticated using (app.is_superuser() or id=(select auth.uid()));
create policy workflow_instances_tenant_access on public.workflow_instances for all to authenticated using (app.is_superuser() or exists (select 1 from public.workflow_definitions d where d.id=workflow_instances.workflow_definition_id and d.tenant_id in (select app.current_tenant_ids()))) with check (app.is_superuser() or exists (select 1 from public.workflow_definitions d where d.id=workflow_instances.workflow_definition_id and d.tenant_id in (select app.current_tenant_ids())));
create policy workflow_tasks_access on public.workflow_tasks for all to authenticated using (app.is_superuser() or exists (select 1 from public.workflow_instances i join public.workflow_definitions d on d.id=i.workflow_definition_id where i.id=workflow_tasks.workflow_instance_id and d.tenant_id in (select app.current_tenant_ids()))) with check (app.is_superuser() or exists (select 1 from public.workflow_instances i join public.workflow_definitions d on d.id=i.workflow_definition_id where i.id=workflow_tasks.workflow_instance_id and d.tenant_id in (select app.current_tenant_ids())));
create policy workflow_transition_history_access on public.workflow_transition_history for all to authenticated using (app.is_superuser() or exists (select 1 from public.workflow_instances i join public.workflow_definitions d on d.id=i.workflow_definition_id where i.id=workflow_transition_history.workflow_instance_id and d.tenant_id in (select app.current_tenant_ids()))) with check (app.is_superuser() or exists (select 1 from public.workflow_instances i join public.workflow_definitions d on d.id=i.workflow_definition_id where i.id=workflow_transition_history.workflow_instance_id and d.tenant_id in (select app.current_tenant_ids())));

do $$
declare r record;
begin
  for r in select t.tablename from pg_tables t join pg_class c on c.relname=t.tablename join pg_namespace n on n.oid=c.relnamespace and n.nspname=t.schemaname where t.schemaname='public' and c.relrowsecurity and not exists (select 1 from pg_policies p where p.schemaname=t.schemaname and p.tablename=t.tablename)
  loop
    execute format('create policy %I on public.%I for all to authenticated using (app.is_superuser()) with check (app.is_superuser())', r.tablename || '_superuser_baseline', r.tablename);
  end loop;
end $$;

do $$
declare t text;
begin
  foreach t in array array['sports','roles','permissions','role_permissions','governing_bodies','document_types','swim_courses','swim_dq_codes','swim_scratch_reasons','swim_strokes','swim_timing_systems','competition_source_systems','competition_formats','swim_time_standards','parser_definitions']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_superuser_baseline', t);
    execute format('create policy %I on public.%I for select to authenticated using (true)', t || '_reference_read', t);
  end loop;
end $$;