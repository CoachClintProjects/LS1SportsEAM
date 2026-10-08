-- Reconciliation audit trail and source-state checks.
create or replace function public.admin_triage_candidates(p_tenant uuid,p_orgs uuid[])
returns table(origin_key text,organization_id uuid,team_id uuid,assigned_role text,title text,description text,priority text,due_at timestamptz,metadata jsonb)
language sql stable security invoker set search_path='' as $$
 with orgs as (select id from public.organizations where tenant_id=p_tenant and id=any(p_orgs)),
 active_squads as (
 select distinct m.athlete_id,m.person_id,m.team_id,t.organization_id from public.team_memberships m join public.teams t on t.id=m.team_id join orgs o on o.id=t.organization_id
 where m.status='active' and (m.starts_on is null or m.starts_on<=current_date) and (m.ends_on is null or m.ends_on>=current_date)
 ), fee_groups as (
 select e.team_id,c.organization_id,c.id competition_id,c.name,f.currency_code,count(distinct e.id) entries,sum(f.total_amount) amount,
 jsonb_agg(jsonb_build_object('fee_id',f.id,'entry_id',e.id,'quantity',f.quantity,'unit_amount',f.unit_amount,'event',ev.name,'athlete_id',e.athlete_id,'total_amount',f.total_amount) order by f.id) lines
 from public.competition_entry_fees f join public.competition_entries e on e.id=f.entry_id
 join public.competition_events ev on ev.id=e.competition_event_id join public.competitions c on c.id=ev.competition_id
 join public.teams t on t.id=e.team_id and t.organization_id=c.organization_id join orgs o on o.id=c.organization_id
 where c.tenant_id=p_tenant and f.competition_id=c.id and coalesce(f.status,'') not in ('paid','cancelled','void') and coalesce(e.entry_status,'') not in ('cancelled','rejected')
 group by e.team_id,c.organization_id,c.id,c.name,f.currency_code
 ), candidates as (
 select 'lease:'||c.id origin_key,c.organization_id,null::uuid team_id,'org_admin'::text assigned_role,
 'Contract renewal: '||c.title title,'Contract expires on '||c.expires_on||'. Renewal terms have not been recorded.' description,'critical'::text priority,c.expires_on::timestamptz due_at,
 jsonb_build_object('kind','lease','entity_type','contracts','entity_id',c.id,'exception_code','LEASE_RENEWAL','recommended_action','Review the contract and record the proposed renewal terms.','evidence',jsonb_build_object('expires_on',c.expires_on,'counterparty',c.counterparty_name)) metadata
 from public.contracts c join orgs o on o.id=c.organization_id
 where c.tenant_id=p_tenant and c.status not in ('cancelled','terminated','expired') and c.expires_on between current_date and current_date+30
 and not exists(select 1 from public.contract_versions v where v.contract_id=c.id and v.terms->>'renewal_for'=c.expires_on::text and nullif(trim(v.terms->>'renewal_terms'),'') is not null)
 union all
 select 'staff:'||c.id,c.organization_id,null,'org_admin','Volunteers needed: '||c.name,
 'The Volunteer Coordinator role is vacant. '||sum(r.required_count-coalesce(a.filled,0))||' required official positions remain unfilled.', 'critical',c.starts_at,
 jsonb_build_object('kind','staffing','entity_type','competitions','entity_id',c.id,'exception_code','STAFF_POSITION_VACANT','recommended_action','Review the remaining positions and send a club parent request.','evidence',jsonb_agg(jsonb_build_object('role',r.role_code,'required',r.required_count,'filled',coalesce(a.filled,0))))
 from public.competitions c join orgs o on o.id=c.organization_id join public.competition_official_requirements r on r.competition_id=c.id and r.active
 left join lateral (select count(*) filled from public.competition_official_assignments a where a.requirement_id=r.id and a.competition_id=c.id and a.status not in ('cancelled','declined')) a on true
 where c.tenant_id=p_tenant and c.starts_at between now() and now()+interval '30 days' and r.required_count>coalesce(a.filled,0)
 and not exists(select 1 from public.role_assignments ra join public.role_definitions rd on rd.id=ra.role_definition_id where ra.organization_id=c.organization_id and ra.tenant_id=p_tenant and rd.code='VOLUNTEER_COORDINATOR' and rd.is_active and ra.status='active' and (ra.starts_at is null or ra.starts_at<=now()) and (ra.ends_at is null or ra.ends_at>now()))
 group by c.id,c.organization_id,c.name,c.starts_at
 union all
 select 'bill:'||b.id,e.organization_id,null,case when b.status='submitted' and b.approval_required_role='org_admin' then 'org_admin' else 'treasurer' end,
 'Review bill '||b.bill_number,case when b.status='submitted' then 'This bill is awaiting spending approval.' else 'This approved bill is awaiting payment processing.' end,'normal',b.due_date::timestamptz,
 jsonb_build_object('kind','payable','entity_type','vendor_bills','entity_id',b.id,'exception_code',case when b.status='submitted' then 'SPENDING_APPROVAL' else 'VOUCHER_INTAKE' end,'recommended_action','Review the bill lines and use the authorized payable controls.','evidence',jsonb_build_object('amount',b.total,'currency',b.currency,'threshold',p.executive_threshold,'status',b.status))
 from public.vendor_bills b join public.legal_entities e on e.id=b.legal_entity_id join orgs o on o.id=e.organization_id left join public.payable_authority_policies p on p.legal_entity_id=e.id
 where b.status in ('submitted','approved','partially_paid')
 union all
 select 'waiver:'||w.id||':'||s.team_id,w.organization_id,s.team_id,'team_manager','Consent needed for a confirmed swimmer',
 'A swimmer has accepted a competition invitation and still has an unsigned required waiver.','critical',w.due_at,
 jsonb_build_object('kind','waiver','entity_type','people','entity_id',a.person_id,'exception_code','ROSTER_BLOCKED','recommended_action','Review the swimmer’s registration and supporting consent. Any waiver decision requires the authorized registration review.','evidence',jsonb_build_object('waiver_assignment_id',w.id,'athlete_id',a.id,'waiver_status',w.status))
 from public.waiver_assignments w join orgs o on o.id=w.organization_id join public.athletes a on a.id=w.athlete_id join active_squads s on s.athlete_id=a.id and s.organization_id=w.organization_id and (w.team_id is null or w.team_id=s.team_id)
 where w.tenant_id=p_tenant and w.status in ('pending','assigned','overdue') and exists(select 1 from public.competition_participation_responses r join public.competitions c on c.id=r.competition_id where r.athlete_id=w.athlete_id and r.organization_id=w.organization_id and r.tenant_id=p_tenant and lower(r.response_status) in ('going') and c.starts_at>now())
 union all
 select 'rsvp:'||r.id||':'||s.team_id,r.organization_id,s.team_id,'team_manager','Competition reply needed: '||c.name,
 'A swimmer has not replied and the entry deadline is approaching.','normal',d.due_at,
 jsonb_build_object('kind','rsvp','entity_type','competition_participation_responses','entity_id',r.id,'exception_code','DEADLINE_APPROACHING','recommended_action','Send a reminder to the recorded recipient’s LS1 inbox.','evidence',jsonb_build_object('athlete_id',r.athlete_id,'deadline',d.due_at,'competition',c.name))
 from public.competition_participation_responses r join orgs o on o.id=r.organization_id join public.competitions c on c.id=r.competition_id and c.tenant_id=p_tenant join active_squads s on s.athlete_id=r.athlete_id and s.organization_id=r.organization_id
 join lateral(select min(due_at) due_at from public.competition_deadlines where competition_id=c.id and deadline_type='entries' and status not in ('cancelled','closed') and due_at between now() and now()+interval '7 days') d on d.due_at is not null
 where r.tenant_id=p_tenant and lower(r.response_status) in ('awaiting_response')
 union all
 select 'fees:'||g.competition_id||':'||g.team_id||':'||g.currency_code,g.organization_id,g.team_id,'team_manager','Verify team entry fees: '||g.name,
 g.entries||' entries have unpaid fees totalling '||g.amount||' '||g.currency_code||'.','normal',null,
 jsonb_build_object('kind','fees','entity_type','competitions','entity_id',g.competition_id,'exception_code','UNVERIFIED_TEAM_FEES','recommended_action','Review every entry fee and send a verified voucher to Treasurer.','evidence',jsonb_build_object('entries',g.entries,'amount',g.amount,'currency',g.currency_code,'lines',g.lines))
 from fee_groups g where g.amount>0 and not exists(select 1 from public.triage_fee_vouchers v where v.tenant_id=p_tenant and v.organization_id=g.organization_id and v.source_key='fees:'||g.competition_id||':'||g.team_id||':'||g.currency_code||':'||md5(jsonb_build_object('entries',g.entries,'amount',g.amount,'currency',g.currency_code,'lines',g.lines)::text) and v.status<>'returned')
 union all
 select 'identity:'||rs.id,r.organization_id,null,'registrar','Identity evidence needs review',
 'A swimmer’s required identity evidence is not yet verified.','critical',null,
 jsonb_build_object('kind','identity','entity_type','people','entity_id',a.person_id,'exception_code','IDENTITY_VERIFICATION','recommended_action','Inspect the uploaded document, then record the registration requirement decision.','evidence',jsonb_build_object('requirement',q.name,'requirement_status',rs.status,'document_id',rs.evidence_document_id))
 from public.registration_requirement_status rs join public.registrations r on r.id=rs.registration_id join orgs o on o.id=r.organization_id join public.registration_requirements q on q.id=rs.requirement_id join public.athletes a on a.id=r.athlete_id
 where q.required and lower(q.requirement_type) in ('identity','birth_certificate','date_of_birth','dob') and rs.status not in ('verified','satisfied','approved','waived') and r.status not in ('cancelled','rejected')
 union all
 select 'safesport:'||s.id||':'||o.id,o.id,null,'registrar','SafeSport review: '||p.first_name||' '||p.last_name,
 'A club member’s SafeSport record is expired or awaiting verification.','critical',s.expires_on::timestamptz,
 jsonb_build_object('kind','safesport','entity_type','safesport_records','entity_id',s.id,'person_id',s.person_id,'exception_code','CREDENTIAL_AUDITING','recommended_action','Review the supporting document and current certificate before approving the record.','evidence',jsonb_build_object('expires_on',s.expires_on,'status',s.status))
 from public.safesport_records s join public.people p on p.id=s.person_id and p.tenant_id=p_tenant join orgs o on exists(select 1 from public.role_assignments ra where ra.person_id=s.person_id and ra.organization_id=o.id and ra.tenant_id=p_tenant and ra.status='active')
 where s.status not in ('revoked','rejected') and (s.expires_on<current_date or s.status='pending' or s.verified_at is null) and exists(select 1 from public.role_assignments ra where ra.person_id=s.person_id and ra.organization_id=o.id and ra.status='active' and (ra.ends_at is null or ra.ends_at>now()))
 ) select * from candidates;
