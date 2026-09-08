-- Maximo-style LS1Sports implementation scheduler hierarchy and command RPC.
do $$
declare pid uuid; super_id uuid; admin_id uuid; athlete_id uuid; parent_id uuid; scout_id uuid; coach_id uuid;
begin
  select id into pid from public.platform_projects where code='LS1SPORTS-IMPLEMENTATION' order by created_at desc limit 1;
  if pid is null then raise exception 'LS1SPORTS-IMPLEMENTATION project not found'; end if;

  insert into public.platform_project_tasks(project_id,code,name,description,status,percent_complete,start_date,target_date,sort_order,evidence)
  select pid,x.task_code,x.task_name,x.task_description,'active',0,p.start_date,p.target_date,x.task_sort,
         jsonb_build_object('work_order_type','engine','engine_key',x.engine_key,'ai_execution',true,'locked',false)
  from public.platform_projects p
  cross join (values
    ('ENGINE-SUPERUSER','Super User Engine','Super User operating system, platform control, Team Engine administration, security, governance, finance, operations and release control.',10,'superuser'),
    ('ENGINE-ADMIN','Admin Engine','Administrative operating workflows and tenant-level Team Engine administration.',20,'admin'),
    ('ENGINE-ATHLETE','Athlete Engine','Athlete experience, progression, profile and Team Engine participation workflows.',30,'athlete'),
    ('ENGINE-PARENT','Parent Engine','Parent and household Team Engine workflows.',40,'parent'),
    ('ENGINE-SCOUT','Scout Engine','Scout and recruiting Team Engine workflows.',50,'scout'),
    ('ENGINE-COACH','Coach Engine','Coach Team Engine operating workflows.',60,'coach')
  ) x(task_code,task_name,task_description,task_sort,engine_key)
  where p.id=pid
  on conflict(project_id,code) do update set name=excluded.name,description=excluded.description,sort_order=excluded.sort_order,
    start_date=coalesce(platform_project_tasks.start_date,excluded.start_date),target_date=coalesce(platform_project_tasks.target_date,excluded.target_date),
    evidence=coalesce(platform_project_tasks.evidence,'{}'::jsonb)||excluded.evidence,updated_at=now();

  select id into super_id from public.platform_project_tasks where project_id=pid and code='ENGINE-SUPERUSER';
  select id into admin_id from public.platform_project_tasks where project_id=pid and code='ENGINE-ADMIN';
  select id into athlete_id from public.platform_project_tasks where project_id=pid and code='ENGINE-ATHLETE';
  select id into parent_id from public.platform_project_tasks where project_id=pid and code='ENGINE-PARENT';
  select id into scout_id from public.platform_project_tasks where project_id=pid and code='ENGINE-SCOUT';
  select id into coach_id from public.platform_project_tasks where project_id=pid and code='ENGINE-COACH';

  update public.platform_project_tasks set parent_task_id=super_id,updated_at=now() where project_id=pid and code in ('IDENTITY-GATEWAY','DB-FOUNDATION','SECURITY-RLS','DATA-ONBOARDING','SUPERUSER','TEAM-ENGINE','FINANCE','COMPLIANCE','AI-AUTOMATION','INTEGRATIONS','TEST-RELEASE','MULTI-SPORT-EXPANSION') and id<>super_id;
  update public.platform_project_tasks set parent_task_id=athlete_id,updated_at=now() where project_id=pid and code='ATHLETE' and id<>athlete_id;
  update public.platform_project_tasks set parent_task_id=parent_id,updated_at=now() where project_id=pid and code='PARENT-OPERATIONS' and id<>parent_id;
  update public.platform_project_tasks set parent_task_id=coach_id,updated_at=now() where project_id=pid and code='COACH-OPERATIONS' and id<>coach_id;

  insert into public.platform_project_tasks(project_id,parent_task_id,code,name,description,status,percent_complete,start_date,target_date,sort_order,evidence)
  select pid,y.parent_ref,y.task_code,y.task_name,y.task_description,'planned',0,p.start_date,p.target_date,y.task_sort,
         jsonb_build_object('work_order_type','engine_backlog','ai_execution',true,'locked',false)
  from public.platform_projects p
  cross join lateral (values
    (admin_id,'ADMIN-PLAN','Admin Engine implementation plan','Complete the Admin Engine to the LS1Sports 100% definition after Super User is locked.',10),
    (scout_id,'SCOUT-PLAN','Scout Engine implementation plan','Complete the Scout Engine to the LS1Sports 100% definition in the approved hub sequence.',10)
  ) y(parent_ref,task_code,task_name,task_description,task_sort)
  where p.id=pid
  on conflict(project_id,code) do update set parent_task_id=excluded.parent_task_id,name=excluded.name,description=excluded.description,updated_at=now();
end $$;

