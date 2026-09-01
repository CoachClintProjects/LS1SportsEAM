import type { NextRequest } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://xedfstgwotzxnztpembv.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PUBLIC_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;

export type SuperUserOperator = { email: string; display_name: string | null; can_onboard_clients: boolean; can_manage_platform_settings: boolean };

export async function getAuthorizedSuperUser(request: NextRequest): Promise<SuperUserOperator | null> {
  const token = request.cookies.get('ls1_superuser_session')?.value;
  if (!token || !SERVICE_KEY || !PUBLIC_KEY) return null;
  const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: PUBLIC_KEY, Authorization: `Bearer ${token}` }, cache: 'no-store' });
  if (!userResponse.ok) return null;
  const user = await userResponse.json() as { email?: string };
  const email = user.email?.trim().toLowerCase();
  if (!email) return null;
  const operatorResponse = await fetch(`${SUPABASE_URL}/rest/v1/platform_superuser_operators?select=email,display_name,can_onboard_clients,can_manage_platform_settings&active=eq.true&email=ilike.${encodeURIComponent(email)}`, { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }, cache: 'no-store' });
  if (!operatorResponse.ok) return null;
  const rows = await operatorResponse.json() as SuperUserOperator[];
  return rows[0] ?? null;
}

export function supabaseServerConfig() { return { url: SUPABASE_URL, serviceKey: SERVICE_KEY, publicKey: PUBLIC_KEY }; }
