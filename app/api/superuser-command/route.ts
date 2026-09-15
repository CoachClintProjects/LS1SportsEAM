import { NextRequest, NextResponse } from 'next/server';
import { requireSuperUser, SuperUserAuthError } from '@/lib/server/requireSuperUser';
import { writeAuditEvent } from '@/lib/server/writeAuditEvent';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const headers = () => ({ apikey: KEY!, Authorization: `Bearer ${KEY!}`, 'Content-Type': 'application/json', Prefer: 'return=representation' });

async function rest(path: string, init: RequestInit = {}) {
  if (!URL || !KEY) throw new Error('SuperUser server credentials are not configured.');
  const response = await fetch(`${URL}/rest/v1/${path}`, { ...init, headers: { ...headers(), ...(init.headers || {}) }, cache: 'no-store' });
  const text = await response.text();
  if (!response.ok) throw new Error(`Supabase ${path} returned ${response.status}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : null;
}

function authError(error: unknown) {
  if (error instanceof SuperUserAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
  return null;
}

type Evidence = Record<string, unknown>;
type Unit = { status?: string; evidence_ref?: string | null; verified_at?: string | null; evidence?: Evidence | null; [key: string]: unknown };

const TRUE_KEYS = (evidence: Evidence, keys: string[]) => keys.some((key) => evidence[key] === true);

function deriveUnitMeasurement(unit: Unit) {
  const evidence = unit.evidence && typeof unit.evidence === 'object' ? unit.evidence : {};
  const status = String(unit.status || '').toLowerCase();
  const hasTraceableArtifact = Boolean(unit.evidence_ref) && !['planned', 'not_started', 'placeholder'].includes(status);
  const implementationCertified = hasTraceableArtifact && (
    TRUE_KEYS(evidence, ['implementation_certified', 'build_green', 'regression_lock']) ||
    ['implemented', 'implemented_unverified', 'observed', 'operational', 'verified', 'complete'].includes(status)
  );
  const operationalCertified = implementationCertified && TRUE_KEYS(evidence, [
    'operational_certified', 'runtime_certified', 'browser_certified', 'live_workflow_certified', 'production_certified'
  ]);
  const validationCertified = operationalCertified && Boolean(unit.verified_at) && TRUE_KEYS(evidence, [
    'validation_certified', 'e2e_certified', 'acceptance_certified', 'regression_certified'
  ]);
  const readiness = implementationCertified && operationalCertified && validationCertified;

  return {
    ...unit,
    implementation_percent: implementationCertified ? 100 : 0,
    operational_percent: operationalCertified ? 100 : 0,
    validation_percent: validationCertified ? 100 : 0,
    measurement: {
      mode: 'evidence_gate_v1',
      implementationCertified,
      operationalCertified,
      validationCertified,
      readinessCertified: readiness,
      traceableArtifact: hasTraceableArtifact,
      measuredAt: new Date().toISOString(),
      note: 'Percentages are derived from evidence gates; stored/manual percentages are not used for SuperUser rollups.'
    }
  };
}

export async function GET(request: NextRequest) {
  try {
    const actor = await requireSuperUser(request);
    if (!URL || !KEY) throw new Error('SuperUser server credentials are not configured.');
    const response = await fetch(`${URL}/rest/v1/rpc/get_superuser_command`, { method: 'POST', headers: { ...headers(), Accept: 'application/json' }, body: '{}', cache: 'no-store' });
    const body = await response.text();
    if (!response.ok) throw new Error(`Supabase SuperUser RPC returned ${response.status}: ${body.slice(0, 400)}`);
    const payload = JSON.parse(body);
    const units = Array.isArray(payload?.units) ? payload.units.map(deriveUnitMeasurement) : [];
    return NextResponse.json({
      ...payload,
      units,
      measurement: { mode: 'evidence_gate_v1', manualPercentagesUsedInRollup: false, readinessRule: 'implementation AND operational AND validation must all be certified' },
      operator: { id: actor.operatorId, email: actor.email, displayName: actor.displayName, canOnboardClients: actor.canOnboardClients, canManagePlatformSettings: actor.canManagePlatformSettings }
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (error) {
    const response = authError(error); if (response) return response;
    return NextResponse.json({ project: null, milestones: [], tasks: [], raci: [], units: [], inventory: [], counts: {}, generatedAt: new Date().toISOString(), source: 'LS1SportsEAM Supabase', error: error instanceof Error ? error.message : 'Command data unavailable' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireSuperUser(request);
    const body = await request.json();
    const action = String(body.action || '');

    if (action === 'update-task') {
      if (!actor.canManagePlatformSettings) throw new SuperUserAuthError('Platform-management permission required.', 403);
      const before = await rest(`platform_project_tasks?id=eq.${encodeURIComponent(body.id)}&select=*&limit=1`);
      const row = await rest(`platform_project_tasks?id=eq.${encodeURIComponent(body.id)}`, { method: 'PATCH', body: JSON.stringify({ status: body.status, percent_complete: Number(body.percent_complete), blocker: body.blocker || null, updated_at: new Date().toISOString() }) });
      await writeAuditEvent(actor, { action: 'SUPERUSER_TASK_UPDATED', entityType: 'platform_project_tasks', entityId: body.id, beforeData: before?.[0] || null, afterData: row?.[0] || body, reason: 'Super User project-control update' });
      return NextResponse.json(row?.[0] || null);
    }

    if (action === 'update-unit') {
      if (!actor.canManagePlatformSettings) throw new SuperUserAuthError('Platform-management permission required.', 403);
      const before = await rest(`platform_milestone_units?id=eq.${encodeURIComponent(body.id)}&select=*&limit=1`);
      const row = await rest(`platform_milestone_units?id=eq.${encodeURIComponent(body.id)}`, { method: 'PATCH', body: JSON.stringify({ status: body.status, evidence: body.evidence || {}, evidence_source: 'SuperUser evidence update', evidence_ref: body.evidence_ref || null, verified_at: body.verified ? new Date().toISOString() : null }) });
      await writeAuditEvent(actor, { action: 'SUPERUSER_UNIT_EVIDENCE_UPDATED', entityType: 'platform_milestone_units', entityId: body.id, beforeData: before?.[0] || null, afterData: row?.[0] || body, reason: 'SuperUser evidence update; manual percentages do not control measurement' });
      return NextResponse.json(row?.[0] ? deriveUnitMeasurement(row[0]) : null);
    }

    if (action === 'create-ticket') {
      const tenant = (await rest('tenants?select=id&limit=1'))?.[0]?.id || null;
      const max = await rest('support_tickets?select=ticket_number&order=ticket_number.desc&limit=1');
      const ticketNumber = Number(max?.[0]?.ticket_number || 0) + 1;
      const row = await rest('support_tickets', { method: 'POST', body: JSON.stringify({ tenant_id: tenant, ticket_number: ticketNumber, title: body.title, description: body.description || null, category: body.category || 'PRODUCT', severity: body.severity || 'MEDIUM', status: 'OPEN' }) });
      await writeAuditEvent(actor, { action: 'SUPPORT_TICKET_CREATED', entityType: 'support_tickets', entityId: row?.[0]?.id || null, tenantId: tenant, afterData: row?.[0] || body, reason: 'Super User support ticket creation' });
      return NextResponse.json(row?.[0] || null);
    }

    if (action === 'create-client') {
      if (!actor.canOnboardClients) throw new SuperUserAuthError('Client-onboarding permission required.', 403);
      const tenant = (await rest('tenants?select=id&limit=1'))?.[0]?.id || null;
      const row = await rest('client_onboarding_cases', { method: 'POST', body: JSON.stringify({ client_name: body.client_name, status: 'DISCOVERY', tenant_id: tenant, primary_admin_email: body.primary_admin_email || null, sports: body.sports?.length ? body.sports : ['SWIMMING'], current_step: 1, notes: { created_from: 'superuser', operator_id: actor.operatorId } }) });
      await writeAuditEvent(actor, { action: 'CLIENT_ONBOARDING_CREATED', entityType: 'client_onboarding_cases', entityId: row?.[0]?.id || null, tenantId: tenant, afterData: row?.[0] || body, reason: 'Super User client onboarding creation' });
      return NextResponse.json(row?.[0] || null);
    }

    if (action === 'register-result-import') {
      if (!actor.canManagePlatformSettings) throw new SuperUserAuthError('Platform-management permission required.', 403);
      const tenant = (await rest('tenants?select=id&limit=1'))?.[0]?.id || null;
      const systems = await rest('competition_source_systems?select=id,name,code&limit=100');
      const source = systems?.find((item: { name?: string; code?: string }) => { const needle = String(body.source_system || '').toLowerCase(); return String(item.name || '').toLowerCase() === needle || String(item.code || '').toLowerCase() === needle; })?.id || null;
      const job = await rest('import_jobs', { method: 'POST', body: JSON.stringify({ tenant_id: tenant, source_system: body.source_system || null, source_file: body.original_filename || null, entity_type: 'COMPETITION_RESULTS', started_at: new Date().toISOString(), status: 'RECEIVED', records_read: 0, records_valid: 0, records_rejected: 0, records_created: 0, records_updated: 0 }) });
      const row = await rest('competition_import_files', { method: 'POST', body: JSON.stringify({ tenant_id: tenant, import_job_id: job?.[0]?.id || null, source_system_id: source, original_filename: body.original_filename, detected_format: body.detected_format || null, file_size_bytes: body.file_size_bytes || null, parse_status: 'queued', parse_summary: { registered_by: actor.email, note: body.note || null } }) });
      await writeAuditEvent(actor, { action: 'COMPETITION_IMPORT_REGISTERED', entityType: 'competition_import_files', entityId: row?.[0]?.id || null, tenantId: tenant, afterData: row?.[0] || body, reason: 'Super User competition source registration' });
      return NextResponse.json(row?.[0] || null);
    }

    return NextResponse.json({ error: 'Unsupported SuperUser action.' }, { status: 400 });
  } catch (error) {
    const response = authError(error); if (response) return response;
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Action failed' }, { status: 400 });
  }
}
