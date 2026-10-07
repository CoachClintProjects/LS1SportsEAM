-- Task scope is explicit. No demo tasks or invented assignments are inserted.
alter table public.operational_tasks add column organization_id uuid references public.organizations(id), add column team_id uuid references public.teams(id), add column assigned_role text, add column revision integer not null default 1;
alter table public.workflow_tasks add column tenant_id uuid references public.tenants(id), add column organization_id uuid references public.organizations(id), add column team_id uuid references public.teams(id), add column assigned_role text, add column revision integer not null default 1;
alter table public.competition_exceptions add column tenant_id uuid references public.tenants(id), add column organization_id uuid references public.organizations(id), add column team_id uuid references public.teams(id), add column assigned_role text, add column revision integer not null default 1;

create function app.triage_scope_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare owner_tenant uuid; owner_org uuid;
begin
  if TG_TABLE_NAME='workflow_tasks' then
    select d.tenant_id into owner_tenant from public.workflow_instances i join public.workflow_definitions d on d.id=i.workflow_definition_id where i.id=NEW.workflow_instance_id;
    if NEW.tenant_id is not null and NEW.tenant_id is distinct from owner_tenant then raise exception 'Task and workflow belong to different clubs'; end if;
    NEW.tenant_id := owner_tenant;
  elsif TG_TABLE_NAME='competition_exceptions' then
    select c.tenant_id,c.organization_id into owner_tenant,owner_org from public.competitions c where c.id=NEW.competition_id;
    if (NEW.tenant_id is not null and NEW.tenant_id is distinct from owner_tenant) or (NEW.organization_id is not null and NEW.organization_id is distinct from owner_org) then raise exception 'Task and competition belong to different clubs'; end if;
    NEW.tenant_id:=owner_tenant; NEW.organization_id:=owner_org;
  end if;
  if NEW.organization_id is not null and not exists(select 1 from public.organizations o where o.id=NEW.organization_id and o.tenant_id=NEW.tenant_id) then raise exception 'Task club does not match its tenant'; end if;
  if NEW.team_id is not null and not exists(select 1 from public.teams t where t.id=NEW.team_id and t.organization_id=NEW.organization_id) then raise exception '[DENY: ERR-901] Squad does not belong to this club'; end if;
  if NEW.assigned_role='team_manager' and NEW.team_id is null then raise exception '[DENY: ERR-901] Team Manager tasks require a squad'; end if;
  if NEW.assigned_role is not null and NEW.assigned_role not in ('org_admin','team_manager','registrar','treasurer','competition_manager','volunteer_coordinator','communications_media','fundraising_coordinator','facilities_equipment_manager') then raise exception 'Unknown task role'; end if;
  if TG_OP='UPDATE' then NEW.revision:=OLD.revision+1; end if;
  return NEW;
end $$;
revoke all on function app.triage_scope_guard() from public,anon,authenticated;

