create table if not exists public.platform_delivery_scopes (
  id uuid primary key default gen_random_uuid(),
  scope_key text not null unique,
  name text not null,
  description text,
  status text not null default 'active',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_delivery_scope_milestones (
  scope_id uuid not null references public.platform_delivery_scopes(id) on delete cascade,
  milestone_id uuid not null references public.platform_milestones(id) on delete cascade,
  required boolean not null default true,
  display_mode text not null default 'active',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (scope_id, milestone_id)
);

alter table public.platform_delivery_scopes enable row level security;
alter table public.platform_delivery_scope_milestones enable row level security;

insert into public.platform_delivery_scopes(scope_key,name,description,status,sort_order)
values ('superuser-team-engine','Super User / Team Engine','Current completion scope for the Super User control plane and Team Engine. Future hubs and Competition remain visible as roadmap but do not block this scope.','active',10)
on conflict (scope_key) do update set name=excluded.name,description=excluded.description,status=excluded.status,sort_order=excluded.sort_order,updated_at=now();

with s as (select id from public.platform_delivery_scopes where scope_key='superuser-team-engine')
insert into public.platform_delivery_scope_milestones(scope_id,milestone_id,required,display_mode,sort_order)
select s.id,m.id,
       case when m.code::text in ('M01','M02','M03','M04','M05','M10','M12','M14') then true else false end,
       case when m.code::text in ('M01','M02','M03','M04','M05','M10','M12','M14') then 'active' else 'roadmap' end,
       m.sort_order
from s cross join public.platform_milestones m
where m.code::text in ('M01','M02','M03','M04','M05','M06','M07','M08','M09','M10','M11','M12','M13','M14')
on conflict (scope_id,milestone_id) do update set required=excluded.required,display_mode=excluded.display_mode,sort_order=excluded.sort_order;
