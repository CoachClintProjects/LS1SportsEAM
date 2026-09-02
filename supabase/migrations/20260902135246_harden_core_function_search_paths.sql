-- Security hardening: deterministic function search paths
alter function public.person_is_minor(uuid) set search_path = public, pg_temp;
alter function public.person_has_role_code(uuid, text[]) set search_path = public, pg_temp;
alter function public.enforce_rule_of_two() set search_path = public, pg_temp;
alter function public.prevent_audit_mutation() set search_path = public, pg_temp;
alter function public.validate_rule_of_two_thread() set search_path = public, pg_temp;
alter function public.validate_posted_journal() set search_path = public, pg_temp;
