insert into public.corporate_site_config(key,value,is_active) values
  ('mfa', jsonb_build_object(
    'eyebrow','SuperUser security',
    'title','Complete multi-factor authentication.',
    'summary','A privileged LS1Sports session is issued only after the configured second-factor requirement is satisfied.',
    'enroll_title','Set up an authenticator',
    'enroll_body','Scan the QR code with your authenticator app, then enter the current verification code.',
    'challenge_title','Enter your verification code',
    'challenge_body','Use the current code from your enrolled authenticator app.',
    'code_label','Verification code',
    'verify_label','Verify and continue',
    'secret_label','Manual setup key',
    'loading_label','Checking authentication assurance…'
  ), true)
on conflict (key) do update set value=excluded.value,is_active=true,updated_at=now();
