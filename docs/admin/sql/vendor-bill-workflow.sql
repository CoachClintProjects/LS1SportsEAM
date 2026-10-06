alter table public.vendor_bills add column if not exists version integer not null default 1;
-- All Admin AP changes run as one scoped transaction, including history and work.
create or replace function public.admin_vendor_bill_write(p_tenant uuid,p_org uuid,p_actor_user uuid,p_actor_person uuid,p_role text,p_id uuid,p_operation text,p_expected_version integer,p_values jsonb,p_reason text)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare prior vendor_bills; saved vendor_bills; entity uuid; vendor uuid; line jsonb; line_number integer:=0; subtotal_value numeric:=0; line_value numeric; tax numeric; total_value numeric; currency_code text; payment ap_payments; amount_value numeric; task uuid; policy payable_authority_policies; required_role text;
begin
 if p_actor_user is null or p_role is null or p_role not in ('org_admin','treasurer') or p_id is null or length(trim(coalesce(p_reason,'')))<5 or p_operation is null or p_operation not in ('create','edit','submit','approve','return','cancel','payment') then raise exception 'Authorized actor, supported action and reason required';end if;
 perform pg_advisory_xact_lock(hashtextextended('vendor-bill:'||p_id,0));
 select * into prior from vendor_bills where id=p_id for update;
 entity:=case when prior.id is null then (p_values->>'legal_entity_id')::uuid else prior.legal_entity_id end;
 select e.base_currency into currency_code from legal_entities e join organizations o on o.id=e.organization_id where e.id=entity and o.id=p_org and o.tenant_id=p_tenant;
 if currency_code is null then raise exception 'Legal entity outside organization';end if;
 if p_operation='create' and prior.id is not null then
  if exists(select 1 from audit_events where tenant_id=p_tenant and entity_type='vendor_bill' and entity_id=p_id and action='vendor_bill.create' and actor_user_id=p_actor_user and after_data->'request'=p_values) then return to_jsonb(prior);end if;
  raise exception 'Bill identifier already used';
 end if;
 if p_operation<>'create' and prior.id is null then raise exception 'Bill not found';end if;
 -- A successful payment retry returns the current bill before version comparison.
 if p_operation='payment' then
  select * into payment from ap_payments where id=(p_values->>'payment_id')::uuid;
  if payment.id is not null then
   if payment.vendor_bill_id=p_id and payment.amount=(p_values->>'amount')::numeric and payment.reference=trim(p_values->>'reference') and exists(select 1 from audit_events where entity_type='vendor_bill' and entity_id=p_id and actor_user_id=p_actor_user and after_data->'payment'->>'id'=payment.id::text and after_data->'request'=p_values) then return to_jsonb(prior);end if;
   raise exception 'Payment identifier already used';
  end if;
 end if;
 if p_operation<>'create' and prior.version is distinct from p_expected_version then raise exception 'Vendor bill changed. Reload before continuing.';end if;
 if prior.journal_id is not null and p_operation in ('edit','return') then raise exception 'Posted bills cannot return to draft; cancel with a ledger reversal';end if;
 if prior.journal_id is not null and p_operation='cancel' and not exists(select 1 from gl_journals where reversal_of=prior.journal_id and status='posted') then raise exception 'Cancel posted bills through their ledger reversal';end if;
 if p_operation in ('create','edit') then
  if p_operation='edit' and prior.status<>'draft' then raise exception 'Return the bill to draft before editing';end if;
  vendor:=(p_values->>'vendor_id')::uuid;
  if not exists(select 1 from vendors where id=vendor and organization_id=p_org and tenant_id=p_tenant and lower(status)='active') then raise exception 'Select an active vendor in this organization';end if;
  if nullif(trim(p_values->>'bill_number'),'') is null or (p_values->>'bill_date')::date is null or (p_values->>'due_date')::date is null or (p_values->>'due_date')::date<(p_values->>'bill_date')::date then raise exception 'Bill number, bill date and valid due date required';end if;
  perform pg_advisory_xact_lock(hashtextextended('vendor-reference:'||vendor||':'||trim(p_values->>'bill_number'),0));
  if exists(select 1 from vendor_bills where vendor_id=vendor and bill_number=trim(p_values->>'bill_number') and id<>p_id) then raise exception 'This vendor bill number is already recorded';end if;
  if jsonb_typeof(p_values->'lines') is distinct from 'array' or jsonb_array_length(p_values->'lines') not between 1 and 250 then raise exception 'Add between 1 and 250 bill lines';end if;
  for line in select value from jsonb_array_elements(p_values->'lines') loop
   if nullif(trim(line->>'description'),'') is null or coalesce((line->>'quantity')::numeric,0)<=0 or (line->>'quantity')::numeric>1000000 or coalesce((line->>'unit_price')::numeric,-1)<0 or (line->>'unit_price')::numeric>999999999.99 or (line->>'quantity')::numeric='NaN'::numeric or (line->>'unit_price')::numeric='NaN'::numeric then raise exception 'Each line needs a description, positive quantity and non-negative price';end if;
   subtotal_value:=subtotal_value+round((line->>'quantity')::numeric*(line->>'unit_price')::numeric,2);
  end loop;
  tax:=coalesce((p_values->>'tax_total')::numeric,0);total_value:=subtotal_value+tax;
  if tax<0 or tax>999999999.99 or tax='NaN'::numeric or round(tax,2)<>tax or total_value<=0 or total_value>999999999999.99 then raise exception 'Bill total and tax must be valid monetary amounts';end if;
  if p_operation='create' then
   insert into vendor_bills(id,legal_entity_id,vendor_id,bill_number,bill_date,due_date,currency,subtotal,tax_total,total,balance_due,status) values(p_id,entity,vendor,trim(p_values->>'bill_number'),(p_values->>'bill_date')::date,(p_values->>'due_date')::date,currency_code,subtotal_value,tax,total_value,total_value,'draft');
  else
   update vendor_bills set vendor_id=vendor,bill_number=trim(p_values->>'bill_number'),bill_date=(p_values->>'bill_date')::date,due_date=(p_values->>'due_date')::date,subtotal=subtotal_value,tax_total=tax,total=total_value,balance_due=total_value,version=version+1 where id=p_id;
   delete from vendor_bill_lines where vendor_bill_id=p_id;
  end if;
  for line in select value from jsonb_array_elements(p_values->'lines') loop
   line_number:=line_number+1;
   insert into vendor_bill_lines(vendor_bill_id,line_no,description,quantity,unit_price,line_total) values(p_id,line_number,trim(line->>'description'),(line->>'quantity')::numeric,(line->>'unit_price')::numeric,round((line->>'quantity')::numeric*(line->>'unit_price')::numeric,2));
  end loop;
 elsif p_operation='payment' then
  if prior.status not in ('approved','partially_paid') then raise exception 'Bill approval is required before recording payment';end if;
  amount_value:=(p_values->>'amount')::numeric;
  if amount_value is null or amount_value<=0 or amount_value>prior.balance_due or amount_value='NaN'::numeric or round(amount_value,2)<>amount_value or (p_values->>'payment_date')::date is null or (p_values->>'payment_date')::date>current_date or nullif(trim(p_values->>'reference'),'') is null then raise exception 'Payment amount, actual payment date and bank or cheque reference required';end if;
  if not exists(select 1 from payment_methods where tenant_id=p_tenant and organization_id=p_org and code=p_values->>'method' and status='active') then raise exception 'Select an active payment method';end if;
  insert into ap_payments(id,vendor_id,vendor_bill_id,payment_date,amount,currency,method,reference,status) values((p_values->>'payment_id')::uuid,prior.vendor_id,p_id,(p_values->>'payment_date')::date,amount_value,prior.currency,p_values->>'method',trim(p_values->>'reference'),'posted') returning * into payment;
  update vendor_bills set balance_due=balance_due-amount_value,status=case when balance_due=amount_value then 'paid' else 'partially_paid' end,version=version+1 where id=p_id;
 else
  if p_operation='approve' then
   if prior.status<>'submitted' or (p_role<>'org_admin' and prior.approval_required_role<>'treasurer') then raise exception 'The designated authority must approve the submitted bill';end if;
  elsif p_operation='submit' then
   if prior.status<>'draft' or prior.total<=0 or not exists(select 1 from vendor_bill_lines where vendor_bill_id=p_id) then raise exception 'Only complete draft bills can be submitted';end if;
   perform pg_advisory_xact_lock(hashtextextended('payable-policy:'||entity,0));
   select * into policy from payable_authority_policies where legal_entity_id=entity;
   required_role:=case when policy.legal_entity_id is null or prior.total>=policy.executive_threshold then 'org_admin' else 'treasurer' end;
   update vendor_bills set approval_required_role=required_role,approval_policy_version=policy.version where id=p_id;
  elsif p_operation='return' then
   if prior.status not in ('submitted','approved') or (prior.status='approved' and p_role<>'org_admin' and prior.approval_required_role<>'treasurer') then raise exception 'This bill cannot be returned to draft';end if;
  elsif p_operation='cancel' then
   if prior.status not in ('draft','submitted','approved') or (prior.status='approved' and p_role<>'org_admin' and prior.approval_required_role<>'treasurer') or exists(select 1 from ap_payments where vendor_bill_id=p_id and status='posted') then raise exception 'Only unpaid bills can be cancelled by the authorized role';end if;
  end if;
  update vendor_bills set status=case p_operation when 'approve' then 'approved' when 'submit' then 'submitted' when 'return' then 'draft' else 'cancelled' end,approved_by=case when p_operation='approve' then p_actor_user else null end,approved_at=case when p_operation='approve' then now() else null end,version=version+1 where id=p_id;
 end if;
 select * into saved from vendor_bills where id=p_id;
 select id into task from work_items where tenant_id=p_tenant and entity_type='vendor_bill' and entity_id=p_id and work_type='VENDOR_BILL_REVIEW' limit 1;
 if task is null then insert into work_items(tenant_id,work_type,entity_type,entity_id,status) values(p_tenant,'VENDOR_BILL_REVIEW','vendor_bill',p_id,'open') returning id into task;end if;
 update work_items set status=case when saved.status in ('paid','cancelled') then 'completed' else 'open' end,payload=jsonb_build_object('title',saved.bill_number,'organization_id',p_org,'legal_entity_id',entity,'assigned_role',case when saved.status='submitted' then saved.approval_required_role else 'treasurer' end,'bill_status',saved.status,'due_on',saved.due_date) where id=task;
 insert into audit_events(tenant_id,actor_user_id,actor_person_id,action,entity_type,entity_id,before_data,after_data,correlation_id,reason) values(p_tenant,p_actor_user,p_actor_person,'vendor_bill.'||p_operation,'vendor_bill',p_id,to_jsonb(prior),jsonb_build_object('bill',to_jsonb(saved),'payment',to_jsonb(payment),'request',p_values),gen_random_uuid(),trim(p_reason));
 return to_jsonb(saved);
end $$;
revoke all on function public.admin_vendor_bill_write(uuid,uuid,uuid,uuid,text,uuid,text,integer,jsonb,text) from public,anon,authenticated;
grant execute on function public.admin_vendor_bill_write(uuid,uuid,uuid,uuid,text,uuid,text,integer,jsonb,text) to service_role;
