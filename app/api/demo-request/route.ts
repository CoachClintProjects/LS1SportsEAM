import { NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function clean(value: unknown, max = 500) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export async function POST(request: Request) {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Demo intake is not configured.' }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const name = clean(body.name, 160);
  const organization = clean(body.organization, 200);
  const email = clean(body.email, 320).toLowerCase();

  if (!name || !organization || !email || !email.includes('@')) {
    return NextResponse.json({ error: 'Name, organization and a valid work email are required.' }, { status: 400 });
  }

  const payload = {
    name,
    organization,
    email,
    role_title: clean(body.role_title, 200) || null,
    phone: clean(body.phone, 80) || null,
    preferred_timing: clean(body.preferred_timing, 200) || null,
    message: clean(body.message, 2000) || null,
    status: 'requested',
  };

  const response = await fetch(`${SUPABASE_URL}/rest/v1/demo_requests`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error('[demo-request] Supabase insert failed', response.status, detail);
    return NextResponse.json({ error: 'Unable to submit the demo request.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
