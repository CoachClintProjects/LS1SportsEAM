-- Prompt 12: existing stores only. RPC is service-only; the API resolves the actor and role.
alter table public.purchase_orders drop constraint purchase_orders_status_lifecycle_chk;
alter table public.purchase_orders add constraint purchase_orders_status_lifecycle_chk check (status is null or lower(status) = any(array['draft','issued','partially_received','received','closed','cancelled','count_mismatch_hold']));

create or replace function public.admin_equipment_write(p_tenant uuid,p_org uuid,p_actor_user uuid,p_actor_person uuid,p_role text,p_action text,p_request uuid,p_values jsonb,p_reason text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
 v_id uuid; v_fac uuid; v_team uuid; v_item uuid; v_loc uuid; v_start timestamptz; v_end timestamptz;
 v_qty numeric; v_damage numeric; v_expected numeric; v_cost numeric; v_reserved numeric; v_hand numeric;
 v_line public.purchase_order_lines%rowtype; v_po public.purchase_orders%rowtype; v_task public.operational_tasks%rowtype;
 v_old jsonb; v_new jsonb; v_prior jsonb; v_entry jsonb; v_rows jsonb; v_msg text; v_currency text;
 v_record record; v_recipient uuid; v_count integer:=0; v_typ text; v_status text;
begin
 if p_request is null or p_actor_user is null or p_actor_person is null or not exists(select 1 from public.people where id=p_actor_person and tenant_id=p_tenant) or not exists(select 1 from public.organizations where id=p_org and tenant_id=p_tenant) then raise exception 'Authenticated club context required'; end if;
 if p_role not in ('facilities_equipment_manager','org_admin','treasurer') or (p_role='treasurer' and p_action<>'release_hold') then raise exception '[DENY: ERR-101] Equipment authority required';end if;
 if length(trim(coalesce(p_reason,'')))<10 or length(p_reason)>2000 then raise exception 'Record a reason of 10–2000 characters';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_org::text||':equipment',0));
 select after_data into v_prior from public.audit_events where tenant_id=p_tenant and correlation_id=p_request and action='equipment.'||p_action and after_data->>'organization_id'=p_org::text limit 1;
 if found then
  if v_prior->'request' is distinct from p_values then raise exception 'Request ID already used with different values';end if;
  return v_prior||jsonb_build_object('duplicate',true);
 end if;
 v_id:=nullif(p_values->>'id','')::uuid; v_fac:=nullif(p_values->>'facility_id','')::uuid; v_team:=nullif(p_values->>'team_id','')::uuid;
 if v_fac is not null and not exists(select 1 from public.facilities f join public.sites s on s.id=f.site_id where f.id=v_fac and s.organization_id=p_org) then raise exception 'Facility outside your club';end if;
 if v_team is not null and not exists(select 1 from public.teams where id=v_team and organization_id=p_org and status='active') then raise exception 'Select an active club squad';end if;
 if p_action='create_item' then
  if length(trim(coalesce(p_values->>'name','')))<2 or length(p_values->>'name')>200 or length(trim(coalesce(p_values->>'sku','')))<1 or length(p_values->>'sku')>80 or length(trim(coalesce(p_values->>'unit','')))<1 then raise exception 'SKU, item name and unit are required';end if;
  insert into public.inventory_items(id,organization_id,sku,name,item_type,unit_of_measure,reorder_point,active) values(p_request,p_org,trim(p_values->>'sku'),trim(p_values->>'name'),nullif(p_values->>'item_type',''),trim(p_values->>'unit'),0,true) returning to_jsonb(inventory_items.*) into v_new;
  v_id:=p_request; v_msg:='Stock item registered. Receive a shipment to add stock.';
 elsif p_action='create_bin' then
  if v_fac is null or length(trim(coalesce(p_values->>'code','')))<1 or length(p_values->>'code')>80 or length(trim(coalesce(p_values->>'name','')))<2 or length(p_values->>'name')>200 then raise exception 'Facility, bin code and name required';end if;
  insert into public.inventory_locations(id,facility_id,code,name) values(p_request,v_fac,trim(p_values->>'code'),trim(p_values->>'name')) returning to_jsonb(inventory_locations.*) into v_new;
  v_id:=p_request; v_msg:='Warehouse bin registered.';
 elsif p_action in ('receive','scrap') then
  v_item:=(p_values->>'item_id')::uuid; v_loc:=(p_values->>'location_id')::uuid;
  if not exists(select 1 from public.inventory_items where id=v_item and organization_id=p_org and active) or not exists(select 1 from public.inventory_locations l join public.facilities f on f.id=l.facility_id join public.sites s on s.id=f.site_id where l.id=v_loc and s.organization_id=p_org) then raise exception 'Select an active club item and warehouse bin';end if;
  v_qty:=(p_values->>'quantity')::numeric;v_cost:=(p_values->>'unit_cost')::numeric;v_currency:=upper(p_values->>'currency');
  if v_qty is null or v_qty<=0 or v_qty>1000000 or v_qty<>round(v_qty,3) or v_cost is null or v_cost<0 or v_cost>1000000 or v_cost<>round(v_cost,2) or v_currency is null or v_currency not in ('CAD','USD','EUR','GBP','AUD','NZD') then raise exception 'Valid quantity, recorded unit cost and currency required';end if;
  insert into public.inventory_balances(item_id,location_id,on_hand,reserved) values(v_item,v_loc,0,0) on conflict do nothing;
  select on_hand,reserved into v_hand,v_reserved from public.inventory_balances where item_id=v_item and location_id=v_loc for update;
  v_old:=jsonb_build_object('on_hand',v_hand,'reserved',v_reserved);
  if p_action='receive' then
   if length(trim(coalesce(p_values->>'packing_slip','')))<1 or length(p_values->>'packing_slip')>120 then raise exception 'Packing slip or shipment reference required';end if;
   if exists(select 1 from public.inventory_transactions where item_id=v_item and transaction_type='receipt' and metadata->>'packing_slip'=trim(p_values->>'packing_slip')) then raise exception 'This item and packing slip were already received. Review stock history.';end if;
   v_damage:=coalesce((p_values->>'damaged')::numeric,0);v_expected:=(p_values->>'expected')::numeric;
   if v_expected is null or v_expected<=0 or v_expected>1000000 or v_damage<0 or v_damage>v_qty or v_expected<>round(v_expected,3) or v_damage<>round(v_damage,3) then raise exception 'Valid expected and damaged counts required';end if;
   if nullif(p_values->>'purchase_order_line_id','') is not null then
    select l.* into v_line from public.purchase_order_lines l join public.purchase_orders po on po.id=l.purchase_order_id join public.purchase_requests pr on pr.id=po.purchase_request_id where l.id=(p_values->>'purchase_order_line_id')::uuid and pr.organization_id=p_org for update of l;
    if v_line.id is null or v_line.item_id is distinct from v_item then raise exception 'Purchase line must match this club item';end if;
    select * into v_po from public.purchase_orders where id=v_line.purchase_order_id for update;
    if lower(v_po.status) not in ('issued','partially_received') then raise exception 'Purchase order is not open for receipt';end if;
    if v_expected is distinct from v_line.quantity-v_line.received_quantity or v_qty-v_damage>v_expected then raise exception 'Expected count changed or usable count exceeds outstanding order. Reload.';end if;
    update public.purchase_order_lines set received_quantity=received_quantity+v_qty-v_damage,metadata=metadata||jsonb_build_object('last_packing_slip',trim(p_values->>'packing_slip')) where id=v_line.id;
    update public.purchase_orders set status=case when v_qty<>v_expected or v_damage>0 then 'COUNT_MISMATCH_HOLD' when exists(select 1 from public.purchase_order_lines where purchase_order_id=v_po.id and received_quantity<quantity) then 'partially_received' else 'received' end where id=v_po.id;
   elsif v_qty<>v_expected or v_damage>0 then raise exception 'Select the purchase order line to log a vendor mismatch and enforce a payment hold';end if;
   update public.inventory_balances set on_hand=on_hand+v_qty-v_damage where item_id=v_item and location_id=v_loc;
   v_typ:='receipt';v_msg:='Shipment received. Usable stock and receipt history saved together.';
   if v_po.id is not null and (v_qty<>v_expected or v_damage>0) then
    insert into public.operational_tasks(id,tenant_id,organization_id,assigned_role,title,description,priority,metadata) values(p_request,p_tenant,p_org,'treasurer','Delivery mismatch — vendor payment on hold',p_reason,'high',jsonb_build_object('kind','equipment_hold','purchase_order_id',v_po.id,'vendor_id',v_po.vendor_id,'line_id',v_line.id,'expected',v_expected,'delivered',v_qty,'damaged',v_damage,'packing_slip',trim(p_values->>'packing_slip'),'recommended_action','Review the discrepancy with Gear & Field Crew before releasing the vendor hold.'));
    v_msg:='Receipt saved and COUNT_MISMATCH_HOLD applied. Treasurer task created; vendor payment is blocked pending review.';
   end if;
  else
   if v_hand-v_reserved<v_qty then raise exception 'Not enough unreserved stock to dispose';end if;
   if length(trim(coalesce(p_values->>'certificate','')))<5 then raise exception 'Disposal certificate or evidence reference required';end if;
   -- Disposal records cost evidence; financial posting requires Treasurer authority.
   update public.inventory_balances set on_hand=on_hand-v_qty where item_id=v_item and location_id=v_loc;
   v_typ:='disposal';v_msg:='Disposal certified and stock reduced. Valuation evidence sent to Treasurer for ledger reconciliation.';
   insert into public.operational_tasks(id,tenant_id,organization_id,assigned_role,title,description,metadata) values(p_request,p_tenant,p_org,'treasurer','Reconcile equipment disposal value',p_reason,jsonb_build_object('kind','equipment_disposal','transaction_id',p_request,'quantity',v_qty,'unit_cost',v_cost,'currency',v_currency,'value',round(v_qty*v_cost,2),'certificate',p_values->>'certificate','recommended_action','Review cost evidence and post the authorized inventory write-off through the finance workspace.'));
  end if;
  insert into public.inventory_transactions(id,item_id,location_id,transaction_type,quantity,unit_cost,reference_type,reference_id,recorded_by,source_system,metadata) values(p_request,v_item,v_loc,v_typ,case when p_action='receive' then v_qty-v_damage else -v_qty end,v_cost,case when v_po.id is not null then 'purchase_order_line' else 'equipment_intake' end,v_line.id,p_actor_person,'LS1 Gear & Field Crew',p_values||jsonb_build_object('reason',p_reason,'currency',v_currency)) returning to_jsonb(inventory_transactions.*) into v_new;
  v_id:=p_request;
 elsif p_action='create_crate' then
  v_rows:=p_values->'lines';
  if v_team is null or jsonb_typeof(v_rows) is distinct from 'array' or jsonb_array_length(v_rows) not between 1 and 100 or length(trim(coalesce(p_values->>'name','')))<2 then raise exception 'Squad, crate name and 1–100 stock lines required';end if;
  for v_entry in select value from jsonb_array_elements(v_rows) order by value->>'item_id',value->>'location_id' loop
   v_item:=(v_entry->>'item_id')::uuid;v_loc:=(v_entry->>'location_id')::uuid;v_qty:=(v_entry->>'quantity')::numeric;
   if v_qty is null or v_qty<=0 or v_qty>1000000 or v_qty<>round(v_qty,3) or not exists(select 1 from public.inventory_items where id=v_item and organization_id=p_org and active) or not exists(select 1 from public.inventory_locations l join public.facilities f on f.id=l.facility_id join public.sites s on s.id=f.site_id where l.id=v_loc and s.organization_id=p_org) then raise exception 'Invalid crate item, bin or quantity';end if;
   update public.inventory_balances set reserved=reserved+v_qty where item_id=v_item and location_id=v_loc and on_hand-reserved>=v_qty;
   if not found then raise exception 'Insufficient available stock. Reload the crate.';end if;
  end loop;
  insert into public.operational_tasks(id,tenant_id,organization_id,team_id,assigned_role,title,description,metadata) values(p_request,p_tenant,p_org,v_team,'facilities_equipment_manager',trim(p_values->>'name'),p_reason,jsonb_build_object('kind','equipment_crate','lines',v_rows,'safety_pass',false,'stage','reserved')) returning to_jsonb(operational_tasks.*) into v_new;
  v_id:=p_request;v_msg:='Crate reserved. Physical safety screening is required before readiness clearance.';
 elsif p_action in ('safety_pass','return_crate','release_hold') then
  select * into v_task from public.operational_tasks where id=v_id and tenant_id=p_tenant and organization_id=p_org for update;
  if v_task.id is null or v_task.revision is distinct from (p_values->>'revision')::integer then raise exception 'Task changed. Reload before saving.';end if;
  v_old:=to_jsonb(v_task);
  if v_task.status='completed' then raise exception 'This task is already complete';end if;
  if p_action='release_hold' then
   if p_role not in ('org_admin','treasurer') or v_task.metadata->>'kind'<>'equipment_hold' then raise exception 'Treasurer or Organization Admin must resolve the hold';end if;
   update public.operational_tasks set status='completed',completed_at=now(),metadata=metadata||jsonb_build_object('resolution',p_reason,'resolved_by',p_actor_person) where id=v_id returning to_jsonb(operational_tasks.*) into v_new;
   update public.purchase_orders set status=case when exists(select 1 from public.purchase_order_lines where purchase_order_id=purchase_orders.id and received_quantity<quantity) then 'partially_received' else 'received' end where id=(v_task.metadata->>'purchase_order_id')::uuid and not exists(select 1 from public.operational_tasks t where t.tenant_id=p_tenant and t.organization_id=p_org and t.metadata->>'kind'='equipment_hold' and t.metadata->>'purchase_order_id'=v_task.metadata->>'purchase_order_id' and t.status<>'completed');
   v_msg:='Vendor discrepancy resolved with recorded evidence. Normal payable approval controls still apply.';
  else
   if v_task.metadata->>'kind'<>'equipment_crate' then raise exception 'Select an equipment crate';end if;
   if p_action='safety_pass' then
    if coalesce((v_task.metadata->>'safety_pass')::boolean,false) then raise exception 'Crate is already screened';end if;
    if coalesce((p_values->>'inspected')::boolean,false)=false then raise exception 'Confirm physical inspection';end if;
    update public.operational_tasks set metadata=metadata||jsonb_build_object('safety_pass',true,'screened_by',p_actor_person,'screened_at',now(),'inspection',p_reason) where id=v_id returning to_jsonb(operational_tasks.*) into v_new;
    insert into public.operational_tasks(tenant_id,organization_id,team_id,assigned_role,title,description,metadata) values(p_tenant,p_org,v_task.team_id,'competition_manager','Equipment crate passed physical screening',v_task.title,jsonb_build_object('kind','equipment_readiness','crate_id',v_id,'safety_pass',true,'recommended_action','Review the screened squad crate when preparing competition readiness. Athlete clearance is checked separately.'));
    v_msg:='Physical equipment screening saved; Competition Manager readiness task created.';
   else
    for v_entry in select value from jsonb_array_elements(v_task.metadata->'lines') loop
     update public.inventory_balances set reserved=reserved-(v_entry->>'quantity')::numeric where item_id=(v_entry->>'item_id')::uuid and location_id=(v_entry->>'location_id')::uuid and reserved>=(v_entry->>'quantity')::numeric;
     if not found then raise exception 'Stock reservation mismatch. Reconcile before returning this crate';end if;
    end loop;
    update public.operational_tasks set status='completed',completed_at=now(),metadata=metadata||jsonb_build_object('stage','returned','return_reason',p_reason) where id=v_id returning to_jsonb(operational_tasks.*) into v_new;
    update public.operational_tasks set status='completed',completed_at=now(),metadata=metadata||jsonb_build_object('crate_returned',true) where tenant_id=p_tenant and organization_id=p_org and metadata->>'kind'='equipment_readiness' and metadata->>'crate_id'=v_id::text;
    v_msg:='Crate returned; stock reservations released and readiness handoff closed.';
   end if;
  end if;
 elsif p_action in ('maintenance','reschedule','shutdown') then
  v_start:=(p_values->>'starts_at')::timestamptz;v_end:=(p_values->>'ends_at')::timestamptz;
  if v_fac is null or v_start is null or v_end is null or not isfinite(v_start) or not isfinite(v_end) or v_end<=v_start or v_end>v_start+interval '366 days' then raise exception 'Facility and valid time window of at most one year required';end if;
  if p_action='maintenance' then
   insert into public.maintenance_work_orders(id,facility_id,work_order_number,description,priority,status,scheduled_start,scheduled_end) values(p_request,v_fac,'GEAR-'||p_request::text,p_reason,'normal','planned',v_start,v_end) returning to_jsonb(maintenance_work_orders.*) into v_new;
   v_id:=p_request;v_msg:='Maintenance work order scheduled. Use an emergency closure if the facility is unsafe.';
  elsif p_action='reschedule' then
   if p_values->>'kind'='maintenance' then
    select to_jsonb(w) into v_old from public.maintenance_work_orders w where id=v_id and facility_id=v_fac for update;
    if v_old is null or v_old->>'status' in ('completed','cancelled') then raise exception 'Open maintenance work order required';end if;
    if (v_old->>'scheduled_start')::timestamptz is distinct from (p_values->>'previous_start')::timestamptz or (v_old->>'scheduled_end')::timestamptz is distinct from (p_values->>'previous_end')::timestamptz then raise exception 'Schedule changed. Reload.';end if;
    update public.maintenance_work_orders set scheduled_start=v_start,scheduled_end=v_end where id=v_id returning to_jsonb(maintenance_work_orders.*) into v_new;
   elsif p_values->>'kind'='booking' then
    select to_jsonb(b) into v_old from public.facility_bookings b where id=v_id and facility_id=v_fac for update;
    if v_old is null or v_old->>'status' in ('cancelled','completed') then raise exception 'Active booking required';end if;
    if (v_old->>'starts_at')::timestamptz is distinct from (p_values->>'previous_start')::timestamptz or (v_old->>'ends_at')::timestamptz is distinct from (p_values->>'previous_end')::timestamptz then raise exception 'Schedule changed. Reload.';end if;
    if exists(select 1 from public.facility_closures where facility_id=v_fac and status='active' and starts_at<v_end and ends_at>v_start) or exists(select 1 from public.facility_bookings where facility_id=v_fac and id<>v_id and status not in ('cancelled','completed') and starts_at<v_end and ends_at>v_start and (resource_id is null or (v_old->>'resource_id') is null or resource_id=(v_old->>'resource_id')::uuid)) then raise exception 'Booking overlaps a closure or occupied facility resource';end if;
    update public.facility_bookings set starts_at=v_start,ends_at=v_end where id=v_id returning to_jsonb(facility_bookings.*) into v_new;
   else raise exception 'Only bookings and maintenance may be rescheduled here';end if;
   v_msg:='Schedule updated with audit history.';
  else
   insert into public.facility_closures(id,facility_id,starts_at,ends_at,reason,status) values(p_request,v_fac,v_start,v_end,p_reason,'active') returning to_jsonb(facility_closures.*) into v_new;
   update public.facilities set status='UNAVAILABLE' where id=v_fac;
   insert into public.operational_tasks(id,tenant_id,organization_id,assigned_role,title,description,priority,metadata) values(p_request,p_tenant,p_org,'org_admin','Emergency facility shutdown — executive review',p_reason,'critical',jsonb_build_object('kind','equipment_shutdown','facility_id',v_fac,'closure_id',p_request,'recommended_action','Validate the fault, coordinate relocation and authorize reopening.'));
   for v_record in select id,name from public.competitions where organization_id=p_org and tenant_id=p_tenant and venue_facility_id=v_fac and status not in ('cancelled','completed') and starts_at<least(v_end,v_start+interval '7 days') and coalesce(ends_at,starts_at+interval '1 day')>v_start loop
    insert into public.operational_tasks(tenant_id,organization_id,assigned_role,title,description,priority,metadata) values(p_tenant,p_org,'competition_manager','CRITICAL SHUTDOWN RISK — '||v_record.name,p_reason,'critical',jsonb_build_object('kind','equipment_shutdown_risk','competition_id',v_record.id,'closure_id',p_request,'facility_id',v_fac));
   end loop;
   for v_record in select distinct t.id,t.name from public.teams t where t.organization_id=p_org and (exists(select 1 from public.facility_bookings b where b.team_id=t.id and b.facility_id=v_fac and b.status<>'cancelled' and b.starts_at<least(v_end,v_start+interval '7 days') and b.ends_at>v_start) or exists(select 1 from public.competition_entries e join public.competition_events ce on ce.id=e.competition_event_id join public.competitions c on c.id=ce.competition_id where e.team_id=t.id and c.organization_id=p_org and c.venue_facility_id=v_fac and c.starts_at<least(v_end,v_start+interval '7 days') and coalesce(c.ends_at,c.starts_at+interval '1 day')>v_start)) loop
    insert into public.operational_tasks(tenant_id,organization_id,team_id,assigned_role,title,description,priority,metadata) values(p_tenant,p_org,v_record.id,'team_manager','Facility shutdown — '||v_record.name,p_reason,'critical',jsonb_build_object('kind','equipment_shutdown_team','closure_id',p_request,'facility_id',v_fac));
    for v_recipient in select distinct ra.person_id from public.role_assignments ra join public.role_definitions rd on rd.id=ra.role_definition_id where ra.tenant_id=p_tenant and ra.organization_id=p_org and (ra.team_id=v_record.id or ra.team_id is null) and ra.status='active' and (ra.starts_at is null or ra.starts_at<=now()) and (ra.ends_at is null or ra.ends_at>now()) and rd.code='TEAM_MANAGER' and rd.is_active loop
     insert into public.notification_events(tenant_id,recipient_person_id,event_type,title,body,priority) values(p_tenant,v_recipient,'facility.shutdown','CRITICAL SHUTDOWN RISK',p_reason,'critical');v_count:=v_count+1;
    end loop;
   end loop;
   v_id:=p_request;v_msg:='Facility unavailable. Executive and affected role tasks created; '||v_count||' LS1 notifications queued. No external delivery claimed.';
  end if;
 elsif p_action='complete_maintenance' then
  select to_jsonb(w) into v_old from public.maintenance_work_orders w join public.facilities f on f.id=w.facility_id join public.sites s on s.id=f.site_id where w.id=v_id and s.organization_id=p_org for update of w;
  if v_old is null or v_old->>'status' in ('completed','cancelled') then raise exception 'Open club maintenance work order required';end if;
  update public.maintenance_work_orders set status='completed',completed_at=now() where id=v_id returning to_jsonb(maintenance_work_orders.*) into v_new;
  v_msg:='Maintenance completion recorded. Active safety closures require executive reopening.';
 elsif p_action='reopen' then
  if p_role<>'org_admin' then raise exception 'Organization Admin must authorize reopening';end if;
  select to_jsonb(c) into v_old from public.facility_closures c join public.facilities f on f.id=c.facility_id join public.sites s on s.id=f.site_id where c.id=v_id and s.organization_id=p_org and c.status='active' for update of c;
  if v_old is null then raise exception 'Active club closure required';end if;
  v_fac:=(v_old->>'facility_id')::uuid;
  update public.facility_closures set status='resolved' where id=v_id returning to_jsonb(facility_closures.*) into v_new;
  if not exists(select 1 from public.facility_closures where facility_id=v_fac and status='active' and ends_at>now()) then update public.facilities set status='active' where id=v_fac;end if;
  update public.operational_tasks set status='completed',completed_at=now(),metadata=metadata||jsonb_build_object('reopening_reason',p_reason) where tenant_id=p_tenant and organization_id=p_org and metadata->>'closure_id'=v_id::text and metadata->>'kind' in ('equipment_shutdown','equipment_shutdown_risk','equipment_shutdown_team');
  v_msg:='Executive reopening recorded; closure handoffs resolved.';
 else raise exception '[DENY: ERR-101] Unsupported equipment action';end if;
 v_new:=jsonb_build_object('id',v_id,'organization_id',p_org,'row',v_new,'message',v_msg,'request',p_values);
 insert into public.audit_events(tenant_id,actor_user_id,actor_person_id,action,entity_type,entity_id,before_data,after_data,correlation_id,reason) values(p_tenant,p_actor_user,p_actor_person,'equipment.'||p_action,'equipment',v_id,v_old,v_new,p_request,p_reason);
 return v_new;
