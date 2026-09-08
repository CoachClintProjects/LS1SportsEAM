drop policy if exists hub_navigation_superuser_read on public.hub_navigation;
create policy hub_navigation_superuser_read on public.hub_navigation
for select to authenticated
using (app.is_superuser());

drop policy if exists admin_roles_superuser_read on public.admin_roles;
create policy admin_roles_superuser_read on public.admin_roles
for select to authenticated
using (app.is_superuser());

drop policy if exists hub_role_navigation_superuser_read on public.hub_role_navigation;
create policy hub_role_navigation_superuser_read on public.hub_role_navigation
for select to authenticated
using (app.is_superuser());
