const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://xedfstgwotzxnztpembv.supabase.co';
const PUBLIC_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;

export type SuperUserIdentity = {
  userId: string;
  email: string;
  operatorId: string;
  personId: string | null;
  displayName: string;
  canOnboardClients: boolean;
  canManagePlatformSettings: boolean;
  accessToken: string;
};

export class SuperUserAuthError extends Error {
  status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.name = 'SuperUserAuthError';
    this.status = status;
  }
}

export async function requireSuperUser(request: Request): Promise<SuperUserIdentity> {
  if (!SUPABASE_URL || !PUBLIC_KEY) {
    throw new SuperUserAuthError('SuperUser authentication is not configured.', 500);
  }

  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) throw new SuperUserAuthError('Authentication required.', 401);

  const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: PUBLIC_KEY,
      Authorization: `Bearer ${token}`,
    },
    cache: 'no-store',
  });

  if (!userResponse.ok) throw new SuperUserAuthError('Invalid or expired session.', 401);

  const user = (await userResponse.json()) as { id?: string; email?: string | null };
  const email = String(user.email || '').trim().toLowerCase();
  if (!user.id || !email) throw new SuperUserAuthError('Authenticated user has no usable identity.', 403);

  // Authorization is evaluated by Supabase RLS using the caller's JWT. This avoids
  // making runtime availability depend on a service-role secret while preserving
  // the immutable auth_user_id binding and app.is_superuser() policy.
  const operatorResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/platform_superuser_operators?select=id,email,display_name,person_id,active,can_onboard_clients,can_manage_platform_settings,auth_user_id&auth_user_id=eq.${encodeURIComponent(user.id)}&active=eq.true&limit=1`,
    {
      headers: {
        apikey: PUBLIC_KEY,
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    },
  );

  if (!operatorResponse.ok) throw new SuperUserAuthError('Unable to verify SuperUser authorization.', 500);

  const operators = (await operatorResponse.json()) as Array<{
    id: string;
    email: string;
    auth_user_id: string;
    person_id: string | null;
    display_name: string | null;
    can_onboard_clients: boolean | null;
    can_manage_platform_settings: boolean | null;
  }>;
  const operator = operators[0];
  if (!operator || operator.auth_user_id !== user.id) throw new SuperUserAuthError('SuperUser access required.', 403);

  return {
    userId: user.id,
    email,
    operatorId: operator.id,
    personId: operator.person_id || null,
    displayName: operator.display_name || email,
    canOnboardClients: Boolean(operator.can_onboard_clients),
    canManagePlatformSettings: Boolean(operator.can_manage_platform_settings),
    accessToken: token,
  };
}
