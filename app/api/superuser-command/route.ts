import { NextRequest, NextResponse } from 'next/server';
import { requireSuperUser, SuperUserAuthError, type SuperUserIdentity } from '@/lib/server/requireSuperUser';
import { writeAuditEvent } from '@/lib/server/writeAuditEvent';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://xedfstgwotzxnztpembv.supabase.co';
const PUBLIC_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function headers(actor: SuperUserIdentity, extra: HeadersInit = {}) {
  const result = new Headers(extra);
  if (!PUBLIC_KEY) throw new Error('Supabase authenticated access is not configured.');
  result.set('apikey', PUBLIC_KEY);
  result.set('Authorization', `Bearer ${actor.accessToken}`);
  result.set('Content-Type', 'application/json');
  if (!result.has('Prefer')) result.set('Prefer', 'return=representation');
  return result;
}

async function rest(actor: SuperUserIdentity, path: string, init: RequestInit = {}) {
  if (!URL || !PUBLIC_KEY) throw new Error('Supabase authenticated access is not configured.');
  const response = await fetch(`${URL}/rest/v1/${path}`, {
    ...init,
    headers: headers(actor, init.headers),
    cache: 'no-store',
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Supabase ${path} returned ${response.status}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : null;
}

function authError(error: unknown) {
  if (error instanceof SuperUserAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const actor = await requireSuperUser(request);
    const response = await fetch(`${URL}/rest/v1/rpc/get_superuser_command`, {
      method: 'POST',
      headers: headers(actor, { Accept: 'application/json' }),
      body: '{}',
      cache: 'no-store',
    });
    const body = await response.text();
    if (!response.ok) throw new Error(`Supabase Super User RPC returned ${response.status}: ${body.slice(0, 400)}`);
    const payload = JSON.parse(body);
    return NextResponse.json({
      ...payload,
      operator: {
        id: actor.operatorId,
        email: actor.email,
        displayName: actor.displayName,
        canOnboardClients: actor.canOnboardClients,
        canManagePlatformSettings: actor.canManagePlatformSettings,
      },
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (error) {
    const response = authError(error);
    if (response) return response;
    return NextResponse.json({
      project: null, milestones: [], tasks: [], raci: [], units: [], inventory: [], counts: {},
      generatedAt: new Date().toISOString(), source: 'LS1SportsEAM Supabase',
      error: error instanceof Error ? error.message : 'Command data unavailable',
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireSuperUser(request);
    const body = await request.json();
    const action = String(body.action || '');

    if (action === 'update-task') {
      if (!actor.canManagePlatformSettings) throw new SuperUserAuthError('Platform-management permission required.', 403);
      const before = await rest(actor, `platform_project_tasks?id=eq.${encodeURIComponent(body.id)}&select=*&limit=1`);
      const row = await rest(actor, `platform_project_tasks?id=eq.${encodeURIComponent(body.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: body.status, percent_complete: Number(body.percent_complete), blocker: body.blocker || null, updated_at: new Date().toISOString() }),
      });
      await writeAuditEvent(actor, { action: 'SUPERUSER_TASK_UPDATED', entityType: 'platform_project_tasks', entityId: body.id, beforeData: before?.[0] || null, afterData: row?.[0] || body, reason: 'Super User project-control update' });
      return NextResponse.json(row?.[0] || null);
    }

    if (action === 'update-unit') {
      if (!actor.canManagePlatformSettings) throw new SuperUserAuthError('Platform-management permission required.', 403);
      const before = await rest(actor, `platform_milestone_units?id=eq.${encodeURIComponent(body.id)}&select=*&limit=1`);
      const row = await rest(actor, `platform_milestone_units?id=eq.${encodeURIComponent(body.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: body.status,
          implementation_percent: Number(body.implementation_percent),
          operational_percent: Number(body.operational_percent),
          validation_percent: Number(body.validation_percent),
          evidence: body.evidence || {}, evidence_source: 'SuperUser', evidence_ref: body.evidence_ref || null,
          verified_at: body.verified ? new Date().toISOString() : null,
        }),
      });
      await writeAuditEvent(actor, { action: 'SUPERUSER_UNIT_UPDATED', entityType: 'platform_milestone_units', entityId: body.id, beforeData: before?.[0] || null, afterData: row?.[0] || body, reason: 'Super User implementation-evidence update' });
      return NextResponse.json(row?.[0] || null);
    }

    if (action === 'create-ticket') {
      const tenant = (await rest(actor, 'tenants?select=id&limit=1'))?.[0]?.id || null;
      const max = await rest(actor, 'support_tickets?select=ticket_number&order=ticket_number.desc&limit=1');
      const ticketNumber = Number(max?.[0]?.ticket_number || 0) + 1;
      const row = await rest(actor, 'support_tickets', { method: 'POST', body: JSON.stringify({ tenant_id: tenant, ticket_number: ticketNumber, title: body.title, description: body.description || null, category: body.category || 'PRODUCT', severity: body.severity || 'MEDIUM', status: 'OPEN' }) });
      await writeAuditEvent(actor, { action: 'SUPPORT_TICKET_CREATED', entityType: 'support_tickets', entityId: row?.[0]?.id || null, tenantId: tenant, afterData: row?.[0] || body, reason: 'Super User support ticket creation' });
      return NextResponse.json(row?.[0] || null);
    }

    if (action === 'create-client') {
      if (!actor.canOnboardClients) throw new SuperUserAuthError('Client-onboarding permission required.', 403);
      const tenant = (await rest(actor, 'tenants?select=id&limit=1'))?.[0]?.id || null;
      const row = await rest(actor, 'client_onboarding_cases', { method: 'POST', body: JSON.stringify({ client_name: body.client_name, status: 'DISCOVERY', tenant_id: tenant, primary_admin_email: body.primary_admin_email || null, sports: body.sports?.length ? body.sports : ['SWIMMING'], current_step: 1, notes: { created_from: 'superuser', operator_id: actor.operatorId } }) });
      await writeAuditEvent(actor, { action: 'CLIENT_ONBOARDING_CREATED', entityType: 'client_onboarding_cases', entityId: row?.[0]?.id || null, tenantId: tenant, afterData: row?.[0] || body, reason: 'Super User client onboarding creation' });
      return NextResponse.json(row?.[0] || null);
    }

    return NextResponse.json({ error: 'Unsupported Super User action.' }, { status: 400 });
  } catch (error) {
    const response = authError(error);
    if (response) return response;
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Action failed' }, { status: 400 });
  }
}
