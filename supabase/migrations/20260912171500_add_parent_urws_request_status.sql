create or replace function public.parent_urws_request_status(p_family_id uuid) returns jsonb language plpgsql security definer set search_path=public,app as $$
declare v jsonb;
begin
 if p_family_id is null or not app.can_access_family(p_family_id) then raise exception 'Family access denied' using errcode='42501';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'membership_id',c.subject_id,'case_type_code',c.case_type_code,'status',c.status,'priority',c.priority,'policy_outcome',c.policy_outcome,'public_summary',c.public_summary,'financial_impact',c.financial_impact,'currency',c.currency,'opened_at',c.opened_at,'resolved_at',c.resolved_at) order by c.opened_at desc),'[]'::jsonb) into v from public.urws_cases c where c.subject_type='membership' and c.subject_id in(select m.id from public.memberships m where m.person_id in(select fm.person_id from public.family_members fm where fm.family_id=p_family_id union select a.person_id from public.athletes a where a.primary_family_id=p_family_id));return v;
end $$;
grant execute on function public.parent_urws_request_status(uuid) to authenticated;
