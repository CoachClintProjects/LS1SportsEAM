-- Payables and their GL consequences commit together; no transfer of funds.
alter table public.vendor_bills add column if not exists journal_id uuid references public.gl_journals(id);
alter table public.vendor_bills add column if not exists payable_account_id uuid references public.chart_of_accounts(id);
alter table public.ap_payments add column if not exists journal_id uuid references public.gl_journals(id);
create unique index if not exists vendor_bill_journal_once on public.vendor_bills(journal_id) where journal_id is not null;
create unique index if not exists ap_payment_journal_once on public.ap_payments(journal_id) where journal_id is not null;

create or replace function public.admin_payable_ledger_write(p_tenant uuid,p_org uuid,p_actor_user uuid,p_actor_person uuid,p_role text,p_id uuid,p_operation text,p_expected_version integer,p_values jsonb,p_reason text)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare bill vendor_bills; saved vendor_bills; payment ap_payments; ledger accounting_ledgers; item vendor_bill_lines; entry jsonb; entries jsonb:='[]'::jsonb; journal jsonb; journal_id_value uuid; account_value uuid; control_account uuid; post_date date; task uuid;
begin
 if p_actor_user is null or p_role is null or p_role not in ('org_admin','treasurer') or p_operation is null or p_operation not in ('post_ledger','payment','reverse_payment','cancel') or length(trim(coalesce(p_reason,'')))<5 then raise exception 'Authorized financial actor, supported operation and reason required';end if;
 select b.* into bill from vendor_bills b join legal_entities e on e.id=b.legal_entity_id join organizations o on o.id=e.organization_id where b.id=p_id and o.id=p_org and o.tenant_id=p_tenant;
 if bill.id is null then raise exception 'Bill outside organization';end if;
 perform pg_advisory_xact_lock(hashtextextended('ledger-entity:'||bill.legal_entity_id,0));
 perform pg_advisory_xact_lock(hashtextextended('vendor-bill:'||p_id,0));
 select * into bill from vendor_bills where id=p_id for update;
 if exists(select 1 from audit_events where tenant_id=p_tenant and entity_type='vendor_bill' and entity_id=p_id and actor_user_id=p_actor_user and action='payable_ledger.'||p_operation and after_data->'request'=p_values and (after_data->>'expected_version')::integer=p_expected_version and reason=trim(p_reason)) then return to_jsonb(bill);end if;
 if bill.version is distinct from p_expected_version then raise exception 'Vendor bill changed. Reload before continuing.';end if;
 if p_operation='cancel' and bill.journal_id is null then
  return admin_vendor_bill_write(p_tenant,p_org,p_actor_user,p_actor_person,p_role,p_id,p_operation,p_expected_version,p_values,p_reason);
 end if;
 if p_operation='post_ledger' then
  if bill.status<>'approved' or bill.journal_id is not null or bill.balance_due<>bill.total or exists(select 1 from ap_payments where vendor_bill_id=p_id) then raise exception 'Only an approved, unpaid and unposted bill can be posted';end if;
  select * into ledger from accounting_ledgers where id=(p_values->>'ledger_id')::uuid and legal_entity_id=bill.legal_entity_id and currency=bill.currency and accounting_basis='accrual';
  if ledger.id is null then raise exception 'Select an accrual ledger in the bill currency and legal entity';end if;
  control_account:=(p_values->>'payable_account_id')::uuid;
  if not exists(select 1 from chart_of_accounts where id=control_account and legal_entity_id=bill.legal_entity_id and active and lower(account_type)='liability') then raise exception 'Select an active liability account for accounts payable';end if;
  if jsonb_typeof(p_values->'allocations') is distinct from 'array' or jsonb_array_length(p_values->'allocations')<>(select count(*) from vendor_bill_lines where vendor_bill_id=p_id) then raise exception 'Assign one expense or asset account to every bill line';end if;
  for item in select * from vendor_bill_lines where vendor_bill_id=p_id order by line_no loop
   if (select count(*) from jsonb_array_elements(p_values->'allocations') a where (a->>'line_no')::integer=item.line_no)<>1 then raise exception 'Each bill line needs exactly one account assignment';end if;
   select (a->>'account_id')::uuid into account_value from jsonb_array_elements(p_values->'allocations') a where (a->>'line_no')::integer=item.line_no;
   if not exists(select 1 from chart_of_accounts where id=account_value and legal_entity_id=bill.legal_entity_id and active and lower(account_type) in ('asset','expense')) then raise exception 'Bill line account must be an active expense or asset in this legal entity';end if;
   update vendor_bill_lines set account_id=account_value where id=item.id;
   if item.line_total>0 then entries:=entries||jsonb_build_array(jsonb_build_object('account_id',account_value,'debit',item.line_total,'credit',0,'description',item.description));end if;
  end loop;
  if bill.tax_total>0 then
   account_value:=(p_values->>'tax_account_id')::uuid;
   if not exists(select 1 from chart_of_accounts where id=account_value and legal_entity_id=bill.legal_entity_id and active and lower(account_type) in ('asset','expense')) then raise exception 'Select the applicable recoverable-tax asset or tax expense account';end if;
   entries:=entries||jsonb_build_array(jsonb_build_object('account_id',account_value,'debit',bill.tax_total,'credit',0,'description','Tax on '||bill.bill_number));
  end if;
  entries:=entries||jsonb_build_array(jsonb_build_object('account_id',control_account,'debit',0,'credit',bill.total,'description',bill.bill_number));
  post_date:=(p_values->>'journal_date')::date;
  if post_date is null or post_date<bill.bill_date then raise exception 'Posting date must be on or after the bill date';end if;
 elsif p_operation='payment' then
  if bill.journal_id is null then raise exception 'Post the approved bill to the general ledger before recording payment';end if;
  select l.* into ledger from accounting_ledgers l join gl_journals j on j.ledger_id=l.id where j.id=bill.journal_id and j.status='posted';
  if ledger.id is null or exists(select 1 from gl_journals where reversal_of=bill.journal_id) then raise exception 'Bill ledger posting is not active';end if;
  account_value:=(p_values->>'cash_account_id')::uuid;
  if not exists(select 1 from chart_of_accounts where id=account_value and legal_entity_id=bill.legal_entity_id and active and lower(account_type)='asset') then raise exception 'Select the active bank or cash asset account used for payment';end if;
  perform admin_vendor_bill_write(p_tenant,p_org,p_actor_user,p_actor_person,p_role,p_id,'payment',p_expected_version,p_values,p_reason);
  select * into payment from ap_payments where id=(p_values->>'payment_id')::uuid and vendor_bill_id=p_id;
  entries:=jsonb_build_array(jsonb_build_object('account_id',bill.payable_account_id,'debit',payment.amount,'credit',0,'description',bill.bill_number),jsonb_build_object('account_id',account_value,'debit',0,'credit',payment.amount,'description',payment.reference));
  post_date:=payment.payment_date;
  if post_date<(select journal_date from gl_journals where id=bill.journal_id) then raise exception 'Payment date cannot precede the bill ledger posting';end if;
 else
  -- Reversals leave the original journal and payment history intact.
  if p_operation='cancel' then
   if bill.status<>'approved' or exists(select 1 from ap_payments where vendor_bill_id=p_id and status='posted') or (p_role<>'org_admin' and bill.approval_required_role<>'treasurer') then raise exception 'Only the approving authority can cancel an unpaid posted bill';end if;
   journal_id_value:=bill.journal_id;
  else
   select * into payment from ap_payments where id=(p_values->>'payment_id')::uuid and vendor_bill_id=p_id for update;
   if payment.id is null or payment.status<>'posted' or payment.journal_id is null then raise exception 'Select an unreversed payment with a linked ledger posting';end if;
   journal_id_value:=payment.journal_id;
  end if;
  select to_jsonb(j) into journal from gl_journals j where id=journal_id_value;
  if (p_values->>'journal_date')::date < (journal->>'journal_date')::date then raise exception 'Reversal date cannot precede the original posting';end if;
  perform admin_ledger_write(p_tenant,p_org,p_actor_user,p_actor_person,journal_id_value,'reverse',(journal->>'version')::integer,jsonb_build_object('reversal_id',p_values->>'journal_id','journal_number',p_values->>'journal_number','journal_date',p_values->>'journal_date'),p_reason);
  if p_operation='cancel' then
   perform admin_vendor_bill_write(p_tenant,p_org,p_actor_user,p_actor_person,p_role,p_id,'cancel',p_expected_version,p_values,p_reason);
  else
   update ap_payments set status='reversed' where id=payment.id;
   update vendor_bills set balance_due=balance_due+payment.amount,status=case when balance_due+payment.amount=total then 'approved' else 'partially_paid' end,version=version+1 where id=p_id;
  end if;
 end if;
 if p_operation in ('post_ledger','payment') then
  journal_id_value:=(p_values->>'journal_id')::uuid;
  if journal_id_value is null then raise exception 'Stable journal identifier required';end if;
  journal:=admin_ledger_write(p_tenant,p_org,p_actor_user,p_actor_person,journal_id_value,'create',0,jsonb_build_object('legal_entity_id',bill.legal_entity_id,'ledger_id',ledger.id,'journal_number',p_values->>'journal_number','journal_date',post_date,'description',case when p_operation='post_ledger' then 'Vendor bill ' else 'Vendor payment ' end||bill.bill_number,'lines',entries),p_reason);
  update gl_journals set source=case when p_operation='post_ledger' then 'vendor_bill' else 'vendor_payment' end where id=journal_id_value returning to_jsonb(gl_journals.*) into journal;
  perform admin_ledger_write(p_tenant,p_org,p_actor_user,p_actor_person,journal_id_value,'post',(journal->>'version')::integer,'{}',p_reason);
  if p_operation='post_ledger' then update vendor_bills set journal_id=journal_id_value,payable_account_id=control_account,version=version+1 where id=p_id;
  else update ap_payments set journal_id=journal_id_value where id=payment.id;end if;
 end if;
 select * into saved from vendor_bills where id=p_id;
 update work_items set status=case when saved.status in ('paid','cancelled') then 'completed' else 'open' end,payload=payload||jsonb_build_object('bill_status',saved.status,'assigned_role','treasurer','journal_id',saved.journal_id) where tenant_id=p_tenant and entity_type='vendor_bill' and entity_id=p_id and work_type='VENDOR_BILL_REVIEW';
 insert into audit_events(tenant_id,actor_user_id,actor_person_id,action,entity_type,entity_id,before_data,after_data,correlation_id,reason) values(p_tenant,p_actor_user,p_actor_person,'payable_ledger.'||p_operation,'vendor_bill',p_id,to_jsonb(bill),jsonb_build_object('bill',to_jsonb(saved),'request',p_values,'expected_version',p_expected_version,'journal_id',journal_id_value),gen_random_uuid(),trim(p_reason));
 return to_jsonb(saved);
