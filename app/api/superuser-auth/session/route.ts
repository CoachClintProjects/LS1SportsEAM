import { NextRequest, NextResponse } from 'next/server';
import { supabaseServerConfig } from '@/lib/server/superuserAuth';

type AuthPolicy = {
  require_mfa: boolean;
  required_aal: 'aal1' | 'aal2';
  session_max_age_seconds: number;
};

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

export async function POST(request: NextRequest) {
  const { url, serviceKey, publicKey } = supabaseServerConfig();
  if (!serviceKey || !publicKey) return NextResponse.json({ error: 'Authentication is not configured.' }, { status: 500 });
  const body = await request.json() as { accessToken?: string };
  const token = body.accessToken;
  if (!token) return NextResponse.json({ error: 'Access token is required.' }, { status: 400 });

  const userResponse = await fetch(`${url}/auth/v1/user`, { headers: { apikey: publicKey, Authorization: `Bearer ${token}` }, cache: 'no-store' });
  if (!userResponse.ok) return NextResponse.json({ error: 'Supabase session is invalid.' }, { status: 401 });
  const user = await userResponse.json() as { email?: string };
  const email = user.email?.trim().toLowerCase();
  if (!email) return NextResponse.json({ error: 'Authenticated account has no email.' }, { status: 403 });

  const [operatorResponse, policyResponse] = await Promise.all([
    fetch(`${url}/rest/v1/platform_superuser_operators?select=email,display_name&active=eq.true&email=ilike.${encodeURIComponent(email)}`, { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }, cache: 'no-store' }),
    fetch(`${url}/rest/v1/platform_auth_configuration?select=require_mfa,required_aal,session_max_age_seconds&code=eq.SUPERUSER&is_active=eq.true&limit=1`, { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }, cache: 'no-store' }),
  ]);

  const operators = operatorResponse.ok ? await operatorResponse.json() as Array<{ email: string; display_name: string | null }> : [];
  if (!operators.length) return NextResponse.json({ error: 'Authenticated account is not an authorized SuperUser operator.' }, { status: 403 });

  const policies = policyResponse.ok ? await policyResponse.json() as AuthPolicy[] : [];
  const policy = policies[0];
  if (!policy) return NextResponse.json({ error: 'SuperUser authentication policy is not configured.' }, { status: 503 });

  if (policy.require_mfa) {
    const payload = decodeJwtPayload(token);
    const aal = typeof payload?.aal === 'string' ? payload.aal : null;
    if (aal !== policy.required_aal) {
      return NextResponse.json({ error: 'Multi-factor authentication is required before a SuperUser session can be issued.', code: 'MFA_REQUIRED', requiredAal: policy.required_aal }, { status: 428 });
    }
  }

  const response = NextResponse.json({ ok: true, operator: operators[0] });
  response.cookies.set('ls1_superuser_session', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: policy.session_max_age_seconds,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set('ls1_superuser_session', '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 });
  return response;
}
