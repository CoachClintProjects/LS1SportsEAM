do $$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='urws_financial_dispositions' and policyname='urws_financial_dispositions_admin_read') then
  create policy urws_financial_dispositions_admin_read on public.urws_financial_dispositions for select to authenticated using (
   app.has_admin_role(array['org_admin','treasurer']) and organization_id in (select o.id from public.organizations o where o.tenant_id in (select app.current_tenant_ids()))
  );
 end if;
end $$;
grant select on public.urws_financial_dispositions to authenticated;
