import { NextRequest, NextResponse } from 'next/server';
import { AthleteAuthError, requireAthlete } from '@/lib/server/requireAthlete';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://xedfstgwotzxnztpembv.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const AGE_BANDS = new Set(['5-8', '9-11', '12-14', '15-17', '18+']);

export async function GET(request: NextRequest) {
  try {
    if (!SERVICE_KEY) throw new Error('Supabase server credentials are not configured.');
    const actor = await requireAthlete(request);
    const requestedBand = request.nextUrl.searchParams.get('age') ?? actor.ageBand ?? '5-8';
    const previewBand = AGE_BANDS.has(requestedBand) ? requestedBand : '5-8';
    const ageBand = actor.isSuperUser ? previewBand : actor.ageBand;
    if (!ageBand) throw new AthleteAuthError('Athlete age band is unavailable for this account.', 403);

    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_athlete_hub`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ p_age_band: ageBand, p_athlete_number: actor.isSuperUser ? null : actor.athleteNumber }),
      cache: 'no-store',
    });

    const body = await response.text();
    if (!response.ok) throw new Error(`Supabase Athlete Hub RPC returned ${response.status}: ${body.slice(0, 300)}`);
    const payload = JSON.parse(body);
    return NextResponse.json({ ...payload, accessMode: actor.isSuperUser ? 'superuser-stage-preview' : 'authenticated-self', requestedAgeBand: ageBand }, {
      headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' },
    });
  } catch (error) {
    const status = error instanceof AthleteAuthError ? error.status : 500;
    return NextResponse.json(
      {
        athlete: null, availableBands: [], sports: [], teams: [], results: [], goals: [], development: [], schedule: [], badges: [], challenges: [], recruiting: { cycles: [], outreachCount: 0 }, documents: [], metrics: {}, reconciliation: {}, generatedAt: new Date().toISOString(), source: 'LS1SportsEAM Supabase', projection: 'authenticated-athlete-projection', error: error instanceof Error ? error.message : 'Athlete data unavailable',
      },
      { status, headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' } },
    );
  }
}
