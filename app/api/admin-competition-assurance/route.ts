import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, AdminAuthError } from '@/lib/server/requireAdmin';
import { adminRest } from '@/lib/server/adminRest';
import { writeAdminAuditEvent } from '@/lib/server/writeAdminAuditEvent';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
type Row = Record<string, any>;
const allowedEligible = new Set(['eligible','approved','allow','qualified','pass']);

async function competitionFor(actor: Awaited<ReturnType<typeof requireAdmin>>, id: string) {
  return (await adminRest<Row[]>(actor, `competitions?id=eq.${encodeURIComponent(id)}&select=id,tenant_id,organization_id,name&limit=1`))?.[0] || null;
}

function issueFor(response: Row | undefined, assurance: Row | undefined) {
  const commitment = response?.response_status || 'no_response_record';
  const entry = assurance?.entry_state || 'not_prepared';
  if (commitment === 'going' && entry === 'not_prepared') return { code: 'GOING_NOT_PREPARED', severity: 'critical', message: 'Athlete said Going but no entry has been prepared.' };
  if (commitment === 'going' && entry === 'prepared') return { code: 'GOING_NOT_SUBMITTED', severity: 'critical', message: 'Athlete said Going and an entry is prepared, but submission is not recorded.' };
  if (commitment === 'going' && entry === 'submitted') return { code: 'SUBMITTED_NOT_VERIFIED', severity: 'critical', message: 'Entry is recorded as submitted but has not been verified.' };
  if (commitment === 'not_going' && ['prepared','submitted','verified'].includes(entry)) return { code: 'DECLINED_BUT_ENTRY_EXISTS', severity: 'critical', message: 'Athlete is Not Going but an entry still exists.' };
  if (commitment !== 'going' && ['submitted','verified'].includes(entry)) return { code: 'ENTRY_WITHOUT_COMMITMENT', severity: 'critical', message: 'Entry exists without a Going commitment.' };
  if (assurance?.clearance_state === 'manual_override') return { code: 'MANUAL_OVERRIDE', severity: 'warning', message: 'Attendance clearance is based on a manual override.' };
  return null;
}