create or replace function public.get_superuser_command()
returns jsonb language plpgsql set search_path to 'public' as $function$
declare p jsonb;m jsonb;t jsonb;r jsonb;c jsonb;u jsonb;i jsonb;g jsonb;
begin
  select to_jsonb(x) into p from (select id,name,status,start_date,target_date,description,code from platform_projects where code='LS1SPORTS-IMPLEMENTATION' order by created_at desc limit 1)x;
  if p is null then return jsonb_build_object('project',null,'milestones','[]'::jsonb,'tasks','[]'::jsonb,'raci','[]'::jsonb,'units','[]'::jsonb,'inventory','[]'::jsonb,'gates','[]'::jsonb,'counts','{}'::jsonb,'generatedAt',now(),'source','LS1SportsEAM Supabase','error','Implementation project has not been initialized.'); end if;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.sort_order),'[]'::jsonb) into m from (select pm.id,pm.code,pm.name,pm.domain,pm.status,pm.target_percent,coalesce(pm.metric_definition,'{}'::jsonb)||jsonb_build_object('denominator','DB → API → UI → lifecycle writes → authorization → audit → integration → tests/validation','gate_progress',coalesce(gp.percent_complete,0),'passed_gates',coalesce(gp.passed_gates,0),'gate_count',coalesce(gp.denominator,8),'gates',coalesce(gp.gates,'[]'::jsonb)) metric_definition,pm.sort_order from platform_milestones pm left join v_platform_milestone_gate_progress gp on gp.milestone_id=pm.id order by pm.sort_order)x;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.sort_order),'[]'::jsonb) into t from (select pt.id,pt.parent_task_id,pt.code,pt.name,pt.description,pt.status,coalesce(gp.percent_complete,pt.percent_complete,0)::numeric percent_complete,pt.start_date,pt.target_date,pt.sort_order,pt.blocker,coalesce(pt.evidence,'{}'::jsonb)||jsonb_build_object('progress_source',case when pt.milestone_id is null then 'platform_project_tasks' else 'platform_milestone_gate_status' end,'denominator','DB → API → UI → lifecycle writes → authorization → audit → integration → tests/validation','passed_gates',coalesce(gp.passed_gates,0),'gate_count',coalesce(gp.denominator,8),'gates',coalesce(gp.gates,'[]'::jsonb)) evidence,pt.milestone_id from platform_project_tasks pt left join v_platform_milestone_gate_progress gp on gp.milestone_id=pt.milestone_id where pt.project_id=(p->>'id')::uuid order by pt.sort_order)x;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at),'[]'::jsonb) into r from (select id,task_id,responsibility,person_id,role_id,notes,created_at from platform_raci_assignments where project_id=(p->>'id')::uuid order by created_at)x;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.unit_key),'[]'::jsonb) into u from (select id,milestone_id,unit_type,unit_key,status,evidence,completed_at,implementation_percent,operational_percent,validation_percent,evidence_source,evidence_ref,verified_at from platform_milestone_units order by unit_key)x;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.area,x.artifact_key),'[]'::jsonb) into i from (select id,area,artifact_type,artifact_key,repository_path,commit_sha,status,implementation_percent,operational_percent,validation_percent,evidence,verified_at from platform_implementation_inventory order by area,artifact_key)x;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.sort_order),'[]'::jsonb) into g from (select code,name,description,sort_order,is_active from platform_implementation_gates where is_active order by sort_order)x;
  select jsonb_build_object('organization_count',(select count(*) from organizations),'people_count',(select count(*) from people),'athlete_count',(select count(*) from athletes),'team_count',(select count(*) from teams),'team_membership_count',(select count(*) from team_memberships),'program_count',(select count(*) from programs),'season_count',(select count(*) from seasons),'import_job_count',(select count(*) from import_jobs),'data_quality_issue_count',(select count(*) from data_quality_issues),'approval_count',(select count(*) from approvals),'audit_event_count',(select count(*) from audit_events),'ai_agent_count',(select count(*) from ai_agents),'automation_count',(select count(*) from automation_definitions),'integration_count',(select count(*) from integration_connections),'asset_count',(select count(*) from assets),'milestone_unit_count',(select count(*) from platform_milestone_units),'implementation_gate_count',(select count(*) from platform_implementation_gates where is_active),'onboarding_count',(select count(*) from client_onboarding_cases),'credential_count',(select count(*) from credentials),'safesport_count',(select count(*) from safesport_records),'invoice_count',(select count(*) from invoices),'payment_count',(select count(*) from payments),'vendor_count',(select count(*) from vendors),'maintenance_work_order_count',(select count(*) from maintenance_work_orders),'facility_count',(select count(*) from facilities),'training_plan_count',(select count(*) from training_plans),'development_plan_count',(select count(*) from development_plans),'recruiting_cycle_count',(select count(*) from recruiting_cycles),'media_asset_count',(select count(*) from media_assets),'document_count',(select count(*) from documents),'workflow_definition_count',(select count(*) from workflow_definitions),'rule_count',(select count(*) from rules),'privacy_request_count',(select count(*) from privacy_requests),'communication_thread_count',(select count(*) from communication_threads),'report_definition_count',(select count(*) from report_definitions),'knowledge_item_count',(select count(*) from knowledge_items),'fixed_asset_count',(select count(*) from fixed_assets),'purchase_order_count',(select count(*) from purchase_orders),'payroll_run_count',(select count(*) from payroll_runs)) into c;
  return jsonb_build_object('project',p,'milestones',m,'tasks',t,'raci',r,'units',u,'inventory',i,'gates',g,'counts',c,'generatedAt',now(),'source','LS1SportsEAM Supabase','progressModel','8-gate A+ evidence denominator');
end $function$;
