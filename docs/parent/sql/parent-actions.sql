alter type public.legal_custody_tier add value if not exists 'UNVERIFIED';
create or replace function public.parent_action(p_user uuid,p_person uuid,p_athlete uuid,p_org uuid,p_action text,p_id uuid,p_values jsonb)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare g family_authority_assignments; a athletes; required_scope text; before_value jsonb; after_value jsonb; r competition_participation_responses; w waiver_assignments; d waivers; template_row waiver_templates; o volunteer_opportunities; result_id uuid; target_role text;
begin
 required_scope:=case p_action when 'respond' then 'parent.respond' when 'sign' then 'parent.sign' when 'contact' then 'parent.contact' when 'document' then 'parent.documents' else case when p_values->>'kind'='billing' then 'parent.finance' else 'parent.read' end end;
 select * into g from family_authority_assignments where athlete_id=p_athlete and person_id=p_person and status='active' and valid_from<=now() and (valid_until is null or valid_until>now()) and legal_custody_status<>'RESTRICTED_NO_CONTACT' and restrictions='[]'::jsonb and authority_scopes ? 'parent.read' and authority_scopes ? required_scope for share;
 if not found or p_user is null then raise exception 'Current guardian permission required';end if;
 select at.* into a from athletes at join people p on p.id=at.person_id where at.id=p_athlete and p.tenant_id=g.tenant_id;
 if not found then raise exception 'Athlete outside guardian tenant';end if;
 if not exists(select 1 from organizations where id=p_org and tenant_id=g.tenant_id) or not (exists(select 1 from team_memberships m join teams t on t.id=m.team_id where m.athlete_id=p_athlete and m.status='active' and t.organization_id=p_org and (m.starts_on is null or m.starts_on<=current_date) and (m.ends_on is null or m.ends_on>=current_date)) or exists(select 1 from registrations where athlete_id=p_athlete and organization_id=p_org)) then raise exception 'Athlete outside club';end if;
 if p_action='respond' then
 select * into r from competition_participation_responses where id=p_id and athlete_id=p_athlete and recipient_person_id=p_person and organization_id=p_org for update;
 if not found or r.invitation_status<>'notified' then raise exception 'Open invitation addressed to you required';end if;
 if not exists(select 1 from competitions where id=r.competition_id and status not in ('cancelled','archived') and starts_at>now()) then raise exception 'Competition no longer accepts responses';end if;
 if (nullif(r.metadata->>'response_due_at','') is not null and (r.metadata->>'response_due_at')::timestamptz<now()) or exists(select 1 from competition_deadlines where competition_id=r.competition_id and lower(name) ~ '(rsvp|participation|response)' and status not in ('cancelled','completed') and due_at<now()) then raise exception 'Competition deadline passed. Contact your team manager';end if;
 if coalesce(p_values->>'response','') not in ('going','not_going') then raise exception 'Choose attending or not attending';end if;
 if r.updated_at is distinct from (p_values->>'expected_updated_at')::timestamptz then raise exception 'Response changed. Refresh before saving';end if;
 before_value:=to_jsonb(r);
 update competition_participation_responses set response_status=p_values->>'response',responded_at=now(),updated_at=now() where id=p_id returning to_jsonb(competition_participation_responses.*) into after_value;
 elsif p_action='request' then
 if coalesce(p_values->>'kind','') not in ('registration','squad_change','identity','billing','absence','message','nomination','family_access') then raise exception 'Unsupported request';end if;
 if length(trim(coalesce(p_values->>'description','')))<3 or length(p_values->>'description')>4000 then raise exception 'Describe your request in 3–4,000 characters';end if;
 target_role:=case p_values->>'kind' when 'billing' then 'treasurer' when 'registration' then 'registrar' when 'identity' then 'registrar' when 'absence' then 'team_manager' when 'squad_change' then 'team_manager' when 'nomination' then 'competition_manager' else 'org_admin' end;
 if exists(select 1 from work_items where id=p_id) then
 if exists(select 1 from work_items where id=p_id and owner_person_id=p_person and entity_id=a.person_id and payload->>'source'='parent') then return jsonb_build_object('ok',true,'id',p_id,'replayed',true);else raise exception 'Request identifier already used';end if;end if;
 insert into work_items(id,tenant_id,work_type,entity_type,entity_id,owner_person_id,status,priority,payload) values(p_id,g.tenant_id,'ADMIN_TASK','person',a.person_id,p_person,'open','normal',jsonb_build_object('source','parent','title',initcap(replace(p_values->>'kind','_',' '))||' request','description',p_values->>'description','athlete_id',p_athlete,'organization_id',p_org,'assigned_role',target_role,'created_by',p_user,'request_kind',p_values->>'kind','created_at',now())) returning to_jsonb(work_items.*) into after_value;
 elsif p_action='contact' then
 select jsonb_build_object('phone',phone,'phone_secondary',phone_secondary) into before_value from people where id=p_person and tenant_id=g.tenant_id for update;
 if length(coalesce(p_values->>'phone',''))>100 or length(coalesce(p_values->>'phone_secondary',''))>100 then raise exception 'Telephone is too long';end if;
 update people set phone=nullif(trim(p_values->>'phone'),''),phone_secondary=nullif(trim(p_values->>'phone_secondary'),''),updated_at=now() where id=p_person and updated_at=(p_values->>'expected_updated_at')::timestamptz returning jsonb_build_object('phone',phone,'phone_secondary',phone_secondary) into after_value;
 if not found then raise exception 'Contact changed. Refresh before saving';end if;
 elsif p_action='sign' then
 select * into w from waiver_assignments where id=p_id and athlete_id=p_athlete and person_id=a.person_id and organization_id=p_org for update;
 if not found or w.status not in ('assigned','pending','required','open') then raise exception 'Open waiver assignment required';end if;
 select * into d from waivers where id=w.waiver_id and organization_id=p_org and status='active' and (effective_from is null or effective_from<=current_date) and (effective_to is null or effective_to>=current_date);
 if not found then raise exception 'Current waiver is unavailable';end if;
 select * into template_row from waiver_templates where organization_id=p_org and lower(code)=lower(d.code::text) and version::text=d.version and status='active' and (effective_from is null or effective_from<=current_date) and (effective_to is null or effective_to>=current_date);
 if not found or template_row.id::text is distinct from p_values->>'template_id' or template_row.body_template is distinct from p_values->>'body' or template_row.updated_at is distinct from (p_values->>'template_updated_at')::timestamptz then raise exception 'Waiver text changed or is unavailable. Reload';end if;
 if template_row.signature_policy not in ('{}'::jsonb,'{"method":"typed_name"}'::jsonb) then raise exception 'This waiver needs a different signing process. Contact the club';end if;
 if (p_values->>'agree') is distinct from 'true' or length(trim(coalesce(p_values->>'signed_name','')))<3 then raise exception 'Your name and explicit agreement are required';end if;
 before_value:=to_jsonb(w);
 insert into waiver_acceptances(waiver_id,person_id,accepted_by) values(d.id,a.person_id,p_person) returning id into result_id;
 update waiver_assignments set status='completed',completed_at=now(),updated_at=now(),metadata=metadata||jsonb_build_object('acceptance_id',result_id,'template_id',template_row.id,'version',template_row.version,'signed_name',p_values->>'signed_name','accepted_by',p_person,'body_snapshot',template_row.body_template) where id=p_id returning to_jsonb(waiver_assignments.*) into after_value;
 elsif p_action in ('volunteer_join','volunteer_cancel') then
 select * into o from volunteer_opportunities where id=p_id and organization_id=p_org for update;
 if not found or o.starts_at<=now() or o.status not in ('open','active','published') then raise exception 'Opportunity is closed';end if;
 if p_action='volunteer_join' then
 if exists(select 1 from volunteer_assignments where opportunity_id=p_id and volunteer_person_id=p_person and status not in ('cancelled','declined')) then return jsonb_build_object('ok',true,'replayed',true);end if;
 if o.capacity is not null and (select count(*) from volunteer_assignments where opportunity_id=p_id and status not in ('cancelled','declined'))>=o.capacity then raise exception 'This opportunity is full';end if;
 insert into volunteer_assignments(opportunity_id,volunteer_person_id,status) values(p_id,p_person,'requested') returning to_jsonb(volunteer_assignments.*) into after_value;
 else
 update volunteer_assignments set status='cancelled',updated_at=now() where opportunity_id=p_id and volunteer_person_id=p_person and status in ('requested','assigned','confirmed') and checked_in_at is null returning to_jsonb(volunteer_assignments.*) into after_value;
 if not found then raise exception 'No cancellable assignment';end if;
 end if;
 else raise exception 'Unsupported parent action';end if;
 insert into audit_events(tenant_id,actor_user_id,actor_person_id,action,entity_type,entity_id,before_data,after_data,correlation_id,reason) values(g.tenant_id,p_user,p_person,'parent.'||p_action,'athlete',p_athlete,before_value,after_value,gen_random_uuid(),'Parent portal action');
 return jsonb_build_object('ok',true,'id',p_id);
