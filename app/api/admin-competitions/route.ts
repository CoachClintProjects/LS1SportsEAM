import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, AdminAuthError } from '@/lib/server/requireAdmin';
import { adminRest } from '@/lib/server/adminRest';
import { writeAdminAuditEvent } from '@/lib/server/writeAdminAuditEvent';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Row = Record<string, any>;
const has = (roles: string[], ...wanted: string[]) => wanted.some(role => roles.includes(role));

function canReadCompetition(roles: string[], isSuperUser: boolean) {
  return isSuperUser || has(roles, 'org_admin', 'registrar', 'operations', 'team_engine');
}
function canManageAttendance(roles: string[], isSuperUser: boolean) {
  return isSuperUser || has(roles, 'org_admin', 'registrar', 'operations', 'team_engine');
}
function canManageLogistics(roles: string[], isSuperUser: boolean) {
  return isSuperUser || has(roles, 'org_admin', 'operations', 'team_engine');
}

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAdmin(request);
    if (!canReadCompetition(actor.roles, actor.isSuperUser)) throw new AdminAuthError('Competition operations access is not assigned to this Admin role.', 403);
    const now = new Date().toISOString();
    const competitions = await adminRest<Row[]>(actor,
      `competitions?select=id,tenant_id,organization_id,name,competition_type,starts_at,ends_at,timezone,city,region,country_code,status,sanction_number&or=(starts_at.gte.${encodeURIComponent(now)},starts_at.is.null)&order=starts_at.asc.nullslast&limit=50`
    );
    const ids = competitions.map(row => row.id).filter(Boolean);
    if (!ids.length) return NextResponse.json({ competitions: [], generatedAt: new Date().toISOString(), source: 'LS1SportsEAM Competition Engine · Admin operational projection' }, { headers: { 'Cache-Control': 'no-store' } });
    const inFilter = `in.(${ids.map(encodeURIComponent).join(',')})`;
    const [responses, logistics, deadlines, exceptions, eligibility, vendors] = await Promise.all([
      adminRest<Row[]>(actor, `competition_participation_responses?select=id,competition_id,athlete_id,recipient_person_id,invitation_status,response_status,notified_at,responded_at,reminder_count,last_reminded_at,athlete:athletes(id,person:people(id,first_name,last_name,preferred_name,email))&competition_id=${inFilter}&order=created_at.asc`),
      adminRest<Row[]>(actor, `competition_logistics_requirements?select=id,competition_id,requirement_key,label,requirement_state,fulfillment_status,quantity,vendor_id,due_at,notes,vendor:vendors(id,name)&competition_id=${inFilter}&order=label.asc`),
      adminRest<Row[]>(actor, `competition_deadlines?select=id,competition_id,deadline_type,name,due_at,status&competition_id=${inFilter}&order=due_at.asc`),
      adminRest<Row[]>(actor, `competition_exceptions?select=id,competition_id,exception_code,severity,status,problem,recommended_action&competition_id=${inFilter}&status=neq.resolved&order=created_at.asc`),
      adminRest<Row[]>(actor, `competition_eligibility_decisions?select=id,competition_id,athlete_id,decision,severity,decided_at&competition_id=${inFilter}`),
      adminRest<Row[]>(actor, 'vendors?select=id,name,vendor_category,status&order=name.asc&limit=300'),
    ]);

    const enriched = competitions.map(competition => {
      const participation = responses.filter(row => row.competition_id === competition.id);
      const compLogistics = logistics.filter(row => row.competition_id === competition.id);
      const compEligibility = eligibility.filter(row => row.competition_id === competition.id);
      const going = participation.filter(row => row.response_status === 'going').length;
      const notGoing = participation.filter(row => row.response_status === 'not_going').length;
      const awaiting = participation.filter(row => row.response_status === 'awaiting_response').length;
      const eligible = new Set([
        ...participation.map(row => row.athlete_id),
        ...compEligibility.filter(row => ['eligible','approved','allow','qualified','pass'].includes(String(row.decision || '').toLowerCase())).map(row => row.athlete_id),
      ]).size;
      const unresolvedLogistics = compLogistics.filter(row => row.fulfillment_status === 'unresolved' || row.requirement_state === 'unknown').length;
      return {
        ...competition,
        attendance: { eligible, going, notGoing, awaiting },
        participation,
        logistics: compLogistics,
        deadlines: deadlines.filter(row => row.competition_id === competition.id),
        exceptions: exceptions.filter(row => row.competition_id === competition.id),
        eligibilityDecisionCount: compEligibility.length,
        unresolvedLogistics,
      };
    });

    return NextResponse.json({
      competitions: enriched,
      vendors,
      actor: { roles: actor.roles, isSuperUser: actor.isSuperUser, canManageAttendance: canManageAttendance(actor.roles, actor.isSuperUser), canManageLogistics: canManageLogistics(actor.roles, actor.isSuperUser) },
      generatedAt: new Date().toISOString(),
      source: 'LS1SportsEAM Competition Engine · Admin operational projection',
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof AdminAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Competition operations are unavailable.' }, { status: 500 });
  }
}

