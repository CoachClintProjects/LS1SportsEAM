import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, AdminAuthError, type AdminIdentity } from '@/lib/server/requireAdmin';
import { adminRest } from '@/lib/server/adminRest';
import { writeAdminAuditEvent } from '@/lib/server/writeAdminAuditEvent';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Row = Record<string, any>;

const writeRoles = new Set(['org_admin', 'operations', 'treasurer', 'compliance', 'team_engine']);

function canWrite(actor: AdminIdentity) {
  return actor.isSuperUser || actor.roles.some((role) => writeRoles.has(role));
}

function assertWrite(actor: AdminIdentity) {
  if (!canWrite(actor)) throw new AdminAuthError('Your Admin role does not allow relationship record changes.', 403);
}

async function resolveTenant(actor: AdminIdentity) {
  if (actor.tenantIds[0]) return actor.tenantIds[0];
  if (!actor.isSuperUser) throw new AdminAuthError('Admin tenant scope is missing.', 403);
  const rows = await adminRest<Array<{ id: string }>>(actor, 'tenants?select=id&order=created_at.asc&limit=1');
  if (!rows?.[0]?.id) throw new Error('No tenant is available for Admin record creation.');
  return rows[0].id;
}

function clean(value: unknown) {
  const text = String(value ?? '').trim();
  return text || null;
}

function vendorPayload(body: Row) {
  const allowed = [
    'name', 'vendor_category', 'email', 'phone', 'website', 'address_line1', 'address_line2', 'city', 'region',
    'postal_code', 'country_code', 'notes', 'insurance_expires_on', 'compliance_status', 'status', 'tax_id',
  ];
  return Object.fromEntries(allowed.filter((key) => key in body).map((key) => [key, clean(body[key])]));
}

function externalPayload(body: Row) {
  const allowed = [
    'name', 'organization_type', 'status', 'website', 'email', 'phone', 'address_line1', 'address_line2', 'city',
    'region', 'postal_code', 'country_code', 'notes',
  ];
  return Object.fromEntries(allowed.filter((key) => key in body).map((key) => [key, clean(body[key])]));
}

async function loadVendor(actor: AdminIdentity, id: string) {
  const vendors = await adminRest<Row[]>(actor, `vendors?select=*&id=eq.${encodeURIComponent(id)}&limit=1`);
  const vendor = vendors?.[0];
  if (!vendor) return null;
  const [contacts, bills, tasks, activity] = await Promise.all([
    adminRest<Row[]>(actor, `entity_contacts?select=id,relationship_type,job_title,department,is_primary,status,notes,person:people(id,first_name,last_name,preferred_name,email,phone,status)&vendor_id=eq.${encodeURIComponent(id)}&order=is_primary.desc,created_at.asc`),
    actor.isSuperUser || actor.roles.includes('treasurer') || actor.roles.includes('org_admin')
      ? adminRest<Row[]>(actor, `vendor_bills?select=id,bill_number,bill_date,due_date,total,balance_due,status&vendor_id=eq.${encodeURIComponent(id)}&order=bill_date.desc&limit=20`).catch(() => [])
      : Promise.resolve([]),
    adminRest<Row[]>(actor, `work_items?select=id,work_type,status,priority,payload&entity_type=eq.vendor&entity_id=eq.${encodeURIComponent(id)}&order=id.desc&limit=20`).catch(() => []),
    adminRest<Row[]>(actor, `audit_events?select=id,occurred_at,action,reason,after_data&entity_type=eq.vendor&entity_id=eq.${encodeURIComponent(id)}&order=occurred_at.desc&limit=30`).catch(() => []),
  ]);
  return { ...vendor, contacts, bills, tasks, activity };
}