end $$;
revoke all on function public.parent_action(uuid,uuid,uuid,uuid,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.parent_action(uuid,uuid,uuid,uuid,text,uuid,jsonb) to service_role;

create or replace function public.parent_attach_document(p_user uuid,p_person uuid,p_athlete uuid,p_id uuid,p_type uuid,p_title text,p_path text,p_mime text)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare g family_authority_assignments; child uuid;
begin
 select * into g from family_authority_assignments where person_id=p_person and athlete_id=p_athlete and status='active' and valid_from<=now() and (valid_until is null or valid_until>now()) and legal_custody_status<>'RESTRICTED_NO_CONTACT' and restrictions='[]'::jsonb and authority_scopes ? 'parent.read' and authority_scopes ? 'parent.documents' for share;
 if not found or p_user is null then raise exception 'Document permission required';end if;
 select a.person_id into child from athletes a join people p on p.id=a.person_id where a.id=p_athlete and p.tenant_id=g.tenant_id;
 if child is null or p_path is distinct from 'athlete-records/'||g.tenant_id||'/'||child||'/'||p_id then raise exception 'Invalid document owner or storage location';end if;
 if not exists(select 1 from document_types where id=p_type and code::text in ('IDENTITY','REGISTRATION','WAIVER','MEDIA_RELEASE')) then raise exception 'Unsupported document type';end if;
 return admin_attach_person_document(p_id,g.tenant_id,child,p_user,p_person,p_type,p_title,p_path,p_mime);
end $$;
revoke all on function public.parent_attach_document(uuid,uuid,uuid,uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.parent_attach_document(uuid,uuid,uuid,uuid,uuid,text,text,text) to service_role;

create or replace function public.admin_parent_portal_access(p_tenant uuid,p_org uuid,p_athlete uuid,p_guardian uuid,p_actor_user uuid,p_actor_person uuid,p_scopes jsonb)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare a athletes; f uuid; previous jsonb; saved jsonb;
begin
 select at.* into a from athletes at join people p on p.id=at.person_id where at.id=p_athlete and p.tenant_id=p_tenant for update of at;
 if not found then raise exception 'Athlete outside tenant';end if;f:=a.primary_family_id;
 if not exists(select 1 from team_memberships m join teams t on t.id=m.team_id where m.athlete_id=p_athlete and t.organization_id=p_org) and not exists(select 1 from registrations where athlete_id=p_athlete and organization_id=p_org) then raise exception 'Athlete outside club';end if;
 if not exists(select 1 from family_members m join people p on p.id=m.person_id where m.family_id=f and m.person_id=p_guardian and p.tenant_id=p_tenant and p.email is not null and (m.is_primary_guardian or m.relationship_type~*'parent|guardian|mother|father')) then raise exception 'Save a guardian contact with email before granting access';end if;
 if (select count(*) from people where lower(email::text)=(select lower(email::text) from people where id=p_guardian))<>1 then raise exception 'Guardian email must identify exactly one person before granting access';end if;
 if jsonb_typeof(p_scopes) is distinct from 'array' or exists(select 1 from jsonb_array_elements_text(p_scopes) s where s not in ('parent.read','parent.respond','parent.documents','parent.finance','parent.sign','parent.contact')) or (jsonb_array_length(p_scopes)>0 and not p_scopes ? 'parent.read') then raise exception 'Invalid parent permissions';end if;
 if exists(select 1 from family_authority_assignments where athlete_id=p_athlete and person_id=p_guardian and (restrictions<>'[]'::jsonb or status in ('restricted','disputed') or legal_custody_status='RESTRICTED_NO_CONTACT' or source_type<>'parent_portal')) then raise exception 'Existing guardian restrictions must be reviewed first';end if;
 select coalesce(jsonb_agg(to_jsonb(g)),'[]') into previous from family_authority_assignments g where athlete_id=p_athlete and person_id=p_guardian and source_type='parent_portal';
 update family_authority_assignments set status='revoked',valid_until=now(),updated_at=now() where athlete_id=p_athlete and person_id=p_guardian and source_type='parent_portal' and status='active';
 if jsonb_array_length(p_scopes)>0 then
 insert into family_authority_assignments(tenant_id,family_id,athlete_id,person_id,relationship_type,authority_scopes,restrictions,status,valid_from,source_type,created_by_person_id,financial_guarantor_authorized,legal_custody_status,emergency_pickup_authorized)
 values(p_tenant,f,p_athlete,p_guardian,'guardian',p_scopes,'[]','active',now(),'parent_portal',p_actor_person,p_scopes ? 'parent.finance','UNVERIFIED',false) on conflict(family_id,athlete_id,person_id) do update set authority_scopes=excluded.authority_scopes,status='active',valid_from=now(),valid_until=null,updated_at=now(),financial_guarantor_authorized=excluded.financial_guarantor_authorized returning to_jsonb(family_authority_assignments.*) into saved;
 end if;
 insert into audit_events(tenant_id,actor_user_id,actor_person_id,action,entity_type,entity_id,before_data,after_data,correlation_id,reason) values(p_tenant,p_actor_user,p_actor_person,'parent.access_changed','athlete',p_athlete,previous,saved,gen_random_uuid(),'Organization Admin configured parent portal permissions');return jsonb_build_object('ok',true);
end $$;
revoke all on function public.admin_parent_portal_access(uuid,uuid,uuid,uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.admin_parent_portal_access(uuid,uuid,uuid,uuid,uuid,uuid,jsonb) to service_role;

-- The legacy reader must never expose family records directly to clients.
revoke execute on function public.get_parent_hub(uuid) from public, anon, authenticated;
grant execute on function public.get_parent_hub(uuid) to service_role;
