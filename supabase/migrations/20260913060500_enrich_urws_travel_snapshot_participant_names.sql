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
 select coalesce(jsonb_agg(to_jsonb(x) order by x.travel_plan_id,x.display_name,x.id),'[]'::jsonb) into v_participants from (
   select p.id,p.travel_plan_id,p.person_id,p.athlete_id,p.role_code,p.guardian_required,p.status,
     trim(coalesce(nullif(pp.preferred_name,''),pp.first_name,'') || ' ' || coalesce(pp.last_name,'')) as display_name
   from public.travel_participants p
   join public.travel_plans tp on tp.id=p.travel_plan_id
   left join public.athletes a on a.id=p.athlete_id
   left join public.people pp on pp.id=coalesce(p.person_id,a.person_id)
   where tp.organization_id is not null and (app.is_superuser() or tp.tenant_id in (select app.current_tenant_ids()))
 ) x;
 return jsonb_build_object('plans',v_plans,'participants',v_participants,'generated_at',now());
end $$;
