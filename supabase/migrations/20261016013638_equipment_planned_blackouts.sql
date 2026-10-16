-- Planned blackouts remain distinct from emergency shutdowns.
do $patch$
declare definition text;
begin
 select pg_get_functiondef('public.admin_equipment_write(uuid,uuid,uuid,uuid,text,text,uuid,jsonb,text)'::regprocedure) into definition;
 definition:=replace(definition,'elsif p_action in (''maintenance'',''reschedule'',''shutdown'') then','elsif p_action in (''maintenance'',''reschedule'',''shutdown'',''blackout'') then');
 definition:=replace(definition,'if p_action=''maintenance'' then',$branch$
  if p_action='blackout' then
   if exists(select 1 from public.facility_bookings where facility_id=v_fac and status not in ('cancelled','completed') and starts_at<v_end and ends_at>v_start) then raise exception 'Blackout overlaps a confirmed booking. Resolve the booking first, or report an emergency if unsafe.';end if;
   insert into public.facility_closures(id,facility_id,starts_at,ends_at,reason,status) values(p_request,v_fac,v_start,v_end,p_reason,'active') returning to_jsonb(facility_closures.*) into v_new;
   v_id:=p_request;v_msg:='Planned blackout saved. Overlapping competition seeding is restricted until the closure is resolved.';
  elsif p_action='maintenance' then
$branch$);
 definition:=replace(definition,'else raise exception ''Only bookings and maintenance may be rescheduled here'';end if;',$branch$
   elsif p_values->>'kind'='closure' then
    select to_jsonb(c) into v_old from public.facility_closures c where id=v_id and facility_id=v_fac and status='active' for update;
    if v_old is null then raise exception 'Active facility blackout required';end if;
    if exists(select 1 from public.operational_tasks where id=v_id and metadata->>'kind'='equipment_shutdown') then raise exception 'Emergency shutdown windows require executive resolution';end if;
    if (v_old->>'starts_at')::timestamptz is distinct from (p_values->>'previous_start')::timestamptz or (v_old->>'ends_at')::timestamptz is distinct from (p_values->>'previous_end')::timestamptz then raise exception 'Blackout changed. Reload.';end if;
    if exists(select 1 from public.facility_bookings where facility_id=v_fac and status not in ('cancelled','completed') and starts_at<v_end and ends_at>v_start) then raise exception 'Blackout overlaps a confirmed booking';end if;
    update public.facility_closures set starts_at=v_start,ends_at=v_end where id=v_id returning to_jsonb(facility_closures.*) into v_new;
   else raise exception 'Unsupported schedule record';end if;
$branch$);
 execute definition;
end $patch$;
notify pgrst,'reload schema';
