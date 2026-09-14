import { NextRequest, NextResponse } from 'next/server';
import { CoachAuthError, requireCoach, type CoachIdentity } from '@/lib/server/requireCoach';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://xedfstgwotzxnztpembv.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PUBLIC_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type TeamRow = {
  id: string;
  organization_id: string;
  season_id: string | null;
  name: string;
  competitive_level: string | null;
  status: string | null;
};
type OrganizationRow = { id: string; name: string; status: string | null };
type TeamMembershipRow = { athlete_id: string | null; jersey_number: string | null; status: string | null };
type AthleteRow = { id: string; person_id: string; athlete_number: string | null; athlete_status: string };
type PersonRow = { id: string; first_name: string | null; last_name: string | null; preferred_name: string | null };
type TrainingPlanRow = { id: string; name: string; plan_type: string | null; starts_on: string | null; ends_on: string | null; status: string | null };
type AttendanceSessionRow = { id: string; session_date: string; start_time: string | null; end_time: string | null; session_type: string | null; status: string | null };
type TrainingSessionRow = { id: string; training_plan_id: string | null; attendance_session_id: string | null; title: string; session_type: string | null; total_load: number | null; total_distance: number | null; distance_unit: string | null };
type AttendanceRecordRow = { session_id: string; athlete_id: string; status: string; check_in_at: string | null; check_out_at: string | null };
type CompetitionRow = { id: string; name: string; competition_type: string | null; starts_at: string | null; ends_at: string | null; city: string | null; region: string | null; status: string | null };
type AttentionRow = { id: string; category: string; horizon: string; title: string; summary: string | null; severity: string; due_at: string | null; requires_human_judgment: boolean; status: string; athlete_id: string | null; competition_id: string | null; created_at: string };
type ProposalRow = { id: string; agent_key: string; proposal_type: string; autonomy_level: string; subject_type: string | null; subject_id: string | null; proposal: unknown; rationale: unknown; source_evidence: unknown; status: string; created_at: string };
type SeasonRow = { id: string; name: string; starts_on: string | null; ends_on: string | null; status: string | null };

function safeIn(values: string[]) {
  return values.filter((value) => /^[0-9a-f-]{36}$/i.test(value)).join(',');
}

