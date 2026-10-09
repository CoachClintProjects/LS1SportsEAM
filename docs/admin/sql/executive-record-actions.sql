-- Prompt 01: reuse existing waiver, journal, work and audit tables.
create or replace function public.admin_waiver_exception(
 p_tenant uuid,p_org uuid,p_actor_user uuid,p_actor_person uuid,p_id uuid,
 p_expected_updated_at timestamptz,p_operation text,p_reason text,p_request uuid)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare prior waiver_assignments; saved waiver_assignments; previous audit_events; request_data jsonb;
begin
 if p_actor_user is null or p_actor_person is null or p_request is null or p_operation not in ('waive','restore') or p_operation is null or length(trim(coalesce(p_reason,'')))<5 then raise exception 'Actor, action, request and reason required';end if;
 if not exists(select 1 from organizations where id=p_org and tenant_id=p_tenant) then raise exception 'Club outside account';end if;
 perform pg_advisory_xact_lock(hashtextextended('waiver-request:'||p_request,0));
 request_data:=jsonb_build_object('id',p_id,'operation',p_operation,'reason',trim(p_reason),'expected_updated_at',p_expected_updated_at);
 select * into previous from audit_events where correlation_id=p_request and action='waiver.exception' limit 1;
 if previous.id is not null then
  if previous.tenant_id=p_tenant and previous.actor_user_id=p_actor_user and previous.after_data->'request'=request_data then return previous.after_data->'record';end if;
  raise exception 'Request identifier already used';
 end if;
 select w.* into prior from waiver_assignments w join people p on p.id=w.person_id where w.id=p_id and w.organization_id=p_org and p.tenant_id=p_tenant for update of w;
 if not found then raise exception 'Waiver assignment outside club';end if;
 if prior.updated_at is distinct from p_expected_updated_at then raise exception 'Record changed. Reload before deciding.';end if;
 if p_operation='waive' and prior.status not in ('assigned','pending','overdue') then raise exception 'Only an outstanding waiver requirement can be exempted';end if;
 if p_operation='restore' and prior.status<>'waived' then raise exception 'Only an exempted requirement can be restored';end if;
 update waiver_assignments set status=case when p_operation='waive' then 'waived' else 'assigned' end,
 waived_at=case when p_operation='waive' then now() else null end,reason=trim(p_reason),updated_at=clock_timestamp(),
 metadata=coalesce(metadata,'{}')||jsonb_build_object('exception_actor',p_actor_person,'exception_request',p_request,'exception_decided_at',now())
 where id=p_id returning * into saved;
 -- An exception is not a signature: waiver_acceptances is deliberately untouched.
 insert into audit_events(tenant_id,actor_user_id,actor_person_id,action,entity_type,entity_id,before_data,after_data,correlation_id,reason)
 values(p_tenant,p_actor_user,p_actor_person,'waiver.exception','waiver_assignment',p_id,to_jsonb(prior),jsonb_build_object('record',to_jsonb(saved),'request',request_data),p_request,trim(p_reason));
 return to_jsonb(saved);
end $$;
revoke all on function public.admin_waiver_exception(uuid,uuid,uuid,uuid,uuid,timestamptz,text,text,uuid) from public,anon,authenticated;
grant execute on function public.admin_waiver_exception(uuid,uuid,uuid,uuid,uuid,timestamptz,text,text,uuid) to service_role;

create or replace function public.admin_club_finance_action(
 p_tenant uuid,p_org uuid,p_actor_user uuid,p_actor_person uuid,p_request uuid,p_operation text,p_values jsonb,p_reason text)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare ledger accounting_ledgers; fee competition_entry_fees; debit_account chart_of_accounts; credit_account chart_of_accounts;
 prior work_items; original work_items; saved work_items; journal jsonb; journal_row gl_journals; amount numeric; available numeric; request_data jsonb; target uuid; posting_date date;
