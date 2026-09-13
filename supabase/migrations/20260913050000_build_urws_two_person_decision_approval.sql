create table if not exists public.urws_decision_proposals (
 id uuid primary key default gen_random_uuid(), tenant_id uuid, organization_id uuid not null references public.organizations(id) on delete cascade,
 case_id uuid not null references public.urws_cases(id) on delete cascade, authority_rule_id uuid references public.urws_authority_rules(id) on delete set null,
 human_outcome text not null check (human_outcome in ('approved','declined','escalated','partial','no_action')), rationale text not null, financial_impact numeric, currency char(3) not null default 'CAD',
 required_second_approval boolean not null default false, status text not null default 'ready' check (status in ('ready','pending_second_approval','rejected','cancelled','executed')),
 proposed_by_person_id uuid, proposed_by_auth_user_id uuid, proposed_by_operator_id uuid references public.platform_superuser_operators(id) on delete set null,
 proposed_at timestamptz not null default now(), executed_decision_id uuid references public.urws_decisions(id) on delete set null, executed_at timestamptz,
 metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check (proposed_by_person_id is not null or proposed_by_auth_user_id is not null or proposed_by_operator_id is not null)
);
create index if not exists urws_decision_proposals_case_idx on public.urws_decision_proposals(case_id,status,proposed_at desc);
create table if not exists public.urws_decision_approvals (
 id uuid primary key default gen_random_uuid(), proposal_id uuid not null references public.urws_decision_proposals(id) on delete cascade,
 decision text not null check (decision in ('approve','reject')), note text, approved_by_person_id uuid, approved_by_auth_user_id uuid, approved_by_operator_id uuid references public.platform_superuser_operators(id) on delete set null,
 decided_at timestamptz not null default now(), metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(),
 check (approved_by_person_id is not null or approved_by_auth_user_id is not null or approved_by_operator_id is not null)
);
create index if not exists urws_decision_approvals_proposal_idx on public.urws_decision_approvals(proposal_id,decided_at desc);
create unique index if not exists urws_decision_approvals_auth_uidx on public.urws_decision_approvals(proposal_id,approved_by_auth_user_id) where approved_by_auth_user_id is not null;
alter table public.urws_decision_proposals enable row level security; alter table public.urws_decision_approvals enable row level security;
do $$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='urws_decision_proposals' and policyname='urws_decision_proposals_superuser') then create policy urws_decision_proposals_superuser on public.urws_decision_proposals for all using(app.is_superuser()) with check(app.is_superuser()); end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='urws_decision_approvals' and policyname='urws_decision_approvals_superuser') then create policy urws_decision_approvals_superuser on public.urws_decision_approvals for all using(app.is_superuser()) with check(app.is_superuser()); end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='urws_decision_proposals' and policyname='urws_decision_proposals_admin_read') then create policy urws_decision_proposals_admin_read on public.urws_decision_proposals for select to authenticated using(app.has_admin_role(array['org_admin','treasurer']) and organization_id in(select o.id from public.organizations o where o.tenant_id in(select app.current_tenant_ids()))); end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='urws_decision_approvals' and policyname='urws_decision_approvals_admin_read') then create policy urws_decision_approvals_admin_read on public.urws_decision_approvals for select to authenticated using(exists(select 1 from public.urws_decision_proposals p join public.organizations o on o.id=p.organization_id where p.id=proposal_id and app.has_admin_role(array['org_admin','treasurer']) and o.tenant_id in(select app.current_tenant_ids()))); end if;
end $$;
drop trigger if exists urws_decision_approvals_immutable on public.urws_decision_approvals;
create trigger urws_decision_approvals_immutable before update or delete on public.urws_decision_approvals for each row execute function app.prevent_platform_ledger_mutation();

create or replace function app.urws_matching_authority_rule(p_organization_id uuid,p_case_type_code text,p_action text,p_financial_amount numeric default null)
returns uuid language sql stable security definer set search_path=public,app as $$
 select ar.id from public.urws_authority_rules ar where ar.active=true and (ar.organization_id=p_organization_id or ar.organization_id is null) and (ar.case_type_code=p_case_type_code or ar.case_type_code is null) and ar.action=p_action and (ar.min_financial_amount is null or coalesce(p_financial_amount,0)>=ar.min_financial_amount) and (ar.max_financial_amount is null or coalesce(p_financial_amount,0)<=ar.max_financial_amount) order by (ar.organization_id is not null) desc,(ar.case_type_code is not null) desc,coalesce(ar.max_financial_amount,999999999999::numeric) asc limit 1
$$;

