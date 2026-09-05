-- Normalize LS1Sports hub navigation to the actual App Router entrypoints.
-- Root hub pages own query-param workspaces; compatibility catch-all pages protect old URLs.

with dupes as (
  select nav_id,
         row_number() over (partition by hub_id, label, path order by nav_id) as rn
  from public.hub_navigation
  where hub_id = 'superuser' and label = 'Client Onboarding'
)
delete from public.hub_navigation h
using dupes d
where h.nav_id = d.nav_id and d.rn > 1;

update public.hub_navigation
set path = case label
  when 'Client Onboarding' then '/superuser/onboarding'
  when 'Command Center' then '/superuser'
  when 'Project Command' then '/superuser?view=command-center'
  when 'EAM/ERP Project Map' then '/superuser?view=project-map'
  when 'Milestone Tracker' then '/superuser?view=milestones'
  when 'Live Core Metrics' then '/superuser?view=metrics'
  when 'Platform Core' then '/superuser?view=platform'
  when 'Identity & Security' then '/superuser?view=identity'
  when 'Organizations' then '/superuser?view=organizations'
  when 'People' then '/superuser?view=people'
  when 'Athlete Intelligence' then '/superuser?view=athletes'
  when 'Competition Engine' then '/superuser?view=imports'
  when 'Finance & Accounting' then '/superuser?view=financial-overview'
  when 'Facilities & Assets' then '/superuser?view=facilities'
  when 'Procurement' then '/superuser?view=procurement'
  when 'Payroll' then '/superuser?view=payroll'
  when 'Workflow' then '/superuser?view=workflow'
  when 'Rules Engine' then '/superuser?view=workflow'
  when 'AI & Automation' then '/superuser?view=agents'
  when 'Reporting' then '/superuser?view=reporting'
  when 'Audit & Governance' then '/superuser?view=audit'
  when 'Engineering Product' then '/superuser?view=product'
  when 'Compliance' then '/superuser?view=compliance'
  else path
end
where hub_id = 'superuser';

update public.hub_navigation
set is_active = false
where hub_id = 'superuser' and label = 'Integrations';

update public.hub_navigation
set path = '/athlete'
where hub_id = 'athlete';

update public.hub_navigation
set path = case label
  when 'Household Overview' then '/parent'
  when 'My Athletes' then '/parent?view=athletes'
  when 'Schedules' then '/parent?view=schedule'
  when 'Registration' then '/parent?view=registration'
  when 'Financials' then '/parent?view=financial'
  when 'Documents' then '/parent?view=documents'
  when 'Compliance' then '/parent?view=compliance'
  when 'Communications' then '/parent?view=messages'
  when 'Family Members' then '/parent?view=members'
  when 'Transportation' then '/parent?view=transport'
  else path
end
where hub_id = 'parent';

update public.hub_navigation
set path = case
  when path is null then null
  else '/admin?view=' || nav_id::text
end
where hub_id = 'admin';
