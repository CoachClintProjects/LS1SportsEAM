import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET: Load onboarding case
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const caseId = searchParams.get('caseId');

  if (!caseId) {
    return NextResponse.json({ error: 'Case ID required' }, { status: 400 });
  }

  try {
    const { data, error } = await supabase
      .from('client_onboarding_cases')
      .select('*')
      .eq('case_id', caseId)
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load case' }, { status: 500 });
  }
}

// POST: Create or update onboarding case
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { caseId, ...data } = body;

    if (caseId) {
      // Update existing
      const { data: updated, error } = await supabase
        .from('client_onboarding_cases')
        .update({
          ...data,
          updated_at: new Date().toISOString()
        })
        .eq('case_id', caseId)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json(updated);
    } else {
      // Create new
      const { data: created, error } = await supabase
        .from('client_onboarding_cases')
        .insert({
          ...data,
          status: 'in_progress',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json(created);
    }
  } catch (error) {
    return NextResponse.json({ error: 'Failed to save case' }, { status: 500 });
  }
}
