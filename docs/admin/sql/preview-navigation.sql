-- Additive release control for navigation shared by Preview and older Production deployments.
alter table public.hub_navigation add column if not exists preview_enabled boolean not null default false;
-- Enable these only after the supporting Preview build has succeeded.
-- update public.hub_navigation set preview_enabled=true where hub_id='admin' and component in ('GovernanceWorkspace','BudgetWorkspace');
