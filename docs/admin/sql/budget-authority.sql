alter table public.budgets add column if not exists version integer not null default 1;
-- All writes use authenticated server boundaries and transactional controls.
revoke insert,update,delete on public.budgets,public.budget_lines from public,anon,authenticated;
alter table public.budgets enable row level security;
alter table public.budget_lines enable row level security;
create or replace function public.guard_budget_lifecycle() returns trigger language plpgsql security invoker set search_path=public as $$
begin
 if tg_op='INSERT' then
  if new.status is distinct from 'draft' then raise exception 'Budgets start in draft';end if;
  return new;
 end if;
 if old.status in ('approved','locked','closed','cancelled') and (new.name is distinct from old.name or new.fiscal_year is distinct from old.fiscal_year or new.currency is distinct from old.currency or new.legal_entity_id is distinct from old.legal_entity_id) then raise exception 'Approved budget properties are locked';end if;
 if new.status is distinct from old.status then
  if not coalesce(((old.status='draft' and new.status in ('submitted','cancelled')) or (old.status='submitted' and new.status in ('draft','approved','cancelled')) or (old.status='approved' and new.status in ('locked','cancelled')) or (old.status='locked' and new.status='closed')),false) then raise exception 'Budget transition not allowed';end if;
  if new.status in ('submitted','approved','locked') then
   if new.legal_entity_id is null or not exists(select 1 from budget_lines where budget_id=old.id) then raise exception 'Budget entity and lines required';end if;
   if exists(select 1 from budget_lines l left join chart_of_accounts a on a.id=l.account_id where l.budget_id=old.id and (a.id is null or a.legal_entity_id is distinct from new.legal_entity_id or a.active is distinct from true or l.period_start is null or l.period_end is null or l.period_end<l.period_start or l.budget_amount<0 or l.budget_amount='NaN'::numeric or l.budget_amount>999999999999.99)) then raise exception 'Correct budget accounts, periods and amounts before submitting';end if;
  end if;
 end if;
 new.version:=old.version+1;
 return new;
end $$;
create trigger guard_budget_lifecycle before insert or update on public.budgets for each row execute function public.guard_budget_lifecycle();
create or replace function public.guard_budget_line() returns trigger language plpgsql security invoker set search_path=public as $$
declare parent public.budgets; budget uuid;
begin
 budget:=case when tg_op='DELETE' then old.budget_id else new.budget_id end;
 select * into parent from budgets where id=budget for update;
 if parent.id is null or parent.status is distinct from 'draft' then raise exception 'Only draft budget lines can change';end if;
 if tg_op<>'DELETE' then
  if tg_op='UPDATE' and new.budget_id<>old.budget_id then raise exception 'Budget lines cannot be moved';end if;
  perform 1 from chart_of_accounts where id=new.account_id and legal_entity_id=parent.legal_entity_id and active=true;
  if not found then raise exception 'Select an active account in the budget entity';end if;
  if new.period_start is null or new.period_end is null or new.period_end<new.period_start or new.budget_amount<0 or new.budget_amount='NaN'::numeric or new.budget_amount>999999999999.99 then raise exception 'Valid dates and a non-negative amount are required';end if;
 end if;
 update budgets set version=version+1 where id=budget;
 if tg_op='DELETE' then return old;end if;return new;
end $$;
create trigger guard_budget_line before insert or update or delete on public.budget_lines for each row execute function public.guard_budget_line();
revoke all on function public.guard_budget_lifecycle(),public.guard_budget_line() from public,anon,authenticated;

