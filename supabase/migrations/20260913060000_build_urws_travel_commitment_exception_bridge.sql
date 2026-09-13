update public.urws_event_rules
set public_summary_template='Travel commitment exception requires review',subject_type='travel_plan',updated_at=now()
where event_type='travel.commitment.exception.requested';

create or replace function public.admin_urws_travel_snapshot()
returns jsonb language plpgsql security definer set search_path=public,app as $$
declare v_plans jsonb;v_participants jsonb;
begin
 if not (app.is_superuser() or app.is_admin()) then raise exception 'Admin travel scope required' using errcode='42501'; end if;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.starts_at nulls last,x.name),'[]'::jsonb) into v_plans from (
   select tp.id,tp.tenant_id,tp.organization_id,tp.name,tp.starts_at,tp.ends_at,tp.status,tp.destination_city,tp.destination_region,tp.destination_country
   from public.travel_plans tp
   where tp.organization_id is not null and (app.is_superuser() or tp.tenant_id in (select app.current_tenant_ids()))
 ) x;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.travel_plan_id,x.id),'[]'::jsonb) into v_participants from (
   select p.id,p.travel_plan_id,p.person_id,p.athlete_id,p.role_code,p.guardian_required,p.status
   from public.travel_participants p join public.travel_plans tp on tp.id=p.travel_plan_id
   where tp.organization_id is not null and (app.is_superuser() or tp.tenant_id in (select app.current_tenant_ids()))
 ) x;
 return jsonb_build_object('plans',v_plans,'participants',v_participants,'generated_at',now());
end $$;

create or replace function public.urws_request_travel_commitment_exception(p_travel_participant_id uuid,p_reason_code text,p_summary text,p_request_key text)
returns jsonb language plpgsql security definer set search_path=public,app as $$
declare p public.travel_participants%rowtype;tp public.travel_plans%rowtype;v_actor uuid;v_event uuid;v_case uuid;v_key text;
begin
 if not (app.is_superuser() or app.is_admin()) then raise exception 'Admin travel scope required' using errcode='42501'; end if;
 if length(trim(coalesce(p_summary,'')))<8 then raise exception 'Provide a factual operational summary'; end if;
 if p_reason_code not in ('withdrawal','schedule_conflict','guardian_issue','transport_issue','eligibility_issue','financial_question','other') then raise exception 'Unsupported travel exception reason'; end if;
 select * into p from public.travel_participants where id=p_travel_participant_id;if not found then raise exception 'Travel participant not found';end if;
 select * into tp from public.travel_plans where id=p.travel_plan_id;if not found or tp.organization_id is null then raise exception 'Travel plan organization scope is missing';end if;
 if not app.is_superuser() and not (tp.tenant_id in (select app.current_tenant_ids())) then raise exception 'Travel scope denied' using errcode='42501'; end if;
 v_actor:=app.current_person_id();
 v_key:=nullif(trim(coalesce(p_request_key,'')),'');if v_key is null then raise exception 'Request key is required';end if;
 select id into v_event from public.platform_event_outbox where event_type='travel.commitment.exception.requested' and payload->>'request_key'=v_key limit 1;
 if v_event is null then
   insert into public.platform_event_outbox(tenant_id,event_type,aggregate_type,aggregate_id,actor_person_id,payload)
   values(tp.tenant_id,'travel.commitment.exception.requested','travel_plan',tp.id,v_actor,jsonb_build_object('organization_id',tp.organization_id,'travel_plan_id',tp.id,'travel_participant_id',p.id,'person_id',p.person_id,'athlete_id',p.athlete_id,'reason_code',p_reason_code,'summary',trim(p_summary),'request_key',v_key)) returning id into v_event;
 end if;
 select id into v_case from public.urws_cases where source_event_id=v_event limit 1;
 if v_case is not null then
   insert into public.urws_case_links(case_id,linked_type,linked_id,relationship) values(v_case,'travel_participant',p.id,'affected_participant') on conflict do nothing;
 end if;
 return jsonb_build_object('event_id',v_event,'case_id',v_case,'travel_plan_id',tp.id,'travel_participant_id',p.id);
end $$;

grant execute on function public.admin_urws_travel_snapshot() to authenticated;
grant execute on function public.urws_request_travel_commitment_exception(uuid,text,text,text) to authenticated;

create or replace view public.v_urws_travel_operational_summary as
select tp.organization_id,tp.id as travel_plan_id,tp.name as travel_plan_name,tp.starts_at,tp.ends_at,tp.status,
 count(p.id) as participant_count,
 count(p.id) filter(where coalesce(p.guardian_required,false)) as guardian_required_count,
 count(c.id) filter(where c.status not in ('resolved','closed','cancelled')) as open_urws_case_count
from public.travel_plans tp
left join public.travel_participants p on p.travel_plan_id=tp.id
left join public.urws_cases c on c.subject_type='travel_plan' and c.subject_id=tp.id and c.case_type_code in ('travel_commitment_exception','travel_financial_exception')
group by tp.organization_id,tp.id,tp.name,tp.starts_at,tp.ends_at,tp.status;

grant select on public.v_urws_travel_operational_summary to authenticated;
