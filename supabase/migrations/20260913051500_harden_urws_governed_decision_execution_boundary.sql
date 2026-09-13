revoke execute on function public.urws_record_authorized_decision(uuid,text,text,numeric,character) from public;
revoke execute on function public.urws_record_authorized_decision(uuid,text,text,numeric,character) from authenticated;
grant execute on function public.urws_record_authorized_decision(uuid,text,text,numeric,character) to service_role;

revoke execute on function public.urws_propose_decision(uuid,text,text,numeric,character) from public;
revoke execute on function public.urws_approve_decision_proposal(uuid,text,text) from public;
revoke execute on function public.urws_execute_decision_proposal(uuid) from public;
grant execute on function public.urws_propose_decision(uuid,text,text,numeric,character) to authenticated;
grant execute on function public.urws_approve_decision_proposal(uuid,text,text) to authenticated;
grant execute on function public.urws_execute_decision_proposal(uuid) to authenticated;

comment on function public.urws_record_authorized_decision(uuid,text,text,numeric,character) is 'Legacy internal execution primitive. Authenticated users must use governed decision proposals; direct execute is service-role only.';
