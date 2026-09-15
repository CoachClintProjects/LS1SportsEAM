import { NextRequest, NextResponse } from 'next/server';
import { supabaseServerConfig } from '@/lib/server/superuserAuth';

type HubId = 'superuser' | 'athlete' | 'parent' | 'coach' | 'admin' | 'official' | 'scout';
const HUB_ORDER: HubId[] = ['superuser', 'admin', 'coach', 'athlete', 'parent', 'official', 'scout'];

function roleToHub(code: string, name: string): HubId | null {
  const value = `${code} ${name}`.toLowerCase();
  if (/super.?user|platform.?admin/.test(value)) return 'superuser';
  if (/coach/.test(value)) return 'coach';
  if (/athlete|player/.test(value)) return 'athlete';
  if (/parent|guardian/.test(value)) return 'parent';
  if (/official|referee|judge|umpire/.test(value)) return 'official';
  if (/scout|recruit/.test(value)) return 'scout';
  if (/admin|registrar|treasurer|finance|facility|payroll|compliance|board|secretary/.test(value)) return 'admin';
  return null;
}

export async function GET(request: NextRequest) {
  const { url, serviceKey, publicKey } = supabaseServerConfig();
  if (!serviceKey || !publicKey) return NextResponse.json({ error: 'Authentication is not configured.' }, { status: 500 });

  const authorization = request.headers.get('authorization') || '';
  const token = authorization.toLowerCase().startsWith('bearer ') ? authorization.slice(7).trim() : '';
  if (!token) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  const userResponse = await fetch(`${url}/auth/v1/user`, { headers: { apikey: publicKey, Authorization: `Bearer ${token}` }, cache: 'no-store' });
  if (!userResponse.ok) return NextResponse.json({ error: 'Session is invalid or expired.' }, { status: 401 });
  const user = await userResponse.json() as { id?: string; email?: string };
  const email = user.email?.trim().toLowerCase();
  if (!email) return NextResponse.json({ error: 'Authenticated account has no email.' }, { status: 403 });

  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
  const operatorResponse = await fetch(`${url}/rest/v1/platform_superuser_operators?select=email&active=eq.true&email=ilike.${encodeURIComponent(email)}`, { headers, cache: 'no-store' });
  const operators = operatorResponse.ok ? await operatorResponse.json() as Array<{ email: string }> : [];

  const peopleResponse = await fetch(`${url}/rest/v1/people?select=id,tenant_id,email&email=ilike.${encodeURIComponent(email)}`, { headers, cache: 'no-store' });
  const people = peopleResponse.ok ? await peopleResponse.json() as Array<{ id: string; tenant_id: string | null; email: string | null }> : [];
  const person = people[0] || null;

  const roles: Array<{ code: string; name: string; role_type: string | null; organization_id: string | null }> = [];
  if (person) {
    const assignmentResponse = await fetch(`${url}/rest/v1/role_assignments?select=organization_id,status,starts_at,ends_at,role_definitions(code,name,role_type,is_active)&person_id=eq.${person.id}&status=eq.active`, { headers, cache: 'no-store' });
    if (assignmentResponse.ok) {
      const assignments = await assignmentResponse.json() as Array<{ organization_id: string | null; starts_at: string | null; ends_at: string | null; role_definitions: { code: string; name: string; role_type: string | null; is_active: boolean } | null }>;
      const now = Date.now();
      for (const assignment of assignments) {
        const role = assignment.role_definitions;
        if (!role?.is_active) continue;
        if (assignment.starts_at && Date.parse(assignment.starts_at) > now) continue;
        if (assignment.ends_at && Date.parse(assignment.ends_at) <= now) continue;
        roles.push({ code: role.code, name: role.name, role_type: role.role_type, organization_id: assignment.organization_id });
      }
    }
  }

  const allowed = new Set<HubId>();
  if (operators.length) allowed.add('superuser');
  for (const role of roles) {
    const hub = roleToHub(role.code, role.name);
    if (hub) allowed.add(hub);
  }

  // Never advertise a workspace that canonical access does not grant.
  const allowedHubs = HUB_ORDER.filter((hub) => allowed.has(hub));
  return NextResponse.json({
    authenticated: true,
    user: { id: user.id || null, email },
    person: person ? { id: person.id, tenant_id: person.tenant_id } : null,
    roles,
    allowedHubs,
    isPlatformSuperUser: operators.length > 0,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