end $$;
revoke all on function public.admin_payable_ledger_write(uuid,uuid,uuid,uuid,text,uuid,text,integer,jsonb,text) from public,anon,authenticated;
grant execute on function public.admin_payable_ledger_write(uuid,uuid,uuid,uuid,text,uuid,text,integer,jsonb,text) to service_role;

create or replace function public.validate_payable_payment_posting() returns trigger language plpgsql security invoker set search_path=public as $$
declare current_payment ap_payments; bill vendor_bills;
begin
 select * into current_payment from ap_payments where id=new.id;
 select * into bill from vendor_bills where id=current_payment.vendor_bill_id;
 if bill.journal_id is not null then
  if current_payment.journal_id is null or not exists(select 1 from gl_journals where id=current_payment.journal_id and status='posted' and source='vendor_payment') then raise exception 'Payment and its ledger posting must commit together';end if;
  if current_payment.status='reversed' and not exists(select 1 from gl_journals where reversal_of=current_payment.journal_id and status='posted') then raise exception 'Reversed payments require a posted ledger reversal';end if;
 end if;
 return new;
end $$;
create constraint trigger validate_payable_payment_posting after insert or update on public.ap_payments deferrable initially deferred for each row execute function public.validate_payable_payment_posting();
revoke all on function public.validate_payable_payment_posting() from public,anon,authenticated;