async function competitionFor(actor: Awaited<ReturnType<typeof requireAdmin>>, id: string) {
  const rows = await adminRest<Row[]>(actor, `competitions?id=eq.${encodeURIComponent(id)}&select=id,tenant_id,organization_id,name&limit=1`);
  return rows?.[0] || null;
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAdmin(request);
    const body = await request.json();
    const action = String(body.action || '');
    const competitionId = String(body.competitionId || '');
    if (!competitionId) return NextResponse.json({ error: 'Competition is required.' }, { status: 400 });
    const competition = await competitionFor(actor, competitionId);
    if (!competition) return NextResponse.json({ error: 'Competition is outside your authorized scope.' }, { status: 404 });

    if (action === 'sync-eligible') {
      if (!canManageAttendance(actor.roles, actor.isSuperUser)) throw new AdminAuthError('Attendance management permission is required.', 403);
      const decisions = await adminRest<Row[]>(actor, `competition_eligibility_decisions?competition_id=eq.${encodeURIComponent(competitionId)}&select=id,athlete_id,decision,decided_at&order=decided_at.desc`);
      const accepted = new Map<string, Row>();
      for (const decision of decisions) {
        const normalized = String(decision.decision || '').toLowerCase();
        if (!accepted.has(decision.athlete_id) && ['eligible','approved','allow','qualified','pass'].includes(normalized)) accepted.set(decision.athlete_id, decision);
      }
      const athleteIds = [...accepted.keys()];
      let peopleByAthlete = new Map<string, string | null>();
      if (athleteIds.length) {
        const athletes = await adminRest<Row[]>(actor, `athletes?id=in.(${athleteIds.map(encodeURIComponent).join(',')})&select=id,person_id`);
        peopleByAthlete = new Map(athletes.map(row => [row.id, row.person_id || null]));
      }
      const existing = await adminRest<Row[]>(actor, `competition_participation_responses?competition_id=eq.${encodeURIComponent(competitionId)}&select=athlete_id`);
      const existingIds = new Set(existing.map(row => row.athlete_id));
      const rows = athleteIds.filter(id => !existingIds.has(id)).map(athleteId => ({
        tenant_id: competition.tenant_id,
        organization_id: competition.organization_id,
        competition_id: competitionId,
        athlete_id: athleteId,
        eligibility_decision_id: accepted.get(athleteId)?.id || null,
        recipient_person_id: peopleByAthlete.get(athleteId) || null,
        invitation_status: 'eligible',
        response_status: 'awaiting_response',
        metadata: { source: 'competition_eligibility_decisions', synced_by_admin: true },
      }));
      if (rows.length) await adminRest(actor, 'competition_participation_responses', { method: 'POST', body: JSON.stringify(rows) });
      await writeAdminAuditEvent(actor, { action: 'ADMIN_COMPETITION_ELIGIBILITY_SYNCED', entityType: 'competition', entityId: competitionId, tenantId: competition.tenant_id, afterData: { competition_name: competition.name, eligible_decisions: athleteIds.length, participation_rows_created: rows.length }, reason: 'Admin synchronized authoritative Competition Engine eligibility decisions into attendance-response tracking.' });
      return NextResponse.json({ ok: true, eligible: athleteIds.length, created: rows.length });
    }

    if (action === 'set-response') {
      if (!canManageAttendance(actor.roles, actor.isSuperUser)) throw new AdminAuthError('Attendance management permission is required.', 403);
      const responseId = String(body.responseId || '');
      const responseStatus = String(body.responseStatus || '');
      if (!responseId || !['awaiting_response','going','not_going'].includes(responseStatus)) return NextResponse.json({ error: 'A valid participation response and status are required.' }, { status: 400 });
      const before = (await adminRest<Row[]>(actor, `competition_participation_responses?id=eq.${encodeURIComponent(responseId)}&competition_id=eq.${encodeURIComponent(competitionId)}&select=*&limit=1`))?.[0];
      if (!before) return NextResponse.json({ error: 'Participation response was not found.' }, { status: 404 });
      const rows = await adminRest<Row[]>(actor, `competition_participation_responses?id=eq.${encodeURIComponent(responseId)}`, { method: 'PATCH', body: JSON.stringify({ response_status: responseStatus, responded_at: responseStatus === 'awaiting_response' ? null : new Date().toISOString(), updated_at: new Date().toISOString() }) });
      await writeAdminAuditEvent(actor, { action: 'ADMIN_COMPETITION_RESPONSE_UPDATED', entityType: 'competition_participation_response', entityId: responseId, tenantId: competition.tenant_id, beforeData: before, afterData: rows?.[0] || { response_status: responseStatus }, reason: 'Admin recorded athlete participation response.' });
      return NextResponse.json({ ok: true, row: rows?.[0] || null });
    }

    if (action === 'send-reminders') {
      if (!canManageAttendance(actor.roles, actor.isSuperUser)) throw new AdminAuthError('Attendance management permission is required.', 403);
      const awaiting = await adminRest<Row[]>(actor, `competition_participation_responses?competition_id=eq.${encodeURIComponent(competitionId)}&response_status=eq.awaiting_response&select=id,recipient_person_id,reminder_count`);
      const deliverable = awaiting.filter(row => row.recipient_person_id);
      if (deliverable.length) {
        await adminRest(actor, 'notification_events', { method: 'POST', body: JSON.stringify(deliverable.map(row => ({ tenant_id: competition.tenant_id, recipient_person_id: row.recipient_person_id, event_type: 'COMPETITION_RESPONSE_REMINDER', title: `Response needed: ${competition.name}`, body: 'Please confirm whether you are going or not going. No additional response detail is required.', priority: 'normal' }))) });
        for (const row of deliverable) await adminRest(actor, `competition_participation_responses?id=eq.${encodeURIComponent(row.id)}`, { method: 'PATCH', body: JSON.stringify({ invitation_status: 'notified', notified_at: new Date().toISOString(), reminder_count: Number(row.reminder_count || 0) + 1, last_reminded_at: new Date().toISOString(), updated_at: new Date().toISOString() }) });
      }
      await writeAdminAuditEvent(actor, { action: 'ADMIN_COMPETITION_REMINDERS_SENT', entityType: 'competition', entityId: competitionId, tenantId: competition.tenant_id, afterData: { competition_name: competition.name, awaiting: awaiting.length, delivered_in_app: deliverable.length, missing_recipient: awaiting.length - deliverable.length }, reason: 'Admin sent auditable in-app reminders to nonresponders.' });
      return NextResponse.json({ ok: true, awaiting: awaiting.length, delivered: deliverable.length, missingRecipient: awaiting.length - deliverable.length });
    }

    if (action === 'update-logistics') {
      if (!canManageLogistics(actor.roles, actor.isSuperUser)) throw new AdminAuthError('Competition logistics management permission is required.', 403);
      const requirementId = String(body.requirementId || '');
      if (!requirementId) return NextResponse.json({ error: 'Logistics requirement is required.' }, { status: 400 });
      const before = (await adminRest<Row[]>(actor, `competition_logistics_requirements?id=eq.${encodeURIComponent(requirementId)}&competition_id=eq.${encodeURIComponent(competitionId)}&select=*&limit=1`))?.[0];
      if (!before) return NextResponse.json({ error: 'Logistics requirement was not found.' }, { status: 404 });
      const patch: Row = { updated_at: new Date().toISOString() };
      if (body.requirementState !== undefined) patch.requirement_state = String(body.requirementState);
      if (body.fulfillmentStatus !== undefined) patch.fulfillment_status = String(body.fulfillmentStatus);
      if (body.vendorId !== undefined) patch.vendor_id = body.vendorId || null;
      if (body.notes !== undefined) patch.notes = String(body.notes || '') || null;
      const rows = await adminRest<Row[]>(actor, `competition_logistics_requirements?id=eq.${encodeURIComponent(requirementId)}`, { method: 'PATCH', body: JSON.stringify(patch) });
      await writeAdminAuditEvent(actor, { action: 'ADMIN_COMPETITION_LOGISTICS_UPDATED', entityType: 'competition_logistics_requirement', entityId: requirementId, tenantId: competition.tenant_id, beforeData: before, afterData: rows?.[0] || patch, reason: 'Admin updated an open-water/event logistics requirement.' });
      return NextResponse.json({ ok: true, row: rows?.[0] || null });
    }

    return NextResponse.json({ error: 'Unsupported competition action.' }, { status: 400 });
  } catch (error) {
    if (error instanceof AdminAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Competition action failed.' }, { status: 400 });
  }
}
