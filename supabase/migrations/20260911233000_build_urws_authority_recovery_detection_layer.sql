alter table public.urws_cases add column if not exists origin_key text;
alter table public.urws_cases add column if not exists source_event_id uuid references public.platform_event_outbox(id) on delete set null;
create unique index if not exists urws_cases_org_origin_key_uidx on public.urws_cases(organization_id, origin_key) where origin_key is not null;
create index if not exists urws_cases_source_event_idx on public.urws_cases(source_event_id) where source_event_id is not null;

create table if not exists public.urws_authority_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  case_type_code text references public.urws_case_types(code),
  action text not null,
  required_resource_type text not null default 'urws_case',
  required_authority_action text not null,
  min_financial_amount numeric,
  max_financial_amount numeric,
  currency char(3) default 'CAD',
  requires_second_approval boolean not null default false,
  escalation_role text,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (min_financial_amount is null or min_financial_amount >= 0),
  check (max_financial_amount is null or max_financial_amount >= 0),
  check (min_financial_amount is null or max_financial_amount is null or min_financial_amount <= max_financial_amount)
);
create index if not exists urws_authority_rules_lookup_idx on public.urws_authority_rules(organization_id,case_type_code,action,active);
alter table public.urws_authority_rules enable row level security;
drop policy if exists urws_authority_rules_superuser on public.urws_authority_rules;
create policy urws_authority_rules_superuser on public.urws_authority_rules for all to authenticated using (app.is_superuser()) with check(app.is_superuser());

create table if not exists public.urws_financial_recoveries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  commitment_id uuid not null references public.urws_financial_commitments(id) on delete cascade,
  case_id uuid references public.urws_cases(id) on delete set null,
  recovery_type text not null,
  counterparty_type text,
  counterparty_id uuid,
  amount numeric not null check (amount >= 0),
  currency char(3) not null default 'CAD',
  status text not null default 'expected' check (status in ('expected','requested','approved','received','denied','cancelled','written_off')),
  expected_at timestamptz,
  received_at timestamptz,
  external_reference text,
  evidence jsonb not null default '{}'::jsonb,
  created_by_person_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists urws_financial_recoveries_commitment_idx on public.urws_financial_recoveries(commitment_id,status);
create index if not exists urws_financial_recoveries_case_idx on public.urws_financial_recoveries(case_id) where case_id is not null;
alter table public.urws_financial_recoveries enable row level security;
drop policy if exists urws_financial_recoveries_superuser on public.urws_financial_recoveries;
create policy urws_financial_recoveries_superuser on public.urws_financial_recoveries for all to authenticated using (app.is_superuser()) with check(app.is_superuser());

create or replace function app.urws_recompute_commitment_recovery(p_commitment_id uuid)
returns void
language plpgsql
security definer
set search_path = public, app
as $$
declare
  v_recovered numeric := 0;
  v_amount numeric;
  v_refundable_until timestamptz;
  v_status text;
begin
  select amount, refundable_until into v_amount, v_refundable_until
  from public.urws_financial_commitments where id = p_commitment_id;
  if not found then return; end if;
  select coalesce(sum(amount),0) into v_recovered
  from public.urws_financial_recoveries
  where commitment_id = p_commitment_id and status = 'received';
  v_status := case
    when v_recovered >= v_amount and v_amount > 0 then 'recovered'
    when v_recovered > 0 then 'partially_recovered'
    else 'committed'
  end;
  update public.urws_financial_commitments
  set recovered_amount = least(v_recovered, v_amount),
      status = v_status,
      recoverability = case
        when v_recovered >= v_amount and v_amount > 0 then 'recovered'
        when v_recovered > 0 then 'partial'
        when v_refundable_until is not null and v_refundable_until < now() then 'unlikely'
        else recoverability
      end,
      updated_at = now()
  where id = p_commitment_id;
end;
$$;

create or replace function app.urws_sync_recovery_totals()
returns trigger
language plpgsql
security definer
set search_path = public, app
as $$
begin
  if tg_op = 'DELETE' then
    perform app.urws_recompute_commitment_recovery(old.commitment_id);
    return old;
  end if;
  perform app.urws_recompute_commitment_recovery(new.commitment_id);
  if tg_op = 'UPDATE' and old.commitment_id is distinct from new.commitment_id then
    perform app.urws_recompute_commitment_recovery(old.commitment_id);
  end if;
  return new;
