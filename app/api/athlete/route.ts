import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://xedfstgwotzxnztpembv.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    if (!SERVICE_KEY) throw new Error('Supabase server credentials are not configured.');
    const athleteNumber = request.nextUrl.searchParams.get('athlete');
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_athlete_demo`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ p_athlete_number: athleteNumber || null }),
      cache: 'no-store',
    });
    const body = await response.text();
    if (!response.ok) throw new Error(`Supabase Athlete RPC returned ${response.status}: ${body.slice(0, 300)}`);
    return NextResponse.json(JSON.parse(body), { headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' } });
  } catch (error) {
    return NextResponse.json({ athlete: null, availableAthletes: [], sports: [], teams: [], results: [], goals: [], development: [], metrics: {}, generatedAt: new Date().toISOString(), source: 'LS1SportsEAM Supabase', projection: 'public-adult-demo', error: error instanceof Error ? error.message : 'Athlete data unavailable' }, { status: 200, headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' } });
  }
}