async function snapshot(actor: Awaited<ReturnType<typeof requireAdmin>>, competitionId: string) {
  const competition = await competitionFor(actor, competitionId);
  if (!competition) throw new AdminAuthError('Competition is outside your authorized scope.', 404);
  const [responses, eligibility, events, assurance, attempts] = await Promise.all([
    adminRest<Row[]>(actor, `competition_participation_responses?competition_id=eq.${encodeURIComponent(competitionId)}&select=id,competition_id,athlete_id,recipient_person_id,response_status,invitation_status,reminder_count,notified_at,responded_at,athlete:athletes(id,person:people(id,first_name,last_name,preferred_name,email,phone))&order=created_at.asc`),
    adminRest<Row[]>(actor, `competition_eligibility_decisions?competition_id=eq.${encodeURIComponent(competitionId)}&select=id,athlete_id,decision,decided_at&order=decided_at.desc`),
    adminRest<Row[]>(actor, `competition_events?competition_id=eq.${encodeURIComponent(competitionId)}&select=id`),
    adminRest<Row[]>(actor, `competition_entry_assurance?competition_id=eq.${encodeURIComponent(competitionId)}&select=*&order=created_at.asc`),
    adminRest<Row[]>(actor, `competition_communication_attempts?competition_id=eq.${encodeURIComponent(competitionId)}&select=id,athlete_id,recipient_person_id,channel,purpose,destination_hint,delivery_state,attempted_at,delivered_at,read_at,failed_at,failure_reason&order=attempted_at.desc&limit=200`),
  ]);
  const eventIds = events.map(row => row.id).filter(Boolean);
  const entries = eventIds.length ? await adminRest<Row[]>(actor, `competition_entries?competition_event_id=in.(${eventIds.map(encodeURIComponent).join(',')})&select=id,competition_event_id,athlete_id,entry_status,eligibility_status,scratch_status`) : [];
  const preparedAthletes = new Set(entries.filter(row => row.athlete_id && String(row.entry_status || '').toLowerCase() !== 'scratched').map(row => row.athlete_id));
  const latestEligibility = new Map<string, Row>();
  for (const row of eligibility) if (row.athlete_id && !latestEligibility.has(row.athlete_id)) latestEligibility.set(row.athlete_id, row);
  const eligibleAthletes = new Set([...latestEligibility.entries()].filter(([,row]) => allowedEligible.has(String(row.decision || '').toLowerCase())).map(([id]) => id));
  const responseByAthlete = new Map(responses.map(row => [row.athlete_id, row]));
  const assuranceByAthlete = new Map(assurance.map(row => [row.athlete_id, row]));
  const athleteIds = new Set([...eligibleAthletes, ...responseByAthlete.keys(), ...assuranceByAthlete.keys(), ...preparedAthletes]);
  const rows = [...athleteIds].map(athleteId => {
    const response = responseByAthlete.get(athleteId);
    const record = assuranceByAthlete.get(athleteId);
    const issue = issueFor(response, record);
    return { athleteId, eligible: eligibleAthletes.has(athleteId), response, assurance: record || null, hasPreparedEntries: preparedAthletes.has(athleteId), eventEntryCount: entries.filter(row => row.athlete_id === athleteId).length, issue };
  });
  const metrics = {
    eligible: rows.filter(r => r.eligible).length,
    going: rows.filter(r => r.response?.response_status === 'going').length,
    noResponse: rows.filter(r => r.eligible && (!r.response || r.response?.response_status === 'awaiting_response')).length,
    notGoing: rows.filter(r => r.response?.response_status === 'not_going').length,
    prepared: rows.filter(r => r.assurance?.entry_state === 'prepared' || r.hasPreparedEntries).length,
    submitted: rows.filter(r => r.assurance?.entry_state === 'submitted').length,
    verified: rows.filter(r => r.assurance?.entry_state === 'verified').length,
    cleared: rows.filter(r => ['cleared','manual_override'].includes(r.assurance?.clearance_state)).length,
    critical: rows.filter(r => r.issue?.severity === 'critical').length,
  };
  return { competition, rows, attempts, metrics };
}

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAdmin(request);
    const competitionId = request.nextUrl.searchParams.get('competitionId') || '';
    if (!competitionId) return NextResponse.json({ error: 'competitionId is required.' }, { status: 400 });
    const data = await snapshot(actor, competitionId);
    return NextResponse.json({ ...data, generatedAt: new Date().toISOString(), source: 'LS1SportsEAM Competition Commitment & Entry Assurance' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof AdminAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Entry assurance is unavailable.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAdmin(request);
    const body = await request.json();
    const competitionId = String(body.competitionId || '');
    const action = String(body.action || '');
    const competition = await competitionFor(actor, competitionId);
    if (!competition) throw new AdminAuthError('Competition is outside your authorized scope.', 404);

    if (action === 'reconcile') {
      const data = await snapshot(actor, competitionId);
      const existing = new Map(data.rows.filter(r => r.assurance).map(r => [r.athleteId, r.assurance]));
      const inserts = data.rows.filter(r => !existing.has(r.athleteId)).map(r => ({ tenant_id: competition.tenant_id, organization_id: competition.organization_id, competition_id: competitionId, athlete_id: r.athleteId, entry_state: r.hasPreparedEntries ? 'prepared' : 'not_prepared', clearance_state: 'not_cleared', mismatch_code: r.issue?.code || null, mismatch_detail: r.issue?.message || null, last_reconciled_at: new Date().toISOString(), evidence: { competition_entries_detected: r.eventEntryCount } }));
      if (inserts.length) await adminRest(actor, 'competition_entry_assurance', { method: 'POST', body: JSON.stringify(inserts) });
      for (const row of data.rows.filter(r => existing.has(r.athleteId))) {
        const current = existing.get(row.athleteId)!;
        const patch: Row = { mismatch_code: row.issue?.code || null, mismatch_detail: row.issue?.message || null, last_reconciled_at: new Date().toISOString(), updated_at: new Date().toISOString() };
        if (current.entry_state === 'not_prepared' && row.hasPreparedEntries) patch.entry_state = 'prepared';
        await adminRest(actor, `competition_entry_assurance?id=eq.${encodeURIComponent(current.id)}`, { method: 'PATCH', body: JSON.stringify(patch) });
      }
      await writeAdminAuditEvent(actor, { action: 'ADMIN_COMPETITION_ENTRY_RECONCILED', entityType: 'competition', entityId: competitionId, tenantId: competition.tenant_id, afterData: { competition_name: competition.name, athletes_checked: data.rows.length, new_assurance_rows: inserts.length, critical_issues: data.metrics.critical }, reason: 'Reconciled commitment, eligibility, prepared entries and entry assurance evidence.' });
      return NextResponse.json({ ok: true, created: inserts.length, checked: data.rows.length, critical: data.metrics.critical });
    }

    if (action === 'set-entry-state') {
      const athleteId = String(body.athleteId || '');
      const entryState = String(body.entryState || '');
      if (!athleteId || !['not_prepared','prepared','submitted','verified','rejected','scratched'].includes(entryState)) return NextResponse.json({ error: 'Valid athleteId and entryState are required.' }, { status: 400 });
      const current = (await adminRest<Row[]>(actor, `competition_entry_assurance?competition_id=eq.${encodeURIComponent(competitionId)}&athlete_id=eq.${encodeURIComponent(athleteId)}&select=*&limit=1`))?.[0];
      const now = new Date().toISOString();
      const evidence = body.evidence && typeof body.evidence === 'object' ? body.evidence : {};
      if (entryState === 'submitted' && !body.externalReference && !body.submissionArtifactId && !Object.keys(evidence).length) return NextResponse.json({ error: 'Submitted requires evidence: external reference, submission artifact, or evidence payload.' }, { status: 400 });
      if (entryState === 'verified' && (!String(body.verificationMethod || '').trim() || (!body.externalReference && !Object.keys(evidence).length))) return NextResponse.json({ error: 'Verified requires a verification method plus authoritative evidence/reference.' }, { status: 400 });
      const payload: Row = { tenant_id: competition.tenant_id, organization_id: competition.organization_id, competition_id: competitionId, athlete_id: athleteId, entry_state: entryState, clearance_state: entryState === 'verified' ? 'cleared' : 'not_cleared', external_reference: body.externalReference || null, submission_artifact_id: body.submissionArtifactId || null, verification_method: body.verificationMethod || null, evidence, submitted_at: ['submitted','verified'].includes(entryState) ? (current?.submitted_at || now) : null, verified_at: entryState === 'verified' ? now : null, mismatch_code: null, mismatch_detail: null, last_reconciled_at: now, updated_at: now };
      let row: Row | null = null;
      if (current) row = (await adminRest<Row[]>(actor, `competition_entry_assurance?id=eq.${encodeURIComponent(current.id)}`, { method: 'PATCH', body: JSON.stringify(payload) }))?.[0] || null;
      else row = (await adminRest<Row[]>(actor, 'competition_entry_assurance', { method: 'POST', body: JSON.stringify(payload) }))?.[0] || null;
      await writeAdminAuditEvent(actor, { action: 'ADMIN_COMPETITION_ENTRY_STATE_UPDATED', entityType: 'competition_entry_assurance', entityId: row?.id || current?.id || null, tenantId: competition.tenant_id, beforeData: current || null, afterData: row || payload, reason: 'Admin updated competition entry assurance with evidence requirements.' });
      return NextResponse.json({ ok: true, row });
    }

    if (action === 'manual-override') {
      const athleteId = String(body.athleteId || '');
      const reason = String(body.reason || '').trim();
      if (!athleteId || reason.length < 8) return NextResponse.json({ error: 'Manual override requires an athlete and a meaningful reason.' }, { status: 400 });
      const current = (await adminRest<Row[]>(actor, `competition_entry_assurance?competition_id=eq.${encodeURIComponent(competitionId)}&athlete_id=eq.${encodeURIComponent(athleteId)}&select=*&limit=1`))?.[0];
      if (!current) return NextResponse.json({ error: 'Reconcile the competition before using an override.' }, { status: 409 });
      const patch = { clearance_state: 'manual_override', manual_override_reason: reason, manual_override_by: actor.personId, updated_at: new Date().toISOString() };
      const row = (await adminRest<Row[]>(actor, `competition_entry_assurance?id=eq.${encodeURIComponent(current.id)}`, { method: 'PATCH', body: JSON.stringify(patch) }))?.[0] || null;
      await writeAdminAuditEvent(actor, { action: 'ADMIN_COMPETITION_ENTRY_OVERRIDE', entityType: 'competition_entry_assurance', entityId: current.id, tenantId: competition.tenant_id, beforeData: current, afterData: row || patch, reason });
      return NextResponse.json({ ok: true, row });
    }

    if (action === 'remind-nonresponders') {
      const data = await snapshot(actor, competitionId);
      const pending = data.rows.filter(r => r.eligible && (!r.response || r.response?.response_status === 'awaiting_response'));
      const deliverable = pending.flatMap(r => {
        const response = r.response;
        if (!response?.recipient_person_id) return [];
        return [{ ...r, response }];
      });
      if (deliverable.length) {
        await adminRest(actor, 'notification_events', { method: 'POST', body: JSON.stringify(deliverable.map(r => ({ tenant_id: competition.tenant_id, recipient_person_id: r.response.recipient_person_id, event_type: 'COMPETITION_RESPONSE_REMINDER', title: `Response needed: ${competition.name}`, body: 'Please confirm Going or Not Going. A Going response is not an entry confirmation; LS1Sports will confirm entry separately after verification.', priority: 'high' }))) });
        await adminRest(actor, 'competition_communication_attempts', { method: 'POST', body: JSON.stringify(deliverable.map(r => ({ tenant_id: competition.tenant_id, organization_id: competition.organization_id, competition_id: competitionId, athlete_id: r.athleteId, recipient_person_id: r.response.recipient_person_id, participation_response_id: r.response.id, channel: 'in_app', purpose: 'competition_response_reminder', destination_hint: 'LS1Sports in-app', delivery_state: 'accepted', accepted_at: new Date().toISOString() }))) });
      }
      await writeAdminAuditEvent(actor, { action: 'ADMIN_COMPETITION_NONRESPONDER_FOLLOWUP', entityType: 'competition', entityId: competitionId, tenantId: competition.tenant_id, afterData: { pending: pending.length, accepted_in_app: deliverable.length, external_email_sms_phone_connected: false }, reason: 'Followed up with nonresponders using only the currently authoritative connected channel.' });
      return NextResponse.json({ ok: true, pending: pending.length, delivered: deliverable.length, externalChannelsConnected: false });
    }

    return NextResponse.json({ error: 'Unsupported assurance action.' }, { status: 400 });
  } catch (error) {
    if (error instanceof AdminAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Entry assurance action failed.' }, { status: 400 });
  }
}
