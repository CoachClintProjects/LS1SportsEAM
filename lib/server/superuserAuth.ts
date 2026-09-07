import type { NextRequest } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://xedfstgwotzxnztpembv.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PUBLIC_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;

export type SuperUserOperator = { email: string; display_name: string | null; can_onboard_clients: boolean; can_manage_platform_settings: boolean };
type SuperUserAuthPolicy = { require_mfa: boolean; required_aal: 'aal1' | 'aal2' };

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const segment = token.split('.')[1];
  if (!segment) return null;
  try {
    const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function getAuthorizedSuperUser(request: NextRequest): Promise<SuperUserOperator | null> {
  const token = request.cookies.get('ls1_superuser_session')?.value;
  if (!token || !SERVICE_KEY || !PUBLIC_KEY) return null;

  const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: PUBLIC_KEY, Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!userResponse.ok) return null;
  const user = await userResponse.json() as { email?: string };
  const email = user.email?.trim().toLowerCase();
  if (!email) return null;

  const [operatorResponse, policyResponse] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/platform_superuser_operators?select=email,display_name,can_onboard_clients,can_manage_platform_settings&active=eq.true&email=ilike.${encodeURIComponent(email)}`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
      cache: 'no-store',
    }),
    fetch(`${SUPABASE_URL}/rest/v1/platform_auth_configuration?select=require_mfa,required_aal&code=eq.SUPERUSER&is_active=eq.true&limit=1`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
      cache: 'no-store',
    }),
  ]);
  if (!operatorResponse.ok || !policyResponse.ok) return null;

  const policies = await policyResponse.json() as SuperUserAuthPolicy[];
  const policy = policies[0];
  if (!policy) return null;
  if (policy.require_mfa) {
    const payload = decodeJwtPayload(token);
    const aal = typeof payload?.aal === 'string' ? payload.aal : null;
    if (aal !== policy.required_aal) return null;
  }

  const rows = await operatorResponse.json() as SuperUserOperator[];
  return rows[0] ?? null;
}

export function supabaseServerConfig() { return { url: SUPABASE_URL, serviceKey: SERVICE_KEY, publicKey: PUBLIC_KEY }; }
