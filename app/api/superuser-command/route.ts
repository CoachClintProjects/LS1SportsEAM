import { NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://xedfstgwotzxnztpembv.supabase.co';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;

export async function GET() {
  try {
    if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Supabase public credentials are not configured.');
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_superuser_command`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: '{}',
      cache: 'no-store',
    });
    const body = await response.text();
    if (!response.ok) throw new Error(`Supabase SuperUser RPC returned ${response.status}: ${body.slice(0, 240)}`);
    const payload = JSON.parse(body);
    return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (error) {
    return NextResponse.json({ project: null, milestones: [], tasks: [], raci: [], counts: {}, generatedAt: new Date().toISOString(), source: 'LS1SportsEAM Supabase', error: error instanceof Error ? error.message : 'Command data unavailable' }, { status: 200, headers: { 'Cache-Control': 'no-store, max-age=0' } });
  }
}
