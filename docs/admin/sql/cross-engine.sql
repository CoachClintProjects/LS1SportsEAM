-- Prompt 03. Existing records only; no synthetic setup or business entries.
-- All entry points are server-only and commit their effects atomically.
create or replace function public.admin_cross_engine(p_tenant uuid,p_org uuid,p_actor_user uuid,p_actor_person uuid,p_request uuid,p_operation text,p_values jsonb,p_reason text)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare prior audit_events; request_data jsonb; result jsonb; cfg jsonb; src groups; dst groups; tm teams; season seasons;
 inv invoices; ln invoice_lines; holding work_items; ledger accounting_ledgers; jr jsonb; jid uuid:=gen_random_uuid();
 amount numeric; subtotal numeric; tax numeric; remaining integer; elapsed integer; total_days integer; headcount integer;
 athlete uuid; target uuid; credit_id uuid; task_id uuid; payment_id uuid; policy_version integer; row_data record;
begin
 if p_actor_user is null or p_actor_person is null or p_request is null or p_operation is null or length(trim(coalesce(p_reason,'')))<5 then raise exception 'A signed-in decision maker, request and reason are required';end if;
 if not exists(select 1 from organizations where id=p_org and tenant_id=p_tenant) or not exists(select 1 from people where id=p_actor_person and tenant_id=p_tenant) then raise exception 'Club authority denied';end if;
 perform pg_advisory_xact_lock(hashtextextended('cross-engine:'||p_org,0));
 request_data:=jsonb_build_object('operation',p_operation,'values',p_values,'reason',trim(p_reason));
 select * into prior from audit_events where correlation_id=p_request and action='cross_engine.'||p_operation limit 1;
 if prior.id is not null then
  if prior.tenant_id=p_tenant and prior.actor_user_id=p_actor_user and prior.after_data->'request'=request_data then return prior.after_data->'result';end if;
  raise exception 'Request identifier already used';
 end if;
 select config_value into cfg from system_configurations where tenant_id=p_tenant and config_namespace='admin.cross_engine' and config_key=p_org::text and active order by version desc limit 1;
 if p_operation='settings' then
  if not exists(select 1 from accounting_ledgers l join legal_entities e on e.id=l.legal_entity_id where l.id=(p_values->>'ledger_id')::uuid and e.organization_id=p_org) then raise exception 'Select a club ledger';end if;
  select * into ledger from accounting_ledgers where id=(p_values->>'ledger_id')::uuid;
  for row_data in select * from (values ('bank_account','asset'),('held_account','asset'),('receivable_account','asset'),('income_account','revenue'),('tax_account','liability')) as accounts(key,kind) loop
   if not exists(select 1 from chart_of_accounts where id=(p_values->>row_data.key)::uuid and legal_entity_id=ledger.legal_entity_id and active and lower(account_type)=row_data.kind) then raise exception 'Choose the correct active club account for %',row_data.key;end if;
  end loop;
  if (select count(distinct x) from unnest(array[p_values->>'bank_account',p_values->>'held_account',p_values->>'receivable_account',p_values->>'income_account',p_values->>'tax_account']) x)<>5 then raise exception 'Each purpose needs a different account';end if;
  select coalesce(max(version),0)+1 into policy_version from system_configurations where tenant_id=p_tenant and config_namespace='admin.cross_engine' and config_key=p_org::text;
  update system_configurations set active=false where tenant_id=p_tenant and config_namespace='admin.cross_engine' and config_key=p_org::text and active;
  insert into system_configurations(tenant_id,config_namespace,config_key,config_value,version,updated_by) values(p_tenant,'admin.cross_engine',p_org::text,p_values,policy_version,p_actor_user);
  result:=jsonb_build_object('saved',true);
 elsif p_operation='squad_settings' then
  select g.* into dst from groups g join teams t on t.id=g.team_id where g.id=(p_values->>'group_id')::uuid and t.organization_id=p_org;
  if dst.id is null or (p_values->>'hard_cap')::integer<1 or (p_values->>'hard_cap') is null then raise exception 'Select a club squad and positive whole roster limit';end if;
  select coalesce(max(version),0)+1 into policy_version from system_configurations where tenant_id=p_tenant and config_namespace='admin.squad' and config_key=dst.id::text;
  update system_configurations set active=false where tenant_id=p_tenant and config_namespace='admin.squad' and config_key=dst.id::text and active;
  insert into system_configurations(tenant_id,config_namespace,config_key,config_value,version,updated_by) values(p_tenant,'admin.squad',dst.id::text,jsonb_build_object('hard_cap',(p_values->>'hard_cap')::integer,'organization_id',p_org),policy_version,p_actor_user);
  result:=jsonb_build_object('saved',true);
 elsif p_operation in ('preview_transfer','transfer') then
  athlete:=(p_values->>'athlete_id')::uuid;
  select g.* into src from groups g join teams t on t.id=g.team_id join group_memberships m on m.group_id=g.id where g.id=(p_values->>'source_id')::uuid and m.athlete_id=athlete and m.status='active' and t.organization_id=p_org for update of g,m;
  if src.id is null then raise exception 'Select the athlete’s current club squad';end if;
  select * into tm from teams where id=src.team_id;
  select * into season from seasons where id=tm.season_id and organization_id=p_org;
  if season.starts_on is null or season.ends_on is null or season.ends_on<season.starts_on or current_date not between season.starts_on and season.ends_on then raise exception 'The squad needs an active season with valid start and end dates';end if;
  if nullif(p_values->>'destination_id','') is not null then
   select g.* into dst from groups g join teams t on t.id=g.team_id where g.id=(p_values->>'destination_id')::uuid and t.organization_id=p_org and t.season_id=season.id and t.status='active' and g.status='active' for update of g;
   if dst.id is null or dst.id=src.id then raise exception 'Choose a different active squad in the same season';end if;
   if exists(select 1 from group_memberships where group_id=dst.id and athlete_id=athlete and status='active') then raise exception 'Athlete already belongs to that squad';end if;
   select (config_value->>'hard_cap')::integer into headcount from system_configurations where tenant_id=p_tenant and config_namespace='admin.squad' and config_key=dst.id::text and active order by version desc limit 1;
   if headcount is null then raise exception 'Set the destination squad roster limit first';end if;
   if (select count(*) from group_memberships where group_id=dst.id and status='active' and (starts_on is null or starts_on<=current_date) and (ends_on is null or ends_on>=current_date))>=headcount and coalesce((p_values->>'president_override')::boolean,false)=false then raise exception '[DENY: ERR-881: ROSTER CAPACITY OVERRUN - DESTINATION GROUP LOCKED]';end if;
  end if;
  select i.* into inv from invoices i join customers c on c.id=i.customer_id join athletes a on a.person_id=c.person_id where i.id=(p_values->>'invoice_id')::uuid and a.id=athlete and c.organization_id=p_org and i.status not in ('draft','void','cancelled') for update of i;
  select * into ln from invoice_lines where id=(p_values->>'source_line_id')::uuid and invoice_id=inv.id and entity_type='group' and entity_id=src.id;
  if inv.id is null or ln.id is null or ln.line_total<=0 or ln.tax_amount is null then raise exception 'Select this athlete’s issued squad-fee invoice and linked squad fee line';end if;
  subtotal:=0;tax:=0;
  if dst.id is not null then
   select l.line_total,l.tax_amount into subtotal,tax from invoice_lines l join invoices i on i.id=l.invoice_id join legal_entities e on e.id=i.legal_entity_id where l.id=(p_values->>'destination_line_id')::uuid and l.entity_type='group' and l.entity_id=dst.id and i.currency=inv.currency and e.organization_id=p_org and i.status not in ('draft','void','cancelled');
   if subtotal is null or tax is null then raise exception 'Select an issued fee line for the destination squad in the same currency';end if;
  end if;
  total_days:=season.ends_on-season.starts_on+1;elapsed:=current_date-season.starts_on;remaining:=season.ends_on-current_date+1;
  subtotal:=round((subtotal-ln.line_total)*remaining/total_days,2);tax:=round((tax-ln.tax_amount)*remaining/total_days,2);
  if subtotal+tax<0 and elapsed>=30 then subtotal:=0;tax:=0;end if;
  amount:=subtotal+tax;
  result:=jsonb_build_object('subtotal',subtotal,'tax_total',tax,'balance_due',amount,'elapsedDays',elapsed,'remainingDays',remaining,'totalDays',total_days,'refundCutoff',elapsed>=30,'currency',inv.currency);
  if p_operation='preview_transfer' then return result;end if;
  if p_values->'quote' is distinct from result then raise exception 'Recalculate Club Balance before saving; the quote changed';end if;
  if amount>0 then
   if cfg is null then raise exception 'Set up the club posting accounts first';end if;
   select * into ledger from accounting_ledgers where id=(cfg->>'ledger_id')::uuid and legal_entity_id=inv.legal_entity_id and currency=inv.currency;
   if ledger.id is null or subtotal<0 or tax<0 then raise exception 'Fee components need review before this move can be posted';end if;
   target:=gen_random_uuid();
   insert into invoices(id,legal_entity_id,customer_id,invoice_number,currency,subtotal,tax_total,total,balance_due,status) values(target,inv.legal_entity_id,inv.customer_id,'MOVE-'||p_request,inv.currency,subtotal,tax,amount,amount,'issued');
   insert into invoice_lines(invoice_id,line_no,description,quantity,unit_price,tax_amount,line_total,entity_type,entity_id) values(target,1,'Remaining season squad fee',1,subtotal,tax,subtotal,'group',dst.id);
   jr:=admin_ledger_write(p_tenant,p_org,p_actor_user,p_actor_person,jid,'create',null,jsonb_build_object('legal_entity_id',ledger.legal_entity_id,'ledger_id',ledger.id,'journal_number','MOVE-'||p_request,'journal_date',current_date,'description',p_reason,'lines',jsonb_build_array(jsonb_build_object('account_id',cfg->>'receivable_account','debit',amount,'credit',0))||case when subtotal>0 then jsonb_build_array(jsonb_build_object('account_id',cfg->>'income_account','debit',0,'credit',subtotal)) else '[]'::jsonb end||case when tax>0 then jsonb_build_array(jsonb_build_object('account_id',cfg->>'tax_account','debit',0,'credit',tax)) else '[]'::jsonb end),p_reason);
   perform admin_ledger_write(p_tenant,p_org,p_actor_user,p_actor_person,jid,'post',(jr->>'version')::integer,'{}',p_reason);
  elsif amount<0 then
   if -amount+coalesce((select sum(c.amount) from credits c where c.invoice_id=inv.id and status in ('pending','applied','open')),0)>inv.total then raise exception 'Credit exceeds the remaining original fee; review earlier credits';end if;
   credit_id:=gen_random_uuid();task_id:=gen_random_uuid();
   insert into credits(id,customer_id,invoice_id,amount,reason,status) values(credit_id,inv.customer_id,inv.id,-amount,p_reason,'pending');
   insert into operational_tasks(id,tenant_id,organization_id,team_id,assigned_role,title,description,metadata) values(task_id,p_tenant,p_org,tm.id,'treasurer','Review squad-change credit',p_reason,jsonb_build_object('cross_engine',true,'credit_id',credit_id,'subtotal',-subtotal,'tax_total',-tax,'athlete_id',athlete));
  end if;
  update group_memberships set status='inactive',ends_on=current_date where group_id=src.id and athlete_id=athlete;
  if dst.id is not null then insert into group_memberships(group_id,athlete_id,starts_on,status) values(dst.id,athlete,current_date,'active') on conflict(group_id,athlete_id) do update set starts_on=current_date,ends_on=null,status='active';end if;
  if dst.team_id is distinct from src.team_id then
   update team_memberships set status='inactive',ends_on=current_date where athlete_id=athlete and team_id=src.team_id and status='active' and not exists(select 1 from group_memberships m join groups g on g.id=m.group_id where m.athlete_id=athlete and m.status='active' and g.team_id=src.team_id);
   if dst.team_id is not null and not exists(select 1 from team_memberships where athlete_id=athlete and team_id=dst.team_id and status='active') then insert into team_memberships(team_id,athlete_id,person_id,membership_type,starts_on,status) select dst.team_id,id,person_id,'athlete',current_date,'active' from athletes where id=athlete;end if;
  end if;
  if dst.id is null then
   update registrations set status='withdrawn' where athlete_id=athlete and organization_id=p_org and season_id=season.id and program_id=coalesce(src.program_id,tm.program_id) and status in ('approved','active','submitted') and not exists(select 1 from group_memberships m join groups g on g.id=m.group_id where m.athlete_id=athlete and m.status='active' and g.program_id=registrations.program_id);
  elsif coalesce(dst.program_id,(select program_id from teams where id=dst.team_id)) is distinct from coalesce(src.program_id,tm.program_id) then
   update registrations set program_id=coalesce(dst.program_id,(select program_id from teams where id=dst.team_id)),status='submitted',approved_at=null where athlete_id=athlete and organization_id=p_org and season_id=season.id and program_id=coalesce(src.program_id,tm.program_id) and status in ('approved','active','submitted');
   insert into operational_tasks(tenant_id,organization_id,team_id,assigned_role,title,description) values(p_tenant,p_org,dst.team_id,'registrar','Review eligibility after program change',p_reason);
  end if;
  insert into athlete_asset_ledger(athlete_id,event_type,source_system,source_record_id,previous_state,new_state,actor_person_id) values(athlete,'squad_transfer','admin.cross_engine',p_request::text,jsonb_build_object('group_id',src.id),result||jsonb_build_object('group_id',dst.id,'invoice_id',target,'credit_id',credit_id,'president_override',p_values->'president_override'),p_actor_person);
  result:=result||jsonb_build_object('invoice_id',target,'credit_id',credit_id);
 elsif p_operation in ('cash','deposit','approve_credit') then
  if cfg is null then raise exception 'Set up the club posting accounts first';end if;
  select * into ledger from accounting_ledgers where id=(cfg->>'ledger_id')::uuid;
  perform pg_advisory_xact_lock(hashtextextended('ledger-entity:'||ledger.legal_entity_id,0));
  if p_operation='cash' then
   select * into tm from teams where id=(p_values->>'team_id')::uuid and organization_id=p_org;
   select i.* into inv from invoices i join customers c on c.id=i.customer_id where i.id=(p_values->>'invoice_id')::uuid and c.organization_id=p_org and i.legal_entity_id=ledger.legal_entity_id and i.currency=ledger.currency for update of i;
   amount:=(p_values->>'amount')::numeric;
   if tm.id is null or inv.id is null or inv.status not in ('issued','partial','overdue') or amount is null or amount<=0 or amount='NaN'::numeric or round(amount,2)<>amount or amount>inv.balance_due then raise exception 'Choose a club squad, an unpaid invoice and the exact positive cash received, up to the balance due';end if;
   if not exists(select 1 from customers c join athletes a on a.person_id=c.person_id join group_memberships m on m.athlete_id=a.id join groups g on g.id=m.group_id where c.id=inv.customer_id and g.team_id=tm.id and m.status='active') then raise exception 'Invoice athlete is not in this squad';end if;
   payment_id:=gen_random_uuid();
   insert into payments(id,customer_id,invoice_id,amount,currency,method,status,processor_reference) values(payment_id,inv.customer_id,inv.id,amount,inv.currency,'deck_cash','posted',p_request::text);
   insert into payment_allocations(payment_id,invoice_id,amount) values(payment_id,inv.id,amount);
   update invoices set balance_due=balance_due-amount,status=case when balance_due=amount then 'paid' else 'partial' end where id=inv.id;
   jr:=admin_ledger_write(p_tenant,p_org,p_actor_user,p_actor_person,jid,'create',null,jsonb_build_object('legal_entity_id',ledger.legal_entity_id,'ledger_id',ledger.id,'journal_number','CASH-'||p_request,'journal_date',current_date,'description',p_reason,'lines',jsonb_build_array(jsonb_build_object('account_id',cfg->>'held_account','debit',amount,'credit',0),jsonb_build_object('account_id',cfg->>'receivable_account','debit',0,'credit',amount))),p_reason);
   perform admin_ledger_write(p_tenant,p_org,p_actor_user,p_actor_person,jid,'post',(jr->>'version')::integer,'{}',p_reason);
   insert into work_items(id,tenant_id,work_type,entity_type,entity_id,status,payload) values(p_request,p_tenant,'DECK_CASH','payment',payment_id,'open',jsonb_build_object('organization_id',p_org,'team_id',tm.id,'amount',amount,'currency',inv.currency,'ledger_id',ledger.id,'held_account',cfg->>'held_account','journal_id',jid));
   insert into operational_tasks(tenant_id,organization_id,team_id,assigned_role,title,description,metadata) values(p_tenant,p_org,tm.id,'treasurer','💵 DECK CASH RECONCILE',p_reason,jsonb_build_object('cross_engine',true,'holding_id',p_request));
   result:=jsonb_build_object('payment_id',payment_id,'balance_due',inv.balance_due-amount,'undeposited_deck_cash',amount);
  elsif p_operation='deposit' then
   select * into holding from work_items where id=(p_values->>'holding_id')::uuid and tenant_id=p_tenant and work_type='DECK_CASH' and payload->>'organization_id'=p_org::text for update;
   if holding.id is null or holding.status<>'open' or nullif(trim(p_values->>'bank_reference'),'') is null then raise exception 'Select an undeposited receipt and enter the actual bank deposit reference';end if;
   if holding.payload->>'ledger_id'<>ledger.id::text or holding.payload->>'held_account'<>cfg->>'held_account' then raise exception 'Posting setup changed; restore the receipt’s original ledger and holdings account before depositing';end if;
   amount:=(holding.payload->>'amount')::numeric;
   jr:=admin_ledger_write(p_tenant,p_org,p_actor_user,p_actor_person,jid,'create',null,jsonb_build_object('legal_entity_id',ledger.legal_entity_id,'ledger_id',ledger.id,'journal_number','BANK-'||p_request,'journal_date',current_date,'description',p_reason||' / '||(p_values->>'bank_reference'),'lines',jsonb_build_array(jsonb_build_object('account_id',cfg->>'bank_account','debit',amount,'credit',0),jsonb_build_object('account_id',cfg->>'held_account','debit',0,'credit',amount))),p_reason);
   perform admin_ledger_write(p_tenant,p_org,p_actor_user,p_actor_person,jid,'post',(jr->>'version')::integer,'{}',p_reason);
   update work_items set status='completed',payload=payload||jsonb_build_object('deposit_journal',jid,'bank_reference',p_values->>'bank_reference','deposited_at',now()) where id=holding.id;
   update operational_tasks set status='completed',completed_at=now() where tenant_id=p_tenant and organization_id=p_org and metadata->>'holding_id'=holding.id::text;
   result:=jsonb_build_object('deposited',amount,'journal_id',jid);
  else
   select c.id,c.amount,c.invoice_id,t.id task,t.metadata into row_data from credits c join operational_tasks t on t.metadata->>'credit_id'=c.id::text where c.id=(p_values->>'credit_id')::uuid and c.status='pending' and t.tenant_id=p_tenant and t.organization_id=p_org and t.metadata->>'cross_engine'='true' for update of c,t;
   if not found then raise exception 'Select a pending club credit';end if;
   select * into inv from invoices where id=row_data.invoice_id and legal_entity_id=ledger.legal_entity_id and currency=ledger.currency for update;
   amount:=row_data.amount;subtotal:=(row_data.metadata->>'subtotal')::numeric;tax:=(row_data.metadata->>'tax_total')::numeric;
   if coalesce((row_data.metadata->>'needs_fee_review')::boolean,false) then subtotal:=(p_values->>'subtotal')::numeric;tax:=(p_values->>'tax_total')::numeric;end if;
   if subtotal is null or tax is null or inv.id is null or inv.status in ('void','cancelled') or amount>inv.total or subtotal<0 or tax<0 or subtotal+tax<>amount then raise exception 'Credit requires invoice and fee review; cash refunds are not a bank transfer';end if;
   jr:=admin_ledger_write(p_tenant,p_org,p_actor_user,p_actor_person,jid,'create',null,jsonb_build_object('legal_entity_id',ledger.legal_entity_id,'ledger_id',ledger.id,'journal_number','CREDIT-'||p_request,'journal_date',current_date,'description',p_reason,'lines',jsonb_build_array(jsonb_build_object('account_id',cfg->>'receivable_account','debit',0,'credit',amount))||case when subtotal>0 then jsonb_build_array(jsonb_build_object('account_id',cfg->>'income_account','debit',subtotal,'credit',0)) else '[]'::jsonb end||case when tax>0 then jsonb_build_array(jsonb_build_object('account_id',cfg->>'tax_account','debit',tax,'credit',0)) else '[]'::jsonb end),p_reason);
   perform admin_ledger_write(p_tenant,p_org,p_actor_user,p_actor_person,jid,'post',(jr->>'version')::integer,'{}',p_reason);
   update credits set status=case when row_data.amount>inv.balance_due then 'open' else 'applied' end,amount=case when row_data.amount>inv.balance_due then row_data.amount-inv.balance_due else row_data.amount end where id=row_data.id;
   update invoices set balance_due=greatest(0,balance_due-amount),status=case when balance_due<=amount then 'paid' else status end where id=inv.id;
   update operational_tasks set status='completed',completed_at=now(),metadata=metadata||jsonb_build_object('journal_id',jid) where id=row_data.task;
   result:=jsonb_build_object('credit_id',row_data.id,'amount',amount,'journal_id',jid);
  end if;
 elsif p_operation='cover_fee' then
  if cfg is null then raise exception 'Set up the club posting accounts first';end if;
  select * into ledger from accounting_ledgers where id=(cfg->>'ledger_id')::uuid;
  select f.*,e.athlete_id,e.team_id into row_data from competition_entry_fees f join competitions c on c.id=f.competition_id join competition_entries e on e.id=f.entry_id join teams t on t.id=e.team_id where f.id=(p_values->>'fee_id')::uuid and c.organization_id=p_org and t.organization_id=p_org and f.status='assessed' and f.currency_code=ledger.currency for update of f;
  if not found then raise exception 'Select an assessed athlete entry fee in this club and currency';end if;
  target:=gen_random_uuid();
  jr:=admin_vendor_bill_write(p_tenant,p_org,p_actor_user,p_actor_person,'org_admin',target,'create',null,jsonb_build_object('legal_entity_id',ledger.legal_entity_id,'vendor_id',p_values->>'vendor_id','bill_number','ENTRY-'||row_data.id,'bill_date',current_date,'due_date',current_date,'tax_total',0,'lines',jsonb_build_array(jsonb_build_object('description','Club-covered meet entry','quantity',1,'unit_price',row_data.total_amount))),p_reason);
  jr:=admin_vendor_bill_write(p_tenant,p_org,p_actor_user,p_actor_person,'org_admin',target,'submit',(jr->>'version')::integer,'{}',p_reason);
  jr:=admin_vendor_bill_write(p_tenant,p_org,p_actor_user,p_actor_person,'org_admin',target,'approve',(jr->>'version')::integer,'{}',p_reason);
  jr:=admin_payable_ledger_write(p_tenant,p_org,p_actor_user,p_actor_person,'org_admin',target,'post_ledger',(jr->>'version')::integer,jsonb_build_object('ledger_id',ledger.id,'payable_account_id',p_values->>'payable_account','journal_id',jid,'journal_number','ENTRY-'||p_request,'journal_date',current_date,'allocations',jsonb_build_array(jsonb_build_object('line_no',1,'account_id',p_values->>'expense_account'))),p_reason);
  update competition_entry_fees set status='club_covered' where id=row_data.id;
  insert into operational_tasks(tenant_id,organization_id,team_id,assigned_role,title,description,metadata) values(p_tenant,p_org,row_data.team_id,'treasurer','Prepare Cash Box',p_reason,jsonb_build_object('cross_engine',true,'vendor_bill_id',target,'fee_id',row_data.id));
  insert into athlete_asset_ledger(athlete_id,event_type,source_system,source_record_id,new_state,actor_person_id) values(row_data.athlete_id,'club_covers_entry_fee','admin.cross_engine',p_request::text,jsonb_build_object('fee_id',row_data.id,'vendor_bill_id',target,'journal_id',jid,'status','club_covered'),p_actor_person);
  result:=jsonb_build_object('fee_id',row_data.id,'vendor_bill_id',target,'status','club_covered');
 elsif p_operation='deactivate' then
  if p_values->>'entity' not in ('group','program') then raise exception 'Choose a squad or program';end if;
  target:=(p_values->>'id')::uuid;
  if p_values->>'entity'='group' then
   select g.* into src from groups g join teams t on t.id=g.team_id where g.id=target and t.organization_id=p_org for update of g;
   if src.id is null or src.status<>'active' then raise exception 'Choose an active club squad';end if;
  else
   if not exists(select 1 from programs where id=target and organization_id=p_org and status='active') then raise exception 'Choose an active club program';end if;
  end if;
  -- Draft credits for linked unpaid fee lines only; retain every original invoice.
  for row_data in select i.id,i.customer_id,least(i.balance_due,sum(l.line_total+l.tax_amount)) amount from invoices i join invoice_lines l on l.invoice_id=i.id join legal_entities e on e.id=i.legal_entity_id where e.organization_id=p_org and i.balance_due>0 and i.status not in ('draft','void','cancelled') and ((l.entity_type=p_values->>'entity' and l.entity_id=target) or (p_values->>'entity'='program' and l.entity_type='group' and l.entity_id in (select g.id from groups g left join teams t on t.id=g.team_id where coalesce(g.program_id,t.program_id)=target))) group by i.id loop
   if exists(select 1 from credits where invoice_id=row_data.id and status='pending') then raise exception 'Review the existing pending credit before deactivating';end if;
   credit_id:=gen_random_uuid();
   insert into credits(id,customer_id,invoice_id,amount,reason,status) values(credit_id,row_data.customer_id,row_data.id,row_data.amount,p_reason,'pending');
   insert into operational_tasks(tenant_id,organization_id,assigned_role,title,description,metadata) values(p_tenant,p_org,'treasurer','Review closure credit',p_reason,jsonb_build_object('cross_engine',true,'credit_id',credit_id,'needs_fee_review',true));
  end loop;
  for row_data in select m.* from group_memberships m join groups g on g.id=m.group_id left join teams t on t.id=g.team_id where m.status='active' and ((p_values->>'entity'='group' and g.id=target) or (p_values->>'entity'='program' and coalesce(g.program_id,t.program_id)=target)) loop
   insert into athlete_asset_ledger(athlete_id,event_type,source_system,source_record_id,previous_state,new_state,actor_person_id) values(row_data.athlete_id,'squad_suspended','admin.cross_engine',p_request::text,to_jsonb(row_data),jsonb_build_object('status','suspended','reason',p_reason),p_actor_person);
   update group_memberships set status='suspended',ends_on=current_date where group_id=row_data.group_id and athlete_id=row_data.athlete_id;
  end loop;
  update team_memberships m set status='suspended',ends_on=current_date where m.status='active' and m.athlete_id is not null and m.team_id in(select g.team_id from groups g left join teams t on t.id=g.team_id where (p_values->>'entity'='group' and g.id=target) or (p_values->>'entity'='program' and coalesce(g.program_id,t.program_id)=target)) and not exists(select 1 from group_memberships gm join groups g on g.id=gm.group_id where gm.athlete_id=m.athlete_id and g.team_id=m.team_id and gm.status='active');
  if p_values->>'entity'='group' then update groups set status='suspended' where id=target;
  else update programs set status='suspended' where id=target;update groups g set status='suspended' where g.program_id=target or g.team_id in(select id from teams where program_id=target);update teams set status='suspended' where program_id=target;end if;
  insert into operational_tasks(tenant_id,organization_id,assigned_role,title,description,priority,metadata) values(p_tenant,p_org,'communications_media','Draft urgent squad or program closure notice',p_reason,'high',jsonb_build_object('cross_engine',true,'entity',p_values->>'entity','id',target,'draft_only',true));
  result:=jsonb_build_object('status','suspended','id',target);
 elsif p_operation='reverse_fee' then
  select t.id task,(t.metadata->>'vendor_bill_id')::uuid bill,(t.metadata->>'fee_id')::uuid fee into row_data from operational_tasks t where t.id=(p_values->>'task_id')::uuid and t.tenant_id=p_tenant and t.organization_id=p_org and t.metadata->>'cross_engine'='true' and t.metadata ? 'vendor_bill_id' and t.status='open' for update;
  if not found then raise exception 'Select an unreversed club-covered fee';end if;
  select to_jsonb(b) into jr from vendor_bills b where b.id=row_data.bill;
  perform admin_payable_ledger_write(p_tenant,p_org,p_actor_user,p_actor_person,'org_admin',row_data.bill,'cancel',(jr->>'version')::integer,jsonb_build_object('journal_id',jid,'journal_number','REV-'||p_request,'journal_date',current_date),p_reason);
  update competition_entry_fees set status='assessed' where id=row_data.fee and status='club_covered';
  if not found then raise exception 'Fee changed since coverage; review before reversing';end if;
  update operational_tasks set status='completed',completed_at=now() where id=row_data.task;
  insert into athlete_asset_ledger(athlete_id,event_type,source_system,source_record_id,new_state,actor_person_id) select e.athlete_id,'entry_fee_coverage_reversed','admin.cross_engine',p_request::text,jsonb_build_object('fee_id',row_data.fee,'vendor_bill_id',row_data.bill,'reversal_journal',jid),p_actor_person from competition_entry_fees f join competition_entries e on e.id=f.entry_id where f.id=row_data.fee;
  result:=jsonb_build_object('reversed_bill',row_data.bill,'reversal_journal',jid);
 else
  raise exception 'Unsupported club action';
 end if;
 insert into audit_events(tenant_id,actor_user_id,actor_person_id,action,entity_type,entity_id,after_data,correlation_id,reason) values(p_tenant,p_actor_user,p_actor_person,'cross_engine.'||p_operation,'organization',p_org,jsonb_build_object('request',request_data,'result',result),p_request,p_reason);
 return result;