async function rest<T>(path: string): Promise<T> {
  const key = SERVICE_KEY ?? PUBLIC_KEY;
  if (!key) throw new Error('Coach runtime data access is not configured.');
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' },
    cache: 'no-store',
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Coach runtime query failed (${response.status}): ${text.slice(0, 240)}`);
  return (text ? JSON.parse(text) : null) as T;
}

async function resolveTeam(actor: CoachIdentity, requestedTeamId: string | null) {
  if (requestedTeamId && !/^[0-9a-f-]{36}$/i.test(requestedTeamId)) {
    throw new CoachAuthError('Invalid team context.', 400);
  }

  if (!actor.isSuperUser && requestedTeamId) {
    const permitted = actor.assignments.some((assignment) => assignment.teamId === requestedTeamId || assignment.teamId === null);
    if (!permitted) throw new CoachAuthError('Coach is not assigned to the requested team.', 403);
  }

  if (requestedTeamId) {
    const rows = await rest<TeamRow[]>(`teams?select=id,organization_id,season_id,name,competitive_level,status&id=eq.${requestedTeamId}&limit=1`);
    const team = rows[0] || null;
    if (!team) throw new CoachAuthError('Requested team was not found.', 404);
    if (!actor.isSuperUser) {
      const permittedOrganization = actor.assignments.some((assignment) => assignment.organizationId === team.organization_id);
      if (!permittedOrganization) throw new CoachAuthError('Coach is not assigned to the requested organization.', 403);
    }
    return team;
  }

  const assignedTeamId = actor.assignments.find((assignment) => assignment.teamId)?.teamId;
  if (assignedTeamId) {
    const rows = await rest<TeamRow[]>(`teams?select=id,organization_id,season_id,name,competitive_level,status&id=eq.${assignedTeamId}&limit=1`);
    if (rows[0]) return rows[0];
  }

  const organizationId = actor.assignments[0]?.organizationId;
  const filter = organizationId ? `&organization_id=eq.${organizationId}` : '';
  const rows = await rest<TeamRow[]>(`teams?select=id,organization_id,season_id,name,competitive_level,status&status=eq.active${filter}&order=name.asc&limit=1`);
  return rows[0] || null;
}

export async function GET(request: NextRequest) {
  try {
    const actor = await requireCoach(request);
    const team = await resolveTeam(actor, request.nextUrl.searchParams.get('team'));

    if (!team) {
      return NextResponse.json({
        identity: { displayName: actor.displayName, isSuperUser: actor.isSuperUser },
        context: { team: null, organization: null, season: null },
        roster: [],
        training: { plans: [], sessions: [] },
        attendance: { sessions: [], records: [] },
        competitions: [],
        attention: [],
        proposals: [],
        metrics: { rosterSize: 0, openAttention: 0, pendingProposals: 0, scheduledSessions: 0, upcomingCompetitions: 0 },
        generatedAt: new Date().toISOString(),
        source: 'canonical',
      });
    }

    const [organizations, memberships, plans, attendanceSessions, competitions, seasons] = await Promise.all([
      rest<OrganizationRow[]>(`organizations?select=id,name,status&id=eq.${team.organization_id}&limit=1`),
      rest<TeamMembershipRow[]>(`team_memberships?select=athlete_id,jersey_number,status&team_id=eq.${team.id}&status=eq.active&order=created_at.asc`),
      rest<TrainingPlanRow[]>(`training_plans?select=id,name,plan_type,starts_on,ends_on,status&team_id=eq.${team.id}&order=starts_on.desc.nullslast&limit=30`),
      rest<AttendanceSessionRow[]>(`attendance_sessions?select=id,session_date,start_time,end_time,session_type,status&team_id=eq.${team.id}&order=session_date.desc,start_time.desc&limit=40`),
      rest<CompetitionRow[]>(`competitions?select=id,name,competition_type,starts_at,ends_at,city,region,status&organization_id=eq.${team.organization_id}&order=starts_at.asc.nullslast&limit=30`),
      team.season_id ? rest<SeasonRow[]>(`seasons?select=id,name,starts_on,ends_on,status&id=eq.${team.season_id}&limit=1`) : Promise.resolve([] as SeasonRow[]),
    ]);

    const athleteIds = memberships.map((membership) => membership.athlete_id).filter((value): value is string => Boolean(value));
    const athleteIn = safeIn(athleteIds);
    const athletes = athleteIn
      ? await rest<AthleteRow[]>(`athletes?select=id,person_id,athlete_number,athlete_status&id=in.(${athleteIn})`)
      : [];
    const personIds = athletes.map((athlete) => athlete.person_id);
    const personIn = safeIn(personIds);
    const people = personIn
      ? await rest<PersonRow[]>(`people?select=id,first_name,last_name,preferred_name&id=in.(${personIn})`)
      : [];

    const attendanceIds = attendanceSessions.map((session) => session.id);
    const attendanceIn = safeIn(attendanceIds);
    const [trainingSessions, attendanceRecords] = attendanceIn
      ? await Promise.all([
          rest<TrainingSessionRow[]>(`training_sessions?select=id,training_plan_id,attendance_session_id,title,session_type,total_load,total_distance,distance_unit&attendance_session_id=in.(${attendanceIn})`),
          rest<AttendanceRecordRow[]>(`attendance_records?select=session_id,athlete_id,status,check_in_at,check_out_at&session_id=in.(${attendanceIn})`),
        ])
      : [[], []] as [TrainingSessionRow[], AttendanceRecordRow[]];

    const coachPersonId = actor.personId;
    const attentionFilter = coachPersonId
      ? `coach_person_id=eq.${coachPersonId}`
      : `organization_id=eq.${team.organization_id}`;
    const proposalFilter = coachPersonId
      ? `coach_person_id=eq.${coachPersonId}`
      : `organization_id=eq.${team.organization_id}`;
    const [attention, proposals] = await Promise.all([
      rest<AttentionRow[]>(`coach_attention_items?select=id,category,horizon,title,summary,severity,due_at,requires_human_judgment,status,athlete_id,competition_id,created_at&${attentionFilter}&status=eq.open&order=due_at.asc.nullslast,created_at.desc&limit=50`),
      rest<ProposalRow[]>(`coach_agent_proposals?select=id,agent_key,proposal_type,autonomy_level,subject_type,subject_id,proposal,rationale,source_evidence,status,created_at&${proposalFilter}&status=eq.proposed&order=created_at.desc&limit=50`),
    ]);

    const peopleById = new Map(people.map((person) => [person.id, person]));
    const athleteById = new Map(athletes.map((athlete) => [athlete.id, athlete]));
    const roster = memberships.flatMap((membership) => {
      if (!membership.athlete_id) return [];
      const athlete = athleteById.get(membership.athlete_id);
      if (!athlete) return [];
      const person = peopleById.get(athlete.person_id);
      const fullName = [person?.first_name, person?.last_name].filter(Boolean).join(' ');
      return [{
        athleteId: athlete.id,
        athleteNumber: athlete.athlete_number,
        name: person?.preferred_name || fullName || 'Athlete',
        status: athlete.athlete_status,
        jerseyNumber: membership.jersey_number,
      }];
    });

    const now = Date.now();
    const upcomingCompetitions = competitions.filter((competition) => !competition.starts_at || new Date(competition.starts_at).getTime() >= now).length;
    const today = new Date().toISOString().slice(0, 10);
    const scheduledSessions = attendanceSessions.filter((session) => session.session_date >= today && session.status !== 'cancelled').length;

    return NextResponse.json({
      identity: {
        displayName: actor.displayName,
        isSuperUser: actor.isSuperUser,
        coachPersonId: actor.personId,
      },
      context: {
        team,
        organization: organizations[0] || null,
        season: seasons[0] || null,
      },
      roster,
      training: { plans, sessions: trainingSessions },
      attendance: { sessions: attendanceSessions, records: attendanceRecords },
      competitions,
      attention,
      proposals,
      metrics: {
        rosterSize: roster.length,
        openAttention: attention.length,
        pendingProposals: proposals.length,
        scheduledSessions,
        upcomingCompetitions,
      },
      generatedAt: new Date().toISOString(),
      source: 'canonical',
    }, { headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' } });
  } catch (error) {
    if (error instanceof CoachAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Coach runtime unavailable.' }, { status: 500 });
  }
}