begin
 if p_actor_user is null or p_actor_person is null or p_request is null or p_operation is null or p_operation not in ('cover_entry_fee','release_escrow','reverse') or length(trim(coalesce(p_reason,'')))<5 then raise exception 'Actor, action, request and reason required';end if;
 if not exists(select 1 from organizations where id=p_org and tenant_id=p_tenant) then raise exception 'Club outside account';end if;
 perform pg_advisory_xact_lock(hashtextextended('executive-finance:'||p_request,0));
 request_data:=jsonb_build_object('operation',p_operation,'values',p_values,'reason',trim(p_reason));
 select * into prior from work_items where id=p_request;
 if prior.id is not null then
  if prior.tenant_id=p_tenant and prior.work_type='CLUB_FINANCE_DECISION' and prior.payload->'request'=request_data and prior.payload->>'actor_user'=p_actor_user::text then return to_jsonb(prior);end if;
  raise exception 'Request identifier already used';
 end if;
 posting_date:=(p_values->>'date')::date;
 if posting_date is null or posting_date>current_date then raise exception 'Enter the actual posting date, not a future date';end if;
 if p_operation='reverse' then
  target:=(p_values->>'decision_id')::uuid;
  select * into original from work_items where id=target and tenant_id=p_tenant and work_type='CLUB_FINANCE_DECISION' and payload->>'organization_id'=p_org::text;
  if original.id is null or original.payload->>'operation'='reverse' then raise exception 'Original club transaction required';end if;
  select * into journal_row from gl_journals where id=original.entity_id;
  perform pg_advisory_xact_lock(hashtextextended('ledger-entity:'||journal_row.legal_entity_id,0));
  select * into original from work_items where id=target for update;
  if original.payload ? 'reversed_by' then raise exception 'Transaction already reversed';end if;
  journal:=admin_ledger_write(p_tenant,p_org,p_actor_user,p_actor_person,journal_row.id,'reverse',(p_values->>'version')::integer,
   jsonb_build_object('reversal_id',p_request,'journal_number','REV-'||p_request::text,'journal_date',posting_date),p_reason);
  if original.payload->>'operation'='cover_entry_fee' then
   select * into fee from competition_entry_fees where id=(original.payload->>'fee_id')::uuid for update;
   if fee.status is distinct from 'club_covered' then raise exception 'Entry fee changed after the original decision';end if;
   update competition_entry_fees set status=original.payload->>'previous_fee_status' where id=fee.id;
  end if;
  update work_items set payload=payload||jsonb_build_object('reversed_by',p_request) where id=target;
 else
  select l.* into ledger from accounting_ledgers l join legal_entities e on e.id=l.legal_entity_id where l.id=(p_values->>'ledger_id')::uuid and e.organization_id=p_org;
  if ledger.id is null then raise exception 'Select a club ledger';end if;
  perform pg_advisory_xact_lock(hashtextextended('ledger-entity:'||ledger.legal_entity_id,0));
  select * into debit_account from chart_of_accounts where id=(p_values->>'debit_account')::uuid and legal_entity_id=ledger.legal_entity_id and active=true;
  select * into credit_account from chart_of_accounts where id=(p_values->>'credit_account')::uuid and legal_entity_id=ledger.legal_entity_id and active=true;
  if debit_account.id is null or credit_account.id is null or debit_account.id=credit_account.id then raise exception 'Select two different active club accounts';end if;
  if p_operation='cover_entry_fee' then
   select f.* into fee from competition_entry_fees f join competitions c on c.id=f.competition_id where f.id=(p_values->>'fee_id')::uuid and c.organization_id=p_org for update of f;
   if fee.id is null or fee.status is distinct from 'assessed' then raise exception 'Select an assessed entry fee in this club';end if;
   if fee.currency_code is distinct from ledger.currency then raise exception 'Entry fee and ledger currencies must match';end if;
   if lower(debit_account.account_type)<>'expense' or lower(credit_account.account_type)<>'liability' then raise exception 'Select a club expense account and an amount-owed liability account';end if;
   amount:=fee.total_amount;
  else
   amount:=(p_values->>'amount')::numeric;
   if lower(debit_account.account_type)<>'liability' or lower(credit_account.account_type)<>'asset' then raise exception 'Select the funds-held liability account and paying bank asset account';end if;
   if nullif(trim(p_values->>'payment_reference'),'') is null then raise exception 'Enter the actual payment reference';end if;
   -- Locking the entity serializes this balance check with other ledger writes.
   select coalesce(sum(l.credit-l.debit),0) into available from gl_lines l join gl_journals j on j.id=l.journal_id where l.account_id=debit_account.id and j.ledger_id=ledger.id and j.status='posted' and j.journal_date<=posting_date;
   if available<amount then raise exception 'Release exceeds the recorded funds held';end if;
  end if;
  if amount is null or amount='NaN'::numeric or amount<=0 or amount>999999999999.99 or round(amount,2)<>amount then raise exception 'A positive amount with at most two decimals is required';end if;
  journal:=admin_ledger_write(p_tenant,p_org,p_actor_user,p_actor_person,p_request,'create',null,
   jsonb_build_object('legal_entity_id',ledger.legal_entity_id,'ledger_id',ledger.id,'journal_number','CLUB-'||p_request::text,'journal_date',posting_date,
   'description',case when p_operation='cover_entry_fee' then 'Club covers entry fee' else 'Recorded release of funds held' end||': '||trim(p_reason),
   'lines',jsonb_build_array(jsonb_build_object('account_id',debit_account.id,'debit',amount,'credit',0),jsonb_build_object('account_id',credit_account.id,'debit',0,'credit',amount))),p_reason);
  journal:=admin_ledger_write(p_tenant,p_org,p_actor_user,p_actor_person,p_request,'post',(journal->>'version')::integer,'{}',p_reason);
  if p_operation='cover_entry_fee' then update competition_entry_fees set status='club_covered' where id=fee.id;end if;
 end if;
 insert into work_items(id,tenant_id,work_type,entity_type,entity_id,owner_person_id,status,payload)
 values(p_request,p_tenant,'CLUB_FINANCE_DECISION','gl_journal',(journal->>'id')::uuid,p_actor_person,'completed',
 jsonb_build_object('title',case p_operation when 'cover_entry_fee' then 'Club covers entry fee' when 'release_escrow' then 'Recorded funds release' else 'Transaction reversed' end,
 'organization_id',p_org,'actor_user',p_actor_user,'operation',p_operation,'request',request_data,'journal',journal,'fee_id',fee.id,'previous_fee_status',fee.status,'amount',amount,'reversal_of',target)) returning * into saved;
 insert into audit_events(tenant_id,actor_user_id,actor_person_id,action,entity_type,entity_id,after_data,correlation_id,reason)
 values(p_tenant,p_actor_user,p_actor_person,'club_finance.'||p_operation,'gl_journal',(journal->>'id')::uuid,to_jsonb(saved),p_request,trim(p_reason));
 return to_jsonb(saved);
