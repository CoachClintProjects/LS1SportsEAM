-- Derive queue items from canonical records. No example records or amounts.
alter table public.operational_tasks add column metadata jsonb not null default '{}'::jsonb;
alter table public.operational_tasks add column origin_key text;
create unique index operational_tasks_origin on public.operational_tasks(tenant_id,organization_id,origin_key) where origin_key is not null;

create table public.triage_fee_vouchers (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),organization_id uuid not null references public.organizations(id),team_id uuid not null references public.teams(id),competition_id uuid not null references public.competitions(id),
 status text not null default 'verified' check(status in ('verified','linked','returned')),
 snapshot jsonb not null,source_key text not null,verified_by uuid not null references public.people(id),verified_at timestamptz not null default now(),reason text not null,vendor_bill_id uuid references public.vendor_bills(id),
 unique(tenant_id,organization_id,source_key)
);
alter table public.triage_fee_vouchers enable row level security;
revoke all on public.triage_fee_vouchers from public,anon,authenticated;
grant all on public.triage_fee_vouchers to service_role;

create function public.admin_triage_candidates(p_tenant uuid,p_orgs uuid[])
returns table(origin_key text,organization_id uuid,team_id uuid,assigned_role text,title text,description text,priority text,due_at timestamptz,metadata jsonb)
language sql stable security invoker set search_path='' as $$
 with orgs as (select id from public.organizations where tenant_id=p_tenant and id=any(p_orgs)),
 active_squads as (
 select distinct m.athlete_id,m.person_id,m.team_id,t.organization_id from public.team_memberships m join public.teams t on t.id=m.team_id join orgs o on o.id=t.organization_id
 where m.status='active' and (m.starts_on is null or m.starts_on<=current_date) and (m.ends_on is null or m.ends_on>=current_date)
 ), fee_groups as (
 select e.team_id,c.organization_id,c.id competition_id,c.name,f.currency_code,count(distinct e.id) entries,sum(f.total_amount) amount,
 jsonb_agg(jsonb_build_object('fee_id',f.id,'entry_id',e.id,'quantity',f.quantity,'unit_amount',f.unit_amount,'total_amount',f.total_amount) order by f.id) lines
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
 select 'safesport:'||s.id||':'||o.id,o.id,null,'registrar','SafeSport evidence needs review',
 'A club member’s SafeSport record is expired or awaiting verification.','critical',s.expires_on::timestamptz,
 jsonb_build_object('kind','safesport','entity_type','safesport_records','entity_id',s.id,'person_id',s.person_id,'exception_code','CREDENTIAL_AUDITING','recommended_action','Review the supporting document and current certificate before approving the record.','evidence',jsonb_build_object('expires_on',s.expires_on,'status',s.status))
 from public.safesport_records s join public.people p on p.id=s.person_id and p.tenant_id=p_tenant join orgs o on exists(select 1 from public.role_assignments ra where ra.person_id=s.person_id and ra.organization_id=o.id and ra.tenant_id=p_tenant and ra.status='active')
 where s.status not in ('revoked','rejected') and (s.expires_on<current_date or s.status='pending' or s.verified_at is null)
 ) select * from candidates;
$$;
revoke all on function public.admin_triage_candidates(uuid,uuid[]) from public,anon,authenticated;
grant execute on function public.admin_triage_candidates(uuid,uuid[]) to service_role;

create function public.admin_triage_sync(p_tenant uuid,p_orgs uuid[])
returns jsonb language plpgsql security invoker set search_path='' as $$
declare row_data record; existing public.operational_tasks%rowtype; changed integer:=0; keys text[]:=array[]::text[];
begin
 -- Serialize reconciliation per tenant. Nothing is paid, approved or sent here.
 perform pg_advisory_xact_lock(hashtextextended(p_tenant::text||':triage',0));
 for row_data in select * from public.admin_triage_candidates(p_tenant,p_orgs) loop
  keys:=array_append(keys,row_data.origin_key||':'||row_data.organization_id);
  select * into existing from public.operational_tasks where tenant_id=p_tenant and organization_id=row_data.organization_id and origin_key=row_data.origin_key for update;
  if existing.id is null then
   insert into public.operational_tasks(tenant_id,organization_id,team_id,assigned_role,title,description,priority,status,due_at,metadata,origin_key) values(p_tenant,row_data.organization_id,row_data.team_id,row_data.assigned_role,row_data.title,row_data.description,row_data.priority,'open',row_data.due_at,row_data.metadata,row_data.origin_key);
   changed:=changed+1;
  elsif (existing.metadata-'last_action_at') is distinct from row_data.metadata or existing.description is distinct from row_data.description or existing.title is distinct from row_data.title or existing.due_at is distinct from row_data.due_at or existing.assigned_role is distinct from row_data.assigned_role or existing.status='completed' then
   update public.operational_tasks set metadata=row_data.metadata||case when existing.metadata ? 'last_action_at' then jsonb_build_object('last_action_at',existing.metadata->'last_action_at') else '{}'::jsonb end,title=row_data.title,description=row_data.description,priority=row_data.priority,due_at=row_data.due_at,assigned_role=row_data.assigned_role,status='open',completed_at=null where id=existing.id;
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
notify pgrst,'reload schema';