-- Private helper reads authorization tables without their own RLS hiding assignments.
-- It is never an exposed RPC; every call requires an authenticated identity.
create function app.can_read_triage(p_tenant uuid,p_org uuid,p_team uuid,p_role text,p_assignee uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select (select auth.uid()) is not null and (
   (select app.is_superuser()) or exists (
     select 1 from public.role_assignments a join public.role_definitions d on d.id=a.role_definition_id
     where a.person_id=(select app.current_person_id()) and a.tenant_id=p_tenant and a.organization_id=p_org
       and upper(a.status)='ACTIVE' and d.is_active and (a.starts_at is null or a.starts_at<=now()) and (a.ends_at is null or a.ends_at>now())
       and (d.code='ORGANIZATION_ADMIN' or (
         (p_assignee is null or p_assignee=a.person_id)
         and (a.team_id is null or a.team_id=p_team)
         and (p_role<>'team_manager' or (p_team is not null and a.team_id=p_team))
         and d.code=any(case p_role
           when 'team_manager' then array['TEAM_MANAGER'] when 'registrar' then array['REGISTRAR','RECORDS_ADMINISTRATOR']
           when 'treasurer' then array['TREASURER','FINANCE'] when 'competition_manager' then array['COMPETITION_MANAGER']
           when 'volunteer_coordinator' then array['VOLUNTEER_COORDINATOR','VOLUNTEER'] when 'communications_media' then array['COMMUNICATIONS_MEDIA','COMMUNICATIONS']
           when 'fundraising_coordinator' then array['FUNDRAISING_COORDINATOR'] when 'facilities_equipment_manager' then array['FACILITIES_EQUIPMENT_MANAGER'] else array[]::text[] end)
       ))
   )
 )
$$;
revoke all on function app.can_read_triage(uuid,uuid,uuid,text,uuid) from public,anon;
grant execute on function app.can_read_triage(uuid,uuid,uuid,text,uuid) to authenticated,service_role;

do $$ declare t text; begin
 foreach t in array array['operational_tasks','workflow_tasks','competition_exceptions'] loop
   execute format('alter table public.%I enable row level security',t);
   execute format('create trigger triage_scope_guard before insert or update on public.%I for each row execute function app.triage_scope_guard()',t);
   execute format('create policy triage_scope_boundary on public.%I as restrictive for select to authenticated using (app.can_read_triage(tenant_id,organization_id,team_id,assigned_role,assigned_to))',t);
   execute format('create policy triage_scoped_read on public.%I for select to authenticated using (app.can_read_triage(tenant_id,organization_id,team_id,assigned_role,assigned_to))',t);
   -- State transitions must pass server permissions and the atomic audit transaction.
   execute format('revoke all on public.%I from anon',t);
   execute format('revoke insert,update,delete,truncate,references,trigger on public.%I from authenticated',t);
   execute format('grant select on public.%I to authenticated',t);
   execute format('create index %I on public.%I (tenant_id,organization_id,assigned_role,team_id,status)',t||'_triage_scope_idx',t);
 end loop;
end $$;

create function public.admin_triage_change(p_source text,p_id uuid,p_revision integer,p_action text,p_note text,p_tenant uuid,p_orgs uuid[],p_role text,p_team uuid,p_actor_user uuid,p_actor_person uuid,p_create jsonb default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare before_row jsonb; after_row jsonb; item_id uuid:=p_id; i public.workflow_instances%rowtype; d public.workflow_definitions%rowtype; stages jsonb; stage_no integer; next_stage text; corr uuid:=gen_random_uuid();
begin
 if p_source not in ('operational_tasks','workflow_tasks','competition_exceptions') then raise exception 'Unknown task source'; end if;
 if p_actor_user is null or not exists(select 1 from auth.users where id=p_actor_user) then raise exception 'Authentication required'; end if;
 if p_actor_person is null then raise exception 'Your account needs a person record before changing tasks'; end if;
 if length(trim(coalesce(p_note,'')))<3 or length(p_note)>4000 then raise exception 'Record a resolution note between 3 and 4000 characters'; end if;
 if p_action='create' then
   if p_source<>'operational_tasks' or p_create is null or length(trim(coalesce(p_create->>'title','')))=0 then raise exception 'Task title is required'; end if;
   if not ((p_create->>'organization_id')::uuid=any(p_orgs)) or (p_role<>'org_admin' and p_create->>'assigned_role'<>p_role) or (p_role='team_manager' and (p_create->>'team_id')::uuid is distinct from p_team) then raise exception '[DENY: ERR-901] Task is outside your assignment'; end if;
   insert into public.operational_tasks(tenant_id,organization_id,team_id,assigned_role,title,description,priority,status,due_at)
   values(p_tenant,(p_create->>'organization_id')::uuid,nullif(p_create->>'team_id','')::uuid,p_create->>'assigned_role',trim(p_create->>'title'),p_create->>'description',p_create->>'priority','open',nullif(p_create->>'due_at','')::timestamptz)
   returning id,to_jsonb(operational_tasks.*) into item_id,after_row;
 else
   execute format('select to_jsonb(t) from public.%I t where id=$1 for update',p_source) into before_row using p_id;
   if before_row is null or (before_row->>'tenant_id')::uuid is distinct from p_tenant or not coalesce((before_row->>'organization_id')::uuid=any(p_orgs),false) or (p_role<>'org_admin' and before_row->>'assigned_role' is distinct from p_role) or (p_team is not null and (before_row->>'team_id')::uuid is distinct from p_team) or (p_role='team_manager' and p_team is null) then raise exception '[DENY: ERR-901] Task is outside your assignment'; end if;
   if (before_row->>'revision')::integer is distinct from p_revision then raise exception 'Task changed. Refresh and review the latest version.' using errcode='40001'; end if;
   if p_action not in ('complete','reopen') then raise exception 'Unknown task action'; end if;
   if p_action='complete' and lower(before_row->>'status') in ('completed','resolved','cancelled','skipped') then raise exception 'Task is already closed'; end if;
   if p_action='reopen' and lower(before_row->>'status') not in ('completed','resolved') then raise exception 'Only completed tasks can be reopened'; end if;
   if p_source='operational_tasks' then
     update public.operational_tasks set status=case when p_action='complete' then 'completed' else 'open' end,completed_at=case when p_action='complete' then now() else null end where id=p_id returning to_jsonb(operational_tasks.*) into after_row;
   elsif p_source='competition_exceptions' then
     -- A human attests to the resolution; this never changes eligibility or money.
     update public.competition_exceptions set status=case when p_action='complete' then 'resolved' else 'open' end,resolved_at=case when p_action='complete' then now() else null end,resolved_by=case when p_action='complete' then p_actor_person else null end where id=p_id returning to_jsonb(competition_exceptions.*) into after_row;
   else
     if p_action<>'complete' then raise exception 'Completed workflow stages cannot be reopened from the task list'; end if;
     select * into i from public.workflow_instances where id=(before_row->>'workflow_instance_id')::uuid for update;
     select * into d from public.workflow_definitions where id=i.workflow_definition_id;
     if d.tenant_id is distinct from p_tenant or i.status not in ('pending','running') then raise exception 'Workflow is not running in this club'; end if;
     stages:=d.definition->'stages';
     if jsonb_typeof(stages) is distinct from 'array' or jsonb_array_length(stages)=0 then raise exception 'Workflow stages need review by Organization Admin'; end if;
     select ordinality::integer-1 into stage_no from jsonb_array_elements_text(stages) with ordinality where value=before_row->>'task_code' limit 1;
     if stage_no is null then raise exception 'Task does not match a workflow stage'; end if;
     if coalesce((i.context->>'stage_index')::integer,0)<>stage_no then raise exception 'Complete the current workflow stage first'; end if;
     next_stage:=stages->>(stage_no+1);
     update public.workflow_tasks set status='completed',completed_at=now(),decision=p_note where id=p_id returning to_jsonb(workflow_tasks.*) into after_row;
     if next_stage is not null then
       insert into public.workflow_tasks(workflow_instance_id,task_code,assigned_to,status,tenant_id,organization_id,team_id,assigned_role,metadata)
       values(i.id,next_stage,(before_row->>'assigned_to')::uuid,'pending',p_tenant,(before_row->>'organization_id')::uuid,(before_row->>'team_id')::uuid,before_row->>'assigned_role',coalesce(before_row->'metadata','{}'::jsonb)||jsonb_build_object('stage_index',stage_no+1));
     end if;
     update public.workflow_instances set status=case when next_stage is null then 'completed' else 'running' end,completed_at=case when next_stage is null then now() else null end,context=coalesce(context,'{}'::jsonb)||jsonb_build_object('stage_index',stage_no+1,'current_stage',next_stage) where id=i.id;
     insert into public.workflow_transition_history(workflow_instance_id,from_state,to_state,transition_code,actor_person_id,reason,metadata) values(i.id,before_row->>'task_code',coalesce(next_stage,'completed'),'task_completed',p_actor_person,p_note,jsonb_build_object('task_id',p_id,'correlation_id',corr));
   end if;
 end if;
 insert into public.audit_events(tenant_id,actor_user_id,actor_person_id,action,entity_type,entity_id,before_data,after_data,correlation_id,reason)
 values(p_tenant,p_actor_user,p_actor_person,'triage.'||p_action,p_source,item_id,before_row,after_row,corr,p_note);
 return jsonb_build_object('id',item_id,'row',after_row,'correlationId',corr);
end $$;
revoke all on function public.admin_triage_change(text,uuid,integer,text,text,uuid,uuid[],text,uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.admin_triage_change(text,uuid,integer,text,text,uuid,uuid[],text,uuid,uuid,uuid,jsonb) to service_role;
notify pgrst,'reload schema';
create function public.admin_triage_feed(p_tenant uuid,p_orgs uuid[],p_role text,p_team uuid,p_person uuid,p_executive boolean,p_sources text[],p_status text,p_search text,p_page integer)
returns jsonb language sql stable security invoker set search_path='' as $$
 with all_tasks as (
   select 'operational_tasks'::text source,to_jsonb(t) row,t.id,t.tenant_id,t.organization_id,t.team_id,t.assigned_role,t.assigned_to,t.status,t.due_at,t.title search_text from public.operational_tasks t where 'operational_tasks'=any(p_sources)
   union all
   select 'workflow_tasks',to_jsonb(t),t.id,t.tenant_id,t.organization_id,t.team_id,t.assigned_role,t.assigned_to,t.status,t.due_at,coalesce(t.metadata->>'title',t.task_code) from public.workflow_tasks t where 'workflow_tasks'=any(p_sources)
   union all
   select 'competition_exceptions',to_jsonb(t),t.id,t.tenant_id,t.organization_id,t.team_id,t.assigned_role,t.assigned_to,t.status,null::timestamptz,t.problem from public.competition_exceptions t where 'competition_exceptions'=any(p_sources)
 ), filtered as (
   select * from all_tasks where tenant_id=p_tenant and organization_id=any(p_orgs)
   and (p_role='org_admin' or assigned_role=p_role)
   and (p_role<>'team_manager' or (p_team is not null and team_id=p_team))
   and (p_team is null or team_id=p_team)
   and (p_executive or assigned_to is null or assigned_to=p_person)
   and case when p_status='closed' then lower(status) in ('completed','resolved','cancelled','skipped') else coalesce(lower(status),'') not in ('completed','resolved','cancelled','skipped') end
   and (coalesce(p_search,'')='' or search_text ilike '%'||replace(replace(replace(p_search,'\','\\'),'%','\%'),'_','\_')||'%')
 ), page_rows as (select * from filtered order by due_at asc nulls last,id,source limit 25 offset greatest(p_page-1,0)*25)
 select jsonb_build_object('total',(select count(*) from filtered),'rows',coalesce((select jsonb_agg(jsonb_build_object('source',source,'row',row) order by due_at asc nulls last,id,source) from page_rows),'[]'::jsonb));
$$;
revoke all on function public.admin_triage_feed(uuid,uuid[],text,uuid,uuid,boolean,text[],text,text,integer) from public,anon,authenticated;
grant execute on function public.admin_triage_feed(uuid,uuid[],text,uuid,uuid,boolean,text[],text,text,integer) to service_role;
