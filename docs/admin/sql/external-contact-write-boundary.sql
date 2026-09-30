-- Mutations must pass the audited, role-scoped server API.
revoke insert,update,delete on public.entity_contacts from anon,authenticated;
grant select,insert,update on public.entity_contacts to service_role;
