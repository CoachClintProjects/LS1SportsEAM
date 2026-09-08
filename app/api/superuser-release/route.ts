import { NextRequest, NextResponse } from 'next/server';
import { requireSuperUser, SuperUserAuthError } from '@/lib/server/requireSuperUser';
import { writeAuditEvent } from '@/lib/server/writeAuditEvent';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://xedfstgwotzxnztpembv.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Row = Record<string, unknown>;

type ReleaseAction =
  | 'create-candidate'
  | 'record-verification'
  | 'record-defect'
  | 'set-deployment'
  | 'certify';

async function rest<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!SERVICE_KEY) throw new Error('Supabase server credentials are not configured.');
  const headers = new Headers(init.headers || {});
  headers.set('apikey', SERVICE_KEY);
  headers.set('Authorization', `Bearer ${SERVICE_KEY}`);
  headers.set('Accept', 'application/json');
  if (init.body) headers.set('Content-Type', 'application/json');
  if (!headers.has('Prefer') && init.method && init.method !== 'GET') {
    headers.set('Prefer', 'return=representation');
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers,
    cache: 'no-store',
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Release ledger request failed (${response.status}): ${text.slice(0, 500)}`);
  return (text ? JSON.parse(text) : []) as T;
}

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function runtimeIdentity() {
  return {
    commitSha: process.env.VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || null,
    branchName: process.env.VERCEL_GIT_COMMIT_REF || null,
    deploymentId: process.env.VERCEL_DEPLOYMENT_ID || null,
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || null,
  };
}

async function readCandidate(candidateId?: string | null) {
  const filter = candidateId
    ? `id=eq.${encodeURIComponent(candidateId)}&limit=1`
    : `hub_id=eq.superuser&order=created_at.desc&limit=1`;
  const candidates = await rest<Row[]>(`platform_release_candidates?select=*&${filter}`);
  const candidate = candidates[0] || null;
  if (!candidate) return { candidate: null, verifications: [], defects: [] };
  const id = String(candidate.id);
  const [verifications, defects] = await Promise.all([
    rest<Row[]>(`platform_release_verifications?select=*&release_candidate_id=eq.${encodeURIComponent(id)}&order=category.asc,test_key.asc`),
    rest<Row[]>(`platform_release_defects?select=*&release_candidate_id=eq.${encodeURIComponent(id)}&order=severity.asc,first_seen_at.desc`),
  ]);
  return { candidate, verifications, defects };
}

function summarize(verifications: Row[], defects: Row[]) {
  const required = verifications.filter(row => row.is_required !== false);
  const pass = required.filter(row => row.result === 'PASS').length;
  const fail = required.filter(row => row.result === 'FAIL').length;
  const blocked = required.filter(row => row.result === 'BLOCKED').length;
  const notRun = required.filter(row => row.result === 'NOT_RUN').length;
  const openDefects = defects.filter(row => ['OPEN', 'IN_PROGRESS', 'RETEST_REQUIRED'].includes(String(row.status))).length;
  return {
    required: required.length,
    pass,
    fail,
    blocked,
    notRun,
    openDefects,
    certificationReady: required.length > 0 && pass === required.length && openDefects === 0,
  };
}

export async function GET(request: NextRequest) {
  try {
    await requireSuperUser(request);
    const candidateId = request.nextUrl.searchParams.get('candidateId');
    const ledger = await readCandidate(candidateId);
    return NextResponse.json({
      ...ledger,
      summary: summarize(ledger.verifications, ledger.defects),
      runtime: runtimeIdentity(),
      generatedAt: new Date().toISOString(),
      source: 'LS1Sports release certification ledger',
    }, { headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' } });
  } catch (error) {
    if (error instanceof SuperUserAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Release ledger unavailable.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireSuperUser(request);
    const body = (await request.json()) as Record<string, unknown>;
    const action = clean(body.action) as ReleaseAction;
    let result: Row | null = null;

    if (action === 'create-candidate') {
      const runtime = runtimeIdentity();
      const commitSha = clean(body.commitSha) || runtime.commitSha || '';
      const branchName = clean(body.branchName) || runtime.branchName || 'superuser-release-candidate';
      const candidateCode = clean(body.candidateCode) || `superuser-${commitSha.slice(0, 12)}`;
      if (!/^[0-9a-f]{7,64}$/i.test(commitSha)) {
        return NextResponse.json({ error: 'A valid deployed commit SHA is required.' }, { status: 400 });
      }
      const rows = await rest<Row[]>('platform_release_candidates', {
        method: 'POST',
        body: JSON.stringify({
          hub_id: 'superuser',
          candidate_code: candidateCode,
          branch_name: branchName,
          commit_sha: commitSha,
          deployment_id: clean(body.deploymentId) || runtime.deploymentId || null,
          deployment_url: clean(body.deploymentUrl) || null,
          status: runtime.deploymentId ? 'DEPLOYED' : 'BUILD_PENDING',
          metadata: { created_from: 'superuser-release-api', runtime_environment: runtime.environment },
        }),
      });
      result = rows[0] || null;
    } else if (action === 'record-verification') {
      const candidateId = clean(body.candidateId);
      const testKey = clean(body.testKey);
      const category = clean(body.category).toUpperCase();
      const expectedResult = clean(body.expectedResult);
      const verificationResult = clean(body.result).toUpperCase();
      if (!candidateId || !testKey || !category || !expectedResult || !verificationResult) {
        return NextResponse.json({ error: 'candidateId, testKey, category, expectedResult, and result are required.' }, { status: 400 });
      }
      const rows = await rest<Row[]>(
        `platform_release_verifications?on_conflict=release_candidate_id,test_key`,
        {
          method: 'POST',
          headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
          body: JSON.stringify({
            release_candidate_id: candidateId,
            test_key: testKey,
            category,
            route_path: clean(body.routePath) || null,
            workflow_key: clean(body.workflowKey) || null,
            expected_result: expectedResult,
            actual_result: clean(body.actualResult) || null,
            result: verificationResult,
            evidence: typeof body.evidence === 'object' && body.evidence ? body.evidence : {},
            tested_by: actor.userId,
            tested_at: new Date().toISOString(),
            resolution_commit_sha: clean(body.resolutionCommitSha) || null,
            retest_result: clean(body.retestResult).toUpperCase() || null,
            is_required: body.isRequired !== false,
            updated_at: new Date().toISOString(),
          }),
        },
      );
      result = rows[0] || null;
    } else if (action === 'record-defect') {
      const candidateId = clean(body.candidateId);
      const defectKey = clean(body.defectKey);
      const severity = clean(body.severity).toUpperCase();
      const title = clean(body.title);
      const status = clean(body.status).toUpperCase() || 'OPEN';
      if (!candidateId || !defectKey || !severity || !title) {
        return NextResponse.json({ error: 'candidateId, defectKey, severity, and title are required.' }, { status: 400 });
      }
      const rows = await rest<Row[]>(
        `platform_release_defects?on_conflict=release_candidate_id,defect_key`,
        {
          method: 'POST',
          headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
          body: JSON.stringify({
            release_candidate_id: candidateId,
            verification_id: clean(body.verificationId) || null,
            defect_key: defectKey,
            severity,
            title,
            description: clean(body.description) || null,
            status,
            last_seen_at: new Date().toISOString(),
            occurrence_count: Number(body.occurrenceCount || 1),
            resolution_commit_sha: clean(body.resolutionCommitSha) || null,
            resolution_notes: clean(body.resolutionNotes) || null,
            evidence: typeof body.evidence === 'object' && body.evidence ? body.evidence : {},
            resolved_at: ['RESOLVED', 'CLOSED'].includes(status) ? new Date().toISOString() : null,
            updated_at: new Date().toISOString(),
          }),
        },
      );
      result = rows[0] || null;
    } else if (action === 'set-deployment') {
      const candidateId = clean(body.candidateId);
      const deploymentId = clean(body.deploymentId);
      if (!candidateId || !deploymentId) return NextResponse.json({ error: 'candidateId and deploymentId are required.' }, { status: 400 });
      const status = clean(body.status).toUpperCase() || 'DEPLOYED';
      const rows = await rest<Row[]>(`platform_release_candidates?id=eq.${encodeURIComponent(candidateId)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          deployment_id: deploymentId,
          deployment_url: clean(body.deploymentUrl) || null,
          status,
          updated_at: new Date().toISOString(),
        }),
      });
      result = rows[0] || null;
    } else if (action === 'certify') {
      const candidateId = clean(body.candidateId);
      if (!candidateId) return NextResponse.json({ error: 'candidateId is required.' }, { status: 400 });
      const rows = await rest<Row[]>(`platform_release_candidates?id=eq.${encodeURIComponent(candidateId)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'CERTIFIED',
          certified_by: actor.userId,
          certification_notes: clean(body.notes) || null,
          updated_at: new Date().toISOString(),
        }),
      });
      result = rows[0] || null;
    } else {
      return NextResponse.json({ error: 'Unknown release action.' }, { status: 400 });
    }

    await writeAuditEvent(actor, {
      action: `SUPERUSER_RELEASE_${action.toUpperCase().replaceAll('-', '_')}`,
      entityType: 'platform_release_candidate',
      entityId: result?.release_candidate_id ? String(result.release_candidate_id) : result?.id ? String(result.id) : clean(body.candidateId) || null,
      afterData: { action, result },
      reason: clean(body.reason) || `Super User release control: ${action}`,
      privileged: true,
    });

    const candidateId = result?.release_candidate_id ? String(result.release_candidate_id) : result?.id ? String(result.id) : clean(body.candidateId);
    const ledger = await readCandidate(candidateId || null);
    return NextResponse.json({ ok: true, result, ...ledger, summary: summarize(ledger.verifications, ledger.defects), runtime: runtimeIdentity() });
  } catch (error) {
    if (error instanceof SuperUserAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Release action failed.' }, { status: 500 });
  }
}
