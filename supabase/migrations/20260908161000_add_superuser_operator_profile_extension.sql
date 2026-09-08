alter table public.platform_superuser_operators
add column if not exists profile jsonb not null default '{}'::jsonb;

comment on column public.platform_superuser_operators.profile is 'Operator-local profile attributes used when a platform Super User is not linked to canonical Person Master.';
