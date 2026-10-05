-- Canonical general ledger: atomic posting, immutable posted entries and explicit periods.
alter table public.gl_journals add column if not exists version integer not null default 1;
alter table public.gl_journals add column if not exists ledger_id uuid references public.accounting_ledgers(id);
alter table public.gl_journals add column if not exists reversal_of uuid references public.gl_journals(id);
alter table public.gl_journals add column if not exists created_by uuid;
alter table public.gl_journals add column if not exists created_at timestamptz not null default now();
alter table public.fiscal_periods add column if not exists version integer not null default 1;
create unique index if not exists gl_journal_one_reversal on public.gl_journals(reversal_of) where reversal_of is not null;
create unique index if not exists gl_journal_one_posting on public.journal_postings(journal_id);
create index if not exists gl_journal_entity_date on public.gl_journals(legal_entity_id,journal_date desc,id);
create index if not exists gl_line_journal on public.gl_lines(journal_id);
revoke insert,update,delete on public.gl_journals,public.gl_lines,public.journal_postings,public.fiscal_periods,public.fiscal_years,public.accounting_ledgers from public,anon,authenticated;

create or replace function public.guard_gl_line() returns trigger language plpgsql security invoker set search_path=public as $$
declare parent gl_journals; account chart_of_accounts; currency_code text;
begin
 select * into parent from gl_journals where id=case when tg_op='DELETE' then old.journal_id else new.journal_id end for update;
 if parent.id is null or parent.status is distinct from 'draft' then raise exception 'Only draft journal lines can change';end if;
 if tg_op='DELETE' then return old;end if;
 if tg_op='UPDATE' and new.journal_id<>old.journal_id then raise exception 'Journal lines cannot be moved';end if;
 select * into account from chart_of_accounts where id=new.account_id;
 select currency into currency_code from accounting_ledgers where id=parent.ledger_id;
 if account.id is null or account.legal_entity_id<>parent.legal_entity_id or account.active is distinct from true then raise exception 'Select an active account in this legal entity';end if;
 if new.currency is distinct from currency_code then raise exception 'Line currency must match the ledger';end if;
 if new.debit is null or new.credit is null or new.debit<0 or new.credit<0 or new.debit>999999999999.99 or new.credit>999999999999.99 or new.debit='NaN'::numeric or new.credit='NaN'::numeric or round(new.debit,2)<>new.debit or round(new.credit,2)<>new.credit or not ((new.debit>0 and new.credit=0) or (new.credit>0 and new.debit=0)) then raise exception 'Each line needs one positive debit or credit with at most two decimals';end if;
 return new;
end $$;
create trigger guard_gl_line before insert or update or delete on public.gl_lines for each row execute function public.guard_gl_line();
create or replace function public.guard_gl_header() returns trigger language plpgsql security invoker set search_path=public as $$
declare total_debit numeric; total_credit numeric;
begin
 if tg_op='DELETE' then raise exception 'Retain journal history; cancel a draft or reverse a posting';end if;
 if tg_op='INSERT' then
  if new.status is distinct from 'draft' then raise exception 'Journals start in draft';end if;
 else
  if old.status is distinct from 'draft' then raise exception 'Posted and cancelled journals are immutable';end if;
  if new.legal_entity_id is distinct from old.legal_entity_id or new.ledger_id is distinct from old.ledger_id or new.reversal_of is distinct from old.reversal_of then raise exception 'Journal entity, ledger and reversal link cannot change';end if;
  if new.status not in ('draft','posted','cancelled') or new.status is null then raise exception 'Invalid journal state';end if;
  new.version:=old.version+1;
 end if;
 if not exists(select 1 from accounting_ledgers where id=new.ledger_id and legal_entity_id=new.legal_entity_id) then raise exception 'Journal ledger must belong to the legal entity';end if;
 if new.status='posted' then
  select sum(debit),sum(credit) into total_debit,total_credit from gl_lines where journal_id=new.id;
  if total_debit is null or total_debit<=0 or total_debit<>total_credit or (select count(*) from gl_lines where journal_id=new.id)<2 then raise exception 'Posting requires at least two balanced lines';end if;
  if not exists(select 1 from journal_postings x join fiscal_periods p on p.id=x.period_id join fiscal_years y on y.id=p.fiscal_year_id where x.journal_id=new.id and x.posting_status='posted' and x.ledger_id=new.ledger_id and y.legal_entity_id=new.legal_entity_id and y.status='open' and p.status='open' and new.journal_date between p.starts_on and p.ends_on) then raise exception 'Atomic posting to the matching open period is required';end if;
 end if;
 return new;
