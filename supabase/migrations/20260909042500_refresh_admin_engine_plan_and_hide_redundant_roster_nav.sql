do $$
declare
  v_project uuid;
  v_admin_plan uuid;
begin
  select id into v_project from public.platform_projects where code='LS1SPORTS-IMPLEMENTATION' order by created_at desc limit 1;
  select id into v_admin_plan from public.platform_project_tasks where project_id=v_project and code='ADMIN-PLAN' limit 1;

  if v_admin_plan is not null then
    update public.platform_project_tasks
       set status='active',
           evidence=coalesce(evidence,'{}'::jsonb) || jsonb_build_object(
             'progress_model','4-step evidence: implementation + live data/integration + production build/deploy + authenticated browser/runtime',
             'last_reconciled_at',now(),
             'source','Admin build evidence'
           ),
           updated_at=now()
     where id=v_admin_plan;

    insert into public.platform_project_tasks(project_id,parent_task_id,code,name,description,status,percent_complete,start_date,target_date,sort_order,evidence)
    select v_project,v_admin_plan,x.code,x.name,x.description,x.status,x.percent_complete,current_date,(select target_date from public.platform_projects where id=v_project),x.sort_order,x.evidence
    from (values
      ('ADMIN-HOME','Admin daily digest and command center','Role-aware daily digest, live calendar, action center, metrics, exceptions, quick actions and semantic color command-center UI.','active',75::numeric,10,jsonb_build_object('evidence_basis','implementation + live data + exact-SHA build/deploy proven; authenticated regular-Admin browser certification remains','runtime_certified',false)),
      ('ADMIN-AUTH','Admin authorization and RLS','Caller-JWT Admin authorization, role scoping, RLS policies and audited writes without service-role dependency.','active',75::numeric,20,jsonb_build_object('evidence_basis','implementation + live database policies + exact-SHA build/deploy proven; authenticated regular-Admin browser certification remains','runtime_certified',false)),
      ('ADMIN-RELATIONSHIPS','Vendor and external organization records','HubSpot-style vendor, municipal/council/external-organization records, contacts, associations, inline editing and audited writes.','active',75::numeric,30,jsonb_build_object('evidence_basis','implementation + live schema + exact-SHA build/deploy proven; authenticated browser workflow certification remains','runtime_certified',false)),
      ('ADMIN-REGISTRAR','Registrar workspace','Live registration queue with truthful zero-state behavior and role-aware access.','active',75::numeric,40,jsonb_build_object('evidence_basis','implementation + live registrations source + exact-SHA build/deploy proven; authenticated browser workflow certification remains','runtime_certified',false)),
      ('ADMIN-MEMBERSHIP','Membership administration','Live canonical organization/governing-body membership workspace using 229 HPAC records and real people associations.','active',75::numeric,50,jsonb_build_object('evidence_basis','implementation + live 229-row source + exact-SHA build/deploy proven; authenticated browser record workflow certification remains','runtime_certified',false)),
      ('ADMIN-TEAM','Teams, programs and seasons administration','Live Team Engine teams/programs/seasons administration with HPAC as current canonical club context.','active',75::numeric,60,jsonb_build_object('evidence_basis','implementation + live canonical data + exact-SHA build/deploy proven; authenticated browser record workflow certification remains','runtime_certified',false)),
      ('ADMIN-FINANCE','Billing, invoices and payments workspaces','Billing controls plus invoice/payment workspaces with clearly separated demo transactions where live financial activity is absent.','active',75::numeric,70,jsonb_build_object('evidence_basis','implementation + canonical finance tables + exact-SHA build/deploy proven; real transaction/runtime certification remains','runtime_certified',false)),
      ('ADMIN-DESIGN','Admin visual system and record UX','Platform semantic colors, larger readable Admin presentation, colorful action-center patterns and shared three-column record shell.','active',75::numeric,80,jsonb_build_object('evidence_basis','implementation + exact-SHA build/deploy proven; cross-device/browser visual certification remains','runtime_certified',false)),
      ('ADMIN-COMPETITION','Competition-facing Admin operations','Competition eligibility notifications, going/no-response tracking and open-water logistics surfaced in Admin without merging Team Engine and Competition Engine.','planned',0::numeric,90,jsonb_build_object('evidence_basis','planned; not yet implemented','runtime_certified',false))
    ) as x(code,name,description,status,percent_complete,sort_order,evidence)
    where not exists(select 1 from public.platform_project_tasks p where p.project_id=v_project and p.code=x.code);
  end if;

  update public.hub_navigation
     set is_active=false,
         description='Roster assignment is coach-centric. Admin accesses team assignment context through Teams and Membership rather than a duplicate top-level roster workspace.'
   where hub_id='admin' and label='Rosters';
end $$;
