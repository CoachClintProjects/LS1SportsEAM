-- Triage messages are personal; recipients read through the scoped API.
revoke all on public.notification_events from anon;
revoke insert,update,delete,truncate,references,trigger on public.notification_events from authenticated;
create policy triage_notification_recipient on public.notification_events as restrictive for select to authenticated
 using(event_type not in ('competition.reply_reminder','competition.volunteers_needed') or recipient_person_id=(select app.current_person_id()) or (select app.is_superuser()));
-- Document the intentional server-only policy alongside the revoked client grants.
create policy triage_fee_service on public.triage_fee_vouchers for all to service_role using(true) with check(true);
notify pgrst,'reload schema';