end $$;
create trigger guard_gl_header before insert or update or delete on public.gl_journals for each row execute function public.guard_gl_header();
create or replace function public.guard_gl_posting() returns trigger language plpgsql security invoker set search_path=public as $$
declare parent gl_journals; period fiscal_periods; year fiscal_years;
begin
 if tg_op<>'INSERT' then raise exception 'Posting history is immutable';end if;
 select * into parent from gl_journals where id=new.journal_id for update;
 select * into period from fiscal_periods where id=new.period_id for update;
 select * into year from fiscal_years where id=period.fiscal_year_id for share;
 if parent.status is distinct from 'draft' or parent.id is null or period.id is null or period.status is distinct from 'open' or year.status is distinct from 'open' or year.legal_entity_id is distinct from parent.legal_entity_id or parent.journal_date not between period.starts_on and period.ends_on or new.ledger_id is distinct from parent.ledger_id or new.posting_status is distinct from 'posted' then raise exception 'Posting requires a draft journal and its open fiscal period and ledger';end if;
 new.posted_at:=now();return new;
end $$;
create trigger guard_gl_posting before insert or update or delete on public.journal_postings for each row execute function public.guard_gl_posting();
-- Deferred check prevents a posting record being committed without its matching header transition.
create or replace function public.validate_gl_posting_pair() returns trigger language plpgsql security invoker set search_path=public as $$
begin
 if not exists(select 1 from gl_journals where id=new.journal_id and status='posted') then raise exception 'Posting and journal must commit together';end if;
 return new;
end $$;
create constraint trigger validate_gl_posting_pair after insert on public.journal_postings deferrable initially deferred for each row execute function public.validate_gl_posting_pair();

