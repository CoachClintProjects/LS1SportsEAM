const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://xedfstgwotzxnztpembv.supabase.co';
const PUBLIC_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export type CoachAssignment = {
  id: string;
  organizationId: string;
  teamId: string | null;
  programId: string | null;
  roleKey: string;
  isHeadCoach: boolean;
};

export type CoachIdentity = {
  userId: string;
  email: string | null;
  personId: string | null;
  displayName: string;
  isSuperUser: boolean;
  assignments: CoachAssignment[];
  accessToken: string;
};

export class CoachAuthError extends Error {
  status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.name = 'CoachAuthError';
    this.status = status;
  }
}

type AuthUser = { id?: string; email?: string | null };
type OperatorRow = { display_name: string | null; person_id: string | null };
type UserRow = { person_id: string | null; status: string | null };
type PersonRow = { first_name: string | null; preferred_name: string | null; status: string | null };
type AssignmentRow = {
  id: string;
  organization_id: string;
  team_id: string | null;
  program_id: string | null;
  role_key: string;
  is_head_coach: boolean;
};

function cookieToken(request: Request) {
  const cookie = request.headers.get('cookie') || '';
  const pair = cookie
    .split(';')
    .map((value) => value.trim())
    .find((value) => value.startsWith('ls1_superuser_session='));
  return pair ? decodeURIComponent(pair.slice('ls1_superuser_session='.length)) : '';
}

function publicHeaders(token: string) {
  if (!PUBLIC_KEY) throw new CoachAuthError('Coach authentication is not configured.', 500);
  return { apikey: PUBLIC_KEY, Authorization: `Bearer ${token}`, Accept: 'application/json' };
}

async function serviceRest<T>(path: string): Promise<T> {
  const key = SERVICE_KEY ?? PUBLIC_KEY;
  if (!key) throw new CoachAuthError('Coach authorization data access is not configured.', 500);
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' },
    cache: 'no-store',
  });
  const text = await response.text();
  if (!response.ok) {
    throw new CoachAuthError(`Unable to verify Coach authorization (${response.status}).`, 500);
  }
  return (text ? JSON.parse(text) : null) as T;
}

export async function requireCoach(request: Request): Promise<CoachIdentity> {
  if (!SUPABASE_URL || !PUBLIC_KEY) throw new CoachAuthError('Coach authentication is not configured.', 500);

  const authorization = request.headers.get('authorization') || '';
  const headerToken = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  const token = headerToken || cookieToken(request);
  if (!token) throw new CoachAuthError('Authentication required.', 401);

  const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: publicHeaders(token),
    cache: 'no-store',
  });
  if (!userResponse.ok) throw new CoachAuthError('Invalid or expired session.', 401);

  const authUser = (await userResponse.json()) as AuthUser;
  const userId = String(authUser.id || '');
  const email = authUser.email ? String(authUser.email).trim().toLowerCase() : null;
  if (!userId) throw new CoachAuthError('Authenticated user has no usable identity.', 403);

  const operators = await serviceRest<OperatorRow[]>(
    `platform_superuser_operators?select=display_name,person_id&auth_user_id=eq.${encodeURIComponent(userId)}&active=eq.true&limit=1`,
  );
  if (operators[0]) {
    return {
      userId,
      email,
      personId: operators[0].person_id || null,
      displayName: operators[0].display_name || email || 'SuperUser',
      isSuperUser: true,
      assignments: [],
      accessToken: token,
    };
  }

  const users = await serviceRest<UserRow[]>(
    `users?select=person_id,status&id=eq.${encodeURIComponent(userId)}&limit=1`,
  );
  const personId = users[0]?.person_id || null;
  if (!personId || String(users[0]?.status || '').toUpperCase() !== 'ACTIVE') {
    throw new CoachAuthError('Coach Hub access requires an active person identity.', 403);
  }

  const today = new Date().toISOString().slice(0, 10);
  const assignments = await serviceRest<AssignmentRow[]>(
    `coach_access_assignments?select=id,organization_id,team_id,program_id,role_key,is_head_coach&coach_person_id=eq.${encodeURIComponent(personId)}&status=eq.active&or=(starts_on.is.null,starts_on.lte.${today})&or=(ends_on.is.null,ends_on.gte.${today})&order=is_head_coach.desc,created_at.asc`,
  );
  if (!assignments.length) {
    throw new CoachAuthError('This account does not have an active Coach assignment.', 403);
  }

  const people = await serviceRest<PersonRow[]>(
    `people?select=first_name,preferred_name,status&id=eq.${encodeURIComponent(personId)}&limit=1`,
  );
  const person = people[0];
  if (person?.status && String(person.status).toUpperCase() !== 'ACTIVE') {
    throw new CoachAuthError('Coach person record is not active.', 403);
  }

  return {
    userId,
    email,
    personId,
    displayName: person?.preferred_name || person?.first_name || email || 'Coach',
    isSuperUser: false,
    assignments: assignments.map((assignment) => ({
      id: assignment.id,
      organizationId: assignment.organization_id,
      teamId: assignment.team_id,
      programId: assignment.program_id,
      roleKey: assignment.role_key,
      isHeadCoach: assignment.is_head_coach,
    })),
    accessToken: token,
  };
}
