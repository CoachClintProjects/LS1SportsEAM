-- The Super User command endpoint executes this RPC with the authenticated caller JWT.
-- Keep anonymous callers denied; RLS and app.is_superuser() remain the row authority.
revoke all on function public.get_superuser_command() from public, anon;
grant execute on function public.get_superuser_command() to authenticated;
