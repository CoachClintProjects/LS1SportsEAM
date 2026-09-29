import { NextRequest, NextResponse } from 'next/server';
import { resolveAccess, serviceHeaders } from '@/lib/server/accessControl';
import { supabaseServerConfig } from '@/lib/server/superuserAuth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const context = await resolveAccess(request);
  if (!context) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  if (!context.allowedHubs.includes('admin')) return NextResponse.json({ error: 'Admin access denied.' }, { status: 403 });
  if (!context.isPlatformSuperUser) return NextResponse.json({ selectionRequired: false, organizations: [], userId: context.user.id });
  const { url } = supabaseServerConfig();
  const headers = serviceHeaders();
  if (!url || !headers) return NextResponse.json({ error: 'Canonical store unavailable.' }, { status: 503 });
  const response = await fetch(`${url}/rest/v1/organizations?select=id,tenant_id,name,code,status&order=name.asc&limit=1000`, { headers, cache: 'no-store' });
  if (!response.ok) return NextResponse.json({ error: 'Canonical organizations unavailable.' }, { status: 502 });
  const organizations = await response.json() as Array<{ id: string; tenant_id: string; name: string; code: string; status: string }>;
  const available = organizations.filter(org => org.tenant_id);
  return NextResponse.json({ selectionRequired: available.length !== 1, organizations: available, userId: context.user.id });
}
