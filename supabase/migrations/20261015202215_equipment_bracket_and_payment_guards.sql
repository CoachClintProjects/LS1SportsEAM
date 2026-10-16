-- The delivery hold is evaluated before the independent President sign-off guard.
alter trigger equipment_payment_hold on public.ap_payments rename to a_equipment_payment_hold;
create or replace function app.equipment_assignment_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare c public.competitions%rowtype;run_id uuid;
begin
 if tg_op='DELETE' then run_id:=old.seeding_run_id;else run_id:=new.seeding_run_id;end if;
 select comp.* into c from public.competition_seeding_runs r join public.competitions comp on comp.id=r.competition_id where r.id=run_id;
 perform pg_advisory_xact_lock(hashtextextended(c.organization_id::text||':equipment',0));
 if exists(select 1 from public.facility_closures f where f.facility_id=c.venue_facility_id and f.status='active' and f.starts_at<coalesce(c.ends_at,c.starts_at+interval '1 day') and f.ends_at>c.starts_at) then raise exception 'CRITICAL SHUTDOWN RISK: resolve the facility closure before bracket assignments';end if;
 if tg_op='DELETE' then return old;end if;return new;
end $$;
create trigger equipment_assignment_lock before insert or update or delete on public.competition_seeding_assignments for each row execute function app.equipment_assignment_guard();
revoke all on function app.equipment_assignment_guard() from public,anon,authenticated;
notify pgrst,'reload schema';
