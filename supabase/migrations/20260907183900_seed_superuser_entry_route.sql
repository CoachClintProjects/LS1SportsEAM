insert into public.corporate_site_config(key,value,is_active) values
  ('superuser_entry', jsonb_build_object('href','/superuser?view=command-center'), true)
on conflict (key) do update set value=excluded.value,is_active=true,updated_at=now();
