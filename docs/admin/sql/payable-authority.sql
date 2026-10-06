-- No default spending authority is invented. Until Org Admin configures a
-- legal entity, every bill requires executive approval. Policy is snapshotted
-- at submission; changing policy does not rewrite an existing authorization.
create table if not exists public.payable_authority_policies (
 legal_entity_id uuid primary key references public.legal_entities(id),
 executive_threshold numeric not null check (executive_threshold >= 0 and executive_threshold <= 999999999999.99 and round(executive_threshold,2)=executive_threshold),
 version integer not null default 1 check(version>0),
 updated_at timestamptz not null default now(),
 updated_by uuid not null
);
alter table public.payable_authority_policies enable row level security;
revoke all on public.payable_authority_policies from public,anon,authenticated;
grant select,insert,update on public.payable_authority_policies to service_role;
alter table public.vendor_bills add column if not exists approval_required_role text not null default 'org_admin' check(approval_required_role in ('org_admin','treasurer'));
alter table public.vendor_bills add column if not exists approval_policy_version integer;
alter table public.vendor_bills add column if not exists approved_by uuid;
alter table public.vendor_bills add column if not exists approved_at timestamptz;

create or replace function public.admin_payable_authority_write(p_tenant uuid,p_org uuid,p_actor_user uuid,p_actor_person uuid,p_role text,p_entity uuid,p_expected_version integer,p_threshold text,p_reason text)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare prior payable_authority_policies; saved payable_authority_policies; amount_value numeric;
begin
 if p_actor_user is null or p_role is distinct from 'org_admin' or length(trim(coalesce(p_reason,'')))<5 then raise exception 'Organization Admin and decision reason required';end if;
 if not exists(select 1 from legal_entities e join organizations o on o.id=e.organization_id where e.id=p_entity and o.id=p_org and o.tenant_id=p_tenant) then raise exception 'Legal entity outside organization';end if;
 if p_threshold is null or p_threshold !~ '^[0-9]{1,12}(\.[0-9]{1,2})?$' then raise exception 'Enter a non-negative threshold with at most two decimal places';end if;
 amount_value:=p_threshold::numeric;
 perform pg_advisory_xact_lock(hashtextextended('payable-policy:'||p_entity,0));
 select * into prior from payable_authority_policies where legal_entity_id=p_entity for update;
 -- Exact retry must be tied to the original actor, version and reason.
 if prior.version=coalesce(p_expected_version, -1)+1 and prior.executive_threshold=amount_value and exists(select 1 from audit_events where tenant_id=p_tenant and entity_type='payable_authority' and entity_id=p_entity and actor_user_id=p_actor_user and reason=trim(p_reason) and (after_data->>'version')::integer=prior.version) then return to_jsonb(prior)||jsonb_build_object('executive_threshold',prior.executive_threshold::text);end if;
 if coalesce(prior.version,0) is distinct from p_expected_version then raise exception 'Approval policy changed. Reload before saving.';end if;
 insert into payable_authority_policies(legal_entity_id,executive_threshold,updated_by) values(p_entity,amount_value,p_actor_user)
 on conflict(legal_entity_id) do update set executive_threshold=excluded.executive_threshold,version=payable_authority_policies.version+1,updated_at=now(),updated_by=excluded.updated_by returning * into saved;
 insert into audit_events(tenant_id,actor_user_id,actor_person_id,action,entity_type,entity_id,before_data,after_data,correlation_id,reason)
 values(p_tenant,p_actor_user,p_actor_person,'payable_authority.set','payable_authority',p_entity,to_jsonb(prior),to_jsonb(saved),gen_random_uuid(),trim(p_reason));
 return to_jsonb(saved)||jsonb_build_object('executive_threshold',saved.executive_threshold::text);
end $$;
revoke all on function public.admin_payable_authority_write(uuid,uuid,uuid,uuid,text,uuid,integer,text,text) from public,anon,authenticated;
grant execute on function public.admin_payable_authority_write(uuid,uuid,uuid,uuid,text,uuid,integer,text,text) to service_role;