end $$;
revoke all on function public.admin_cross_engine(uuid,uuid,uuid,uuid,uuid,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.admin_cross_engine(uuid,uuid,uuid,uuid,uuid,text,jsonb,text) to service_role;

create or replace function public.cross_engine_history_guard() returns trigger language plpgsql security invoker set search_path=public as $$
begin
 if tg_table_name='athlete_asset_ledger' then raise exception 'Athlete history is permanent; add a compensating event';end if;
 if tg_table_name='invoices' then
  if old.status not in ('draft') then raise exception 'Posted invoices are permanent; issue a credit or reverse the transaction';end if;
 elsif tg_table_name='groups' then
  if exists(select 1 from group_memberships where group_id=old.id and status='active') or exists(select 1 from invoice_lines l join invoices i on i.id=l.invoice_id where l.entity_type='group' and l.entity_id=old.id and i.balance_due>0) then raise exception '[DENY: ERR-409: REFERENTIAL RECONCILIATION INTEGRITY BLOCK] Use Deactivate & Rollback';end if;
 elsif tg_table_name='programs' then
  if exists(select 1 from groups g join group_memberships m on m.group_id=g.id left join teams t on t.id=g.team_id where coalesce(g.program_id,t.program_id)=old.id and m.status='active') or exists(select 1 from registrations where program_id=old.id and status in ('submitted','approved','active')) or exists(select 1 from invoice_lines l join invoices i on i.id=l.invoice_id where i.balance_due>0 and ((l.entity_type='program' and l.entity_id=old.id) or (l.entity_type='group' and l.entity_id in(select g.id from groups g left join teams t on t.id=g.team_id where coalesce(g.program_id,t.program_id)=old.id)))) then raise exception '[DENY: ERR-409: REFERENTIAL RECONCILIATION INTEGRITY BLOCK] Use Deactivate & Rollback';end if;
 end if;
 return old;
end $$;
revoke all on function public.cross_engine_history_guard() from public,anon,authenticated;
create trigger cross_engine_athlete_history before update or delete on public.athlete_asset_ledger for each row execute function public.cross_engine_history_guard();
create trigger cross_engine_invoice_history before delete on public.invoices for each row execute function public.cross_engine_history_guard();
create trigger cross_engine_group_delete before delete on public.groups for each row execute function public.cross_engine_history_guard();
create trigger cross_engine_program_delete before delete on public.programs for each row execute function public.cross_engine_history_guard();
