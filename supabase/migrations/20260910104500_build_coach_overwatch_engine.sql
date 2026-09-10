alter table public.coach_attention_items add column if not exists dedupe_key text;
create unique index if not exists coach_attention_open_dedupe_idx on public.coach_attention_items(coach_person_id,dedupe_key) where status='open' and dedupe_key is not null;

create or replace function app.refresh_coach_overwatch(p_coach_person_id uuid,p_team_id uuid)
returns integer
language plpgsql
security definer
set search_path=public,app
as $$
declare
  v_org uuid;
  v_count integer:=0;
  v_rows integer:=0;
begin
  if p_coach_person_id is null or p_team_id is null then raise exception 'coach and team are required'; end if;
  if not app.is_superuser() and (app.current_person_id() is distinct from p_coach_person_id or not app.can_access_coach_team(p_team_id)) then raise exception 'coach scope denied'; end if;
  select organization_id into v_org from public.teams where id=p_team_id;
  if v_org is null then raise exception 'team not found'; end if;

  update public.coach_attention_items set status='resolved',resolved_at=now(),resolution_note='Superseded by Overwatch refresh',updated_at=now()
   where coach_person_id=p_coach_person_id and team_id=p_team_id and status='open' and source_type like 'overwatch:%';

  insert into public.coach_attention_items(organization_id,coach_person_id,team_id,category,horizon,title,summary,severity,source_type,source_id,due_at,requires_human_judgment,dedupe_key)
  select v_org,p_coach_person_id,p_team_id,'compliance',case when c.expires_on<=current_date+7 then 'now' when c.expires_on<=current_date+30 then 'soon' else 'watch' end,'Coach credential expiring',c.credential_type||coalesce(' · '||c.issuer,''),'high','overwatch:credential_expiry',c.id,c.expires_on::timestamptz,false,'credential:'||c.id
    from public.credentials c where c.person_id=p_coach_person_id and c.expires_on between current_date and current_date+60 and lower(coalesce(c.status,'active')) not in ('expired','revoked');
  get diagnostics v_rows = row_count; v_count:=v_count+v_rows;

  insert into public.coach_attention_items(organization_id,coach_person_id,team_id,athlete_id,category,horizon,title,summary,severity,source_type,source_id,due_at,requires_human_judgment,dedupe_key)
  select v_org,p_coach_person_id,p_team_id,g.athlete_id,'development',case when g.due_on<current_date then 'now' else 'soon' end,'Athlete development goal needs review',g.title,'normal','overwatch:development_goal',g.id,g.due_on::timestamptz,true,'goal:'||g.id
    from public.development_goals g join public.team_memberships tm on tm.athlete_id=g.athlete_id and tm.team_id=p_team_id and lower(tm.status)='active'
   where g.due_on<=current_date+14 and lower(coalesce(g.status,'open')) not in ('complete','completed','closed');
  get diagnostics v_rows = row_count; v_count:=v_count+v_rows;

  insert into public.coach_attention_items(organization_id,coach_person_id,team_id,category,horizon,title,summary,severity,source_type,source_id,due_at,requires_human_judgment,dedupe_key)
  select v_org,p_coach_person_id,p_team_id,'approval','now','Approval waiting for coach',a.approval_type,'normal','overwatch:approval',a.id,a.requested_at,true,'approval:'||a.id
    from public.approvals a where a.approver_person_id=p_coach_person_id and lower(a.status) in ('pending','requested');
  get diagnostics v_rows = row_count; v_count:=v_count+v_rows;

  insert into public.coach_attention_items(organization_id,coach_person_id,team_id,category,horizon,title,summary,severity,source_type,source_id,due_at,requires_human_judgment,dedupe_key)
  select v_org,p_coach_person_id,p_team_id,'competition','soon','Meet entry deadline approaching',cc.name||' · '||cc.source_name,'high','overwatch:competition_candidate',cc.id,cc.entry_deadline,true,'candidate:'||cc.id
    from public.coach_competition_candidates cc where cc.organization_id=v_org and cc.validation_status='candidate' and cc.entry_deadline between now() and now()+interval '14 days';
  get diagnostics v_rows = row_count; v_count:=v_count+v_rows;

  insert into public.coach_attention_items(organization_id,coach_person_id,team_id,category,horizon,title,summary,severity,source_type,source_id,due_at,requires_human_judgment,dedupe_key)
  select v_org,p_coach_person_id,p_team_id,'competition','fyi','Competition approaching',c.name,'normal','overwatch:competition',c.id,c.starts_at,false,'competition:'||c.id
    from public.competitions c where c.organization_id=v_org and c.starts_at between now() and now()+interval '7 days' and lower(coalesce(c.status,'active')) not in ('cancelled','canceled');
  get diagnostics v_rows = row_count; v_count:=v_count+v_rows;

  insert into public.coach_attention_items(organization_id,coach_person_id,team_id,athlete_id,category,horizon,title,summary,severity,source_type,source_id,requires_human_judgment,dedupe_key)
  select v_org,p_coach_person_id,p_team_id,x.athlete_id,'attendance','watch','Attendance pattern needs review',x.flagged::text||' of '||x.total::text||' recent attendance records are absent/late/unexcused','normal','overwatch:attendance',x.athlete_id,true,'attendance:'||x.athlete_id
  from (select ar.athlete_id,count(*) total,count(*) filter(where lower(ar.status) in ('absent','late','unexcused')) flagged from public.attendance_records ar join public.attendance_sessions s on s.id=ar.session_id where s.team_id=p_team_id and s.session_date>=current_date-30 group by ar.athlete_id) x where x.total>=4 and x.flagged::numeric/x.total>=0.25;
  get diagnostics v_rows = row_count; v_count:=v_count+v_rows;

  insert into public.coach_attention_items(organization_id,coach_person_id,team_id,category,horizon,title,summary,severity,source_type,source_id,due_at,requires_human_judgment,dedupe_key)
  select v_org,p_coach_person_id,p_team_id,'facility','now','Schedule or facility change',ce.title,'high','overwatch:calendar_change',ce.id,ce.starts_at,false,'calendar:'||ce.id
    from public.calendar_events ce where ce.organization_id=v_org and ce.starts_at between now() and now()+interval '7 days' and lower(coalesce(ce.status,'active')) in ('cancelled','canceled','changed','rescheduled');
  get diagnostics v_rows = row_count; v_count:=v_count+v_rows;

  insert into public.platform_event_outbox(event_type,aggregate_type,aggregate_id,actor_person_id,payload,status)
  values('coach.overwatch.refreshed','team',p_team_id,p_coach_person_id,jsonb_build_object('attention_items_created',v_count,'organization_id',v_org),'pending');
  return v_count;
end$$;
grant execute on function app.refresh_coach_overwatch(uuid,uuid) to authenticated;
