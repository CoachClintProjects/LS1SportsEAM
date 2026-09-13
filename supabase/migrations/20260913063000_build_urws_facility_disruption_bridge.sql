update public.urws_event_rules
set public_summary_template='Facility disruption requires operational review',subject_type='facility',priority='high',updated_at=now()
where event_type='facility.disruption.reported';

create or replace function app.urws_sync_facility_closure()
returns trigger
language plpgsql
security definer
set search_path=public,app
as $$
declare
  v_org uuid;
  v_tenant uuid;
  v_event uuid;
  v_case uuid;
  v_status text:=lower(coalesce(new.status,''));
begin
  if new.facility_id is null then return new; end if;

  select s.organization_id,o.tenant_id into v_org,v_tenant
  from public.facilities f
  join public.sites s on s.id=f.site_id
  join public.organizations o on o.id=s.organization_id
  where f.id=new.facility_id;

  if v_org is null then return new; end if;

  if v_status in ('cancelled','canceled','resolved','closed','completed','reopened') then
    select c.id into v_case
    from public.urws_cases c
    join public.urws_case_event_links cel on cel.case_id=c.id
    join public.platform_event_outbox e on e.id=cel.event_id
    where c.case_type_code='facility_disruption'
      and c.subject_type='facility'
      and c.subject_id=new.facility_id
      and e.event_type='facility.disruption.reported'
      and e.payload->>'facility_closure_id'=new.id::text
      and c.status not in ('resolved','closed','cancelled')
    order by c.opened_at desc
    limit 1;

    if v_case is not null then
      update public.urws_cases
      set status='resolved',resolved_at=coalesce(resolved_at,now()),updated_at=now(),
          metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('facility_closure_status',new.status,'facility_closure_resolved_at',now())
      where id=v_case;
    end if;
    return new;
  end if;

  select id into v_event
  from public.platform_event_outbox
  where event_type='facility.disruption.reported'
    and payload->>'facility_closure_id'=new.id::text
  order by occurred_at asc
  limit 1;

  if v_event is null then
    insert into public.platform_event_outbox(tenant_id,event_type,aggregate_type,aggregate_id,actor_person_id,payload)
    values(
      v_tenant,'facility.disruption.reported','facility',new.facility_id,app.current_person_id(),
      jsonb_build_object(
        'organization_id',v_org,
        'facility_id',new.facility_id,
        'facility_closure_id',new.id,
        'starts_at',new.starts_at,
        'ends_at',new.ends_at,
        'reason',new.reason,
        'status',new.status
      )
    ) returning id into v_event;
  end if;

  select id into v_case from public.urws_cases where source_event_id=v_event limit 1;
  if v_case is not null then
    insert into public.urws_case_links(case_id,linked_type,linked_id,relationship)
    values(v_case,'facility_closure',new.id,'source_closure') on conflict do nothing;
    insert into public.urws_case_links(case_id,linked_type,linked_id,relationship)
    values(v_case,'facility',new.facility_id,'affected_facility') on conflict do nothing;
  end if;
  return new;
end $$;

drop trigger if exists urws_facility_closure_sync on public.facility_closures;
create trigger urws_facility_closure_sync
after insert or update of facility_id,starts_at,ends_at,reason,status on public.facility_closures
for each row execute function app.urws_sync_facility_closure();

create or replace function public.admin_urws_facility_snapshot()
returns jsonb
language plpgsql
security definer
set search_path=public,app
as $$
declare v_facilities jsonb;v_closures jsonb;v_bookings jsonb;
begin
  if not (app.is_superuser() or app.is_admin()) then raise exception 'Admin facility scope required' using errcode='42501'; end if;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.name),'[]'::jsonb) into v_facilities from (
    select f.id,f.name,f.facility_type,f.status,f.timezone,s.organization_id,s.name as site_name
    from public.facilities f
    join public.sites s on s.id=f.site_id
    join public.organizations o on o.id=s.organization_id
    where app.is_superuser() or o.tenant_id in (select app.current_tenant_ids())
  ) x;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.starts_at desc),'[]'::jsonb) into v_closures from (
    select fc.id,fc.facility_id,fc.starts_at,fc.ends_at,fc.reason,fc.status,
      f.name as facility_name,s.organization_id,
      (select count(*) from public.facility_bookings b where b.facility_id=fc.facility_id and b.starts_at<fc.ends_at and b.ends_at>fc.starts_at and lower(coalesce(b.status,'')) not in ('cancelled','canceled')) as affected_booking_count
    from public.facility_closures fc
    join public.facilities f on f.id=fc.facility_id
    join public.sites s on s.id=f.site_id
    join public.organizations o on o.id=s.organization_id
    where app.is_superuser() or o.tenant_id in (select app.current_tenant_ids())
  ) x;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.starts_at),'[]'::jsonb) into v_bookings from (
    select b.id,b.facility_id,b.team_id,b.event_id,b.starts_at,b.ends_at,b.status
    from public.facility_bookings b
    join public.facilities f on f.id=b.facility_id
    join public.sites s on s.id=f.site_id
    join public.organizations o on o.id=s.organization_id
    where app.is_superuser() or o.tenant_id in (select app.current_tenant_ids())
  ) x;

  return jsonb_build_object('facilities',v_facilities,'closures',v_closures,'bookings',v_bookings,'generated_at',now());
end $$;

grant execute on function public.admin_urws_facility_snapshot() to authenticated;

create or replace view public.v_urws_facility_operational_summary as
select s.organization_id,f.id as facility_id,f.name as facility_name,
 count(distinct fc.id) filter(where lower(coalesce(fc.status,'')) not in ('cancelled','canceled','resolved','closed','completed','reopened')) as active_closure_count,
 count(distinct c.id) filter(where c.status not in ('resolved','closed','cancelled')) as open_urws_case_count,
 count(distinct b.id) filter(where exists(select 1 from public.facility_closures x where x.facility_id=f.id and lower(coalesce(x.status,'')) not in ('cancelled','canceled','resolved','closed','completed','reopened') and b.starts_at<x.ends_at and b.ends_at>x.starts_at) and lower(coalesce(b.status,'')) not in ('cancelled','canceled')) as affected_booking_count
from public.facilities f
join public.sites s on s.id=f.site_id
left join public.facility_closures fc on fc.facility_id=f.id
left join public.facility_bookings b on b.facility_id=f.id
left join public.urws_cases c on c.subject_type='facility' and c.subject_id=f.id and c.case_type_code in ('facility_disruption','facility_service_disruption')
group by s.organization_id,f.id,f.name;

grant select on public.v_urws_facility_operational_summary to authenticated;
