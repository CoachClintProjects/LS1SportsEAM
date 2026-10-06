create or replace function public.admin_payable_reconciliation(p_tenant uuid,p_org uuid,p_entity uuid)
returns jsonb language plpgsql stable security invoker set search_path=public as $$
declare rows jsonb;
begin
 if not exists(select 1 from legal_entities e join organizations o on o.id=e.organization_id where e.id=p_entity and o.id=p_org and o.tenant_id=p_tenant) then raise exception 'Legal entity outside organization';end if;
 with controls as (
  select distinct b.payable_account_id account_id,j.ledger_id from vendor_bills b join gl_journals j on j.id=b.journal_id where b.legal_entity_id=p_entity
 ), outstanding as (
  select b.payable_account_id account_id,j.ledger_id,sum(case when b.status='cancelled' then 0 else b.balance_due end) balance
  from vendor_bills b join gl_journals j on j.id=b.journal_id where b.legal_entity_id=p_entity group by b.payable_account_id,j.ledger_id
 ), posted as (
  select l.account_id,j.ledger_id,sum(l.credit-l.debit) balance from gl_lines l join gl_journals j on j.id=l.journal_id where j.legal_entity_id=p_entity and j.status='posted' group by l.account_id,j.ledger_id
 ) select coalesce(jsonb_agg(jsonb_build_object('ledger_id',c.ledger_id,'ledger_name',g.name,'currency',g.currency,'account_code',a.account_code,'account_name',a.account_name,'payable_balance',coalesce(o.balance,0)::text,'ledger_balance',coalesce(p.balance,0)::text,'variance',(coalesce(p.balance,0)-coalesce(o.balance,0))::text) order by g.name,a.account_code),'[]'::jsonb) into rows
 from controls c join chart_of_accounts a on a.id=c.account_id join accounting_ledgers g on g.id=c.ledger_id left join outstanding o on o.account_id=c.account_id and o.ledger_id=c.ledger_id left join posted p on p.account_id=c.account_id and p.ledger_id=c.ledger_id;
 return jsonb_build_object('controls',rows,'unposted_bill_count',(select count(*) from vendor_bills where legal_entity_id=p_entity and status not in ('draft','cancelled') and journal_id is null),'unlinked_payment_count',(select count(*) from ap_payments p join vendor_bills b on b.id=p.vendor_bill_id where b.legal_entity_id=p_entity and p.status='posted' and p.journal_id is null));
end $$;
revoke all on function public.admin_payable_reconciliation(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.admin_payable_reconciliation(uuid,uuid,uuid) to service_role;
