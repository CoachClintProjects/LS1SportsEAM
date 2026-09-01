import { NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://xedfstgwotzxnztpembv.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_PUBLIC_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const key = SUPABASE_SERVICE_ROLE_KEY ?? SUPABASE_PUBLIC_KEY;
    if (!SUPABASE_URL || !key) {
      throw new Error('Supabase server credentials are not configured.');
    }

    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_superuser_command`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
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

    const payload = JSON.parse(body);
    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' },
    });
  } catch (error) {
    return NextResponse.json(
      {
        project: null,
        milestones: [],
        tasks: [],
        raci: [],
        counts: {},
        generatedAt: new Date().toISOString(),
        source: 'LS1SportsEAM Supabase',
        error: error instanceof Error ? error.message : 'Command data unavailable',
      },
      {
        status: 200,
        headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' },
      },
    );
  }
}