create or replace function public.admin_ledger_write(p_tenant uuid,p_org uuid,p_actor_user uuid,p_actor_person uuid,p_id uuid,p_operation text,p_expected_version integer,p_values jsonb,p_reason text)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare prior gl_journals; saved gl_journals; entity uuid; ledger accounting_ledgers; period fiscal_periods; line jsonb; before_lines jsonb; task uuid; source_journal gl_journals; request_data jsonb;
begin
 if p_actor_user is null or p_id is null or length(trim(coalesce(p_reason,'')))<5 or p_operation is null or p_operation not in ('create','edit','post','cancel','reverse') then raise exception 'Actor, journal, supported operation and a reason are required';end if;
 select * into prior from gl_journals where id=p_id;
 entity:=case when prior.id is null then (p_values->>'legal_entity_id')::uuid else prior.legal_entity_id end;
 if not exists(select 1 from legal_entities e join organizations o on o.id=e.organization_id where e.id=entity and o.id=p_org and o.tenant_id=p_tenant) then raise exception 'Legal entity outside organization';end if;
 perform pg_advisory_xact_lock(hashtextextended('ledger-entity:'||entity,0));
 select * into prior from gl_journals where id=p_id for update;
 request_data:=jsonb_build_object('operation',p_operation,'values',p_values,'reason',trim(p_reason));
 if p_operation='create' and prior.id is not null then
  if exists(select 1 from audit_events where entity_type='gl_journal' and entity_id=p_id and tenant_id=p_tenant and actor_user_id=p_actor_user and action='ledger.create' and after_data->'request'=request_data) then return to_jsonb(prior);end if;
  raise exception 'Journal identifier already used';
 end if;
 if p_operation<>'create' then
  if prior.id is null then raise exception 'Journal not found';end if;
  if prior.version is distinct from p_expected_version then raise exception 'Journal changed. Reload before continuing.';end if;
  select jsonb_agg(to_jsonb(l)) into before_lines from gl_lines l where journal_id=p_id;
 end if;
 if p_operation in ('create','edit') then
  if p_operation='edit' and prior.status<>'draft' then raise exception 'Only draft journals can be edited';end if;
  select * into ledger from accounting_ledgers where id=case when p_operation='create' then (p_values->>'ledger_id')::uuid else prior.ledger_id end and legal_entity_id=entity;
  if ledger.id is null or nullif(trim(p_values->>'journal_number'),'') is null or (p_values->>'journal_date')::date is null or nullif(trim(p_values->>'description'),'') is null then raise exception 'Ledger, journal number, date and description required';end if;
  if jsonb_typeof(p_values->'lines') is distinct from 'array' or jsonb_array_length(p_values->'lines') not between 2 and 500 then raise exception 'Provide between 2 and 500 journal lines';end if;
  if p_operation='create' then
   insert into gl_journals(id,legal_entity_id,ledger_id,journal_number,journal_date,description,source,status,created_by) values(p_id,entity,ledger.id,trim(p_values->>'journal_number'),(p_values->>'journal_date')::date,trim(p_values->>'description'),'manual','draft',p_actor_user);
  else
   update gl_journals set journal_number=trim(p_values->>'journal_number'),journal_date=(p_values->>'journal_date')::date,description=trim(p_values->>'description') where id=p_id;
   delete from gl_lines where journal_id=p_id;
  end if;
  for line in select value from jsonb_array_elements(p_values->'lines') loop
   insert into gl_lines(journal_id,account_id,debit,credit,currency,description) values(p_id,(line->>'account_id')::uuid,(line->>'debit')::numeric,(line->>'credit')::numeric,ledger.currency,nullif(trim(line->>'description'),''));
  end loop;
 elsif p_operation='cancel' then
  if prior.status<>'draft' then raise exception 'Only draft journals can be cancelled';end if;
  update gl_journals set status='cancelled' where id=p_id;
 elsif p_operation='reverse' then
  if prior.status<>'posted' then raise exception 'Only posted journals can be reversed';end if;
  if exists(select 1 from gl_journals where reversal_of=p_id) then raise exception 'This journal already has a reversal';end if;
  if (p_values->>'journal_date')::date is null or nullif(trim(p_values->>'journal_number'),'') is null or (p_values->>'reversal_id')::uuid is null then raise exception 'Reversal identifier, number and posting date required';end if;
  select p.* into period from fiscal_periods p join fiscal_years y on y.id=p.fiscal_year_id where y.legal_entity_id=entity and y.status='open' and p.status='open' and (p_values->>'journal_date')::date between p.starts_on and p.ends_on for update of p;
  if period.id is null then raise exception 'Reversal date must fall in an open period';end if;
  source_journal:=prior;
  insert into gl_journals(id,legal_entity_id,ledger_id,journal_number,journal_date,description,source,status,reversal_of,created_by) values((p_values->>'reversal_id')::uuid,entity,prior.ledger_id,trim(p_values->>'journal_number'),(p_values->>'journal_date')::date,'Reversal of '||prior.journal_number||': '||trim(p_reason),'reversal','draft',p_id,p_actor_user) returning * into saved;
  insert into gl_lines(journal_id,account_id,debit,credit,currency,description) select saved.id,account_id,credit,debit,currency,description from gl_lines where journal_id=p_id;
  insert into journal_postings(journal_id,period_id,ledger_id,posting_status) values(saved.id,period.id,saved.ledger_id,'posted');
  update gl_journals set status='posted' where id=saved.id returning * into saved;
 else
  if prior.status<>'draft' then raise exception 'Only draft journals can be posted';end if;
  select p.* into period from fiscal_periods p join fiscal_years y on y.id=p.fiscal_year_id where y.legal_entity_id=entity and y.status='open' and p.status='open' and prior.journal_date between p.starts_on and p.ends_on for update of p;
  if period.id is null then raise exception 'Journal date must fall in an open fiscal period';end if;
  -- Revalidate account activity at posting, not just at draft save.
  if exists(select 1 from gl_lines l join chart_of_accounts a on a.id=l.account_id where l.journal_id=p_id and (a.active is distinct from true or a.legal_entity_id<>entity)) then raise exception 'All posting accounts must be active in this entity';end if;
  insert into journal_postings(journal_id,period_id,ledger_id,posting_status) values(p_id,period.id,prior.ledger_id,'posted');
  update gl_journals set status='posted' where id=p_id;
 end if;
 if p_operation<>'reverse' then select * into saved from gl_journals where id=p_id;end if;
 select id into task from work_items where tenant_id=p_tenant and entity_type='gl_journal' and entity_id=saved.id and work_type='JOURNAL_REVIEW' limit 1;
 if task is null and saved.status='draft' then insert into work_items(tenant_id,work_type,entity_type,entity_id,status) values(p_tenant,'JOURNAL_REVIEW','gl_journal',saved.id,'open') returning id into task;end if;
 if task is not null then update work_items set status=case when saved.status='draft' then 'open' else 'completed' end,payload=jsonb_build_object('title',saved.journal_number||' · '||saved.description,'legal_entity_id',entity,'organization_id',p_org,'assigned_role','treasurer','record_version',saved.version) where id=task;end if;
 insert into audit_events(tenant_id,actor_user_id,actor_person_id,action,entity_type,entity_id,before_data,after_data,correlation_id,reason) values(p_tenant,p_actor_user,p_actor_person,'ledger.'||p_operation,'gl_journal',p_id,jsonb_build_object('journal',to_jsonb(prior),'lines',before_lines),jsonb_build_object('journal',to_jsonb(saved),'lines',(select jsonb_agg(to_jsonb(l)) from gl_lines l where journal_id=saved.id),'request',request_data),gen_random_uuid(),trim(p_reason));
 return to_jsonb(saved);
