import { NextRequest, NextResponse } from 'next/server';
import { requireSuperUser, SuperUserAuthError } from '@/lib/server/requireSuperUser';
import { writeAuditEvent } from '@/lib/server/writeAuditEvent';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const STEP_DEFINITIONS = [
  ['CLIENT', 'Client / Tenant'],
  ['ORGANIZATION', 'Organization'],
  ['SPORTS', 'Sport(s)'],
  ['PRIMARY_ADMIN', 'Primary Organization Admin'],
  ['SECURITY', 'Security & Roles'],
  ['CONFIGURATION', 'Configuration'],
  ['DATA_SOURCES', 'Data Sources'],
  ['IMPORT', 'Import / Migration'],
  ['VALIDATION', 'Validation'],
  ['CLIENT_REVIEW', 'Client Review'],
  ['ACTIVATION', 'Activation'],
  ['HANDOFF', 'Handoff'],
] as const;

function headers(prefer = 'return=representation') {
  if (!KEY) throw new Error('Supabase service credentials are not configured.');
  return {
    apikey: KEY,
    Authorization: `Bearer ${KEY}`,
    'Content-Type': 'application/json',
    Prefer: prefer,
  };
}

async function rest(path: string, init: RequestInit = {}) {
  if (!URL || !KEY) throw new Error('Supabase service credentials are not configured.');
  const response = await fetch(`${URL}/rest/v1/${path}`, {
    ...init,
    headers: { ...headers(), ...(init.headers || {}) },
    cache: 'no-store',
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Supabase ${path} returned ${response.status}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : null;
}

async function loadCase(id: string) {
  const [cases, steps] = await Promise.all([
    rest(`client_onboarding_cases?id=eq.${encodeURIComponent(id)}&select=*`),
    rest(`client_onboarding_steps?onboarding_case_id=eq.${encodeURIComponent(id)}&select=*&order=sort_order.asc`),
  ]);
  return { case: cases?.[0] || null, steps: steps || [] };
}

function authError(error: unknown) {
  if (error instanceof SuperUserAuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    await requireSuperUser(request);
    const id = request.nextUrl.searchParams.get('case');
    if (id) return NextResponse.json(await loadCase(id));
    const cases = await rest('client_onboarding_cases?select=*&order=started_at.desc&limit=100');
    return NextResponse.json({ cases: cases || [] });
  } catch (error) {
    const response = authError(error);
    if (response) return response;
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load onboarding data.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireSuperUser(request);
    if (!actor.canOnboardClients) throw new SuperUserAuthError('Client-onboarding permission required.', 403);

    const body = await request.json();
    const action = String(body.action || '');

    if (action === 'create-case') {
      const clientName = String(body.client_name || '').trim();
      if (!clientName) throw new Error('Client name is required.');

      const created = await rest('client_onboarding_cases', {
        method: 'POST',
        body: JSON.stringify({
          client_name: clientName,
          status: 'DISCOVERY',
          primary_admin_email: body.primary_admin_email || null,
          sports: Array.isArray(body.sports) && body.sports.length ? body.sports : ['SWIMMING'],
          current_step: 1,
          notes: { ...(body.notes || {}), created_by_operator_id: actor.operatorId },
        }),
      });
      const onboardingCase = created?.[0];
      if (!onboardingCase?.id) throw new Error('Onboarding case was not created.');

      const stepRows = STEP_DEFINITIONS.map(([step_code, step_name], index) => ({
        onboarding_case_id: onboardingCase.id,
        step_code,
        step_name,
        sort_order: index + 1,
        status: index === 0 ? 'in_progress' : 'pending',
        evidence: {},
      }));
      await rest('client_onboarding_steps', { method: 'POST', body: JSON.stringify(stepRows) });
      const after = await loadCase(onboardingCase.id);
      await writeAuditEvent(actor, {
        action: 'CLIENT_ONBOARDING_CREATED',
        entityType: 'client_onboarding_cases',
        entityId: onboardingCase.id,
        tenantId: onboardingCase.tenant_id || null,
        afterData: { case: after.case, step_count: after.steps.length },
        reason: 'Super User created client onboarding workflow',
      });
      return NextResponse.json(after);
    }

    if (action === 'update-case') {
      const id = String(body.id || '');
      if (!id) throw new Error('Onboarding case ID is required.');
      const before = await loadCase(id);
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      for (const key of ['client_name', 'status', 'primary_admin_email', 'current_step', 'notes']) {
        if (body[key] !== undefined) patch[key] = body[key];
      }
      if (Array.isArray(body.sports)) patch.sports = body.sports;
      await rest(`client_onboarding_cases?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) });
      const after = await loadCase(id);
      await writeAuditEvent(actor, {
        action: 'CLIENT_ONBOARDING_UPDATED',
        entityType: 'client_onboarding_cases',
        entityId: id,
        tenantId: (after.case as Record<string, unknown> | null)?.tenant_id as string | null,
        beforeData: before.case || null,
        afterData: after.case || patch,
        reason: 'Super User updated onboarding case',
      });
      return NextResponse.json(after);
    }

    if (action === 'update-step') {
      const caseId = String(body.case_id || '');
      const stepId = String(body.step_id || '');
      if (!caseId || !stepId) throw new Error('Case and step IDs are required.');
      const beforeCase = await loadCase(caseId);
      const beforeStep = beforeCase.steps.find((step: Record<string, unknown>) => step.id === stepId) || null;
      const status = String(body.status || 'pending');

      await rest(`client_onboarding_steps?id=eq.${encodeURIComponent(stepId)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status,
          evidence: body.evidence || {},
          completed_at: status === 'completed' ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        }),
      });

      const steps = await rest(`client_onboarding_steps?onboarding_case_id=eq.${encodeURIComponent(caseId)}&select=*&order=sort_order.asc`);
      const firstOpen = (steps || []).find((step: Record<string, unknown>) => step.status !== 'completed');
      const currentStep = firstOpen?.sort_order || STEP_DEFINITIONS.length;
      await rest(`client_onboarding_cases?id=eq.${encodeURIComponent(caseId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ current_step: currentStep, updated_at: new Date().toISOString() }),
      });
      const after = await loadCase(caseId);
      const afterStep = after.steps.find((step: Record<string, unknown>) => step.id === stepId) || null;
      await writeAuditEvent(actor, {
        action: 'CLIENT_ONBOARDING_STEP_UPDATED',
        entityType: 'client_onboarding_steps',
        entityId: stepId,
        tenantId: (after.case as Record<string, unknown> | null)?.tenant_id as string | null,
        beforeData: beforeStep,
        afterData: afterStep || { status },
        reason: `Onboarding step ${status}`,
      });
      return NextResponse.json(after);
    }

    if (action === 'activate') {
      const id = String(body.id || '');
      if (!id) throw new Error('Onboarding case ID is required.');
      const before = await loadCase(id);
      const incomplete = (before.steps || []).filter((step: Record<string, unknown>) => step.status !== 'completed');
      if (incomplete.length) {
        return NextResponse.json({ error: `Activation requires all 12 onboarding steps. ${incomplete.length} step(s) remain incomplete.` }, { status: 409 });
      }

      await rest(`client_onboarding_cases?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'ACTIVE',
          current_step: STEP_DEFINITIONS.length,
          activated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      });
      const after = await loadCase(id);
      await writeAuditEvent(actor, {
        action: 'CLIENT_ONBOARDING_ACTIVATED',
        entityType: 'client_onboarding_cases',
        entityId: id,
        tenantId: (after.case as Record<string, unknown> | null)?.tenant_id as string | null,
        beforeData: before.case || null,
        afterData: after.case || null,
        reason: 'All onboarding steps completed; Super User activated client',
      });
      return NextResponse.json(after);
    }

    return NextResponse.json({ error: 'Unsupported onboarding action.' }, { status: 400 });
  } catch (error) {
    const response = authError(error);
    if (response) return response;
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to save onboarding data.' }, { status: 400 });
  }
}
