import { NextRequest, NextResponse } from 'next/server';
import { authorizeRequest, authorizationFailure } from '@/lib/server/authorization';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function headers(prefer = 'return=representation') {
  if (!KEY) throw new Error('Supabase service credentials are not configured.');
  return {
    apikey: KEY,
    Authorization: `Bearer ${KEY}`,
    'Content-Type': 'application/json',
    Prefer: prefer,
  };
}

async function rest(path: string, init: RequestInit = {}, prefer = 'return=representation') {
  if (!URL || !KEY) throw new Error('Supabase service credentials are not configured.');
  const response = await fetch(`${URL}/rest/v1/${path}`, {
    ...init,
    headers: { ...headers(prefer), ...(init.headers || {}) },
    cache: 'no-store',
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Supabase ${path} returned ${response.status}: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
}

async function audit(args: {
  tenantId?: string | null;
  action: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
  actorPersonId?: string | null;
}) {
  try {
    await rest('audit_events', {
      method: 'POST',
      body: JSON.stringify({
        tenant_id: args.tenantId || null,
        actor_person_id: args.actorPersonId || null,
        action: args.action,
        entity_type: 'organizations',
        entity_id: args.entityId || null,
        before_data: args.before ?? null,
        after_data: args.after ?? null,
        reason: args.reason || 'SuperUser Organizations workspace',
        privileged: true,
      }),
    });
  } catch (error) {
    console.error('[superuser-organizations] audit write failed', error);
  }
}

async function getOrganization(id: string) {
  const rows = await rest(`organizations?select=id,tenant_id,parent_organization_id,code,name,legal_name,organization_type,status,created_at,updated_at&id=eq.${encodeURIComponent(id)}&limit=1`);
  return rows?.[0] || null;
}

export async function GET(request: NextRequest) {
  try {
    await authorizeRequest(request, { permission: 'organizations.read' });
    const [organizations, tenants] = await Promise.all([
      rest('organizations?select=id,tenant_id,parent_organization_id,code,name,legal_name,organization_type,status,created_at,updated_at&order=name.asc&limit=250'),
      rest('tenants?select=id,name,status&order=name.asc&limit=100'),
    ]);

    return NextResponse.json({
      organizations: organizations || [],
      tenants: tenants || [],
      generatedAt: new Date().toISOString(),
      source: 'LS1SportsEAM Supabase',
    });
  } catch (error) {
    const auth = authorizationFailure(error);
    if (auth) return NextResponse.json(auth.body, { status: auth.status });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Organization data unavailable.' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = String(body.action || '');

    if (action === 'create-organization') {
      const auth = await authorizeRequest(request, {
        permission: 'organizations.create',
        requestedFields: ['tenant_id', 'code', 'name', 'legal_name', 'organization_type', 'status'],
      });
      const tenantId = String(body.tenantId || '').trim();
      const code = String(body.code || '').trim().toUpperCase();
      const name = String(body.name || '').trim();
      if (!tenantId) throw new Error('Tenant is required.');
      if (!code) throw new Error('Organization code is required.');
      if (!name) throw new Error('Organization name is required.');

      const row = await rest('organizations', {
        method: 'POST',
        body: JSON.stringify({
          tenant_id: tenantId,
          code,
          name,
          legal_name: String(body.legalName || '').trim() || null,
          organization_type: String(body.organizationType || '').trim() || 'club',
          status: 'active',
        }),
      });
      const created = row?.[0] || null;
      await audit({ tenantId, action: 'ORGANIZATION_CREATE', entityId: created?.id, after: created, actorPersonId: auth.personId });
      return NextResponse.json({ ok: true, row: created });
    }

    if (action === 'update-organization') {
      const id = String(body.id || '').trim();
      const code = String(body.code || '').trim().toUpperCase();
      const name = String(body.name || '').trim();
      if (!id) throw new Error('Organization ID is required.');
      if (!code) throw new Error('Organization code is required.');
      if (!name) throw new Error('Organization name is required.');
      const before = await getOrganization(id);
      if (!before) throw new Error('Organization not found.');
      const auth = await authorizeRequest(request, {
        permission: 'organizations.update',
        organizationId: before.id,
        requestedFields: ['code', 'name', 'legal_name', 'organization_type', 'status'],
      });

      const row = await rest(`organizations?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          code,
          name,
          legal_name: String(body.legalName || '').trim() || null,
          organization_type: String(body.organizationType || '').trim() || null,
          status: String(body.status || before.status || 'active'),
          updated_at: new Date().toISOString(),
        }),
      });
      const updated = row?.[0] || null;
      await audit({ tenantId: before.tenant_id, action: 'ORGANIZATION_UPDATE', entityId: id, before, after: updated, actorPersonId: auth.personId });
      return NextResponse.json({ ok: true, row: updated });
    }

    if (action === 'archive-organization' || action === 'restore-organization') {
      const id = String(body.id || '').trim();
      if (!id) throw new Error('Organization ID is required.');
      const before = await getOrganization(id);
      if (!before) throw new Error('Organization not found.');
      const auth = await authorizeRequest(request, { permission: 'organizations.archive', organizationId: before.id });
      const nextStatus = action === 'archive-organization' ? 'archived' : 'active';
      const row = await rest(`organizations?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus, updated_at: new Date().toISOString() }),
      });
      const updated = row?.[0] || null;
      await audit({
        tenantId: before.tenant_id,
        action: action === 'archive-organization' ? 'ORGANIZATION_ARCHIVE' : 'ORGANIZATION_RESTORE',
        entityId: id,
        before,
        after: updated,
        actorPersonId: auth.personId,
      });
      return NextResponse.json({ ok: true, row: updated });
    }

    throw new Error('Unsupported SuperUser organization action.');
  } catch (error) {
    const auth = authorizationFailure(error);
    if (auth) return NextResponse.json(auth.body, { status: auth.status });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'SuperUser organization action failed.' },
      { status: 400 },
    );
  }
}