end $$;
revoke all on function public.admin_equipment_write(uuid,uuid,uuid,uuid,text,text,uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.admin_equipment_write(uuid,uuid,uuid,uuid,text,text,uuid,jsonb,text) to service_role;

create or replace function app.equipment_payment_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare v_org uuid;v_vendor uuid;
begin
 if new.status in ('cancelled','reversed','failed','void') then return new;end if;
 select le.organization_id,b.vendor_id into v_org,v_vendor from public.vendor_bills b join public.legal_entities le on le.id=b.legal_entity_id where b.id=new.vendor_bill_id;
 if v_org is null then return new;end if;
 perform pg_advisory_xact_lock(hashtextextended(v_org::text||':equipment',0));
 if exists(select 1 from public.purchase_orders po join public.purchase_requests pr on pr.id=po.purchase_request_id where pr.organization_id=v_org and po.vendor_id=v_vendor and lower(po.status)='count_mismatch_hold') then raise exception 'COUNT_MISMATCH_HOLD: resolve the vendor delivery discrepancy before payment';end if;
 return new;
end $$;
create trigger equipment_payment_hold before insert or update on public.ap_payments for each row execute function app.equipment_payment_guard();

create or replace function app.equipment_seeding_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare c public.competitions%rowtype;
begin
 select * into c from public.competitions where id=new.competition_id;
 perform pg_advisory_xact_lock(hashtextextended(c.organization_id::text||':equipment',0));
 if exists(select 1 from public.facility_closures f where f.facility_id=c.venue_facility_id and f.status='active' and f.starts_at<coalesce(c.ends_at,c.starts_at+interval '1 day') and f.ends_at>c.starts_at) then raise exception 'CRITICAL SHUTDOWN RISK: resolve the facility closure before bracket changes';end if;
 return new;
end $$;
create trigger equipment_seeding_lock before insert or update on public.competition_seeding_runs for each row execute function app.equipment_seeding_guard();
revoke all on function app.equipment_payment_guard(),app.equipment_seeding_guard() from public,anon,authenticated;
notify pgrst,'reload schema';