end $$;

create or replace function public.admin_ledger_setup(p_tenant uuid,p_org uuid,p_actor_user uuid,p_actor_person uuid,p_entity uuid,p_operation text,p_values jsonb,p_reason text)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare saved jsonb; ledger accounting_ledgers; year fiscal_years; start_date date; end_date date; next_date date; period_no integer:=0;
begin
 if p_actor_user is null or length(trim(coalesce(p_reason,'')))<5 or p_operation is null or p_operation not in ('ledger','fiscal_year') then raise exception 'Actor, setup operation and reason required';end if;
 if not exists(select 1 from legal_entities e join organizations o on o.id=e.organization_id where e.id=p_entity and o.id=p_org and o.tenant_id=p_tenant) then raise exception 'Legal entity outside organization';end if;
 perform pg_advisory_xact_lock(hashtextextended('ledger-entity:'||p_entity,0));
 if p_operation='ledger' then
  if nullif(trim(p_values->>'code'),'') is null or nullif(trim(p_values->>'name'),'') is null or p_values->>'accounting_basis' is null or p_values->>'accounting_basis' not in ('accrual','cash') then raise exception 'Ledger code, name and accounting basis required';end if;
  select * into ledger from accounting_ledgers where legal_entity_id=p_entity and code=trim(p_values->>'code');
  if ledger.id is not null then
   if ledger.name=trim(p_values->>'name') and ledger.accounting_basis=p_values->>'accounting_basis' then return to_jsonb(ledger);end if;
   raise exception 'Ledger code already used';
  end if;
  insert into accounting_ledgers(legal_entity_id,code,name,accounting_basis,currency,is_primary) select p_entity,trim(p_values->>'code'),trim(p_values->>'name'),p_values->>'accounting_basis',base_currency,not exists(select 1 from accounting_ledgers where legal_entity_id=p_entity) from legal_entities where id=p_entity returning * into ledger;
  saved:=to_jsonb(ledger);
 else
  start_date:=(p_values->>'starts_on')::date;end_date:=(p_values->>'ends_on')::date;
  if start_date is null or end_date is null or end_date<start_date or end_date-start_date>366 or (p_values->>'fiscal_year')::integer is null or (p_values->>'fiscal_year')::integer not between 1900 and 2200 then raise exception 'Fiscal year and a date range of at most one year required';end if;
  select * into year from fiscal_years where legal_entity_id=p_entity and fiscal_year=(p_values->>'fiscal_year')::integer;
  if year.id is not null then
   if year.starts_on=start_date and year.ends_on=end_date then return to_jsonb(year);end if;
   raise exception 'Fiscal year label already used';
  end if;
  if exists(select 1 from fiscal_years where legal_entity_id=p_entity and starts_on<=end_date and ends_on>=start_date) then raise exception 'Fiscal years cannot overlap';end if;
  insert into fiscal_years(legal_entity_id,fiscal_year,starts_on,ends_on,status) values(p_entity,(p_values->>'fiscal_year')::integer,start_date,end_date,'open') returning * into year;
  while start_date<=end_date loop
   period_no:=period_no+1;next_date:=least((date_trunc('month',start_date)+interval '1 month')::date,end_date+1);
   insert into fiscal_periods(fiscal_year_id,period_no,starts_on,ends_on,status) values(year.id,period_no,start_date,next_date-1,'open');start_date:=next_date;
  end loop;
  saved:=to_jsonb(year);
 end if;
 insert into audit_events(tenant_id,actor_user_id,actor_person_id,action,entity_type,entity_id,after_data,correlation_id,reason) values(p_tenant,p_actor_user,p_actor_person,'ledger.setup_'||p_operation,p_operation,(saved->>'id')::uuid,saved,gen_random_uuid(),trim(p_reason));
 return saved;