create or replace function public.urws_propose_decision(p_case_id uuid,p_human_outcome text,p_rationale text,p_financial_impact numeric default null,p_currency character default 'CAD')
returns uuid language plpgsql security definer set search_path=public,app as $$
declare c public.urws_cases%rowtype; ar public.urws_authority_rules%rowtype; v_rule uuid; v_auth uuid; v_person uuid; v_operator uuid; v_tenant uuid; v_id uuid; v_second boolean:=false;
begin
 select * into c from public.urws_cases where id=p_case_id; if not found then raise exception 'URWS case not found'; end if;
 if p_human_outcome not in ('approved','declined','escalated','partial','no_action') then raise exception 'Unsupported URWS decision outcome'; end if;
 if length(trim(coalesce(p_rationale,'')))<8 then raise exception 'Decision rationale is required'; end if;
 v_auth:=auth.uid(); v_person:=app.current_person_id(); select id,person_id into v_operator,v_person from public.platform_superuser_operators where auth_user_id=v_auth and active=true limit 1; if v_person is null and v_operator is null then v_person:=app.current_person_id(); end if;
 if not app.urws_has_authority(v_person,c.organization_id,c.case_type_code,'decide_case',coalesce(p_financial_impact,c.financial_impact,0)) then raise exception 'URWS decision authority denied' using errcode='42501'; end if;
 v_rule:=app.urws_matching_authority_rule(c.organization_id,c.case_type_code,'decide_case',coalesce(p_financial_impact,c.financial_impact,0));
 if v_rule is not null then select * into ar from public.urws_authority_rules where id=v_rule; v_second:=coalesce(ar.requires_second_approval,false); end if;
 select tenant_id into v_tenant from public.organizations where id=c.organization_id;
 insert into public.urws_decision_proposals(tenant_id,organization_id,case_id,authority_rule_id,human_outcome,rationale,financial_impact,currency,required_second_approval,status,proposed_by_person_id,proposed_by_auth_user_id,proposed_by_operator_id,metadata)
 values(v_tenant,c.organization_id,c.id,v_rule,p_human_outcome,trim(p_rationale),coalesce(p_financial_impact,c.financial_impact),coalesce(p_currency,c.currency,'CAD'),v_second,case when v_second then 'pending_second_approval' else 'ready' end,v_person,v_auth,v_operator,jsonb_build_object('source','admin_urws_workspace')) returning id into v_id;
 insert into public.platform_event_outbox(tenant_id,event_type,aggregate_type,aggregate_id,actor_person_id,payload) values(v_tenant,'urws.decision.proposed','urws_decision_proposal',v_id,v_person,jsonb_build_object('organization_id',c.organization_id,'case_id',c.id,'requires_second_approval',v_second,'human_outcome',p_human_outcome));
 return v_id;
end $$;

create or replace function public.urws_approve_decision_proposal(p_proposal_id uuid,p_decision text,p_note text default null)
returns void language plpgsql security definer set search_path=public,app as $$
declare pr public.urws_decision_proposals%rowtype; c public.urws_cases%rowtype; v_auth uuid; v_person uuid; v_operator uuid; v_tenant uuid;
begin
 select * into pr from public.urws_decision_proposals where id=p_proposal_id for update; if not found then raise exception 'Decision proposal not found'; end if;
 if pr.status<>'pending_second_approval' then raise exception 'Decision proposal is not awaiting second approval'; end if;
 if p_decision not in ('approve','reject') then raise exception 'Approval decision must be approve or reject'; end if;
 select * into c from public.urws_cases where id=pr.case_id;
 v_auth:=auth.uid(); v_person:=app.current_person_id(); select id,person_id into v_operator,v_person from public.platform_superuser_operators where auth_user_id=v_auth and active=true limit 1; if v_person is null and v_operator is null then v_person:=app.current_person_id(); end if;
 if (pr.proposed_by_auth_user_id is not null and pr.proposed_by_auth_user_id=v_auth) or (pr.proposed_by_operator_id is not null and pr.proposed_by_operator_id=v_operator) or (pr.proposed_by_person_id is not null and pr.proposed_by_person_id=v_person) then raise exception 'Second approval must come from a different authorized person'; end if;
 if not app.urws_has_authority(v_person,c.organization_id,c.case_type_code,'decide_case',coalesce(pr.financial_impact,0)) then raise exception 'URWS second-approval authority denied' using errcode='42501'; end if;
 insert into public.urws_decision_approvals(proposal_id,decision,note,approved_by_person_id,approved_by_auth_user_id,approved_by_operator_id,metadata) values(pr.id,p_decision,nullif(trim(coalesce(p_note,'')),''),v_person,v_auth,v_operator,jsonb_build_object('source','admin_urws_workspace'));
 update public.urws_decision_proposals set status=case when p_decision='approve' then 'ready' else 'rejected' end,updated_at=now() where id=pr.id;
 select tenant_id into v_tenant from public.organizations where id=c.organization_id;
 insert into public.platform_event_outbox(tenant_id,event_type,aggregate_type,aggregate_id,actor_person_id,payload) values(v_tenant,case when p_decision='approve' then 'urws.decision.second_approved' else 'urws.decision.rejected' end,'urws_decision_proposal',pr.id,v_person,jsonb_build_object('organization_id',c.organization_id,'case_id',c.id,'approval_decision',p_decision));
