update public.urws_event_rules
set public_summary_template='Staff credential lapse requires immediate compliance review',subject_type='credential',priority='urgent',updated_at=now()
where event_type='workforce.credential.lapsed';

create or replace function app.urws_emit_credential_lapse(p_credential_id uuid)
returns integer
language plpgsql
security definer
set search_path=public,app
as $$
declare
  cr public.credentials%rowtype;
  r record;
  v_event uuid;
  v_case uuid;
  v_count integer:=0;
begin
  select * into cr from public.credentials where id=p_credential_id;
  if not found then return 0; end if;
  if not (coalesce(cr.expires_on,current_date)>=current_date and lower(coalesce(cr.status,'')) not in ('expired','lapsed','invalid','revoked')) then
    for r in
      select distinct o.id as organization_id,o.tenant_id
      from public.staff_assignments sa
      join public.teams t on t.id=sa.team_id
      join public.organizations o on o.id=t.organization_id
      where sa.person_id=cr.person_id
        and lower(coalesce(sa.status,'active')) not in ('inactive','ended','cancelled','canceled','terminated')
        and (sa.starts_on is null or sa.starts_on<=current_date)
        and (sa.ends_on is null or sa.ends_on>=current_date)
    loop
      select id into v_event
      from public.platform_event_outbox
      where event_type='workforce.credential.lapsed'
        and payload->>'credential_id'=cr.id::text
        and payload->>'organization_id'=r.organization_id::text
      order by occurred_at asc
      limit 1;

      if v_event is null then
        insert into public.platform_event_outbox(tenant_id,event_type,aggregate_type,aggregate_id,actor_person_id,payload)
        values(
          r.tenant_id,'workforce.credential.lapsed','credential',cr.id,app.current_person_id(),
          jsonb_build_object(
            'organization_id',r.organization_id,
            'credential_id',cr.id,
            'person_id',cr.person_id,
            'credential_type',cr.credential_type,
            'expires_on',cr.expires_on,
            'status',cr.status,
            'verification_status',cr.verification_status
          )
        ) returning id into v_event;
        v_count:=v_count+1;
      end if;

      select id into v_case from public.urws_cases where source_event_id=v_event limit 1;
      if v_case is not null then
        insert into public.urws_case_links(case_id,linked_type,linked_id,relationship)
        values(v_case,'credential',cr.id,'lapsed_credential') on conflict do nothing;
        insert into public.urws_case_links(case_id,linked_type,linked_id,relationship)
        values(v_case,'person',cr.person_id,'affected_person') on conflict do nothing;
      end if;
    end loop;
  end if;
  return v_count;
end $$;

create or replace function app.urws_credential_change_trigger()
returns trigger
language plpgsql
security definer
set search_path=public,app
as $$
begin
  perform app.urws_emit_credential_lapse(new.id);
  return new;
end $$;

drop trigger if exists urws_credential_change on public.credentials;
create trigger urws_credential_change
after insert or update of expires_on,status,verification_status on public.credentials
for each row execute function app.urws_credential_change_trigger();

create or replace function app.urws_refresh_lapsed_credentials(p_organization_id uuid default null)
returns integer
language plpgsql
security definer
set search_path=public,app
as $$
declare r record;v_count integer:=0;
begin
  for r in
    select distinct cr.id
    from public.credentials cr
    join public.staff_assignments sa on sa.person_id=cr.person_id
    join public.teams t on t.id=sa.team_id
    where (p_organization_id is null or t.organization_id=p_organization_id)
      and lower(coalesce(sa.status,'active')) not in ('inactive','ended','cancelled','canceled','terminated')
      and (sa.starts_on is null or sa.starts_on<=current_date)
      and (sa.ends_on is null or sa.ends_on>=current_date)
      and ((cr.expires_on is not null and cr.expires_on<current_date) or lower(coalesce(cr.status,'')) in ('expired','lapsed','invalid','revoked'))
  loop
    v_count:=v_count+app.urws_emit_credential_lapse(r.id);
  end loop;
  return v_count;
end $$;

create or replace function public.admin_urws_workforce_snapshot()
returns jsonb
language plpgsql
security definer
set search_path=public,app
as $$
declare v_credentials jsonb;v_assignments jsonb;
begin
  if not (app.is_superuser() or app.is_admin()) then raise exception 'Admin workforce scope required' using errcode='42501'; end if;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.display_name,x.credential_type),'[]'::jsonb) into v_credentials from (
    select cr.id,cr.person_id,cr.credential_type,cr.issuer,cr.issued_on,cr.expires_on,cr.status,cr.verification_status,cr.verified_at,
      trim(coalesce(nullif(p.preferred_name,''),p.first_name)||' '||p.last_name) as display_name,
      exists(select 1 from public.staff_assignments sa join public.teams t on t.id=sa.team_id join public.organizations o on o.id=t.organization_id where sa.person_id=cr.person_id and (app.is_superuser() or o.tenant_id in (select app.current_tenant_ids()))) as in_scope,
      ((cr.expires_on is not null and cr.expires_on<current_date) or lower(coalesce(cr.status,'')) in ('expired','lapsed','invalid','revoked')) as lapsed
    from public.credentials cr
    join public.people p on p.id=cr.person_id
    where app.is_superuser() or exists(select 1 from public.staff_assignments sa join public.teams t on t.id=sa.team_id join public.organizations o on o.id=t.organization_id where sa.person_id=cr.person_id and o.tenant_id in (select app.current_tenant_ids()))
  ) x;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.organization_name,x.team_name,x.display_name),'[]'::jsonb) into v_assignments from (
    select sa.id,sa.person_id,sa.team_id,sa.role_code,sa.starts_on,sa.ends_on,sa.status,t.organization_id,t.name as team_name,o.name as organization_name,
      trim(coalesce(nullif(p.preferred_name,''),p.first_name)||' '||p.last_name) as display_name
    from public.staff_assignments sa
    join public.people p on p.id=sa.person_id
    join public.teams t on t.id=sa.team_id
    join public.organizations o on o.id=t.organization_id
    where app.is_superuser() or o.tenant_id in (select app.current_tenant_ids())
  ) x;

  return jsonb_build_object('credentials',v_credentials,'assignments',v_assignments,'generated_at',now());
end $$;

grant execute on function public.admin_urws_workforce_snapshot() to authenticated;
grant execute on function app.urws_refresh_lapsed_credentials(uuid) to authenticated;

create or replace view public.v_urws_workforce_operational_summary as
select o.id as organization_id,
 count(distinct sa.id) filter(where lower(coalesce(sa.status,'active')) not in ('inactive','ended','cancelled','canceled','terminated')) as active_staff_assignments,
 count(distinct cr.id) filter(where (cr.expires_on is not null and cr.expires_on<current_date) or lower(coalesce(cr.status,'')) in ('expired','lapsed','invalid','revoked')) as lapsed_credentials,
 count(distinct c.id) filter(where c.status not in ('resolved','closed','cancelled')) as open_urws_case_count
from public.organizations o
left join public.teams t on t.organization_id=o.id
left join public.staff_assignments sa on sa.team_id=t.id
left join public.credentials cr on cr.person_id=sa.person_id
left join public.urws_cases c on c.organization_id=o.id and c.case_type_code in ('staff_compliance_lapse','credential_compliance_exception')
group by o.id;

grant select on public.v_urws_workforce_operational_summary to authenticated;
