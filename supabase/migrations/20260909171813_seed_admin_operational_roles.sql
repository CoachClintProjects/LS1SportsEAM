insert into public.roles (code,name,description,privilege_level)
values
  ('REGISTRAR','Registrar','Registration, membership and athlete enrollment administration',60),
  ('TREASURER','Treasurer','Organization finance, billing, invoicing, payments and payroll administration',65),
  ('OPERATIONS_ADMIN','Operations Admin','Facilities, vendors and day-to-day organization operations',60),
  ('COMPLIANCE_ADMIN','Compliance Admin','Compliance evidence, safety and background-check administration',60),
  ('REPORTING_ADMIN','Reporting Admin','Organization reporting and analytics administration',50),
  ('TEAM_ENGINE_ADMIN','Team Engine Admin','Programs, seasons, teams and Team Engine master-data administration',60)
on conflict (code) do update set
  name=excluded.name,
  description=excluded.description,
  privilege_level=excluded.privilege_level;