-- Even an older API cannot reverse a linked posting without reconciling AP.
create or replace function public.validate_payable_reversal() returns trigger language plpgsql security invoker set search_path=public as $$
declare original gl_journals; linked_bill vendor_bills; linked_payment ap_payments;
begin
 if new.reversal_of is null then return new;end if;
 select * into original from gl_journals where id=new.reversal_of;
 select * into linked_bill from vendor_bills where journal_id=original.id;
 select * into linked_payment from ap_payments where journal_id=original.id;
 if linked_bill.id is not null and linked_bill.status<>'cancelled' then raise exception 'Bill reversal and cancellation must commit together';end if;
 if linked_payment.id is not null and linked_payment.status<>'reversed' then raise exception 'Payment reversal and payable balance correction must commit together';end if;
 if original.reversal_of is not null and exists(
  with recursive ancestors as (
   select id,reversal_of,source from gl_journals where id=original.reversal_of
   union all select j.id,j.reversal_of,j.source from gl_journals j join ancestors a on j.id=a.reversal_of
  ) select 1 from ancestors where source in ('vendor_bill','vendor_payment')
 ) then raise exception 'A payable reversal cannot itself be reversed; record a new approved transaction';end if;
 return new;
end $$;
create constraint trigger validate_payable_reversal after insert or update on public.gl_journals deferrable initially deferred for each row execute function public.validate_payable_reversal();
revoke all on function public.validate_payable_reversal() from public,anon,authenticated;