end $$;

create or replace function public.urws_execute_decision_proposal(p_proposal_id uuid)
returns uuid language plpgsql security definer set search_path=public,app as $$
declare pr public.urws_decision_proposals%rowtype; c public.urws_cases%rowtype; v_auth uuid; v_person uuid; v_operator uuid; v_evidence jsonb; v_previous uuid; v_id uuid; v_tenant uuid;
begin
 select * into pr from public.urws_decision_proposals where id=p_proposal_id for update; if not found then raise exception 'Decision proposal not found'; end if;
 if pr.status<>'ready' then raise exception 'Decision proposal is not ready for execution'; end if;
 select * into c from public.urws_cases where id=pr.case_id;
 v_auth:=auth.uid(); v_person:=app.current_person_id(); select id,person_id into v_operator,v_person from public.platform_superuser_operators where auth_user_id=v_auth and active=true limit 1; if v_person is null and v_operator is null then v_person:=app.current_person_id(); end if;
 if not app.urws_has_authority(v_person,c.organization_id,c.case_type_code,'decide_case',coalesce(pr.financial_impact,0)) then raise exception 'URWS decision execution authority denied' using errcode='42501'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'type',e.evidence_type,'occurred_at',e.occurred_at,'summary',e.summary) order by e.occurred_at),'[]'::jsonb) into v_evidence from public.urws_evidence_items e where e.case_id=c.id and e.sensitivity='standard';
 select id into v_previous from public.urws_decisions where case_id=c.id order by decided_at desc limit 1; select tenant_id into v_tenant from public.organizations where id=c.organization_id;
 insert into public.urws_decisions(tenant_id,organization_id,case_id,decision_type,policy_outcome,human_outcome,policy_overridden,decided_by_person_id,decided_by_auth_user_id,decided_by_operator_id,authority_resource_type,authority_action,rationale,financial_impact,currency,evidence_snapshot,decision_context,supersedes_decision_id)
 values(v_tenant,c.organization_id,c.id,'authorized_human_decision',c.policy_outcome,pr.human_outcome,(c.policy_outcome is not null and c.policy_outcome not in ('unassessed','eligible','approve') and pr.human_outcome in ('approved','partial')),v_person,v_auth,v_operator,'urws_case','decide',pr.rationale,pr.financial_impact,pr.currency,v_evidence,jsonb_build_object('source','urws_decision_proposal','proposal_id',pr.id,'second_approval_required',pr.required_second_approval),v_previous) returning id into v_id;
 update public.urws_decision_packets set status='used_for_decision' where id=(select id from public.urws_decision_packets where case_id=c.id and status='prepared' order by packet_version desc limit 1);
 update public.urws_cases set status=case when pr.human_outcome='escalated' then 'escalated' else 'resolved' end,resolved_at=case when pr.human_outcome='escalated' then null else now() end,updated_at=now() where id=c.id;
 update public.urws_decision_proposals set status='executed',executed_decision_id=v_id,executed_at=now(),updated_at=now() where id=pr.id;
 insert into public.platform_event_outbox(tenant_id,event_type,aggregate_type,aggregate_id,actor_person_id,payload) values(v_tenant,'urws.case.decided','urws_case',c.id,v_person,jsonb_build_object('organization_id',c.organization_id,'decision_id',v_id,'proposal_id',pr.id,'human_outcome',pr.human_outcome,'financial_impact',pr.financial_impact,'second_approval_required',pr.required_second_approval));
 return v_id;
end $$;

grant select on public.urws_decision_proposals,public.urws_decision_approvals to authenticated;
grant execute on function public.urws_propose_decision(uuid,text,text,numeric,character) to authenticated;
grant execute on function public.urws_approve_decision_proposal(uuid,text,text) to authenticated;
grant execute on function public.urws_execute_decision_proposal(uuid) to authenticated;