end $$;
revoke all on function public.admin_club_finance_action(uuid,uuid,uuid,uuid,uuid,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.admin_club_finance_action(uuid,uuid,uuid,uuid,uuid,text,jsonb,text) to service_role;

create or replace function public.admin_club_cash_receipt(p_tenant uuid,p_org uuid,p_actor_user uuid,p_actor_person uuid,p_request uuid,p_invoice uuid,p_amount numeric,p_method text,p_reason text)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare prior audit_events; request_data jsonb; result jsonb;
begin
 if p_actor_user is null or p_actor_person is null or p_request is null or length(trim(coalesce(p_reason,'')))<5 then raise exception 'Actor, request and reason required';end if;
 if not exists(select 1 from organizations where id=p_org and tenant_id=p_tenant) then raise exception 'Club outside account';end if;
 perform pg_advisory_xact_lock(hashtextextended('club-cash:'||p_request,0));
 request_data:=jsonb_build_object('invoice',p_invoice,'amount',p_amount,'method',p_method,'reason',trim(p_reason));
 select * into prior from audit_events where correlation_id=p_request and action='club_finance.cash' limit 1;
 if prior.id is not null then
  if prior.tenant_id=p_tenant and prior.actor_user_id=p_actor_user and prior.after_data->'request'=request_data then return prior.after_data->'result';end if;
  raise exception 'Request identifier already used';
 end if;
 if not exists(select 1 from payment_methods where tenant_id=p_tenant and organization_id=p_org and code=p_method and method_type='cash' and status='active') then raise exception 'Active club cash payment method required';end if;
 result:=admin_post_invoice_payment(p_actor_user,p_actor_person,p_org,p_invoice,p_amount,p_method,p_request::text);
 insert into audit_events(tenant_id,actor_user_id,actor_person_id,action,entity_type,entity_id,after_data,correlation_id,reason)
 values(p_tenant,p_actor_user,p_actor_person,'club_finance.cash','invoice',p_invoice,jsonb_build_object('request',request_data,'result',result,'payload',jsonb_build_object('organization_id',p_org)),p_request,trim(p_reason));
 return result;
end $$;
revoke all on function public.admin_club_cash_receipt(uuid,uuid,uuid,uuid,uuid,uuid,numeric,text,text) from public,anon,authenticated;
grant execute on function public.admin_club_cash_receipt(uuid,uuid,uuid,uuid,uuid,uuid,numeric,text,text) to service_role;
