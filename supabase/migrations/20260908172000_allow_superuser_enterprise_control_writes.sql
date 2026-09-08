drop policy if exists business_rule_definitions_superuser_all on public.business_rule_definitions;
create policy business_rule_definitions_superuser_all on public.business_rule_definitions
for all to authenticated using (app.is_superuser()) with check (app.is_superuser());

drop policy if exists integration_definitions_superuser_all on public.integration_definitions;
create policy integration_definitions_superuser_all on public.integration_definitions
for all to authenticated using (app.is_superuser()) with check (app.is_superuser());

drop policy if exists validation_rule_definitions_superuser_all on public.validation_rule_definitions;
create policy validation_rule_definitions_superuser_all on public.validation_rule_definitions
for all to authenticated using (app.is_superuser()) with check (app.is_superuser());

drop policy if exists roles_superuser_all on public.roles;
create policy roles_superuser_all on public.roles
for all to authenticated using (app.is_superuser()) with check (app.is_superuser());

drop policy if exists permissions_superuser_all on public.permissions;
create policy permissions_superuser_all on public.permissions
for all to authenticated using (app.is_superuser()) with check (app.is_superuser());

drop policy if exists role_permissions_superuser_all on public.role_permissions;
create policy role_permissions_superuser_all on public.role_permissions
for all to authenticated using (app.is_superuser()) with check (app.is_superuser());