create or replace function public.admin_budget_write(p_tenant uuid,p_org uuid,p_actor_user uuid,p_actor_person uuid,p_role text,p_id uuid,p_operation text,p_expected_version integer,p_values jsonb,p_reason text)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare prior budgets; saved budgets; old_line budget_lines; line budget_lines; entity uuid; target text; task uuid;
begin
 if p_actor_user is null or p_id is null or p_role is null or p_role not in ('org_admin','treasurer') or nullif(trim(p_reason),'') is null then raise exception 'Authorized actor and reason required';end if;
 if p_operation is null or p_operation not in ('create','edit','save_line','delete_line','transition') then raise exception 'Unsupported budget action';end if;
 perform 1 from organizations where id=p_org and tenant_id=p_tenant;if not found then raise exception 'Organization outside tenant';end if;
 perform pg_advisory_xact_lock(hashtextextended('budget:'||p_id::text,0));
 select * into prior from budgets where id=p_id for update;
 if p_operation='create' then
  entity:=(p_values->>'legal_entity_id')::uuid;
  perform 1 from legal_entities where id=entity and organization_id=p_org;if not found then raise exception 'Legal entity outside organization';end if;
  if prior.id is not null then
   if prior.legal_entity_id=entity and prior.name=trim(p_values->>'name') and prior.fiscal_year=(p_values->>'fiscal_year')::integer then return to_jsonb(prior);end if;
   raise exception 'Budget identifier already used';
  end if;
  if p_values->>'currency' is null or nullif(trim(p_values->>'name'),'') is null or (p_values->>'fiscal_year')::integer not between 1900 and 2200 or p_values->>'currency' !~ '^[A-Z]{3}$' then raise exception 'Budget name, fiscal year and currency are required';end if;
  insert into budgets(id,legal_entity_id,name,fiscal_year,currency,status) values(p_id,entity,trim(p_values->>'name'),(p_values->>'fiscal_year')::integer,p_values->>'currency','draft') returning * into saved;
 else
  perform 1 from legal_entities where id=prior.legal_entity_id and organization_id=p_org;
  if prior.id is null or not found then raise exception 'Budget outside organization';end if;
  if prior.version is distinct from p_expected_version then raise exception 'Budget changed. Reload before saving.';end if;
  if p_operation='edit' then
   if prior.status<>'draft' then raise exception 'Only draft budget properties can change';end if;
   if nullif(trim(p_values->>'name'),'') is null or p_values->>'currency' is null or p_values->>'currency' !~ '^[A-Z]{3}$' or (p_values->>'fiscal_year')::integer not between 1900 and 2200 then raise exception 'Budget name, fiscal year and currency required';end if;
   update budgets set name=trim(p_values->>'name'),fiscal_year=(p_values->>'fiscal_year')::integer,currency=p_values->>'currency' where id=p_id returning * into saved;
  elsif p_operation='transition' then
   target:=p_values->>'status';
   if target is null then raise exception 'Budget status required';end if;
   if p_role<>'org_admin' and target not in ('submitted','draft') then raise exception 'Organization Admin approval authority required';end if;
   update budgets set status=target where id=p_id returning * into saved;
  else
   if prior.status<>'draft' then raise exception 'Only draft budget lines can change';end if;
   select * into old_line from budget_lines where id=(p_values->>'line_id')::uuid for update;
   if old_line.id is not null and old_line.budget_id<>p_id then raise exception 'Line outside budget';end if;
   if p_operation='delete_line' then
    if old_line.id is null then raise exception 'Budget line not found';end if;
    delete from budget_lines where id=old_line.id;
   else
    if old_line.id is null then
     insert into budget_lines(id,budget_id,account_id,period_start,period_end,budget_amount)
      values((p_values->>'line_id')::uuid,p_id,(p_values->>'account_id')::uuid,(p_values->>'period_start')::date,(p_values->>'period_end')::date,(p_values->>'budget_amount')::numeric) returning * into line;
    else
     update budget_lines set account_id=(p_values->>'account_id')::uuid,period_start=(p_values->>'period_start')::date,period_end=(p_values->>'period_end')::date,budget_amount=(p_values->>'budget_amount')::numeric where id=old_line.id returning * into line;
    end if;
   end if;
   select * into saved from budgets where id=p_id;
  end if;
 end if;
 select id into task from work_items where tenant_id=p_tenant and entity_type='budget' and entity_id=p_id and work_type='BUDGET_REVIEW' limit 1;
 if task is null then insert into work_items(tenant_id,work_type,entity_type,entity_id,status) values(p_tenant,'BUDGET_REVIEW','budget',p_id,'open') returning id into task;end if;
 update work_items set status=case when saved.status in ('approved','locked','closed','cancelled') then 'completed' else 'open' end,payload=jsonb_build_object('title',saved.name,'organization_id',p_org,'assigned_role',case when saved.status='submitted' then 'org_admin' else 'treasurer' end,'budget_status',saved.status,'record_version',saved.version) where id=task;
 insert into audit_events(tenant_id,actor_user_id,actor_person_id,action,entity_type,entity_id,before_data,after_data,correlation_id,reason)
 values(p_tenant,p_actor_user,p_actor_person,'budget.'||p_operation,'budget',p_id,jsonb_build_object('budget',to_jsonb(prior),'line',to_jsonb(old_line)),jsonb_build_object('budget',to_jsonb(saved),'line',to_jsonb(line)),gen_random_uuid(),p_reason);
 return to_jsonb(saved);
end $$;
revoke all on function public.admin_budget_write(uuid,uuid,uuid,uuid,text,uuid,text,integer,jsonb,text) from public,anon,authenticated;
grant execute on function public.admin_budget_write(uuid,uuid,uuid,uuid,text,uuid,text,integer,jsonb,text) to service_role;
do $$ declare nav uuid; r record; begin
 insert into hub_navigation(hub_id,label,path,component,sort_order,is_active) values('admin','Budgets','/admin?view=budgets','BudgetWorkspace',14,false) returning nav_id into nav;
 for r in select role_id from admin_roles where role_name in ('org_admin','treasurer') loop insert into hub_role_navigation(role_id,nav_id,can_view) values(r.role_id,nav,true);end loop;
end $$;
