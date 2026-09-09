insert into public.hub_role_navigation (role_id,nav_id,can_view)
select ar.role_id, hn.nav_id, true
from public.admin_roles ar
join public.hub_navigation hn on hn.hub_id='admin' and hn.label='Vendors'
where ar.role_name in ('org_admin','operations','treasurer','compliance','team_engine')
and not exists (select 1 from public.hub_role_navigation x where x.role_id=ar.role_id and x.nav_id=hn.nav_id);

insert into public.hub_role_navigation (role_id,nav_id,can_view)
select ar.role_id, hn.nav_id, true
from public.admin_roles ar
join public.hub_navigation hn on hn.hub_id='admin' and hn.label='External Organizations'
where ar.role_name in ('org_admin','operations','compliance','team_engine')
and not exists (select 1 from public.hub_role_navigation x where x.role_id=ar.role_id and x.nav_id=hn.nav_id);
