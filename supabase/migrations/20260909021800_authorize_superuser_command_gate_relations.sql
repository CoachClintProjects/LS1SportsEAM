-- Complete the authenticated/RLS dependency chain for public.get_superuser_command().
-- These relations feed the implementation-gate progress model exposed by the Super User Command Center.
grant select on table public.platform_implementation_gates to authenticated;
grant select on table public.platform_milestone_gate_status to authenticated;

drop policy if exists platform_implementation_gates_superuser_read on public.platform_implementation_gates;
create policy platform_implementation_gates_superuser_read
on public.platform_implementation_gates
for select
to authenticated
using (app.is_superuser());

drop policy if exists platform_milestone_gate_status_superuser_read on public.platform_milestone_gate_status;
create policy platform_milestone_gate_status_superuser_read
on public.platform_milestone_gate_status
for select
to authenticated
using (app.is_superuser());
