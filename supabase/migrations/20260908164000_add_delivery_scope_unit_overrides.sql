create table if not exists public.platform_delivery_scope_units (
  scope_id uuid not null references public.platform_delivery_scopes(id) on delete cascade,
  unit_id uuid not null references public.platform_milestone_units(id) on delete cascade,
  required boolean not null default true,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (scope_id, unit_id)
);

alter table public.platform_delivery_scope_units enable row level security;

with s as (
  select id from public.platform_delivery_scopes where scope_key='superuser-team-engine'
), u as (
  select id from public.platform_milestone_units where unit_key='superuser_competition_import'
)
insert into public.platform_delivery_scope_units(scope_id,unit_id,required,reason)
select s.id,u.id,false,'Competition Engine is placeholder-only and outside the active Team Engine release.'
from s cross join u
on conflict (scope_id,unit_id) do update set required=false,reason=excluded.reason,updated_at=now();
