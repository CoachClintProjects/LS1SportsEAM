-- URWS refund decisions update the request state, but never mark money processed.
create or replace function app.urws_sync_refund_request_from_decision()
returns trigger
language plpgsql
security definer
set search_path=public,app
as $$
declare
  l record;
  v_status text;
begin
  v_status := case new.human_outcome
    when 'approved' then 'approved'
    when 'partial' then 'approved'
    when 'declined' then 'declined'
    when 'no_action' then 'declined'
    when 'escalated' then 'escalated'
    else null
  end;
  if v_status is null then return new; end if;

  for l in
    select linked_id from public.urws_case_links
    where case_id=new.case_id and linked_type='refund_request'
  loop
    update public.refund_requests
       set status=v_status,
           recommended_disposition=case when new.human_outcome='partial' then 'partial_approval' else new.human_outcome end,
           decided_by_person_id=new.decided_by_person_id,
           decided_at=new.decided_at,
           decision_note=new.rationale,
           updated_at=now()
     where id=l.linked_id
       and status <> 'processed';
  end loop;
  return new;
end $$;

drop trigger if exists urws_decisions_sync_refund_request on public.urws_decisions;
create trigger urws_decisions_sync_refund_request
after insert on public.urws_decisions
for each row execute function app.urws_sync_refund_request_from_decision();
