import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return NextResponse.json({ error: 'Icons service is not configured' }, { status: 503 });
    }
    const supabase = createClient(url, key);
    const { data, error } = await supabase
      .from('icon_registry')
      .select('*')
      .order('icon_name', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ icons: data });
  } catch (error) {
    console.error('Error fetching icons:', error);
    return NextResponse.json(
      { error: 'Failed to fetch icons' },
      { status: 500 }
    );
  }
}
