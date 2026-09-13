alter table public.urws_decisions alter column decided_by_person_id drop not null;
alter table public.urws_decisions add column if not exists decided_by_auth_user_id uuid;
alter table public.urws_decisions add column if not exists decided_by_operator_id uuid references public.platform_superuser_operators(id) on delete set null;
do $$ begin
 if not exists(select 1 from pg_constraint where conrelid='public.urws_decisions'::regclass and conname='urws_decisions_actor_identity_check') then
  alter table public.urws_decisions add constraint urws_decisions_actor_identity_check check (decided_by_person_id is not null or decided_by_auth_user_id is not null or decided_by_operator_id is not null);
 end if;
end $$;

create or replace function app.urws_has_authority(p_person_id uuid,p_organization_id uuid,p_case_type_code text,p_action text,p_financial_amount numeric default null)
returns boolean language plpgsql stable security definer set search_path=public,app as $$
declare r public.urws_authority_rules%rowtype; v_has_grant boolean;
begin
 if app.is_superuser() then return true; end if;
 if p_person_id is null then return false; end if;
 select * into r from public.urws_authority_rules where active=true and (organization_id=p_organization_id or organization_id is null) and (case_type_code=p_case_type_code or case_type_code is null) and action=p_action and (min_financial_amount is null or coalesce(p_financial_amount,0)>=min_financial_amount) and (max_financial_amount is null or coalesce(p_financial_amount,0)<=max_financial_amount) order by (organization_id is not null) desc,(case_type_code is not null) desc,coalesce(max_financial_amount,999999999999::numeric) asc limit 1;
 if not found then return false; end if;
 select exists(select 1 from public.platform_authority_grants g where g.subject_person_id=p_person_id and g.status='active' and g.resource_type=r.required_resource_type and g.action=r.required_authority_action and (g.resource_id=p_organization_id or g.resource_id is null) and g.valid_from<=now() and (g.valid_until is null or g.valid_until>=now())) into v_has_grant;
 return v_has_grant;
end $$;

create or replace function public.urws_record_authorized_decision(p_case_id uuid,p_human_outcome text,p_rationale text,p_financial_impact numeric default null,p_currency character default 'CAD')
returns uuid language plpgsql security definer set search_path=public,app as $$
declare c public.urws_cases%rowtype; v_person uuid; v_operator uuid; v_auth uuid; v_id uuid; v_evidence jsonb; v_previous uuid; v_tenant uuid;
begin
 select * into c from public.urws_cases where id=p_case_id; if not found then raise exception 'URWS case not found'; end if;
 if p_human_outcome not in ('approved','declined','escalated','partial','no_action') then raise exception 'Unsupported URWS decision outcome'; end if;
 if length(trim(coalesce(p_rationale,'')))<8 then raise exception 'Decision rationale is required'; end if;
 v_auth:=auth.uid(); v_person:=app.current_person_id();
 select id,person_id into v_operator,v_person from public.platform_superuser_operators where auth_user_id=v_auth and active=true limit 1;
 if v_person is null and v_operator is null then v_person:=app.current_person_id(); end if;
 if v_person is null and v_operator is null and v_auth is null then raise exception 'Authorized decision requires an authenticated actor'; end if;
 if not app.urws_has_authority(v_person,c.organization_id,c.case_type_code,'decide_case',coalesce(p_financial_impact,c.financial_impact,0)) then raise exception 'URWS decision authority denied' using errcode='42501'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'type',e.evidence_type,'occurred_at',e.occurred_at,'summary',e.summary) order by e.occurred_at),'[]'::jsonb) into v_evidence from public.urws_evidence_items e where e.case_id=p_case_id and e.sensitivity='standard';
 select id into v_previous from public.urws_decisions where case_id=p_case_id order by decided_at desc limit 1;
 select tenant_id into v_tenant from public.organizations where id=c.organization_id;
 insert into public.urws_decisions(tenant_id,organization_id,case_id,decision_type,policy_outcome,human_outcome,policy_overridden,decided_by_person_id,decided_by_auth_user_id,decided_by_operator_id,authority_resource_type,authority_action,rationale,financial_impact,currency,evidence_snapshot,decision_context,supersedes_decision_id)
 values(v_tenant,c.organization_id,c.id,'authorized_human_decision',c.policy_outcome,p_human_outcome,(c.policy_outcome is not null and c.policy_outcome not in ('unassessed','eligible','approve') and p_human_outcome in ('approved','partial')),v_person,v_auth,v_operator,'urws_case','decide',trim(p_rationale),coalesce(p_financial_impact,c.financial_impact),coalesce(p_currency,c.currency,'CAD'),v_evidence,jsonb_build_object('source','admin_urws_workspace','case_status_before',c.status),v_previous) returning id into v_id;
 update public.urws_decision_packets set status='used_for_decision' where id=(select id from public.urws_decision_packets where case_id=p_case_id and status='prepared' order by packet_version desc limit 1);
 update public.urws_cases set status=case when p_human_outcome='escalated' then 'escalated' else 'resolved' end,resolved_at=case when p_human_outcome='escalated' then null else now() end,updated_at=now() where id=p_case_id;
 insert into public.platform_event_outbox(tenant_id,event_type,aggregate_type,aggregate_id,actor_person_id,payload) values(v_tenant,'urws.case.decided','urws_case',p_case_id,v_person,jsonb_build_object('organization_id',c.organization_id,'decision_id',v_id,'human_outcome',p_human_outcome,'financial_impact',coalesce(p_financial_impact,c.financial_impact),'actor_auth_user_id',v_auth,'operator_id',v_operator));
 return v_id;
