-- Entry fee vouchers retain the exact reviewed line values. They do not post money.
create function public.admin_triage_domain_action(p_task uuid,p_revision integer,p_tenant uuid,p_orgs uuid[],p_role text,p_team uuid,p_actor_user uuid,p_actor_person uuid,p_action text,p_values jsonb,p_reason text)
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
  for recipient in select distinct fm.person_id from public.family_members fm join public.families f on f.id=fm.family_id and f.tenant_id=p_tenant join public.athletes a on a.primary_family_id=f.id join public.team_memberships tm on tm.athlete_id=a.id and tm.status='active' join public.teams te on te.id=tm.team_id and te.organization_id=t.organization_id where fm.is_primary_guardian and (tm.ends_on is null or tm.ends_on>=current_date) loop
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
