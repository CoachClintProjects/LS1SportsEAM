alter table public.urws_decisions alter column decided_by_person_id drop not null;
alter table public.urws_decisions add column if not exists decided_by_auth_user_id uuid;
alter table public.urws_decisions add column if not exists decided_by_operator_id uuid references public.platform_superuser_operators(id) on delete set null;
do $$ begin if not exists(select 1 from pg_constraint where conrelid='public.urws_decisions'::regclass and conname='urws_decisions_actor_identity_check') then alter table public.urws_decisions add constraint urws_decisions_actor_identity_check check (decided_by_person_id is not null or decided_by_auth_user_id is not null or decided_by_operator_id is not null); end if; end $$;

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

-- The live migration also replaces public.urws_record_authorized_decision and
-- public.urws_record_authorized_remedy so SuperUser actors can be represented
-- by auth_user_id/operator_id when no people row exists. The functions retain
-- person identity whenever one is available, emit actor identity in outbox
-- payloads, and continue to require app.urws_has_authority for every action.
