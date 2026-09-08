import { NextRequest, NextResponse } from 'next/server';
import { requireSuperUser, SuperUserAuthError, type SuperUserIdentity } from '@/lib/server/requireSuperUser';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://xedfstgwotzxnztpembv.supabase.co';
const PUBLIC_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type NavRow = {
  nav_id: string;
  label: string;
  path: string | null;
  icon: string | null;
  description: string | null;
  sort_order: number | null;
  parent_id: string | null;
  is_active: boolean | null;
};

type RoleRow = { role_id: string };
type PermissionRow = { nav_id: string };

const ALLOWED_HUBS = new Set(['superuser', 'admin', 'athlete', 'parent', 'official', 'scout', 'coach']);

async function rest<T>(path: string, actor?: SuperUserIdentity | null): Promise<T> {
  const key = actor ? PUBLIC_KEY : (SERVICE_KEY ?? PUBLIC_KEY);
  const token = actor?.accessToken ?? SERVICE_KEY ?? PUBLIC_KEY;
  if (!key || !token) throw new Error('Supabase navigation access is not configured.');
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Navigation data request failed (${response.status}): ${body.slice(0, 300)}`);
  }
  return response.json() as Promise<T>;
}

function withoutSubtree(rows: NavRow[], rootLabel: string) {
  const rootIds = new Set(rows.filter(row => row.label === rootLabel).map(row => row.nav_id));
  if (!rootIds.size) return rows;
  const excluded = new Set(rootIds);
  let changed = true;
  while (changed) {
    changed = false;
    for (const row of rows) {
      if (row.parent_id && excluded.has(row.parent_id) && !excluded.has(row.nav_id)) {
        excluded.add(row.nav_id);
        changed = true;
      }
    }
  }
  return rows.filter(row => !excluded.has(row.nav_id));
}

export async function GET(request: NextRequest) {
  try {
    const hubId = (request.nextUrl.searchParams.get('hub') || '').trim().toLowerCase();
    const switcherValue = (request.nextUrl.searchParams.get('switcher') || '').trim();
    if (!ALLOWED_HUBS.has(hubId)) return NextResponse.json({ error: 'Unknown hub.' }, { status: 400 });

    const actor = hubId === 'superuser' ? await requireSuperUser(request) : null;
    const rows = await rest<NavRow[]>(
      `hub_navigation?select=nav_id,label,path,icon,description,sort_order,parent_id,is_active&hub_id=eq.${encodeURIComponent(hubId)}&is_active=eq.true&order=sort_order.asc`,
      actor,
    );

    let filtered = rows;
    // Competition is preserved in canonical navigation data for its future domain,
    // but it is intentionally excluded from the active Team Engine Super User release.
    if (hubId === 'superuser') filtered = withoutSubtree(filtered, 'Competition Engine');

    if (hubId === 'admin' && switcherValue) {
      const roles = await rest<RoleRow[]>(`admin_roles?select=role_id&role_name=eq.${encodeURIComponent(switcherValue)}&limit=1`);
      const roleId = roles[0]?.role_id;
      if (roleId) {
        const permissions = await rest<PermissionRow[]>(`hub_role_navigation?select=nav_id&role_id=eq.${encodeURIComponent(roleId)}&can_view=eq.true`);
        const allowed = new Set(permissions.map(item => item.nav_id));
        const childParents = new Set(rows.filter(row => row.parent_id && allowed.has(row.nav_id)).map(row => row.parent_id as string));
        filtered = rows.filter(row => allowed.has(row.nav_id) || childParents.has(row.nav_id) || row.label === 'Command Center');
      }
    }

    return NextResponse.json(
      { hubId, rows: filtered, generatedAt: new Date().toISOString(), source: 'LS1SportsEAM hub_navigation' },
      { headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' } },
    );
  } catch (error) {
    if (error instanceof SuperUserAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Navigation unavailable.' }, { status: 500 });
  }
}
