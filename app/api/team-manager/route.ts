import { NextRequest, NextResponse } from 'next/server';
import { authorizeRequest, authorizationFailure, type AuthorizationContext } from '@/lib/server/authorization';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Row = Record<string, any>;

function serviceHeaders(prefer = 'return=representation') {
  if (!KEY) throw new Error('Supabase service credentials are not configured.');
  return { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: prefer };
}

async function rest(path: string, init: RequestInit = {}, prefer = 'return=representation') {
  if (!URL || !KEY) throw new Error('Supabase service credentials are not configured.');
  const response = await fetch(`${URL}/rest/v1/${path}`, {
    ...init,
    headers: { ...serviceHeaders(prefer), ...(init.headers || {}) },
    cache: 'no-store',
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Supabase ${path} returned ${response.status}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : null;
}

async function audit(auth: AuthorizationContext, args: { tenantId?: string | null; action: string; entityType: string; entityId?: string | null; before?: unknown; after?: unknown; reason?: string }) {
  try {
    await rest('audit_events', {
      method: 'POST',
      body: JSON.stringify({
        tenant_id: args.tenantId || null,
        actor_person_id: auth.personId || null,
        action: args.action,
        entity_type: args.entityType,
        entity_id: args.entityId || null,
        before_data: args.before ?? null,
        after_data: args.after ?? null,
        reason: args.reason || 'Team Manager workspace',
        privileged: auth.superuser,
      }),
    });
  } catch (error) {
    console.error('[team-manager] audit write failed', error);
  }
}

async function teamContext(id: string) {
  const team = (await rest(`teams?select=id,organization_id,sport_id,program_id,season_id,code,name,competitive_level,status&id=eq.${encodeURIComponent(id)}&limit=1`))?.[0] || null;
  if (!team) throw new Error('Team not found.');
  const organization = (await rest(`organizations?select=id,tenant_id,name&id=eq.${encodeURIComponent(team.organization_id)}&limit=1`))?.[0] || null;
  if (!organization) throw new Error('Team organization not found.');
  return { team, organization };
}

async function registrationContext(id: string) {
  const registration = (await rest(`registrations?select=id,organization_id,athlete_id,season_id,program_id,status,submitted_at,approved_at,metadata&id=eq.${encodeURIComponent(id)}&limit=1`))?.[0] || null;
  if (!registration) throw new Error('Registration not found.');
  const organization = (await rest(`organizations?select=id,tenant_id,name&id=eq.${encodeURIComponent(registration.organization_id)}&limit=1`))?.[0] || null;
  return { registration, organization };
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function distinct(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function filterByScope(auth: AuthorizationContext, teams: Row[]) {
  if (auth.superuser) return teams;
  return teams.filter((team) => auth.teamIds.includes(team.id) || auth.organizationIds.includes(team.organization_id));
}

async function authorizeOptional(request: NextRequest, permission: string) {
  try {
    return await authorizeRequest(request, { permission });
  } catch {
    return null;
  }
}

async function communicationRecipients(teamId: string) {
  const memberships: Row[] = await rest(`team_memberships?select=athlete_id,person_id,status&team_id=eq.${encodeURIComponent(teamId)}&status=eq.active&limit=1000`);
  const athleteIds = distinct(memberships.map((row) => row.athlete_id));
  const directPeople = distinct(memberships.map((row) => row.person_id));
  const athletes: Row[] = athleteIds.length
    ? await rest(`athletes?select=id,person_id,primary_family_id&id=in.(${athleteIds.join(',')})&limit=1000`)
    : [];
  const athletePeople = distinct(athletes.map((row) => row.person_id));
  const familyIds = distinct(athletes.map((row) => row.primary_family_id));
  const familyMembers: Row[] = familyIds.length
    ? await rest(`family_members?select=family_id,person_id,is_primary_guardian,can_view_minor_data&family_id=in.(${familyIds.join(',')})&can_view_minor_data=eq.true&limit=2000`)
    : [];
  return {
    allowed: new Set([...directPeople, ...athletePeople, ...familyMembers.map((row) => row.person_id)]),
    athletePersonToFamily: new Map(athletes.filter((row) => row.person_id && row.primary_family_id).map((row) => [row.person_id, row.primary_family_id])),
    guardiansByFamily: new Map(familyIds.map((familyId) => [familyId, familyMembers.filter((row) => row.family_id === familyId && row.is_primary_guardian).map((row) => row.person_id)])),
  };
}

async function assertMinorSafeRecipients(teamId: string, personIds: string[]) {
  const recipientModel = await communicationRecipients(teamId);
  for (const personId of personIds) {
    if (!recipientModel.allowed.has(personId)) throw new Error('Communication recipient is outside the canonical team/family relationship scope.');
  }
  if (!personIds.length) return;
  const people: Row[] = await rest(`people?select=id,birth_date&id=in.(${personIds.join(',')})&limit=1000`);
  const now = new Date();
  for (const person of people) {
    if (!person.birth_date) continue;
    const dob = new Date(`${person.birth_date}T00:00:00Z`);
    const age = now.getUTCFullYear() - dob.getUTCFullYear() - (now < new Date(Date.UTC(now.getUTCFullYear(), dob.getUTCMonth(), dob.getUTCDate())) ? 1 : 0);
    if (age >= 18) continue;
    const familyId = recipientModel.athletePersonToFamily.get(person.id);
    if (!familyId) throw new Error('Direct communication to a minor is blocked because no canonical guardian relationship is available.');
    const guardians = recipientModel.guardiansByFamily.get(familyId) || [];
    if (!guardians.some((guardianId) => personIds.includes(guardianId))) {
      throw new Error('Direct communication to a minor requires an authorized guardian on the same thread.');
    }
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await authorizeRequest(request, { permission: 'teams.read' });
    const [canRoster, canRegistration, canAttendance, canTraining, canCommunication, canWaiver, canCompetition] = await Promise.all([
      authorizeOptional(request, 'rosters.read'),
      authorizeOptional(request, 'registrations.read'),
      authorizeOptional(request, 'attendance.read'),
      authorizeOptional(request, 'training.read'),
      authorizeOptional(request, 'communications.read'),
      authorizeOptional(request, 'waivers.read'),
      authorizeOptional(request, 'competition_entries.read'),
    ]);

    const allTeams: Row[] = await rest('teams?select=id,organization_id,sport_id,program_id,season_id,code,name,competitive_level,status&order=name.asc&limit=500');
    const teams = filterByScope(auth, allTeams);
    const teamIds = distinct(teams.map((row) => row.id));
    const orgIds = distinct(teams.map((row) => row.organization_id));
    const teamFilter = teamIds.length ? `(${teamIds.join(',')})` : '(00000000-0000-0000-0000-000000000000)';
    const orgFilter = orgIds.length ? `(${orgIds.join(',')})` : '(00000000-0000-0000-0000-000000000000)';

    const [organizations, programs, seasons, groups, memberships, registrations, attendanceSessions, trainingPlans, trainingSessions, communicationThreads, waiverAssignments, waivers, entryBatches, entries, scratches, competitions, competitionEvents, approvals] = await Promise.all([
      rest(`organizations?select=id,tenant_id,code,name,status&id=in.${orgFilter}&order=name.asc`),
      rest(`programs?select=id,organization_id,sport_id,code,name,program_type,status&organization_id=in.${orgFilter}&order=name.asc&limit=500`),
      rest(`seasons?select=id,organization_id,sport_id,code,name,starts_on,ends_on,status&organization_id=in.${orgFilter}&order=starts_on.desc&limit=500`),
      rest(`groups?select=id,team_id,program_id,code,name,group_type,status&team_id=in.${teamFilter}&order=name.asc&limit=500`),
      canRoster ? rest(`team_memberships?select=id,team_id,athlete_id,person_id,membership_type,starts_on,ends_on,status,jersey_number,notes&team_id=in.${teamFilter}&limit=2000`) : Promise.resolve([]),
      canRegistration ? rest(`registrations?select=id,organization_id,athlete_id,season_id,program_id,submitted_at,approved_at,status,source,metadata&organization_id=in.${orgFilter}&order=submitted_at.desc&limit=1000`) : Promise.resolve([]),
      canAttendance ? rest(`attendance_sessions?select=id,team_id,group_id,event_id,session_date,start_time,end_time,session_type,status&team_id=in.${teamFilter}&order=session_date.desc&limit=500`) : Promise.resolve([]),
      canTraining ? rest(`training_plans?select=id,team_id,season_id,name,plan_type,starts_on,ends_on,status,created_by&team_id=in.${teamFilter}&order=starts_on.desc&limit=500`) : Promise.resolve([]),
      canTraining ? rest('training_sessions?select=id,training_plan_id,attendance_session_id,title,session_type,total_load,total_distance,distance_unit,workout_definition&limit=1000') : Promise.resolve([]),
      canCommunication ? rest(`communication_threads?select=id,tenant_id,organization_id,team_id,thread_type,title,minor_safe_mode,status,created_by,created_at&team_id=in.${teamFilter}&order=created_at.desc&limit=500`) : Promise.resolve([]),
      canWaiver ? rest(`waiver_assignments?select=id,tenant_id,organization_id,waiver_id,person_id,athlete_id,registration_id,team_id,status,assigned_by,assigned_at,due_at,completed_at,waived_at,reason,metadata&organization_id=in.${orgFilter}&order=assigned_at.desc&limit=1000`) : Promise.resolve([]),
      canWaiver ? rest(`waivers?select=id,organization_id,code,name,version,required_for,effective_from,effective_to,status&organization_id=in.${orgFilter}&order=name.asc&limit=500`) : Promise.resolve([]),
      canCompetition ? rest(`competition_entry_batches?select=id,competition_id,tenant_id,organization_id,batch_code,status,submitted_at,locked_at,submitted_by,summary&organization_id=in.${orgFilter}&order=created_at.desc&limit=500`) : Promise.resolve([]),
      canCompetition ? rest(`competition_entries?select=id,competition_event_id,athlete_id,team_id,seed_value,seed_unit,entry_status,eligibility_status,scratch_status&team_id=in.${teamFilter}&limit=2000`) : Promise.resolve([]),
      canCompetition ? rest(`competition_scratches?select=id,competition_id,competition_entry_id,athlete_id,reason_code,reason_text,status,requested_by,requested_at,approved_by,approved_at&limit=1000`) : Promise.resolve([]),
      canCompetition ? rest('competitions?select=id,organization_id,code,name,status,start_date,end_date&order=start_date.desc&limit=500').catch(() => []) : Promise.resolve([]),
      canCompetition ? rest('competition_events?select=id,competition_id,session_id,code,name,sequence_no,event_definition&limit=2000') : Promise.resolve([]),
      canRegistration ? rest(`approvals?select=id,tenant_id,entity_type,entity_id,requested_by,approver_person_id,approval_type,status,requested_at,decided_at,decision_note&entity_type=eq.registrations&limit=1000`) : Promise.resolve([]),
    ]);

    const rosterAthleteIds = distinct((memberships as Row[]).map((row) => row.athlete_id));
    const registrationAthleteIds = distinct((registrations as Row[]).map((row) => row.athlete_id));
    const athleteIds = distinct([...rosterAthleteIds, ...registrationAthleteIds]);
    const athletes: Row[] = athleteIds.length ? await rest(`athletes?select=id,person_id,athlete_number,athlete_status,status,primary_family_id,privacy_level&id=in.(${athleteIds.join(',')})&limit=3000`) : [];
    const personIds = distinct(athletes.map((row) => row.person_id).concat((memberships as Row[]).map((row) => row.person_id)));
    const people: Row[] = personIds.length ? await rest(`people?select=id,first_name,last_name,preferred_name,birth_date,email,phone,status,privacy_classification&id=in.(${personIds.join(',')})&limit=3000`) : [];
    const groupMemberships: Row[] = canRoster && groups.length ? await rest(`group_memberships?select=group_id,athlete_id,starts_on,ends_on,status&group_id=in.(${groups.map((row: Row) => row.id).join(',')})&limit=2000`) : [];
    const attendanceRecords: Row[] = canAttendance && attendanceSessions.length ? await rest(`attendance_records?select=id,session_id,athlete_id,status,check_in_at,check_out_at,note&session_id=in.(${attendanceSessions.map((row: Row) => row.id).join(',')})&limit=3000`) : [];
    const eligibilityRecords: Row[] = canRegistration && athleteIds.length ? await rest(`eligibility_records?select=id,athlete_id,rule_id,competition_id,status,evaluated_at,reason,expires_at&athlete_id=in.(${athleteIds.join(',')})&order=evaluated_at.desc&limit=2000`) : [];

    return NextResponse.json({
      teams,
      organizations,
      programs,
      seasons,
      groups,
      memberships,
      groupMemberships,
      athletes,
      people,
      registrations,
      eligibilityRecords,
      attendanceSessions,
      attendanceRecords,
      trainingPlans,
      trainingSessions,
      communicationThreads,
      waiverAssignments,
      waivers,
      entryBatches,
      competitionEntries: entries,
      competitionScratches: scratches,
      competitions,
      competitionEvents,
      approvals,
      capabilities: {
        roster: Boolean(canRoster), registration: Boolean(canRegistration), attendance: Boolean(canAttendance), training: Boolean(canTraining), communication: Boolean(canCommunication), waiver: Boolean(canWaiver), competition: Boolean(canCompetition),
        roles: auth.roleCodes, superuser: auth.superuser,
      },
      generatedAt: new Date().toISOString(),
      source: 'LS1SportsEAM Supabase',
    });
  } catch (error) {
    const auth = authorizationFailure(error);
    if (auth) return NextResponse.json(auth.body, { status: auth.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Team Manager data unavailable.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Row;
    const action = String(body.action || '');

    if (action === 'create-team') {
      const organizationId = String(body.organizationId || '');
      const auth = await authorizeRequest(request, { permission: 'teams.create', organizationId, requestedFields: ['organization_id','sport_id','program_id','season_id','code','name','competitive_level','status'] });
      if (!organizationId || !String(body.code || '').trim() || !String(body.name || '').trim()) throw new Error('Organization, team code and team name are required.');
      const organization = (await rest(`organizations?select=id,tenant_id&id=eq.${encodeURIComponent(organizationId)}&limit=1`))?.[0];
      if (!organization) throw new Error('Organization not found.');
      const rows = await rest('teams', { method: 'POST', body: JSON.stringify({ organization_id: organizationId, sport_id: body.sportId || null, program_id: body.programId || null, season_id: body.seasonId || null, code: String(body.code).trim().toUpperCase(), name: String(body.name).trim(), competitive_level: body.competitiveLevel || null, status: 'active' }) });
      const created = rows?.[0] || null;
      await audit(auth, { tenantId: organization.tenant_id, action: 'TEAM_CREATE', entityType: 'teams', entityId: created?.id, after: created });
      return NextResponse.json({ ok: true, row: created });
    }

    if (['update-team','archive-team','restore-team'].includes(action)) {
      const id = String(body.id || '');
      const { team, organization } = await teamContext(id);
      const permission = action === 'update-team' ? 'teams.update' : 'teams.archive';
      const auth = await authorizeRequest(request, { permission, organizationId: team.organization_id, teamId: team.id, requestedFields: action === 'update-team' ? ['program_id','season_id','code','name','competitive_level'] : ['status'] });
      const patch = action === 'update-team' ? { program_id: body.programId ?? team.program_id, season_id: body.seasonId ?? team.season_id, code: String(body.code || team.code).trim().toUpperCase(), name: String(body.name || team.name).trim(), competitive_level: body.competitiveLevel ?? team.competitive_level } : { status: action === 'archive-team' ? 'archived' : 'active' };
      const rows = await rest(`teams?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) });
      const updated = rows?.[0] || null;
      await audit(auth, { tenantId: organization.tenant_id, action: action === 'update-team' ? 'TEAM_UPDATE' : action === 'archive-team' ? 'TEAM_ARCHIVE' : 'TEAM_RESTORE', entityType: 'teams', entityId: id, before: team, after: updated });
      return NextResponse.json({ ok: true, row: updated });
    }

    if (action === 'create-squad') {
      const teamId = String(body.teamId || '');
      const { team, organization } = await teamContext(teamId);
      const auth = await authorizeRequest(request, { permission: 'teams.update', organizationId: team.organization_id, teamId });
      if (!String(body.code || '').trim() || !String(body.name || '').trim()) throw new Error('Squad code and name are required.');
      const rows = await rest('groups', { method: 'POST', body: JSON.stringify({ team_id: teamId, program_id: body.programId || team.program_id || null, code: String(body.code).trim().toUpperCase(), name: String(body.name).trim(), group_type: body.groupType || 'squad', status: 'active' }) });
      const created = rows?.[0] || null;
      await audit(auth, { tenantId: organization.tenant_id, action: 'SQUAD_CREATE', entityType: 'groups', entityId: created?.id, after: created });
      return NextResponse.json({ ok: true, row: created });
    }

    if (['update-squad','archive-squad','restore-squad'].includes(action)) {
      const id = String(body.id || '');
      const group = (await rest(`groups?select=id,team_id,program_id,code,name,group_type,status&id=eq.${encodeURIComponent(id)}&limit=1`))?.[0];
      if (!group?.team_id) throw new Error('Squad not found.');
      const { team, organization } = await teamContext(group.team_id);
      const auth = await authorizeRequest(request, { permission: 'teams.update', organizationId: team.organization_id, teamId: team.id });
      const patch = action === 'update-squad' ? { program_id: body.programId ?? group.program_id, code: String(body.code || group.code).trim().toUpperCase(), name: String(body.name || group.name).trim(), group_type: body.groupType ?? group.group_type } : { status: action === 'archive-squad' ? 'archived' : 'active' };
      const rows = await rest(`groups?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) });
      const updated = rows?.[0] || null;
      await audit(auth, { tenantId: organization.tenant_id, action: action === 'update-squad' ? 'SQUAD_UPDATE' : action === 'archive-squad' ? 'SQUAD_ARCHIVE' : 'SQUAD_RESTORE', entityType: 'groups', entityId: id, before: group, after: updated });
      return NextResponse.json({ ok: true, row: updated });
    }

    if (action === 'add-roster-member') {
      const teamId = String(body.teamId || '');
      const { team, organization } = await teamContext(teamId);
      const auth = await authorizeRequest(request, { permission: 'rosters.update', organizationId: team.organization_id, teamId });
      const athleteId = body.athleteId ? String(body.athleteId) : null;
      const personId = body.personId ? String(body.personId) : null;
      if (!athleteId && !personId) throw new Error('Athlete or person is required.');
      const existing = await rest(`team_memberships?select=id,status&team_id=eq.${encodeURIComponent(teamId)}&${athleteId ? `athlete_id=eq.${encodeURIComponent(athleteId)}` : `person_id=eq.${encodeURIComponent(personId!)}`}&status=eq.active&limit=1`);
      if (existing?.length) throw new Error('This person is already active on the roster.');
      const rows = await rest('team_memberships', { method: 'POST', body: JSON.stringify({ team_id: teamId, athlete_id: athleteId, person_id: personId, membership_type: body.membershipType || (athleteId ? 'athlete' : 'staff'), starts_on: body.startsOn || today(), status: 'active', jersey_number: body.jerseyNumber || null, notes: body.notes || null }) });
      const created = rows?.[0] || null;
      await audit(auth, { tenantId: organization.tenant_id, action: 'ROSTER_MEMBER_ADD', entityType: 'team_memberships', entityId: created?.id, after: created });
      return NextResponse.json({ ok: true, row: created });
    }

    if (action === 'end-roster-member') {
      const id = String(body.id || '');
      const membership = (await rest(`team_memberships?select=*&id=eq.${encodeURIComponent(id)}&limit=1`))?.[0];
      if (!membership) throw new Error('Roster membership not found.');
      const { team, organization } = await teamContext(membership.team_id);
      const auth = await authorizeRequest(request, { permission: 'rosters.update', organizationId: team.organization_id, teamId: team.id });
      const rows = await rest(`team_memberships?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ status: body.status || 'ended', ends_on: body.endsOn || today(), notes: body.notes ?? membership.notes }) });
      const updated = rows?.[0] || null;
      await audit(auth, { tenantId: organization.tenant_id, action: 'ROSTER_MEMBER_END', entityType: 'team_memberships', entityId: id, before: membership, after: updated });
      return NextResponse.json({ ok: true, row: updated });
    }

    if (action === 'move-athlete-group') {
      const teamId = String(body.teamId || '');
      const athleteId = String(body.athleteId || '');
      const groupId = String(body.groupId || '');
      const { team, organization } = await teamContext(teamId);
      const auth = await authorizeRequest(request, { permission: 'rosters.update', organizationId: team.organization_id, teamId });
      const target = (await rest(`groups?select=id,team_id,name&id=eq.${encodeURIComponent(groupId)}&limit=1`))?.[0];
      if (!target || target.team_id !== teamId) throw new Error('Target squad does not belong to this team.');
      const teamGroups: Row[] = await rest(`groups?select=id&team_id=eq.${encodeURIComponent(teamId)}&limit=500`);
      const groupIds = teamGroups.map((row) => row.id);
      const before = groupIds.length ? await rest(`group_memberships?select=group_id,athlete_id,starts_on,ends_on,status&athlete_id=eq.${encodeURIComponent(athleteId)}&group_id=in.(${groupIds.join(',')})`) : [];
      if (groupIds.length) await rest(`group_memberships?athlete_id=eq.${encodeURIComponent(athleteId)}&group_id=in.(${groupIds.join(',')})&status=eq.active`, { method: 'PATCH', body: JSON.stringify({ status: 'moved', ends_on: body.effectiveOn || today() }) });
      const rows = await rest(`group_memberships?on_conflict=group_id,athlete_id`, { method: 'POST', body: JSON.stringify({ group_id: groupId, athlete_id: athleteId, starts_on: body.effectiveOn || today(), ends_on: null, status: 'active' }) }, 'resolution=merge-duplicates,return=representation');
      const updated = rows?.[0] || null;
      await audit(auth, { tenantId: organization.tenant_id, action: 'ROSTER_GROUP_MOVE', entityType: 'group_memberships', entityId: null, before, after: updated, reason: `Athlete moved to ${target.name}` });
      return NextResponse.json({ ok: true, row: updated });
    }

    if (action === 'bulk-enroll') {
      const teamId = String(body.teamId || '');
      const athleteIds = distinct(Array.isArray(body.athleteIds) ? body.athleteIds.map(String) : []);
      if (!athleteIds.length || athleteIds.length > 250) throw new Error('Bulk enrollment requires 1–250 athletes.');
      const { team, organization } = await teamContext(teamId);
      const auth = await authorizeRequest(request, { permission: 'rosters.update', organizationId: team.organization_id, teamId });
      const existing: Row[] = await rest(`team_memberships?select=athlete_id&team_id=eq.${encodeURIComponent(teamId)}&athlete_id=in.(${athleteIds.join(',')})&status=eq.active`);
      const existingIds = new Set(existing.map((row) => row.athlete_id));
      const inserts = athleteIds.filter((id) => !existingIds.has(id)).map((athleteId) => ({ team_id: teamId, athlete_id: athleteId, person_id: null, membership_type: 'athlete', starts_on: body.startsOn || today(), status: 'active', notes: body.notes || null }));
      const rows = inserts.length ? await rest('team_memberships', { method: 'POST', body: JSON.stringify(inserts) }) : [];
      await audit(auth, { tenantId: organization.tenant_id, action: 'ROSTER_BULK_ENROLL', entityType: 'team_memberships', entityId: null, after: { requested: athleteIds.length, created: rows?.length || 0, skipped_existing: existingIds.size } });
      return NextResponse.json({ ok: true, created: rows || [], skippedExisting: [...existingIds] });
    }

    if (action === 'assign-staff') {
      const teamId = String(body.teamId || '');
      const personId = String(body.personId || '');
      const roleCode = String(body.roleCode || 'TEAM_MANAGER').toUpperCase();
      if (!['TEAM_MANAGER','COACH','STAFF'].includes(roleCode)) throw new Error('Unsupported team staff role.');
      const { team, organization } = await teamContext(teamId);
      const auth = await authorizeRequest(request, { permission: 'rosters.update', organizationId: team.organization_id, teamId });
      const role = (await rest(`roles?select=id,code&code=eq.${encodeURIComponent(roleCode)}&limit=1`))?.[0];
      if (!role) throw new Error('Staff role is not configured.');
      const existing = await rest(`person_role_assignments?select=id&person_id=eq.${encodeURIComponent(personId)}&role_id=eq.${encodeURIComponent(role.id)}&team_id=eq.${encodeURIComponent(teamId)}&status=eq.active&limit=1`);
      if (existing?.length) throw new Error('This staff assignment is already active.');
      const rows = await rest('person_role_assignments', { method: 'POST', body: JSON.stringify({ tenant_id: organization.tenant_id, person_id: personId, role_id: role.id, organization_id: team.organization_id, sport_id: team.sport_id || null, team_id: teamId, starts_at: new Date().toISOString(), status: 'active' }) });
      const created = rows?.[0] || null;
      await audit(auth, { tenantId: organization.tenant_id, action: 'TEAM_STAFF_ASSIGN', entityType: 'person_role_assignments', entityId: created?.id, after: created });
      return NextResponse.json({ ok: true, row: created });
    }

    if (['approve-registration','reject-registration','mark-registration-incomplete','waitlist-registration'].includes(action)) {
      const id = String(body.id || '');
      const { registration, organization } = await registrationContext(id);
      const auth = await authorizeRequest(request, { permission: 'registrations.approve', organizationId: registration.organization_id, requestedFields: ['status','approved_at','metadata'] });
      const nextStatus = action === 'approve-registration' ? 'approved' : action === 'reject-registration' ? 'rejected' : action === 'waitlist-registration' ? 'waitlisted' : 'incomplete';
      const metadata = { ...(registration.metadata || {}), review: { action, reason: body.reason || null, actor_person_id: auth.personId, at: new Date().toISOString() } };
      const rows = await rest(`registrations?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ status: nextStatus, approved_at: nextStatus === 'approved' ? new Date().toISOString() : null, metadata }) });
      const updated = rows?.[0] || null;
      await audit(auth, { tenantId: organization?.tenant_id, action: `REGISTRATION_${nextStatus.toUpperCase()}`, entityType: 'registrations', entityId: id, before: registration, after: updated });
      return NextResponse.json({ ok: true, row: updated });
    }

    if (action === 'transfer-registration') {
      const id = String(body.id || '');
      const { registration, organization } = await registrationContext(id);
      const auth = await authorizeRequest(request, { permission: 'registrations.approve', organizationId: registration.organization_id, requestedFields: ['program_id','season_id','status','metadata'] });
      const metadata = { ...(registration.metadata || {}), transfer: { from_program_id: registration.program_id, to_program_id: body.programId || registration.program_id, from_season_id: registration.season_id, to_season_id: body.seasonId || registration.season_id, reason: body.reason || null, actor_person_id: auth.personId, at: new Date().toISOString() } };
      const rows = await rest(`registrations?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ program_id: body.programId || registration.program_id, season_id: body.seasonId || registration.season_id, status: body.status || 'pending_review', approved_at: null, metadata }) });
      const updated = rows?.[0] || null;
      await audit(auth, { tenantId: organization?.tenant_id, action: 'REGISTRATION_TRANSFER', entityType: 'registrations', entityId: id, before: registration, after: updated });
      return NextResponse.json({ ok: true, row: updated });
    }

    if (action === 'request-registration-exception') {
      const id = String(body.id || '');
      const { registration, organization } = await registrationContext(id);
      const auth = await authorizeRequest(request, { permission: 'registrations.read', organizationId: registration.organization_id });
      const rows = await rest('approvals', { method: 'POST', body: JSON.stringify({ tenant_id: organization?.tenant_id || null, entity_type: 'registrations', entity_id: id, requested_by: auth.personId, approval_type: body.approvalType || 'REGISTRATION_EXCEPTION', status: 'pending', decision_note: body.reason || null }) });
      const created = rows?.[0] || null;
      await audit(auth, { tenantId: organization?.tenant_id, action: 'REGISTRATION_EXCEPTION_REQUEST', entityType: 'approvals', entityId: created?.id, after: created });
      return NextResponse.json({ ok: true, row: created });
    }

    if (action === 'set-eligibility') {
      const athleteId = String(body.athleteId || '');
      const competitionId = body.competitionId ? String(body.competitionId) : null;
      const auth = await authorizeRequest(request, { permission: 'registrations.approve' });
      const rows = await rest('eligibility_records', { method: 'POST', body: JSON.stringify({ athlete_id: athleteId, rule_id: body.ruleId || null, competition_id: competitionId, status: body.status || 'eligible', evaluated_at: new Date().toISOString(), reason: body.reason || 'Manual Team Manager eligibility review', expires_at: body.expiresAt || null }) });
      const created = rows?.[0] || null;
      await audit(auth, { action: 'ELIGIBILITY_DECISION', entityType: 'eligibility_records', entityId: created?.id, after: created });
      return NextResponse.json({ ok: true, row: created });
    }

    if (action === 'create-attendance-session') {
      const teamId = String(body.teamId || '');
      const { team, organization } = await teamContext(teamId);
      const auth = await authorizeRequest(request, { permission: 'attendance.update', organizationId: team.organization_id, teamId });
      const rows = await rest('attendance_sessions', { method: 'POST', body: JSON.stringify({ team_id: teamId, group_id: body.groupId || null, event_id: body.eventId || null, session_date: body.sessionDate || today(), start_time: body.startTime || null, end_time: body.endTime || null, session_type: body.sessionType || 'practice', status: body.status || 'planned' }) });
      const created = rows?.[0] || null;
      await audit(auth, { tenantId: organization.tenant_id, action: 'ATTENDANCE_SESSION_CREATE', entityType: 'attendance_sessions', entityId: created?.id, after: created });
      return NextResponse.json({ ok: true, row: created });
    }

    if (action === 'record-attendance') {
      const sessionId = String(body.sessionId || '');
      const athleteId = String(body.athleteId || '');
      const session = (await rest(`attendance_sessions?select=id,team_id,status&id=eq.${encodeURIComponent(sessionId)}&limit=1`))?.[0];
      if (!session?.team_id) throw new Error('Attendance session not found.');
      const { team, organization } = await teamContext(session.team_id);
      const auth = await authorizeRequest(request, { permission: 'attendance.update', organizationId: team.organization_id, teamId: team.id });
      const before = (await rest(`attendance_records?select=*&session_id=eq.${encodeURIComponent(sessionId)}&athlete_id=eq.${encodeURIComponent(athleteId)}&limit=1`))?.[0] || null;
      const rows = await rest('attendance_records?on_conflict=session_id,athlete_id', { method: 'POST', body: JSON.stringify({ session_id: sessionId, athlete_id: athleteId, status: body.status || 'present', check_in_at: body.checkInAt || null, check_out_at: body.checkOutAt || null, note: body.note || null }) }, 'resolution=merge-duplicates,return=representation');
      const updated = rows?.[0] || null;
      await audit(auth, { tenantId: organization.tenant_id, action: before ? 'ATTENDANCE_CORRECT' : 'ATTENDANCE_CAPTURE', entityType: 'attendance_records', entityId: updated?.id, before, after: updated });
      return NextResponse.json({ ok: true, row: updated });
    }

    if (action === 'create-training-plan') {
      const teamId = String(body.teamId || '');
      const { team, organization } = await teamContext(teamId);
      const auth = await authorizeRequest(request, { permission: 'training.update', organizationId: team.organization_id, teamId });
      const rows = await rest('training_plans', { method: 'POST', body: JSON.stringify({ team_id: teamId, season_id: body.seasonId || team.season_id || null, name: String(body.name || '').trim(), plan_type: body.planType || 'season', starts_on: body.startsOn || null, ends_on: body.endsOn || null, status: body.status || 'draft', created_by: auth.personId }) });
      const created = rows?.[0] || null;
      await audit(auth, { tenantId: organization.tenant_id, action: 'TRAINING_PLAN_CREATE', entityType: 'training_plans', entityId: created?.id, after: created });
      return NextResponse.json({ ok: true, row: created });
    }

    if (action === 'create-training-session') {
      const planId = String(body.trainingPlanId || '');
      const plan = (await rest(`training_plans?select=id,team_id,season_id,name,status&id=eq.${encodeURIComponent(planId)}&limit=1`))?.[0];
      if (!plan?.team_id) throw new Error('Training plan not found.');
      const { team, organization } = await teamContext(plan.team_id);
      const auth = await authorizeRequest(request, { permission: 'training.update', organizationId: team.organization_id, teamId: team.id });
      const rows = await rest('training_sessions', { method: 'POST', body: JSON.stringify({ training_plan_id: planId, attendance_session_id: body.attendanceSessionId || null, title: String(body.title || '').trim(), session_type: body.sessionType || 'practice', total_load: body.totalLoad ?? null, total_distance: body.totalDistance ?? null, distance_unit: body.distanceUnit || null, workout_definition: body.workoutDefinition || {} }) });
      const created = rows?.[0] || null;
      await audit(auth, { tenantId: organization.tenant_id, action: 'TRAINING_SESSION_CREATE', entityType: 'training_sessions', entityId: created?.id, after: created });
      return NextResponse.json({ ok: true, row: created });
    }

    if (action === 'create-team-thread') {
      const teamId = String(body.teamId || '');
      const recipientPersonIds = distinct(Array.isArray(body.recipientPersonIds) ? body.recipientPersonIds.map(String) : []);
      const { team, organization } = await teamContext(teamId);
      const auth = await authorizeRequest(request, { permission: 'communications.send', organizationId: team.organization_id, teamId });
      if (!auth.personId) throw new Error('Authenticated person identity is required for communication.');
      await assertMinorSafeRecipients(teamId, recipientPersonIds);
      const rows = await rest('communication_threads', { method: 'POST', body: JSON.stringify({ tenant_id: organization.tenant_id, organization_id: team.organization_id, team_id: teamId, thread_type: 'team', title: String(body.title || `${team.name} Team`).trim(), minor_safe_mode: true, status: 'active', created_by: auth.personId }) });
      const thread = rows?.[0] || null;
      if (!thread) throw new Error('Communication thread could not be created.');
      const memberIds = distinct([auth.personId, ...recipientPersonIds]);
      if (memberIds.length) await rest('communication_thread_members', { method: 'POST', body: JSON.stringify(memberIds.map((personId) => ({ thread_id: thread.id, person_id: personId, membership_role: personId === auth.personId ? 'sender' : 'recipient', is_observer: false }))) });
      await audit(auth, { tenantId: organization.tenant_id, action: 'TEAM_THREAD_CREATE', entityType: 'communication_threads', entityId: thread.id, after: { thread, memberIds } });
      return NextResponse.json({ ok: true, row: thread });
    }

    if (action === 'send-thread-message') {
      const threadId = String(body.threadId || '');
      const thread = (await rest(`communication_threads?select=id,tenant_id,organization_id,team_id,minor_safe_mode,status&id=eq.${encodeURIComponent(threadId)}&limit=1`))?.[0];
      if (!thread?.team_id || thread.status !== 'active') throw new Error('Active team thread not found.');
      const { team } = await teamContext(thread.team_id);
      const auth = await authorizeRequest(request, { permission: 'communications.send', organizationId: team.organization_id, teamId: team.id });
      if (!auth.personId) throw new Error('Authenticated person identity is required for communication.');
      const members: Row[] = await rest(`communication_thread_members?select=person_id,left_at&thread_id=eq.${encodeURIComponent(threadId)}&left_at=is.null`);
      const memberIds = members.map((row) => row.person_id);
      if (!memberIds.includes(auth.personId)) throw new Error('Sender is not an active member of this thread.');
      await assertMinorSafeRecipients(team.id, memberIds.filter((id) => id !== auth.personId));
      const rows = await rest('communication_messages', { method: 'POST', body: JSON.stringify({ thread_id: threadId, sender_person_id: auth.personId, body: String(body.message || '').trim(), message_type: body.messageType || 'text', delivery_status: 'queued', moderated: false, metadata: { team_id: team.id, safe_mode: true } }) });
      const message = rows?.[0] || null;
      const recipients = memberIds.filter((id) => id !== auth.personId).map((personId) => ({ message_id: message.id, recipient_person_id: personId, channel_id: null, delivery_status: 'queued', metadata: { source: 'team_manager' } }));
      if (recipients.length) await rest('communication_message_recipients', { method: 'POST', body: JSON.stringify(recipients) });
      await audit(auth, { tenantId: thread.tenant_id, action: 'TEAM_MESSAGE_SEND', entityType: 'communication_messages', entityId: message?.id, after: { message, recipient_count: recipients.length } });
      return NextResponse.json({ ok: true, row: message, recipientCount: recipients.length });
    }

    if (action === 'assign-waiver') {
      const teamId = body.teamId ? String(body.teamId) : null;
      const organizationId = String(body.organizationId || '');
      const auth = await authorizeRequest(request, { permission: 'waivers.update', organizationId, teamId });
      const organization = (await rest(`organizations?select=id,tenant_id&id=eq.${encodeURIComponent(organizationId)}&limit=1`))?.[0];
      if (!organization) throw new Error('Organization not found.');
      const rows = await rest('waiver_assignments', { method: 'POST', body: JSON.stringify({ tenant_id: organization.tenant_id, organization_id: organizationId, waiver_id: String(body.waiverId || ''), person_id: String(body.personId || ''), athlete_id: body.athleteId || null, registration_id: body.registrationId || null, team_id: teamId, status: 'assigned', assigned_by: auth.personId, due_at: body.dueAt || null, reason: body.reason || null, metadata: body.metadata || {} }) });
      const created = rows?.[0] || null;
      await audit(auth, { tenantId: organization.tenant_id, action: 'WAIVER_ASSIGN', entityType: 'waiver_assignments', entityId: created?.id, after: created });
      return NextResponse.json({ ok: true, row: created });
    }

    if (action === 'update-waiver-assignment') {
      const id = String(body.id || '');
      const assignment = (await rest(`waiver_assignments?select=*&id=eq.${encodeURIComponent(id)}&limit=1`))?.[0];
      if (!assignment) throw new Error('Waiver assignment not found.');
      const auth = await authorizeRequest(request, { permission: 'waivers.update', organizationId: assignment.organization_id, teamId: assignment.team_id || null });
      const status = String(body.status || assignment.status);
      const rows = await rest(`waiver_assignments?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ status, due_at: body.dueAt ?? assignment.due_at, completed_at: status === 'completed' ? new Date().toISOString() : assignment.completed_at, waived_at: status === 'waived' ? new Date().toISOString() : assignment.waived_at, reason: body.reason ?? assignment.reason, updated_at: new Date().toISOString() }) });
      const updated = rows?.[0] || null;
      await audit(auth, { tenantId: assignment.tenant_id, action: 'WAIVER_ASSIGNMENT_UPDATE', entityType: 'waiver_assignments', entityId: id, before: assignment, after: updated });
      return NextResponse.json({ ok: true, row: updated });
    }

    if (action === 'create-entry-batch') {
      const organizationId = String(body.organizationId || '');
      const competitionId = String(body.competitionId || '');
      const auth = await authorizeRequest(request, { permission: 'competition_entries.update', organizationId });
      const organization = (await rest(`organizations?select=id,tenant_id&id=eq.${encodeURIComponent(organizationId)}&limit=1`))?.[0];
      if (!organization) throw new Error('Organization not found.');
      const batchCode = String(body.batchCode || `ENTRY-${Date.now()}`).trim().toUpperCase();
      const rows = await rest('competition_entry_batches', { method: 'POST', body: JSON.stringify({ competition_id: competitionId, tenant_id: organization.tenant_id, organization_id: organizationId, batch_code: batchCode, status: 'draft', summary: { created_from: 'team_manager', team_id: body.teamId || null } }) });
      const created = rows?.[0] || null;
      await audit(auth, { tenantId: organization.tenant_id, action: 'COMPETITION_ENTRY_BATCH_CREATE', entityType: 'competition_entry_batches', entityId: created?.id, after: created });
      return NextResponse.json({ ok: true, row: created });
    }

    if (action === 'add-competition-entry') {
      const teamId = String(body.teamId || '');
      const athleteId = String(body.athleteId || '');
      const eventId = String(body.competitionEventId || '');
      const { team, organization } = await teamContext(teamId);
      const auth = await authorizeRequest(request, { permission: 'competition_entries.update', organizationId: team.organization_id, teamId });
      const event = (await rest(`competition_events?select=id,competition_id,name&id=eq.${encodeURIComponent(eventId)}&limit=1`))?.[0];
      if (!event) throw new Error('Competition event not found.');
      const decision = (await rest(`competition_eligibility_decisions?select=id,decision,severity,decided_at&competition_id=eq.${encodeURIComponent(event.competition_id)}&athlete_id=eq.${encodeURIComponent(athleteId)}&order=decided_at.desc&limit=1`))?.[0] || null;
      const genericEligibility = (await rest(`eligibility_records?select=id,status,reason,evaluated_at&athlete_id=eq.${encodeURIComponent(athleteId)}&or=(competition_id.eq.${encodeURIComponent(event.competition_id)},competition_id.is.null)&order=evaluated_at.desc&limit=1`))?.[0] || null;
      const eligible = decision ? ['eligible','pass','approved','allow'].includes(String(decision.decision).toLowerCase()) : genericEligibility ? ['eligible','approved','pass'].includes(String(genericEligibility.status).toLowerCase()) : false;
      if (!eligible && !body.overrideReason) throw new Error('Athlete does not have a current eligible decision for this competition. An authorized exception is required.');
      if (!eligible && body.overrideReason) {
        await rest('approvals', { method: 'POST', body: JSON.stringify({ tenant_id: organization.tenant_id, entity_type: 'competitions', entity_id: event.competition_id, requested_by: auth.personId, approval_type: 'ENTRY_ELIGIBILITY_EXCEPTION', status: 'pending', decision_note: String(body.overrideReason) }) });
        throw new Error('Eligibility exception was routed for approval; entry was not created.');
      }
      const rows = await rest('competition_entries', { method: 'POST', body: JSON.stringify({ competition_event_id: eventId, athlete_id: athleteId, team_id: teamId, seed_value: body.seedValue ?? null, seed_unit: body.seedUnit || null, entry_status: 'entered', eligibility_status: 'eligible', scratch_status: null }) });
      const created = rows?.[0] || null;
      await audit(auth, { tenantId: organization.tenant_id, action: 'COMPETITION_ENTRY_ADD', entityType: 'competition_entries', entityId: created?.id, after: created });
      return NextResponse.json({ ok: true, row: created });
    }

    if (action === 'submit-entry-batch') {
      const id = String(body.id || '');
      const batch = (await rest(`competition_entry_batches?select=*&id=eq.${encodeURIComponent(id)}&limit=1`))?.[0];
      if (!batch) throw new Error('Entry batch not found.');
      const auth = await authorizeRequest(request, { permission: 'competition_entries.update', organizationId: batch.organization_id });
      if (batch.status !== 'draft') throw new Error('Only draft entry batches can be submitted.');
      const rows = await rest(`competition_entry_batches?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ status: 'submitted', submitted_at: new Date().toISOString(), submitted_by: auth.personId, updated_at: new Date().toISOString() }) });
      const updated = rows?.[0] || null;
      await audit(auth, { tenantId: batch.tenant_id, action: 'COMPETITION_ENTRY_BATCH_SUBMIT', entityType: 'competition_entry_batches', entityId: id, before: batch, after: updated });
      return NextResponse.json({ ok: true, row: updated });
    }

    if (action === 'request-scratch') {
      const entryId = String(body.entryId || '');
      const entry = (await rest(`competition_entries?select=id,competition_event_id,athlete_id,team_id,entry_status,scratch_status&id=eq.${encodeURIComponent(entryId)}&limit=1`))?.[0];
      if (!entry?.team_id) throw new Error('Competition entry not found.');
      const { team, organization } = await teamContext(entry.team_id);
      const auth = await authorizeRequest(request, { permission: 'competition_entries.update', organizationId: team.organization_id, teamId: team.id });
      const event = (await rest(`competition_events?select=id,competition_id&id=eq.${encodeURIComponent(entry.competition_event_id)}&limit=1`))?.[0];
      if (!event) throw new Error('Competition event not found.');
      const rows = await rest('competition_scratches', { method: 'POST', body: JSON.stringify({ competition_id: event.competition_id, competition_entry_id: entryId, athlete_id: entry.athlete_id, reason_code: body.reasonCode || 'TEAM_REQUEST', reason_text: body.reason || null, status: 'requested', requested_by: auth.personId, audit_context: { source: 'team_manager' } }) });
      const created = rows?.[0] || null;
      await rest(`competition_entries?id=eq.${encodeURIComponent(entryId)}`, { method: 'PATCH', body: JSON.stringify({ scratch_status: 'requested' }) });
      await audit(auth, { tenantId: organization.tenant_id, action: 'COMPETITION_SCRATCH_REQUEST', entityType: 'competition_scratches', entityId: created?.id, after: created });
      return NextResponse.json({ ok: true, row: created });
    }

    throw new Error('Unsupported Team Manager action.');
  } catch (error) {
    const auth = authorizationFailure(error);
    if (auth) return NextResponse.json(auth.body, { status: auth.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Team Manager action failed.' }, { status: 400 });
  }
}
