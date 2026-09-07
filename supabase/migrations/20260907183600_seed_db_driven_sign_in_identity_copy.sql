insert into public.corporate_site_config(key,value,is_active) values
  ('sign_in', jsonb_build_object(
    'back_label','Back to LS1Sports',
    'eyebrow','Enterprise Sports EAM / ERP',
    'title','Privileged platform access.',
    'summary','SuperUser access is restricted to configured LS1Sports platform operators. Authentication policy and operator eligibility are enforced server-side.',
    'mfa_title','Multi-factor required',
    'mfa_body','TOTP enrollment or challenge is required before a privileged session is issued.',
    'operator_title','Operator registry',
    'operator_body','Being authenticated is not enough. The account must also be active in the SuperUser operator registry.',
    'workspace_label','SuperUser',
    'sso_label','Continue with SSO',
    'separator_label','or',
    'email_label','Platform operator email',
    'magic_link_label','Send secure sign-in link'
  ), true)
on conflict (key) do update set value=excluded.value,is_active=true,updated_at=now();