end $$;

create or replace function public.urws_record_authorized_remedy(p_case_id uuid,p_decision_id uuid,p_remedy_type text,p_amount numeric default null,p_currency character default 'CAD',p_description text default null)
returns uuid language plpgsql security definer set search_path=public,app as $$
declare c public.urws_cases%rowtype; d public.urws_decisions%rowtype; v_person uuid; v_operator uuid; v_auth uuid; v_id uuid; v_tenant uuid;
begin
 select * into c from public.urws_cases where id=p_case_id; if not found then raise exception 'URWS case not found'; end if;
 select * into d from public.urws_decisions where id=p_decision_id and case_id=p_case_id; if not found then raise exception 'A case decision is required before approving a remedy'; end if;
 if p_remedy_type not in ('refund','credit','fee_waiver','payment_plan','service_credit','operational_correction','other') then raise exception 'Unsupported remedy type'; end if;
 if p_amount is not null and p_amount<0 then raise exception 'Remedy amount cannot be negative'; end if;
 if length(trim(coalesce(p_description,'')))<8 then raise exception 'Remedy description is required'; end if;
 v_auth:=auth.uid(); v_person:=app.current_person_id();
 select id,person_id into v_operator,v_person from public.platform_superuser_operators where auth_user_id=v_auth and active=true limit 1;
 if v_person is null and v_operator is null then v_person:=app.current_person_id(); end if;
 if v_person is null and v_operator is null and v_auth is null then raise exception 'Authorized remedy requires an authenticated actor'; end if;
 if not app.urws_has_authority(v_person,c.organization_id,c.case_type_code,'approve_financial_remedy',coalesce(p_amount,0)) then raise exception 'URWS financial remedy authority denied' using errcode='42501'; end if;
 select tenant_id into v_tenant from public.organizations where id=c.organization_id;
 insert into public.urws_remedies(tenant_id,organization_id,case_id,decision_id,remedy_type,status,amount,currency,effective_at,description,metadata)
 values(v_tenant,c.organization_id,p_case_id,p_decision_id,p_remedy_type,'approved',p_amount,coalesce(p_currency,'CAD'),now(),trim(p_description),jsonb_build_object('approved_by_person_id',v_person,'approved_by_auth_user_id',v_auth,'approved_by_operator_id',v_operator,'source','admin_urws_workspace','execution_required',true)) returning id into v_id;
 insert into public.platform_event_outbox(tenant_id,event_type,aggregate_type,aggregate_id,actor_person_id,payload) values(v_tenant,'urws.remedy.approved','urws_remedy',v_id,v_person,jsonb_build_object('organization_id',c.organization_id,'case_id',p_case_id,'decision_id',p_decision_id,'remedy_type',p_remedy_type,'amount',p_amount,'currency',coalesce(p_currency,'CAD'),'execution_required',true,'actor_auth_user_id',v_auth,'operator_id',v_operator));
 return v_id;
end $$;
