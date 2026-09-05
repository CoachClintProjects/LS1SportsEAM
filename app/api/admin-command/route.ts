import { NextRequest, NextResponse } from 'next/server';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function headers(prefer = 'return=representation') {
  if (!KEY) throw new Error('Supabase service credentials are not configured.');
  return {
    apikey: KEY,
    Authorization: `Bearer ${KEY}`,
    'Content-Type': 'application/json',
    Prefer: prefer,
  };
}

async function rest(path: string, init: RequestInit = {}) {
  if (!URL || !KEY) throw new Error('Supabase service credentials are not configured.');
  const response = await fetch(`${URL}/rest/v1/${path}`, {
    ...init,
    headers: { ...headers(), ...(init.headers || {}) },
    cache: 'no-store',
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Supabase ${path} returned ${response.status}: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
}

export async function GET() {
  try {
    const [invoices, bills, tasks, athletes, teams] = await Promise.all([
      rest('invoices?select=id,invoice_number,invoice_date,due_date,total,balance_due,status&order=invoice_date.desc&limit=50'),
      rest('vendor_bills?select=id,bill_number,bill_date,due_date,total,balance_due,status&order=bill_date.desc&limit=50'),
      rest('work_items?select=id,work_type,status,priority,payload&status=neq.completed&order=id.desc&limit=50'),
      rest('athletes?select=id&status=eq.ACTIVE'),
      rest('teams?select=id&status=eq.active'),
    ]);

    const arBalance = (invoices || []).reduce((sum: number, row: Record<string, unknown>) => sum + Number(row.balance_due || 0), 0);
    const apBalance = (bills || []).reduce((sum: number, row: Record<string, unknown>) => sum + Number(row.balance_due || 0), 0);
    const pastDue = (invoices || []).filter((row: Record<string, unknown>) => {
      if (!row.due_date || Number(row.balance_due || 0) <= 0) return false;
      return new Date(String(row.due_date)).getTime() < Date.now();
    }).length;

    return NextResponse.json({
      invoices: invoices || [],
      vendorBills: bills || [],
      tasks: tasks || [],
      metrics: {
        arBalance,
        apBalance,
        openInvoices: (invoices || []).filter((row: Record<string, unknown>) => Number(row.balance_due || 0) > 0).length,
        pastDue,
        activeAthletes: (athletes || []).length,
        activeTeams: (teams || []).length,
      },
      generatedAt: new Date().toISOString(),
      source: 'LS1SportsEAM Supabase',
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Admin command data unavailable.' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = String(body.action || '');

    if (action === 'create-task') {
      const title = String(body.title || '').trim();
      if (!title) throw new Error('Task title is required.');
      const tenant = (await rest('tenants?select=id&limit=1'))?.[0]?.id || null;
      const row = await rest('work_items', {
        method: 'POST',
        body: JSON.stringify({
          tenant_id: tenant,
          work_type: 'ADMIN_TASK',
          status: 'open',
          priority: body.priority || 'normal',
          payload: {
            title,
            description: body.description || null,
            created_from: 'admin_command_center',
          },
        }),
      });
      return NextResponse.json({ ok: true, row: row?.[0] || null });
    }

    if (action === 'complete-task') {
      const id = String(body.id || '');
      if (!id) throw new Error('Task ID is required.');
      const row = await rest(`work_items?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'completed' }),
      });
      return NextResponse.json({ ok: true, row: row?.[0] || null });
    }

    throw new Error('Unsupported Admin action.');
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Admin action failed.' },
      { status: 400 },
    );
  }
}
