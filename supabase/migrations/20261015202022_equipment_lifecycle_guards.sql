-- Prevent generic task completion from bypassing equipment lifecycle controls.
do $patch$
declare definition text;
begin
 select pg_get_functiondef('public.admin_equipment_write(uuid,uuid,uuid,uuid,text,text,uuid,jsonb,text)'::regprocedure) into definition;
 definition:=replace(definition,'if p_role not in','if p_role is null or p_role not in');
 definition:=replace(definition,'v_id:=nullif(p_values',E'perform set_config(''ls1.equipment_write'',''on'',true);\n v_id:=nullif(p_values');
 definition:=replace(definition,'return v_new;',E'perform set_config(''ls1.equipment_write'',''off'',true);\n return v_new;');
 execute definition;
end $patch$;
create or replace function app.equipment_task_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if old.metadata->>'kind' in ('equipment_hold','equipment_crate','equipment_shutdown','equipment_shutdown_risk','equipment_shutdown_team') and (new.status is distinct from old.status or new.metadata is distinct from old.metadata) and current_setting('ls1.equipment_write',true) is distinct from 'on' then raise exception 'Use the equipment lifecycle action to resolve this task';end if;
 return new;
end $$;
create trigger equipment_task_lifecycle before update on public.operational_tasks for each row execute function app.equipment_task_guard();
create or replace function app.equipment_closure_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if exists(select 1 from public.operational_tasks where id=old.id and metadata->>'kind'='equipment_shutdown') and current_setting('ls1.equipment_write',true) is distinct from 'on' then raise exception 'Emergency closure requires the executive equipment reopening action';end if;
 return new;
end $$;
create trigger equipment_closure_lifecycle before update on public.facility_closures for each row execute function app.equipment_closure_guard();
create or replace function app.equipment_payment_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare v_org uuid;v_vendor uuid;
begin
 if new.status in ('cancelled','reversed','failed','void') then return new;end if;
 select le.organization_id,b.vendor_id into v_org,v_vendor from public.vendor_bills b join public.legal_entities le on le.id=b.legal_entity_id where b.id=new.vendor_bill_id;
 if v_org is null then return new;end if;
 perform pg_advisory_xact_lock(hashtextextended(v_org::text||':equipment',0));
 if exists(select 1 from public.purchase_orders po join public.purchase_requests pr on pr.id=po.purchase_request_id where pr.organization_id=v_org and po.vendor_id=v_vendor and lower(po.status)='count_mismatch_hold') or exists(select 1 from public.operational_tasks t where t.organization_id=v_org and t.metadata->>'kind'='equipment_hold' and t.metadata->>'vendor_id'=v_vendor::text and t.status<>'completed') then raise exception 'COUNT_MISMATCH_HOLD: resolve the vendor delivery discrepancy before payment';end if;
 return new;
end $$;
revoke all on function app.equipment_task_guard(),app.equipment_closure_guard(),app.equipment_payment_guard() from public,anon,authenticated;
notify pgrst,'reload schema';
