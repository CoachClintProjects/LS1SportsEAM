import { NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('SuperUser server credentials are not configured.');
    }

    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_superuser_command`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: '{}',
      cache: 'no-store',
    });

    const body = await response.text();
    if (!response.ok) {
      throw new Error(`Supabase SuperUser RPC returned ${response.status}: ${body.slice(0, 400)}`);
    }

    return NextResponse.json(JSON.parse(body), {
      headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' },
    });
  } catch (error) {
    return NextResponse.json(
      {
        project: null,
        milestones: [],
        tasks: [],
        raci: [],
        units: [],
        inventory: [],
        counts: {},
        generatedAt: new Date().toISOString(),
        source: 'LS1SportsEAM Supabase',
        error: error instanceof Error ? error.message : 'Command data unavailable',
      },
      { status: 200, headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' } },
    );
  }
}