$$;
revoke all on function public.admin_triage_candidates(uuid,uuid[]) from public,anon,authenticated;
grant execute on function public.admin_triage_candidates(uuid,uuid[]) to service_role;

create or replace function public.admin_triage_sync(p_tenant uuid,p_orgs uuid[])
returns jsonb language plpgsql security invoker set search_path='' as $$
declare row_data record; existing public.operational_tasks%rowtype; changed integer:=0; saved jsonb; new_id uuid; keys text[]:=array[]::text[];
begin
 -- Serialize reconciliation per tenant. Nothing is paid, approved or sent here.
 perform pg_advisory_xact_lock(hashtextextended(p_tenant::text||':triage',0));
 for row_data in select * from public.admin_triage_candidates(p_tenant,p_orgs) loop
  keys:=array_append(keys,row_data.origin_key||':'||row_data.organization_id);
  select * into existing from public.operational_tasks where tenant_id=p_tenant and organization_id=row_data.organization_id and origin_key=row_data.origin_key for update;
  if existing.id is null then
   insert into public.operational_tasks(tenant_id,organization_id,team_id,assigned_role,title,description,priority,status,due_at,metadata,origin_key) values(p_tenant,row_data.organization_id,row_data.team_id,row_data.assigned_role,row_data.title,row_data.description,row_data.priority,'open',row_data.due_at,row_data.metadata,row_data.origin_key) returning id,to_jsonb(operational_tasks.*) into new_id,saved;
   insert into public.audit_events(tenant_id,action,entity_type,entity_id,after_data,reason) values(p_tenant,'triage.source_detected','operational_tasks',new_id,saved,'A live source record requires review.');
   changed:=changed+1;
  elsif (existing.metadata-'last_action_at') is distinct from row_data.metadata or existing.description is distinct from row_data.description or existing.title is distinct from row_data.title or existing.due_at is distinct from row_data.due_at or existing.assigned_role is distinct from row_data.assigned_role or existing.status='completed' then
   update public.operational_tasks set metadata=row_data.metadata||case when existing.metadata ? 'last_action_at' then jsonb_build_object('last_action_at',existing.metadata->'last_action_at') else '{}'::jsonb end,title=row_data.title,description=row_data.description,priority=row_data.priority,due_at=row_data.due_at,assigned_role=row_data.assigned_role,status='open',completed_at=null where id=existing.id returning to_jsonb(operational_tasks.*) into saved;
   insert into public.audit_events(tenant_id,action,entity_type,entity_id,before_data,after_data,reason) values(p_tenant,'triage.source_changed','operational_tasks',existing.id,to_jsonb(existing),saved,'The underlying source record changed.');
   changed:=changed+1;
  end if;
 end loop;
 with closed as (
 update public.operational_tasks set status='completed',completed_at=now() where tenant_id=p_tenant and organization_id=any(p_orgs) and origin_key is not null and status<>'completed' and not ((origin_key||':'||organization_id)=any(keys)) returning *
 ) insert into public.audit_events(tenant_id,action,entity_type,entity_id,after_data,reason) select tenant_id,'triage.source_cleared','operational_tasks',id,to_jsonb(closed.*),'The underlying record no longer meets the task condition.' from closed;
 return jsonb_build_object('changed',changed);
