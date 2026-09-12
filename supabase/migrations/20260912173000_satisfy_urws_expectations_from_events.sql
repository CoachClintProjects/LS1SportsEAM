-- Close expected-transition loops from canonical outbox events.
create or replace function app.urws_satisfy_expectations_from_outbox()
returns trigger
language plpgsql
security definer
set search_path=public,app
as $$
begin
  update public.urws_expected_transitions
     set status='satisfied',
         satisfied_by_type='platform_event_outbox',
         satisfied_by_id=new.id,
         satisfied_at=coalesce(new.occurred_at,now()),
         updated_at=now()
   where status in ('pending','overdue')
     and subject_type=new.aggregate_type
     and subject_id=new.aggregate_id
     and expected_event_type=new.event_type;
  return new;
end $$;

drop trigger if exists urws_satisfy_expectations_outbox on public.platform_event_outbox;
create trigger urws_satisfy_expectations_outbox
after insert on public.platform_event_outbox
for each row execute function app.urws_satisfy_expectations_from_outbox();
