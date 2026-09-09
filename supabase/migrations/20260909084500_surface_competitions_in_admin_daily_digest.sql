insert into public.calendar_events (tenant_id,organization_id,sport_id,title,event_type,starts_at,ends_at,timezone,status,metadata)
select c.tenant_id,c.organization_id,c.sport_id,c.name,'competition',c.starts_at,c.ends_at,c.timezone,c.status,jsonb_build_object('competition_id',c.id,'source','competitions')
from public.competitions c
where c.starts_at is not null and c.ends_at is not null and c.status <> 'complete'
  and not exists (select 1 from public.calendar_events e where e.metadata->>'competition_id'=c.id::text);

insert into public.admin_home_role_actions (role_name,action_key,label,description,href,sort_order,is_active)
select r.role_name,'review_competitions','Review competitions','See who is going, who has not responded, deadlines and unresolved logistics.',n.path,35,true
from (values ('org_admin'),('registrar'),('operations'),('team_engine')) as r(role_name)
join public.hub_navigation n on n.hub_id='admin' and n.label='Competitions'
where not exists (select 1 from public.admin_home_role_actions a where a.role_name=r.role_name and a.action_key='review_competitions');