end;
$$;
drop trigger if exists urws_financial_recoveries_sync on public.urws_financial_recoveries;
create trigger urws_financial_recoveries_sync after insert or update or delete on public.urws_financial_recoveries for each row execute function app.urws_sync_recovery_totals();

create table if not exists public.urws_event_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  event_type text not null,
  case_type_code text not null references public.urws_case_types(code),
  subject_type text not null,
  priority text not null default 'normal',
  public_summary_template text,
  origin_prefix text not null default 'event',
  auto_open boolean not null default true,
  active boolean not null default true,
  conditions jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,event_type,case_type_code)
);
create index if not exists urws_event_rules_lookup_idx on public.urws_event_rules(event_type,active,auto_open);
alter table public.urws_event_rules enable row level security;
drop policy if exists urws_event_rules_superuser on public.urws_event_rules;
create policy urws_event_rules_superuser on public.urws_event_rules for all to authenticated using (app.is_superuser()) with check(app.is_superuser());

create table if not exists public.urws_case_event_links (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.urws_cases(id) on delete cascade,
  event_id uuid not null references public.platform_event_outbox(id) on delete cascade,
  relationship text not null default 'opened_by',
  created_at timestamptz not null default now(),
  unique(case_id,event_id),
  unique(event_id,relationship)
);
alter table public.urws_case_event_links enable row level security;
drop policy if exists urws_case_event_links_superuser on public.urws_case_event_links;
create policy urws_case_event_links_superuser on public.urws_case_event_links for all to authenticated using (app.is_superuser()) with check(app.is_superuser());