end $$;
revoke all on function public.admin_triage_sync(uuid,uuid[]) from public,anon,authenticated;
grant execute on function public.admin_triage_sync(uuid,uuid[]) to service_role;
create or replace function public.admin_triage_change(p_source text,p_id uuid,p_revision integer,p_action text,p_note text,p_tenant uuid,p_orgs uuid[],p_role text,p_team uuid,p_actor_user uuid,p_actor_person uuid,p_create jsonb default null)
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
   if before_row->>'origin_key' is not null or before_row->'metadata'->>'kind'='fee_voucher' then raise exception 'Resolve the linked record using its domain controls';end if;
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
create or replace function public.admin_triage_domain_action(p_task uuid,p_revision integer,p_tenant uuid,p_orgs uuid[],p_role text,p_team uuid,p_actor_user uuid,p_actor_person uuid,p_action text,p_values jsonb,p_reason text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare t public.operational_tasks%rowtype; candidate record; prior jsonb; saved jsonb; c public.contracts%rowtype; r public.competition_participation_responses%rowtype; recipient uuid; family uuid; n integer:=0; vid uuid; corr uuid:=gen_random_uuid(); msg text; b public.vendor_bills%rowtype; v public.triage_fee_vouchers%rowtype;
begin
 if p_actor_user is null or p_actor_person is null or not exists(select 1 from public.people where id=p_actor_person and tenant_id=p_tenant) then raise exception 'An authenticated club person is required'; end if;
 if length(trim(coalesce(p_reason,'')))<5 or length(p_reason)>4000 then raise exception 'Record a reason between 5 and 4000 characters'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_tenant::text||':triage',0));
 select * into t from public.operational_tasks where id=p_task for update;
 if t.id is null or t.tenant_id is distinct from p_tenant or not coalesce(t.organization_id=any(p_orgs),false) or (p_role<>'org_admin' and t.assigned_role is distinct from p_role) or (p_team is not null and t.team_id is distinct from p_team) or (p_role='team_manager' and p_team is null) then raise exception '[DENY: ERR-901] Task is outside your assignment'; end if;
 if t.revision is distinct from p_revision then raise exception 'Task changed. Reload before saving.' using errcode='40001';end if;
 prior:=to_jsonb(t);
 if t.origin_key is not null and not exists(select 1 from public.admin_triage_candidates(p_tenant,array[t.organization_id]) x where x.origin_key=t.origin_key) then raise exception 'The source record changed. Refresh this task.' using errcode='40001';end if;
 if t.status='completed' then raise exception 'Task is already closed';end if;
 if p_action='lease_terms' and t.metadata->>'kind'='lease' then
  select * into c from public.contracts where id=(t.metadata->>'entity_id')::uuid and tenant_id=p_tenant and organization_id=t.organization_id for update;
  if c.id is null or c.current_version is distinct from (p_values->>'version')::integer then raise exception 'Contract changed. Reload its latest version.' using errcode='40001';end if;
  if length(trim(coalesce(p_values->>'terms','')))<10 then raise exception 'Enter the proposed renewal terms';end if;
  insert into public.contract_versions(contract_id,version_no,terms,uploaded_by) values(c.id,coalesce(c.current_version,0)+1,jsonb_build_object('renewal_for',c.expires_on,'renewal_terms',trim(p_values->>'terms'),'reviewed_by',p_actor_person,'reviewed_at',now()),p_actor_person);
  update public.contracts set current_version=coalesce(current_version,0)+1,updated_at=now() where id=c.id;
  msg:='Proposed renewal terms recorded. The contract dates and legal status are unchanged.';
 elsif p_action='remind' and t.metadata->>'kind'='rsvp' then
  select * into r from public.competition_participation_responses where id=(t.metadata->>'entity_id')::uuid and tenant_id=p_tenant and organization_id=t.organization_id for update;
  if r.id is null or r.response_status<>'awaiting_response' then raise exception 'This swimmer no longer needs a reply reminder';end if;
  if r.recipient_person_id is null then raise exception 'The invitation has no recorded recipient. Correct the invitation first.';end if;
  if r.last_reminded_at>now()-interval '1 hour' then raise exception 'A reminder was already recorded within the last hour';end if;
  if not exists(select 1 from public.people where id=r.recipient_person_id and tenant_id=p_tenant) then raise exception 'Recipient is outside this club';end if;
  insert into public.notification_events(tenant_id,recipient_person_id,event_type,title,body,priority) values(p_tenant,r.recipient_person_id,'competition.reply_reminder',t.title,p_reason,'normal');
  update public.competition_participation_responses set reminder_count=coalesce(reminder_count,0)+1,last_reminded_at=now(),updated_at=now() where id=r.id;
  msg:='Reminder added to the recipient’s LS1 notification queue. No SMS or push delivery was attempted.';
 elsif p_action='broadcast' and t.metadata->>'kind'='staffing' then
  if exists(select 1 from public.audit_events where entity_type='operational_tasks' and entity_id=t.id and action='triage.broadcast' and occurred_at>now()-interval '1 hour') then raise exception 'A parent request was already recorded within the last hour';end if;
  for recipient in select distinct fm.person_id from public.family_members fm join public.families f on f.id=fm.family_id and f.tenant_id=p_tenant join public.athletes a on a.primary_family_id=f.id join public.team_memberships tm on tm.athlete_id=a.id and tm.status='active' join public.teams te on te.id=tm.team_id and te.organization_id=t.organization_id where fm.is_primary_guardian and (tm.starts_on is null or tm.starts_on<=current_date) and (tm.ends_on is null or tm.ends_on>=current_date) loop
   insert into public.notification_events(tenant_id,recipient_person_id,event_type,title,body,priority) values(p_tenant,recipient,'competition.volunteers_needed',t.title,p_reason,'normal');
   n:=n+1;
  end loop;
  if n=0 then raise exception 'No recorded primary guardians were found for this club';end if;
  msg:=n||' parent requests added to LS1 notification queue. No SMS or push delivery was attempted.';
 elsif p_action='verify_fees' and t.metadata->>'kind'='fees' then
  -- Lock the current fees while comparing the exact reviewed amounts.
  perform f.id from public.competition_entry_fees f join public.competition_entries e on e.id=f.entry_id where f.competition_id=(t.metadata->>'entity_id')::uuid and e.team_id=t.team_id order by f.id for update of f;
  select * into candidate from public.admin_triage_candidates(p_tenant,array[t.organization_id]) where origin_key=t.origin_key;
  if candidate.origin_key is null or candidate.metadata->'evidence' is distinct from t.metadata->'evidence' then raise exception 'Entry fees changed. Refresh and review all current lines.' using errcode='40001';end if;
  insert into public.triage_fee_vouchers(tenant_id,organization_id,team_id,competition_id,snapshot,source_key,verified_by,reason)
  values(p_tenant,t.organization_id,t.team_id,(t.metadata->>'entity_id')::uuid,t.metadata->'evidence',t.origin_key||':'||md5((t.metadata->'evidence')::text),p_actor_person,p_reason)
  on conflict(tenant_id,organization_id,source_key) do update set status='verified',verified_by=excluded.verified_by,verified_at=now(),reason=excluded.reason where triage_fee_vouchers.status='returned' returning id into vid;
  if vid is null then raise exception 'This exact fee voucher was already sent to Treasurer';end if;
  insert into public.operational_tasks(tenant_id,organization_id,team_id,assigned_role,title,description,priority,status,metadata)
  values(p_tenant,t.organization_id,t.team_id,'treasurer','Review verified competition fees','The Team Manager has reviewed each entry fee. Link the matching vendor bill before processing payment.','normal','open',jsonb_build_object('kind','fee_voucher','entity_type','triage_fee_vouchers','entity_id',vid,'exception_code','VOUCHER_INTAKE','recommended_action','Review the verified fee lines and link the matching bill.','evidence',t.metadata->'evidence'));
  msg:='Verified fee voucher sent to Treasurer. No money has been posted.';
 elsif p_action='link_bill' and t.metadata->>'kind'='fee_voucher' then
  select * into v from public.triage_fee_vouchers where id=(t.metadata->>'entity_id')::uuid and tenant_id=p_tenant and organization_id=t.organization_id for update;
  if v.id is null or v.status<>'verified' then raise exception 'Voucher has already been processed';end if;
  select vb.* into b from public.vendor_bills vb join public.legal_entities le on le.id=vb.legal_entity_id where vb.id=(p_values->>'bill_id')::uuid and le.organization_id=t.organization_id for update of vb;
  if b.id is null or b.status='cancelled' or b.total is distinct from (v.snapshot->>'amount')::numeric or trim(b.currency) is distinct from v.snapshot->>'currency' then raise exception 'Select a current club bill matching the verified fee amount and currency';end if;
  if exists(select 1 from public.triage_fee_vouchers where vendor_bill_id=b.id and id<>v.id and status='linked') then raise exception 'This bill is already linked to a fee voucher';end if;
  update public.triage_fee_vouchers set status='linked',vendor_bill_id=b.id where id=v.id;
  update public.operational_tasks set status='completed',completed_at=now() where id=t.id;
  msg:='Voucher linked to the bill. Approval and payment remain subject to the payable controls.';
 else raise exception 'Action does not match this task';end if;
 -- Revision protects repeat clicks even when the underlying condition remains open.
 update public.operational_tasks set metadata=metadata||jsonb_build_object('last_action_at',now()) where id=t.id returning to_jsonb(operational_tasks.*) into saved;
 insert into public.audit_events(tenant_id,actor_user_id,actor_person_id,action,entity_type,entity_id,before_data,after_data,correlation_id,reason) values(p_tenant,p_actor_user,p_actor_person,'triage.'||p_action,'operational_tasks',t.id,prior,saved,corr,p_reason);
 return jsonb_build_object('message',msg,'correlationId',corr);
end $$;
revoke all on function public.admin_triage_domain_action(uuid,integer,uuid,uuid[],text,uuid,uuid,uuid,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.admin_triage_domain_action(uuid,integer,uuid,uuid[],text,uuid,uuid,uuid,text,jsonb,text) to service_role;
notify pgrst,'reload schema';
