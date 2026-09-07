update public.platform_superuser_operators
set active = false,
    updated_at = now()
where lower(email) not in ('kondo@ls1sports.io','admin@ls1sports.io')
  and active = true;

update public.platform_superuser_operators
set active = true,
    can_onboard_clients = true,
    can_manage_platform_settings = true,
    updated_at = now()
where lower(email) in ('kondo@ls1sports.io','admin@ls1sports.io');

insert into public.platform_superuser_operators(email,display_name,active,can_onboard_clients,can_manage_platform_settings)
select v.email,v.display_name,true,true,true
from (values
  ('kondo@ls1sports.io','Kondo'),
  ('admin@ls1sports.io','LS1Sports Admin')
) as v(email,display_name)
where not exists (
  select 1 from public.platform_superuser_operators x where lower(x.email)=lower(v.email)
);
