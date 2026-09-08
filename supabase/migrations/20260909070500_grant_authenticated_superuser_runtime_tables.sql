-- PostgREST requires table privileges in addition to RLS policies.
-- Grant only the active Super User runtime tables that were intentionally withheld.
grant select, update on public.platform_superuser_operators to authenticated;
grant select on public.hub_navigation to authenticated;
grant select on public.hub_role_navigation to authenticated;
grant select, insert, update, delete on public.client_onboarding_cases to authenticated;
grant select, insert, update, delete on public.client_onboarding_steps to authenticated;
grant select, insert, update, delete on public.platform_release_candidates to authenticated;
grant select, insert, update, delete on public.platform_release_verifications to authenticated;
grant select, insert, update, delete on public.platform_release_defects to authenticated;
grant select, insert, update, delete on public.platform_preferences to authenticated;
grant select on public.platform_implementation_inventory to authenticated;
