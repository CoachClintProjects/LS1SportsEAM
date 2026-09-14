create or replace function public.urws_record_authorized_decision(
 p_case_id uuid,
 p_human_outcome text,
 p_rationale text,
 p_financial_impact numeric default null,
 p_currency character default 'CAD'
)
returns uuid
language plpgsql
security definer
set search_path=public,app
as $$
declare
 c public.urws_cases%rowtype;
 ar public.urws_authority_rules%rowtype;
 v_rule uuid;
 v_person uuid;
 v_operator uuid;
 v_auth uuid;
 v_id uuid;
 v_evidence jsonb;
 v_previous uuid;
 v_tenant uuid;
 v_effective_financial_impact numeric;
begin
 select * into c from public.urws_cases where id=p_case_id;
 if not found then raise exception 'URWS case not found'; end if;
 if p_human_outcome not in ('approved','declined','escalated','partial','no_action') then raise exception 'Unsupported URWS decision outcome'; end if;
 if length(trim(coalesce(p_rationale,'')))<8 then raise exception 'Decision rationale is required'; end if;

 v_effective_financial_impact:=coalesce(p_financial_impact,c.financial_impact,0);
 v_rule:=app.urws_matching_authority_rule(c.organization_id,c.case_type_code,'decide_case',v_effective_financial_impact);
 if v_rule is not null then
  select * into ar from public.urws_authority_rules where id=v_rule;
  if coalesce(ar.requires_second_approval,false) then
   raise exception 'This URWS decision requires a second approval and must use the governed proposal workflow' using errcode='42501';
  end if;
 end if;

 v_auth:=auth.uid();
 v_person:=app.current_person_id();
 select id,person_id into v_operator,v_person from public.platform_superuser_operators where auth_user_id=v_auth and active=true limit 1;
 if v_person is null and v_operator is null then v_person:=app.current_person_id(); end if;
 if v_person is null and v_operator is null and v_auth is null then raise exception 'Authorized decision requires an authenticated actor'; end if;
 if not app.urws_has_authority(v_person,c.organization_id,c.case_type_code,'decide_case',v_effective_financial_impact) then raise exception 'URWS decision authority denied' using errcode='42501'; end if;

 select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'type',e.evidence_type,'occurred_at',e.occurred_at,'summary',e.summary) order by e.occurred_at),'[]'::jsonb)
 into v_evidence
 from public.urws_evidence_items e
 where e.case_id=p_case_id and e.sensitivity='standard';
 select id into v_previous from public.urws_decisions where case_id=p_case_id order by decided_at desc limit 1;
 select tenant_id into v_tenant from public.organizations where id=c.organization_id;

 insert into public.urws_decisions(
  tenant_id,organization_id,case_id,decision_type,policy_outcome,human_outcome,policy_overridden,
  decided_by_person_id,decided_by_auth_user_id,decided_by_operator_id,
  authority_resource_type,authority_action,rationale,financial_impact,currency,evidence_snapshot,decision_context,supersedes_decision_id
 ) values(
  v_tenant,c.organization_id,c.id,'authorized_human_decision',c.policy_outcome,p_human_outcome,
  (c.policy_outcome is not null and c.policy_outcome not in ('unassessed','eligible','approve') and p_human_outcome in ('approved','partial')),
  v_person,v_auth,v_operator,'urws_case','decide',trim(p_rationale),coalesce(p_financial_impact,c.financial_impact),coalesce(p_currency,c.currency,'CAD'),
  v_evidence,jsonb_build_object('source','admin_urws_workspace','case_status_before',c.status,'second_approval_required',false),v_previous
 ) returning id into v_id;

 update public.urws_decision_packets
 set status='used_for_decision'
 where id=(select id from public.urws_decision_packets where case_id=p_case_id and status='prepared' order by packet_version desc limit 1);
 update public.urws_cases
 set status=case when p_human_outcome='escalated' then 'escalated' else 'resolved' end,
     resolved_at=case when p_human_outcome='escalated' then null else now() end,
     updated_at=now()
 where id=p_case_id;
 insert into public.platform_event_outbox(tenant_id,event_type,aggregate_type,aggregate_id,actor_person_id,payload)
 values(v_tenant,'urws.case.decided','urws_case',p_case_id,v_person,
  jsonb_build_object('organization_id',c.organization_id,'decision_id',v_id,'human_outcome',p_human_outcome,
   'financial_impact',coalesce(p_financial_impact,c.financial_impact),'actor_auth_user_id',v_auth,'operator_id',v_operator,'second_approval_required',false));
 return v_id;
end $$;

grant execute on function public.urws_record_authorized_decision(uuid,text,text,numeric,character) to authenticated;