async function loadExternalOrganization(actor: AdminIdentity, id: string) {
  const rows = await adminRest<Row[]>(actor, `external_organizations?select=*&id=eq.${encodeURIComponent(id)}&limit=1`);
  const organization = rows?.[0];
  if (!organization) return null;
  const [contacts, tasks, activity] = await Promise.all([
    adminRest<Row[]>(actor, `entity_contacts?select=id,relationship_type,job_title,department,is_primary,status,notes,person:people(id,first_name,last_name,preferred_name,email,phone,status)&external_organization_id=eq.${encodeURIComponent(id)}&order=is_primary.desc,created_at.asc`),
    adminRest<Row[]>(actor, `work_items?select=id,work_type,status,priority,payload&entity_type=eq.external_organization&entity_id=eq.${encodeURIComponent(id)}&order=id.desc&limit=20`).catch(() => []),
    adminRest<Row[]>(actor, `audit_events?select=id,occurred_at,action,reason,after_data&entity_type=eq.external_organization&entity_id=eq.${encodeURIComponent(id)}&order=occurred_at.desc&limit=30`).catch(() => []),
  ]);
  return { ...organization, contacts, tasks, activity };
}

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAdmin(request);
    const type = request.nextUrl.searchParams.get('type') || 'vendor';
    const id = request.nextUrl.searchParams.get('id');

    if (type === 'vendor') {
      if (id) return NextResponse.json({ record: await loadVendor(actor, id), canWrite: canWrite(actor) });
      const records = await adminRest<Row[]>(actor, 'vendors?select=id,vendor_code,name,vendor_category,status,email,phone,city,region,compliance_status,insurance_expires_on,updated_at&order=name.asc&limit=250');
      return NextResponse.json({ records, canWrite: canWrite(actor), roles: actor.roles });
    }

    if (type === 'external-organization') {
      if (id) return NextResponse.json({ record: await loadExternalOrganization(actor, id), canWrite: canWrite(actor) });
      const records = await adminRest<Row[]>(actor, 'external_organizations?select=id,name,organization_type,status,email,phone,city,region,updated_at&order=name.asc&limit=250');
      return NextResponse.json({ records, canWrite: canWrite(actor), roles: actor.roles });
    }

    return NextResponse.json({ error: 'Unsupported record type.' }, { status: 400 });
  } catch (error) {
    const status = error instanceof AdminAuthError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Admin record data unavailable.' }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAdmin(request);
    assertWrite(actor);
    const body = (await request.json()) as Row;
    const action = String(body.action || '');
    const tenantId = await resolveTenant(actor);

    if (action === 'create-vendor') {
      const name = String(body.name || '').trim();
      if (!name) throw new Error('Vendor name is required.');
      const vendorCode = `V-${Date.now().toString(36).toUpperCase()}`;
      const rows = await adminRest<Row[]>(actor, 'vendors', {
        method: 'POST',
        body: JSON.stringify({ tenant_id: tenantId, vendor_code: vendorCode, name, status: 'active', ...vendorPayload(body), updated_at: new Date().toISOString() }),
      });
      const row = rows?.[0];
      await writeAdminAuditEvent(actor, { action: 'VENDOR_CREATED', entityType: 'vendor', entityId: row?.id, tenantId, afterData: row });
      return NextResponse.json({ ok: true, record: row });
    }

    if (action === 'update-vendor') {
      const id = String(body.id || '');
      if (!id) throw new Error('Vendor ID is required.');
      const before = (await adminRest<Row[]>(actor, `vendors?select=*&id=eq.${encodeURIComponent(id)}&limit=1`))?.[0];
      if (!before) throw new Error('Vendor not found.');
      const rows = await adminRest<Row[]>(actor, `vendors?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ ...vendorPayload(body), updated_at: new Date().toISOString() }),
      });
      await writeAdminAuditEvent(actor, { action: 'VENDOR_UPDATED', entityType: 'vendor', entityId: id, tenantId: before.tenant_id || tenantId, beforeData: before, afterData: rows?.[0] });
      return NextResponse.json({ ok: true, record: await loadVendor(actor, id) });
    }

    if (action === 'create-external-organization') {
      const name = String(body.name || '').trim();
      if (!name) throw new Error('Organization name is required.');
      const rows = await adminRest<Row[]>(actor, 'external_organizations', {
        method: 'POST',
        body: JSON.stringify({ tenant_id: tenantId, name, organization_type: body.organization_type || 'municipality', status: 'active', ...externalPayload(body), updated_at: new Date().toISOString() }),
      });
      const row = rows?.[0];
      await writeAdminAuditEvent(actor, { action: 'EXTERNAL_ORGANIZATION_CREATED', entityType: 'external_organization', entityId: row?.id, tenantId, afterData: row });
      return NextResponse.json({ ok: true, record: row });
    }

    if (action === 'update-external-organization') {
      const id = String(body.id || '');
      if (!id) throw new Error('Organization ID is required.');
      const before = (await adminRest<Row[]>(actor, `external_organizations?select=*&id=eq.${encodeURIComponent(id)}&limit=1`))?.[0];
      if (!before) throw new Error('Organization not found.');
      const rows = await adminRest<Row[]>(actor, `external_organizations?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ ...externalPayload(body), updated_at: new Date().toISOString() }),
      });
      await writeAdminAuditEvent(actor, { action: 'EXTERNAL_ORGANIZATION_UPDATED', entityType: 'external_organization', entityId: id, tenantId: before.tenant_id || tenantId, beforeData: before, afterData: rows?.[0] });
      return NextResponse.json({ ok: true, record: await loadExternalOrganization(actor, id) });
    }

    if (action === 'add-contact') {
      const parentType = String(body.parentType || '');
      const parentId = String(body.parentId || '');
      const firstName = String(body.first_name || '').trim();
      const lastName = String(body.last_name || '').trim();
      if (!parentId || !firstName || !lastName) throw new Error('First name, last name, and parent record are required.');
      if (!['vendor', 'external-organization'].includes(parentType)) throw new Error('Unsupported contact parent type.');

      const people = await adminRest<Row[]>(actor, 'people', {
        method: 'POST',
        body: JSON.stringify({ tenant_id: tenantId, first_name: firstName, last_name: lastName, preferred_name: clean(body.preferred_name), email: clean(body.email), phone: clean(body.phone), status: 'ACTIVE', privacy_classification: 'INTERNAL' }),
      });
      const person = people?.[0];
      if (!person?.id) throw new Error('Contact person could not be created.');
      const relationship = await adminRest<Row[]>(actor, 'entity_contacts', {
        method: 'POST',
        body: JSON.stringify({
          tenant_id: tenantId,
          person_id: person.id,
          vendor_id: parentType === 'vendor' ? parentId : null,
          external_organization_id: parentType === 'external-organization' ? parentId : null,
          relationship_type: clean(body.relationship_type) || 'contact',
          job_title: clean(body.job_title),
          department: clean(body.department),
          is_primary: Boolean(body.is_primary),
          status: 'active',
          notes: clean(body.notes),
        }),
      });
      const entityType = parentType === 'vendor' ? 'vendor' : 'external_organization';
      await writeAdminAuditEvent(actor, { action: 'CONTACT_ADDED', entityType, entityId: parentId, tenantId, afterData: { person, relationship: relationship?.[0] } });
      return NextResponse.json({ ok: true, contact: relationship?.[0] || null });
    }

    if (action === 'update-contact') {
      const relationshipId = String(body.relationshipId || '');
      const personId = String(body.personId || '');
      if (!relationshipId || !personId) throw new Error('Contact identifiers are required.');
      await adminRest(actor, `people?id=eq.${encodeURIComponent(personId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ first_name: clean(body.first_name), last_name: clean(body.last_name), preferred_name: clean(body.preferred_name), email: clean(body.email), phone: clean(body.phone), updated_at: new Date().toISOString() }),
      });
      const relationships = await adminRest<Row[]>(actor, `entity_contacts?id=eq.${encodeURIComponent(relationshipId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ relationship_type: clean(body.relationship_type) || 'contact', job_title: clean(body.job_title), department: clean(body.department), is_primary: Boolean(body.is_primary), notes: clean(body.notes), updated_at: new Date().toISOString() }),
      });
      const relationship = relationships?.[0];
      const entityType = relationship?.vendor_id ? 'vendor' : 'external_organization';
      const entityId = relationship?.vendor_id || relationship?.external_organization_id || null;
      await writeAdminAuditEvent(actor, { action: 'CONTACT_UPDATED', entityType, entityId, tenantId, afterData: { relationshipId, personId } });
      return NextResponse.json({ ok: true });
    }

    throw new Error('Unsupported Admin record action.');
  } catch (error) {
    const status = error instanceof AdminAuthError ? error.status : 400;
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Admin record action failed.' }, { status });
  }
}