end $$;

create or replace function public.admin_ledger_report(p_tenant uuid,p_org uuid,p_ledger uuid,p_from date,p_to date)
returns jsonb language plpgsql stable security invoker set search_path=public as $$
declare ledger accounting_ledgers; rows jsonb;
begin
 select l.* into ledger from accounting_ledgers l join legal_entities e on e.id=l.legal_entity_id join organizations o on o.id=e.organization_id where l.id=p_ledger and o.id=p_org and o.tenant_id=p_tenant;
 if ledger.id is null or p_from is null or p_to is null or p_to<p_from then raise exception 'Authorized ledger and valid report dates required';end if;
 select coalesce(jsonb_agg(to_jsonb(t) order by t.account_code),'[]'::jsonb) into rows from (
  select a.id,a.account_code,a.account_name,a.account_type,
   coalesce(sum(l.debit-l.credit) filter(where j.journal_date<p_from),0)::text opening,
   coalesce(sum(l.debit) filter(where j.journal_date>=p_from),0)::text debit,
   coalesce(sum(l.credit) filter(where j.journal_date>=p_from),0)::text credit,
   coalesce(sum(l.debit-l.credit),0)::text closing
  from chart_of_accounts a left join (gl_lines l join gl_journals j on j.id=l.journal_id and j.status='posted' and j.ledger_id=p_ledger and j.journal_date<=p_to) on l.account_id=a.id
  where a.legal_entity_id=ledger.legal_entity_id group by a.id
 ) t;
 return jsonb_build_object('ledger',to_jsonb(ledger),'from',p_from,'to',p_to,'accounts',rows);
end $$;
revoke all on function public.guard_gl_line(),public.guard_gl_header(),public.guard_gl_posting(),public.validate_gl_posting_pair() from public,anon,authenticated;
revoke all on function public.admin_ledger_write(uuid,uuid,uuid,uuid,uuid,text,integer,jsonb,text),public.admin_ledger_setup(uuid,uuid,uuid,uuid,uuid,text,jsonb,text),public.admin_ledger_report(uuid,uuid,uuid,date,date) from public,anon,authenticated;
grant execute on function public.admin_ledger_write(uuid,uuid,uuid,uuid,uuid,text,integer,jsonb,text),public.admin_ledger_setup(uuid,uuid,uuid,uuid,uuid,text,jsonb,text),public.admin_ledger_report(uuid,uuid,uuid,date,date) to service_role;

create or replace function public.guard_fiscal_period() returns trigger language plpgsql security invoker set search_path=public as $$
declare year fiscal_years; has_postings boolean;
begin
 if tg_op='DELETE' then raise exception 'Retain fiscal period history';end if;
 select * into year from fiscal_years where id=new.fiscal_year_id;
 if year.id is null or new.starts_on>new.ends_on or new.starts_on<year.starts_on or new.ends_on>year.ends_on then raise exception 'Period dates must be inside its fiscal year';end if;
 perform pg_advisory_xact_lock(hashtextextended('ledger-entity:'||year.legal_entity_id,0));
 if exists(select 1 from fiscal_periods where fiscal_year_id=new.fiscal_year_id and id<>new.id and starts_on<=new.ends_on and ends_on>=new.starts_on) then raise exception 'Fiscal periods cannot overlap';end if;
 if tg_op='INSERT' then
  if new.status is distinct from 'open' then raise exception 'Fiscal periods start open';end if;
 else
  if new.fiscal_year_id<>old.fiscal_year_id or new.starts_on<>old.starts_on or new.ends_on<>old.ends_on or new.period_no<>old.period_no then raise exception 'Fiscal period boundaries are fixed';end if;
  if new.status is distinct from old.status and not coalesce((old.status='open' and new.status='review') or (old.status='review' and new.status in ('open','closed')) or (old.status='closed' and new.status='open'),false) then raise exception 'Invalid period transition';end if;
  if new.status in ('review','closed') then
   if exists(select 1 from gl_journals where legal_entity_id=year.legal_entity_id and journal_date between new.starts_on and new.ends_on and status='draft') then raise exception 'Resolve draft journals before closing this period';end if;
   if exists(select 1 from gl_journals j left join journal_postings p on p.journal_id=j.id where j.legal_entity_id=year.legal_entity_id and j.journal_date between new.starts_on and new.ends_on and j.status='posted' and p.id is null) then raise exception 'A posted journal has no period posting';end if;
  end if;
  new.version:=old.version+1;
 end if;
 return new;
