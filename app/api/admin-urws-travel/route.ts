import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, AdminAuthError } from '@/lib/server/requireAdmin';
import { adminRest } from '@/lib/server/adminRest';
import { writeAdminAuditEvent } from '@/lib/server/writeAdminAuditEvent';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
type Row = Record<string, any>;

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAdmin(request);
    const snapshot = await adminRest<Row>(actor, 'rpc/admin_urws_travel_snapshot', { method: 'POST', body: '{}' });
    return NextResponse.json(snapshot || { plans: [], participants: [] }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Travel URWS context unavailable.' }, { status: error instanceof AdminAuthError ? error.status : 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAdmin(request);
    const body = await request.json() as Row;
    if (String(body.action || '') !== 'request-exception') return NextResponse.json({ error: 'Unsupported travel URWS action.' }, { status: 400 });
    const participantId = String(body.travel_participant_id || '');
    const reasonCode = String(body.reason_code || 'other');
    const summary = String(body.summary || '').trim();
    if (!participantId) return NextResponse.json({ error: 'Travel participant is required.' }, { status: 400 });
    if (summary.length < 8) return NextResponse.json({ error: 'Provide a factual operational summary.' }, { status: 400 });
    const result = await adminRest<Row>(actor, 'rpc/urws_request_travel_commitment_exception', {
      method: 'POST',
      body: JSON.stringify({ p_travel_participant_id: participantId, p_reason_code: reasonCode, p_summary: summary, p_request_key: randomUUID() }),
    });
    await writeAdminAuditEvent(actor, {
      action: 'URWS_TRAVEL_COMMITMENT_EXCEPTION_REQUESTED',
      entityType: 'travel_participant',
      entityId: participantId,
      afterData: { reason_code: reasonCode, case_id: result?.case_id || null, travel_plan_id: result?.travel_plan_id || null },
      reason: 'Operational travel exception routed through URWS',
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Travel URWS action failed.' }, { status: error instanceof AdminAuthError ? error.status : 400 });
  }
}
