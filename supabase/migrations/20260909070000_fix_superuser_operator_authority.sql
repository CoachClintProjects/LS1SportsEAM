-- Super User authorization must be bound to the authenticated Supabase user.
-- Platform operators are authoritative even when they intentionally do not have a person row.
create or replace function app.is_superuser()
returns boolean
language sql
stable
security definer
set search_path = public, app, auth
as $$
  select
    exists (
      select 1
      from public.platform_superuser_operators pso
      where pso.auth_user_id = auth.uid()
        and pso.active = true
    )
    or exists (
      select 1
      from public.person_role_assignments pra
      join public.roles r on r.id = pra.role_id
      where pra.person_id = app.current_person_id()
        and upper(pra.status) = 'ACTIVE'
        and r.code = 'SYSTEM_SUPERUSER'
    );
$$;

revoke all on function app.is_superuser() from public;
grant execute on function app.is_superuser() to authenticated;
