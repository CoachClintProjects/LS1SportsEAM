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

async function rest(path: string, init: RequestInit = {}, prefer = 'return=representation') {
  if (!URL || !KEY) throw new Error('Supabase service credentials are not configured.');
  const response = await fetch(`${URL}/rest/v1/${path}`, {
    ...init,
    headers: { ...headers(prefer), ...(init.headers || {}) },
    cache: 'no-store',
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Supabase ${path} returned ${response.status}: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
}

async function audit(args: {
  tenantId?: string | null;
  action: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
}) {
  try {
    await rest('audit_events', {
      method: 'POST',
      body: JSON.stringify({
        tenant_id: args.tenantId || null,
        action: args.action,
        entity_type: 'work_items',
        entity_id: args.entityId || null,
        before_data: args.before ?? null,
        after_data: args.after ?? null,
        reason: args.reason || 'Admin Command Center',
        privileged: false,
      }),
    });
  } catch (error) {
    console.error('[admin-command] audit write failed', error);
  }
}

async function getTask(id: string) {
  const rows = await rest(`work_items?select=id,tenant_id,work_type,status,priority,payload&id=eq.${encodeURIComponent(id)}&limit=1`);
  return rows?.[0] || null;
}

export async function GET() {
  try {
    const [invoices, bills, tasks, athletes, teams] = await Promise.all([
      rest('invoices?select=id,invoice_number,invoice_date,due_date,total,balance_due,status&order=invoice_date.desc&limit=50'),
      rest('vendor_bills?select=id,bill_number,bill_date,due_date,total,balance_due,status&order=bill_date.desc&limit=50'),
      rest('work_items?select=id,tenant_id,work_type,status,priority,payload&work_type=eq.ADMIN_TASK&order=id.desc&limit=100'),
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
      const created = row?.[0] || null;
      await audit({ tenantId: tenant, action: 'ADMIN_TASK_CREATE', entityId: created?.id, after: created });
      return NextResponse.json({ ok: true, row: created });
    }

    if (action === 'update-task') {
      const id = String(body.id || '');
      const title = String(body.title || '').trim();
      if (!id) throw new Error('Task ID is required.');
      if (!title) throw new Error('Task title is required.');
      const before = await getTask(id);
      if (!before || before.work_type !== 'ADMIN_TASK') throw new Error('Admin task not found.');
      const row = await rest(`work_items?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          priority: body.priority || before.priority || 'normal',
          payload: {
            ...(before.payload || {}),
            title,
            description: body.description || null,
          },
        }),
      });
      const updated = row?.[0] || null;
      await audit({ tenantId: before.tenant_id, action: 'ADMIN_TASK_UPDATE', entityId: id, before, after: updated });
      return NextResponse.json({ ok: true, row: updated });
    }

    if (action === 'complete-task' || action === 'reopen-task') {
      const id = String(body.id || '');
      if (!id) throw new Error('Task ID is required.');
      const before = await getTask(id);
      if (!before || before.work_type !== 'ADMIN_TASK') throw new Error('Admin task not found.');
      const nextStatus = action === 'complete-task' ? 'completed' : 'open';
      const row = await rest(`work_items?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      const updated = row?.[0] || null;
      await audit({
        tenantId: before.tenant_id,
        action: action === 'complete-task' ? 'ADMIN_TASK_COMPLETE' : 'ADMIN_TASK_REOPEN',
        entityId: id,
        before,
        after: updated,
      });
      return NextResponse.json({ ok: true, row: updated });
    }

    if (action === 'delete-task') {
      const id = String(body.id || '');
      if (!id) throw new Error('Task ID is required.');
      const before = await getTask(id);
      if (!before || before.work_type !== 'ADMIN_TASK') throw new Error('Admin task not found.');
      await rest(`work_items?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
      await audit({ tenantId: before.tenant_id, action: 'ADMIN_TASK_DELETE', entityId: id, before, after: null });
      return NextResponse.json({ ok: true, id });
    }

    throw new Error('Unsupported Admin action.');
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Admin action failed.' },
      { status: 400 },
    );
  }
}
