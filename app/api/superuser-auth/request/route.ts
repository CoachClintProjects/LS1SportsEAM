import { NextRequest, NextResponse } from 'next/server';
import { supabaseServerConfig } from '@/lib/server/superuserAuth';

export async function POST(request: NextRequest) {
  const { url, serviceKey, publicKey } = supabaseServerConfig();
  if (!serviceKey || !publicKey) return NextResponse.json({ error: 'Authentication is not configured.' }, { status: 500 });
  const body = await request.json() as { email?: string };
  const email = body.email?.trim().toLowerCase();
  if (!email) return NextResponse.json({ error: 'Email is required.' }, { status: 400 });

  const allowed = await fetch(`${url}/rest/v1/platform_superuser_operators?select=id&active=eq.true&email=ilike.${encodeURIComponent(email)}`, { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }, cache: 'no-store' });
  const rows = allowed.ok ? await allowed.json() as Array<{ id: string }> : [];
  if (!rows.length) return NextResponse.json({ error: 'This email is not authorized for SuperUser operations.' }, { status: 403 });

  const redirectTo = `${request.nextUrl.origin}/superuser/auth/callback`;
  const auth = await fetch(`${url}/auth/v1/otp?redirect_to=${encodeURIComponent(redirectTo)}`, {
    method: 'POST',
    headers: { apikey: publicKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, create_user: true }),
    cache: 'no-store',
  });
  const text = await auth.text();
  if (!auth.ok) return NextResponse.json({ error: `Unable to send sign-in link: ${text.slice(0, 200)}` }, { status: 400 });
  return NextResponse.json({ ok: true, message: 'Check your email for the LS1Sports SuperUser sign-in link.' });
}
