-- URWS decision packet, obligations, remedies and automatic status evidence.
-- Applied live to Supabase first; this file preserves repository migration parity.

create table if not exists public.urws_obligations (
 id uuid primary key default gen_random_uuid(), tenant_id uuid, organization_id uuid not null references public.organizations(id) on delete cascade, case_id uuid not null references public.urws_cases(id) on delete cascade,
 obligation_type text not null, obligated_party_type text not null, obligated_party_id uuid, description text not null, due_at timestamptz, status text not null default 'open' check (status in ('open','satisfied','waived','breached','cancelled')),
 satisfied_at timestamptz, source_policy_version_id uuid references public.urws_policy_versions(id), source_evidence_item_id uuid references public.urws_evidence_items(id), metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists urws_obligations_case_status_idx on public.urws_obligations(case_id,status,due_at);

create table if not exists public.urws_remedies (
 id uuid primary key default gen_random_uuid(), tenant_id uuid, organization_id uuid not null references public.organizations(id) on delete cascade, case_id uuid not null references public.urws_cases(id) on delete cascade,
 decision_id uuid references public.urws_decisions(id), remedy_type text not null, status text not null default 'proposed' check (status in ('proposed','approved','executing','completed','declined','cancelled','failed')),
 amount numeric(12,2), currency char(3) not null default 'CAD', beneficiary_type text, beneficiary_id uuid, source_commitment_id uuid references public.urws_financial_commitments(id), resulting_refund_id uuid references public.refunds(id),
 effective_at timestamptz, completed_at timestamptz, execution_reference text, description text, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists urws_remedies_case_status_idx on public.urws_remedies(case_id,status);

create table if not exists public.urws_decision_packets (
 id uuid primary key default gen_random_uuid(), tenant_id uuid, organization_id uuid not null references public.organizations(id) on delete cascade, case_id uuid not null references public.urws_cases(id) on delete cascade,
 packet_version integer not null default 1, status text not null default 'prepared' check (status in ('prepared','superseded','used_for_decision')),
 policy_evaluation_id uuid references public.urws_policy_evaluations(id), prepared_by text not null default 'system', prepared_by_person_id uuid,
 public_facts jsonb not null default '{}'::jsonb, restricted_facts jsonb not null default '{}'::jsonb, financial_summary jsonb not null default '{}'::jsonb, evidence_summary jsonb not null default '{}'::jsonb,
 authority_summary jsonb not null default '{}'::jsonb, missing_evidence jsonb not null default '[]'::jsonb, recommendation text, recommendation_rationale text, prepared_at timestamptz not null default now(), supersedes_packet_id uuid references public.urws_decision_packets(id), created_at timestamptz not null default now(), unique(case_id,packet_version)
);
create index if not exists urws_decision_packets_case_idx on public.urws_decision_packets(case_id,packet_version desc);

create or replace function public.urws_build_decision_packet(p_case_id uuid, p_prepared_by_person_id uuid default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare c public.urws_cases%rowtype; v_id uuid; v_version int; v_policy_eval uuid; v_evidence jsonb; v_fin jsonb; v_authority jsonb; v_missing jsonb; v_recommendation text; v_rationale text;
begin
 select * into c from public.urws_cases where id=p_case_id; if not found then raise exception 'URWS case not found'; end if;
 select coalesce(max(packet_version),0)+1 into v_version from public.urws_decision_packets where case_id=p_case_id;
 select id into v_policy_eval from public.urws_policy_evaluations where case_id=p_case_id order by evaluated_at desc limit 1;
 select jsonb_build_object('count',count(*),'types',coalesce(jsonb_agg(distinct evidence_type),'[]'::jsonb),'latest_at',max(occurred_at)) into v_evidence from public.urws_evidence_items where case_id=p_case_id and sensitivity='standard';
 select jsonb_build_object('case_financial_impact',coalesce(c.financial_impact,0),'committed',coalesce(sum(fc.amount),0),'recovered',coalesce(sum(fc.recovered_amount),0),'unrecovered',coalesce(sum(greatest(fc.amount-fc.recovered_amount,0)),0),'currency',c.currency) into v_fin from public.urws_financial_commitments fc where fc.subject_id=c.subject_id or fc.id in (select source_commitment_id from public.urws_remedies where case_id=p_case_id);
 select coalesce(jsonb_agg(jsonb_build_object('action',ar.action,'required_authority_action',ar.required_authority_action,'min',ar.min_financial_amount,'max',ar.max_financial_amount,'second_approval',ar.requires_second_approval,'escalation_role',ar.escalation_role)),'[]'::jsonb) into v_authority from public.urws_authority_rules ar where ar.active and (ar.organization_id is null or ar.organization_id=c.organization_id) and (ar.case_type_code is null or ar.case_type_code=c.case_type_code);
 v_missing := '[]'::jsonb;
 if c.applicable_policy_version_id is null then v_missing:=v_missing||jsonb_build_array('applicable_policy'); end if;
 if coalesce((v_evidence->>'count')::int,0)=0 then v_missing:=v_missing||jsonb_build_array('standard_evidence'); end if;
 if c.policy_outcome is null then v_missing:=v_missing||jsonb_build_array('policy_evaluation'); end if;
 if jsonb_array_length(v_missing)>0 then v_recommendation:='review_required'; v_rationale:='Canonical evidence or policy evaluation is incomplete; no automated disposition should be treated as authoritative.';
 elsif c.policy_outcome in ('outside_policy','exception_required','ineligible','decline') then v_recommendation:='decline_or_escalate'; v_rationale:='Current policy outcome does not support an ordinary approval; an authorized exception may still be considered.';
 else v_recommendation:='eligible_for_authorized_review'; v_rationale:='Available canonical evidence and policy outcome support proceeding to an authorized human decision.'; end if;
 update public.urws_decision_packets set status='superseded' where case_id=p_case_id and status='prepared';
 insert into public.urws_decision_packets(tenant_id,organization_id,case_id,packet_version,policy_evaluation_id,prepared_by,prepared_by_person_id,public_facts,restricted_facts,financial_summary,evidence_summary,authority_summary,missing_evidence,recommendation,recommendation_rationale,supersedes_packet_id)
 values(c.tenant_id,c.organization_id,c.id,v_version,v_policy_eval,case when p_prepared_by_person_id is null then 'system' else 'person' end,p_prepared_by_person_id,jsonb_build_object('case_type',c.case_type_code,'subject_type',c.subject_type,'status',c.status,'priority',c.priority,'public_summary',c.public_summary,'opened_at',c.opened_at,'requested_effective_at',c.requested_effective_at,'policy_outcome',c.policy_outcome),jsonb_build_object('restricted_summary_present',c.restricted_summary is not null),v_fin,v_evidence,v_authority,v_missing,v_recommendation,v_rationale,(select id from public.urws_decision_packets where case_id=p_case_id order by packet_version desc limit 1)) returning id into v_id;
 return v_id;
end $$;

create or replace function public.urws_record_case_status_history() returns trigger language plpgsql security definer set search_path=public as $$ begin if old.status is distinct from new.status then insert into public.urws_case_status_history(case_id,from_status,to_status,reason,metadata) values(new.id,old.status,new.status,'status_change',jsonb_build_object('source','database_trigger')); end if; return new; end $$;
drop trigger if exists urws_cases_status_history_trg on public.urws_cases; create trigger urws_cases_status_history_trg after update of status on public.urws_cases for each row execute function public.urws_record_case_status_history();

alter table public.urws_obligations enable row level security; alter table public.urws_remedies enable row level security; alter table public.urws_decision_packets enable row level security;
do $$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='urws_obligations' and policyname='urws_obligations_superuser') then create policy urws_obligations_superuser on public.urws_obligations for all using (app.is_superuser()) with check (app.is_superuser()); end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='urws_remedies' and policyname='urws_remedies_superuser') then create policy urws_remedies_superuser on public.urws_remedies for all using (app.is_superuser()) with check (app.is_superuser()); end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='urws_decision_packets' and policyname='urws_decision_packets_superuser') then create policy urws_decision_packets_superuser on public.urws_decision_packets for all using (app.is_superuser()) with check (app.is_superuser()); end if;
end $$;
grant execute on function public.urws_build_decision_packet(uuid,uuid) to authenticated;
