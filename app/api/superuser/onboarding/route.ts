import { NextRequest, NextResponse } from 'next/server';

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
  if (!response.ok) {
    throw new Error(`Supabase ${path} returned ${response.status}: ${text.slice(0, 500)}`);
  }
  return text ? JSON.parse(text) : null;
}

async function audit(action: string, entityId: string | null, details: Record<string, unknown>) {
  try {
    await rest('audit_events', {
      method: 'POST',
      body: JSON.stringify({
        action,
        entity_type: 'client_onboarding_cases',
        entity_id: entityId,
        details,
      }),
    });
  } catch {
    // Audit failure must not destroy the primary onboarding transaction.
  }
}

async function loadCase(id: string) {
  const [cases, steps] = await Promise.all([
    rest(`client_onboarding_cases?id=eq.${encodeURIComponent(id)}&select=*`),
    rest(`client_onboarding_steps?onboarding_case_id=eq.${encodeURIComponent(id)}&select=*&order=sort_order.asc`),
  ]);
  return { case: cases?.[0] || null, steps: steps || [] };
}

export async function GET(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get('case');
    if (id) return NextResponse.json(await loadCase(id));

    const cases = await rest(
      'client_onboarding_cases?select=*&order=started_at.desc&limit=100',
    );
    return NextResponse.json({ cases: cases || [] });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to load onboarding data.' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
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
          notes: body.notes || {},
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
      await rest('client_onboarding_steps', {
        method: 'POST',
        body: JSON.stringify(stepRows),
      });
      await audit('CLIENT_ONBOARDING_CREATED', onboardingCase.id, { client_name: clientName });
      return NextResponse.json(await loadCase(onboardingCase.id));
    }

    if (action === 'update-case') {
      const id = String(body.id || '');
      if (!id) throw new Error('Onboarding case ID is required.');
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      for (const key of ['client_name', 'status', 'primary_admin_email', 'current_step', 'notes']) {
        if (body[key] !== undefined) patch[key] = body[key];
      }
      if (Array.isArray(body.sports)) patch.sports = body.sports;
      await rest(`client_onboarding_cases?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      await audit('CLIENT_ONBOARDING_UPDATED', id, patch);
      return NextResponse.json(await loadCase(id));
    }

    if (action === 'update-step') {
      const caseId = String(body.case_id || '');
      const stepId = String(body.step_id || '');
      if (!caseId || !stepId) throw new Error('Case and step IDs are required.');

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

      const steps = await rest(
        `client_onboarding_steps?onboarding_case_id=eq.${encodeURIComponent(caseId)}&select=*&order=sort_order.asc`,
      );
      const firstOpen = (steps || []).find((step: Record<string, unknown>) => step.status !== 'completed');
      const currentStep = firstOpen?.sort_order || STEP_DEFINITIONS.length;
      await rest(`client_onboarding_cases?id=eq.${encodeURIComponent(caseId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ current_step: currentStep, updated_at: new Date().toISOString() }),
      });
      await audit('CLIENT_ONBOARDING_STEP_UPDATED', caseId, { step_id: stepId, status });
      return NextResponse.json(await loadCase(caseId));
    }

    if (action === 'activate') {
      const id = String(body.id || '');
      if (!id) throw new Error('Onboarding case ID is required.');
      await rest(`client_onboarding_cases?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'ACTIVE',
          activated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      });
      await audit('CLIENT_ONBOARDING_ACTIVATED', id, {});
      return NextResponse.json(await loadCase(id));
    }

    throw new Error('Unsupported onboarding action.');
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to save onboarding data.' },
      { status: 400 },
    );
  }
}
