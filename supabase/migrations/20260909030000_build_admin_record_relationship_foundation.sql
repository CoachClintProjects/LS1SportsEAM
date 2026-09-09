alter table public.vendors add column if not exists tenant_id uuid references public.tenants(id);
alter table public.vendors add column if not exists vendor_category text;
alter table public.vendors add column if not exists email text;
alter table public.vendors add column if not exists phone text;
alter table public.vendors add column if not exists website text;
alter table public.vendors add column if not exists address_line1 text;
alter table public.vendors add column if not exists address_line2 text;
alter table public.vendors add column if not exists city text;
alter table public.vendors add column if not exists region text;
alter table public.vendors add column if not exists postal_code text;
alter table public.vendors add column if not exists country_code text;
alter table public.vendors add column if not exists notes text;
alter table public.vendors add column if not exists insurance_expires_on date;
alter table public.vendors add column if not exists compliance_status text not null default 'unknown';
alter table public.vendors add column if not exists created_at timestamptz not null default now();
alter table public.vendors add column if not exists updated_at timestamptz not null default now();

update public.vendors v set tenant_id=o.tenant_id from public.organizations o where v.tenant_id is null and v.organization_id=o.id;

create table if not exists public.external_organizations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  name text not null,
  organization_type text not null default 'external_partner',
  status text not null default 'active',
  website text,
  email text,
  phone text,
  address_line1 text,
  address_line2 text,
  city text,
  region text,
  postal_code text,
  country_code text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.entity_contacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  person_id uuid not null references public.people(id) on delete cascade,
  vendor_id uuid references public.vendors(id) on delete cascade,
  external_organization_id uuid references public.external_organizations(id) on delete cascade,
  relationship_type text not null default 'contact',
  job_title text,
  department text,
  is_primary boolean not null default false,
  status text not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint entity_contacts_one_parent check (((vendor_id is not null)::int + (external_organization_id is not null)::int) = 1)
);

create index if not exists idx_vendors_tenant on public.vendors(tenant_id);
create index if not exists idx_external_organizations_tenant on public.external_organizations(tenant_id);
create index if not exists idx_entity_contacts_tenant on public.entity_contacts(tenant_id);
create index if not exists idx_entity_contacts_vendor on public.entity_contacts(vendor_id);
create index if not exists idx_entity_contacts_external_org on public.entity_contacts(external_organization_id);
create unique index if not exists uq_entity_contacts_vendor_person on public.entity_contacts(vendor_id,person_id) where vendor_id is not null;
create unique index if not exists uq_entity_contacts_external_person on public.entity_contacts(external_organization_id,person_id) where external_organization_id is not null;

alter table public.vendors enable row level security;
alter table public.external_organizations enable row level security;
alter table public.entity_contacts enable row level security;

drop policy if exists vendors_admin_tenant_access on public.vendors;
create policy vendors_admin_tenant_access on public.vendors for all to authenticated
using (app.is_superuser() or tenant_id in (select app.current_tenant_ids()) or (tenant_id is null and organization_id in (select id from public.organizations where tenant_id in (select app.current_tenant_ids()))))
with check (app.is_superuser() or tenant_id in (select app.current_tenant_ids()));

drop policy if exists external_organizations_admin_tenant_access on public.external_organizations;
create policy external_organizations_admin_tenant_access on public.external_organizations for all to authenticated
using (app.is_superuser() or tenant_id in (select app.current_tenant_ids()))
with check (app.is_superuser() or tenant_id in (select app.current_tenant_ids()));

drop policy if exists entity_contacts_admin_tenant_access on public.entity_contacts;
create policy entity_contacts_admin_tenant_access on public.entity_contacts for all to authenticated
using (app.is_superuser() or tenant_id in (select app.current_tenant_ids()))
with check (app.is_superuser() or tenant_id in (select app.current_tenant_ids()));

drop policy if exists audit_events_admin_tenant_select on public.audit_events;
create policy audit_events_admin_tenant_select on public.audit_events for select to authenticated
using (app.is_superuser() or tenant_id in (select app.current_tenant_ids()));
drop policy if exists audit_events_admin_tenant_insert on public.audit_events;
create policy audit_events_admin_tenant_insert on public.audit_events for insert to authenticated
with check (app.is_superuser() or tenant_id in (select app.current_tenant_ids()));

grant select,insert,update on public.vendors to authenticated;
grant select,insert,update,delete on public.external_organizations to authenticated;
grant select,insert,update,delete on public.entity_contacts to authenticated;
grant select,insert,update on public.people to authenticated;
grant select,insert on public.audit_events to authenticated;

insert into public.hub_navigation (hub_id,parent_id,label,icon,path,component,sort_order,is_active,description)
select 'admin', p.nav_id, 'Vendors', 'Building2', '/admin?view=vendors', 'VendorDirectory', 315, true, 'Vendor and supplier relationship management'
from public.hub_navigation p where p.hub_id='admin' and p.label='Operations'
and not exists (select 1 from public.hub_navigation n where n.hub_id='admin' and n.label='Vendors');

insert into public.hub_navigation (hub_id,parent_id,label,icon,path,component,sort_order,is_active,description)
select 'admin', p.nav_id, 'External Organizations', 'Landmark', '/admin?view=external-organizations', 'ExternalOrganizationDirectory', 316, true, 'Municipal, recreation, council, facility and partner contacts'
from public.hub_navigation p where p.hub_id='admin' and p.label='Operations'
and not exists (select 1 from public.hub_navigation n where n.hub_id='admin' and n.label='External Organizations');
