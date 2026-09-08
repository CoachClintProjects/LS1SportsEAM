import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return NextResponse.json({ error: 'Icon service is not configured.' }, { status: 500 });
    }

    const response = await fetch(
      `${url}/rest/v1/icon_registry?select=*&order=icon_name.asc`,
      {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          Accept: 'application/json',
        },
        cache: 'no-store',
      },
    );

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Icon registry request failed (${response.status}): ${detail.slice(0, 300)}`);
    }

    const icons = await response.json();
    return NextResponse.json({ icons }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (error) {
    console.error('Error fetching icons:', error);
    return NextResponse.json({ error: 'Failed to fetch icons' }, { status: 500 });
  }
}
