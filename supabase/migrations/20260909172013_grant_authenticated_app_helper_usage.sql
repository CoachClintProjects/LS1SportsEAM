grant usage on schema app to authenticated;
grant execute on function app.current_person_id() to authenticated;
grant execute on function app.current_tenant_ids() to authenticated;
grant execute on function app.has_admin_role(text[]) to authenticated;
grant execute on function app.is_admin() to authenticated;
grant execute on function app.is_superuser() to authenticated;