create or replace function app.urws_has_authority(
  p_person_id uuid,
  p_organization_id uuid,
  p_case_type_code text,
  p_action text,
  p_financial_amount numeric default null
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, app
as $$
declare
  r public.urws_authority_rules%rowtype;
  v_has_grant boolean;
begin
  if p_person_id is null then return false; end if;
  if app.is_superuser() then return true; end if;
  select * into r
  from public.urws_authority_rules
  where active = true
    and (organization_id = p_organization_id or organization_id is null)
    and (case_type_code = p_case_type_code or case_type_code is null)
    and action = p_action
    and (min_financial_amount is null or coalesce(p_financial_amount,0) >= min_financial_amount)
    and (max_financial_amount is null or coalesce(p_financial_amount,0) <= max_financial_amount)
  order by (organization_id is not null) desc, (case_type_code is not null) desc, coalesce(max_financial_amount,999999999999::numeric) asc
  limit 1;
  if not found then return false; end if;
  select exists(
    select 1 from public.platform_authority_grants g
    where g.subject_person_id = p_person_id
      and g.status = 'active'
      and g.resource_type = r.required_resource_type
      and g.action = r.required_authority_action
      and (g.resource_id = p_organization_id or g.resource_id is null)
      and g.valid_from <= now()
      and (g.valid_until is null or g.valid_until >= now())
  ) into v_has_grant;
  return v_has_grant;
end;
$$;

create or replace function app.urws_process_outbox_event(p_event_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, app
as $$
declare
  e public.platform_event_outbox%rowtype;
  r public.urws_event_rules%rowtype;
  v_org uuid;
  v_case uuid;
  v_origin text;
  v_summary text;
begin
  select * into e from public.platform_event_outbox where id = p_event_id;
  if not found then return null; end if;
  begin
    v_org := nullif(e.payload->>'organization_id','')::uuid;
  exception when invalid_text_representation then
    v_org := null;
  end;
  if v_org is null then return null; end if;
  select * into r
  from public.urws_event_rules
  where event_type = e.event_type and active = true and auto_open = true
    and (organization_id = v_org or organization_id is null)
  order by (organization_id is not null) desc
  limit 1;
  if not found then return null; end if;
  v_origin := r.origin_prefix || ':' || e.event_type || ':' || e.id::text;
  v_summary := coalesce(r.public_summary_template, e.event_type);
  insert into public.urws_cases(
    tenant_id,organization_id,case_type_code,subject_type,subject_id,opened_by_person_id,
    status,priority,public_summary,origin_key,source_event_id,metadata
  ) values (
    e.tenant_id,v_org,r.case_type_code,r.subject_type,e.aggregate_id,e.actor_person_id,
    'open',r.priority,v_summary,v_origin,e.id,
    jsonb_build_object('source_event_type',e.event_type,'source_aggregate_type',e.aggregate_type)
  )
  on conflict (organization_id,origin_key) where origin_key is not null
  do update set updated_at = now()
  returning id into v_case;
  insert into public.urws_case_event_links(case_id,event_id,relationship)
  values(v_case,e.id,'opened_by') on conflict do nothing;
  insert into public.platform_event_outbox(tenant_id,event_type,aggregate_type,aggregate_id,actor_person_id,payload)
  values(e.tenant_id,'urws.case.opened','urws_case',v_case,e.actor_person_id,
    jsonb_build_object('organization_id',v_org,'case_type_code',r.case_type_code,'source_event_id',e.id));
  return v_case;
end;
$$;

create or replace function app.urws_outbox_auto_open_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, app
as $$
begin
  if new.event_type <> 'urws.case.opened' then
    perform app.urws_process_outbox_event(new.id);
  end if;
  return new;
end;
$$;
drop trigger if exists urws_outbox_auto_open on public.platform_event_outbox;
create trigger urws_outbox_auto_open after insert on public.platform_event_outbox for each row execute function app.urws_outbox_auto_open_trigger();

create or replace function app.urws_refresh_overdue_expectations(p_organization_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = public, app
as $$
declare
  x record;
  v_count integer := 0;
  v_case uuid;
  v_origin text;
begin
  for x in
    select * from public.urws_expected_transitions
    where status = 'pending'
      and coalesce(grace_until,due_at) < now()
      and (p_organization_id is null or organization_id = p_organization_id)
  loop
    if x.organization_id is null then continue; end if;
    v_origin := 'expectation:' || x.id::text;
    insert into public.urws_cases(tenant_id,organization_id,case_type_code,subject_type,subject_id,status,priority,public_summary,origin_key,metadata)
    values(x.tenant_id,x.organization_id,'service_failure',x.subject_type,x.subject_id,'open','high',
      'Expected transition did not occur by its required deadline',v_origin,
      jsonb_build_object('expectation_id',x.id,'expectation_key',x.expectation_key,'expected_event_type',x.expected_event_type,'due_at',x.due_at))
    on conflict (organization_id,origin_key) where origin_key is not null
    do update set updated_at = now()
    returning id into v_case;
    update public.urws_expected_transitions set status='overdue',updated_at=now() where id=x.id;
    insert into public.urws_case_links(case_id,linked_type,linked_id,relationship)
    values(v_case,'urws_expected_transition',x.id,'caused_by') on conflict do nothing;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

insert into public.urws_event_rules(event_type,case_type_code,subject_type,priority,public_summary_template,origin_prefix)
values
 ('finance.payment.failed','payment_failure','payment','high','Payment failed and requires recovery or review','payment-failure'),
 ('finance.chargeback.opened','chargeback_dispute','payment','high','Chargeback opened and evidence review is required','chargeback'),
 ('finance.billing.disputed','billing_dispute','invoice','high','Billing dispute requires policy and evidence review','billing-dispute'),
 ('membership.pause.expired','membership_pause_exception','membership','normal','Membership pause expired and lifecycle review is required','pause-expired'),
 ('membership.refund.requested','membership_refund_dispute','membership','high','Membership refund request requires policy review','membership-refund'),
 ('competition.entry.exception.requested','competition_entry_exception','competition_entry','normal','Competition entry exception requires review','competition-entry'),
 ('competition.fee.disputed','competition_fee_dispute','competition_entry_fee','high','Competition fee dispute requires commitment and recovery review','competition-fee'),
 ('travel.commitment.exception.requested','travel_commitment_exception','travel_plan','high','Travel financial commitment exception requires review','travel-commitment'),
 ('facility.disruption.reported','facility_disruption','facility','high','Facility disruption may require operational and financial action','facility-disruption'),
 ('workforce.credential.lapsed','staff_compliance_lapse','credential','urgent','Staff credential lapse requires immediate compliance review','credential-lapse'),
 ('registration.exception.requested','registration_exception','registration','normal','Registration exception requires policy review','registration-exception')
on conflict (organization_id,event_type,case_type_code) do nothing;