end $$;
create trigger guard_fiscal_period before insert or update or delete on public.fiscal_periods for each row execute function public.guard_fiscal_period();
create or replace function public.admin_ledger_period(p_tenant uuid,p_org uuid,p_actor_user uuid,p_actor_person uuid,p_role text,p_id uuid,p_expected_version integer,p_status text,p_reason text)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare prior fiscal_periods; saved fiscal_periods; entity uuid; task uuid;
begin
 if p_actor_user is null or length(trim(coalesce(p_reason,'')))<5 or p_role is null or p_role not in ('org_admin','treasurer') or p_status is null or p_status not in ('review','closed','open') then raise exception 'Authorized actor, decision and reason required';end if;
 if p_status in ('closed','open') and p_role<>'org_admin' then raise exception 'Organization Admin decides period closure and reopening';end if;
 select y.legal_entity_id into entity from fiscal_periods p join fiscal_years y on y.id=p.fiscal_year_id join legal_entities e on e.id=y.legal_entity_id join organizations o on o.id=e.organization_id where p.id=p_id and o.id=p_org and o.tenant_id=p_tenant;
 if entity is null then raise exception 'Fiscal period outside organization';end if;
 perform pg_advisory_xact_lock(hashtextextended('ledger-entity:'||entity,0));
 select * into prior from fiscal_periods where id=p_id for update;
 if prior.version is distinct from p_expected_version then raise exception 'Fiscal period changed. Reload before continuing.';end if;
 if prior.status=p_status then raise exception 'Period is already in this state';end if;
 if p_status in ('review','closed') and exists(select 1 from finance_reconciliation_runs where organization_id=p_org and tenant_id=p_tenant and status not in ('completed','cancelled') and (period_start is null or period_start<=prior.ends_on) and (period_end is null or period_end>=prior.starts_on)) then raise exception 'Resolve outstanding payment reconciliation runs before closing';end if;
 update fiscal_periods set status=p_status where id=p_id returning * into saved;
 select id into task from work_items where tenant_id=p_tenant and entity_type='fiscal_period' and entity_id=p_id and work_type='PERIOD_CLOSE' limit 1;
 if task is null and p_status='review' then insert into work_items(tenant_id,work_type,entity_type,entity_id,status) values(p_tenant,'PERIOD_CLOSE','fiscal_period',p_id,'open') returning id into task;end if;
 if task is not null then update work_items set status=case when p_status='review' then 'open' else 'completed' end,payload=jsonb_build_object('title','Close fiscal period '||saved.starts_on||' – '||saved.ends_on,'organization_id',p_org,'assigned_role','org_admin','legal_entity_id',entity,'record_version',saved.version) where id=task;end if;
 insert into audit_events(tenant_id,actor_user_id,actor_person_id,action,entity_type,entity_id,before_data,after_data,correlation_id,reason) values(p_tenant,p_actor_user,p_actor_person,'ledger.period_'||p_status,'fiscal_period',p_id,to_jsonb(prior),to_jsonb(saved),gen_random_uuid(),trim(p_reason));
 return to_jsonb(saved);
end $$;
revoke all on function public.guard_fiscal_period(),public.admin_ledger_period(uuid,uuid,uuid,uuid,text,uuid,integer,text,text) from public,anon,authenticated;
grant execute on function public.admin_ledger_period(uuid,uuid,uuid,uuid,text,uuid,integer,text,text) to service_role;
