import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://xedfstgwotzxnztpembv.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    if (!SERVICE_KEY) throw new Error('Supabase server credentials are not configured.');

    const familyId = request.nextUrl.searchParams.get('family');
    // Parent identity-to-family authorization is not enabled yet. Do not allow a public query parameter to select another family.
    if (familyId) throw new Error('Authenticated family identity is required before direct family records can be opened.');

    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_parent_hub`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ p_family_id: null }),
      cache: 'no-store',
    });

    const body = await response.text();
    if (!response.ok) throw new Error(`Supabase Parent Hub RPC returned ${response.status}: ${body.slice(0, 300)}`);

    return NextResponse.json(JSON.parse(body), {
      headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' },
    });
  } catch (error) {
    return NextResponse.json(
      {
        family: null,
        members: [],
        athletes: [],
        tasks: [],
        messages: [],
        invoices: [],
        documents: [],
        trips: [],
        custody: [],
        volunteer: [],
        metrics: {},
        generatedAt: new Date().toISOString(),
        source: 'LS1SportsEAM Supabase',
        error: error instanceof Error ? error.message : 'Parent data unavailable',
      },
      { status: 500, headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' } },
    );
  }
}
