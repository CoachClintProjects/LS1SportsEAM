import { NextRequest, NextResponse } from 'next/server';
import { supabaseServerConfig } from '@/lib/server/superuserAuth';

export async function POST(request: NextRequest) {
  const { url, publicKey } = supabaseServerConfig();
  if (!publicKey) return NextResponse.json({ error: 'Authentication is not configured.' }, { status: 500 });
  const body = await request.json() as { accessToken?: string };
  const token = body.accessToken;
  if (!token) return NextResponse.json({ error: 'Access token is required.' }, { status: 400 });

  const userResponse = await fetch(`${url}/auth/v1/user`, { headers: { apikey: publicKey, Authorization: `Bearer ${token}` }, cache: 'no-store' });
  if (!userResponse.ok) return NextResponse.json({ error: 'Supabase session is invalid.' }, { status: 401 });
  const user = await userResponse.json() as { id?: string; email?: string };
  const email = user.email?.trim().toLowerCase();
  if (!user.id || !email) return NextResponse.json({ error: 'Authenticated account has no usable identity.' }, { status: 403 });

  const operatorResponse = await fetch(
    `${url}/rest/v1/platform_superuser_operators?select=id,email,display_name,auth_user_id&active=eq.true&auth_user_id=eq.${encodeURIComponent(user.id)}&limit=1`,
    { headers: { apikey: publicKey, Authorization: `Bearer ${token}` }, cache: 'no-store' },
  );
  const operators = operatorResponse.ok ? await operatorResponse.json() as Array<{ id: string; email: string; display_name: string | null; auth_user_id: string }> : [];
  if (!operators.length || operators[0].auth_user_id !== user.id) return NextResponse.json({ error: 'Authenticated account is not an authorized Super User operator.' }, { status: 403 });

  const response = NextResponse.json({ ok: true, operator: operators[0] });
  response.cookies.set('ls1_superuser_session', token, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 3600 });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set('ls1_superuser_session', '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 });
  return response;
}
