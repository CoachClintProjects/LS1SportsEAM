alter table public.platform_superuser_operators add column if not exists auth_user_id uuid;

update public.platform_superuser_operators o
set auth_user_id = u.id
from auth.users u
where o.auth_user_id is null
  and lower(u.email) = lower(o.email);

alter table public.platform_superuser_operators
  drop constraint if exists platform_superuser_operators_auth_user_id_fkey;
alter table public.platform_superuser_operators
  add constraint platform_superuser_operators_auth_user_id_fkey
  foreign key (auth_user_id) references auth.users(id) on delete restrict;

create unique index if not exists platform_superuser_operators_auth_user_id_uidx
  on public.platform_superuser_operators(auth_user_id)
  where auth_user_id is not null;

alter table public.platform_superuser_operators
  alter column auth_user_id set not null;
