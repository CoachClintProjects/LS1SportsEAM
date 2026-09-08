import { NextRequest, NextResponse } from 'next/server';
import { requireSuperUser, SuperUserAuthError } from '@/lib/server/requireSuperUser';
import { writeAuditEvent } from '@/lib/server/writeAuditEvent';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Row = Record<string, unknown>;

function headers() {
  if (!KEY) throw new Error('Supabase service credentials are not configured.');
  return {
    apikey: KEY,
    Authorization: `Bearer ${KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
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
  if (!response.ok) throw new Error(`Supabase ${path} returned ${response.status}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : null;
}

function req(value: unknown, label: string, max = 200) {
  const text = String(value ?? '').trim();
  if (!text) throw new Error(`${label} is required.`);
  if (text.length > max) throw new Error(`${label} is too long.`);
  return text;
}

function opt(value: unknown, max = 1000) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  if (text.length > max) throw new Error('Value is too long.');
  return text;
}

async function one(table: string, id: string) {
  return (await rest(`${table}?id=eq.${encodeURIComponent(id)}&select=*&limit=1`))?.[0] || null;
}

async function tenantId() {
  return (await rest('tenants?select=id&limit=1'))?.[0]?.id || null;
}

async function audit(
  actor: Awaited<ReturnType<typeof requireSuperUser>>,
  tenant: string | null,
  action: string,
  table: string,
  id: string | null,
  before: unknown,
  after: unknown,
  reason: string,
) {
  await writeAuditEvent(actor, {
    action,
    entityType: table,
    entityId: id,
    tenantId: tenant,
    beforeData: before ?? null,
    afterData: after ?? null,
    reason,
  });
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireSuperUser(request);
    if (!actor.canManagePlatformSettings) {
      throw new SuperUserAuthError('Platform-management permission required.', 403);
    }

    const body = await request.json() as Row;
    const action = String(body.action || '');
    const tenant = await tenantId();

    if (action === 'create-program') {
      const item = (await rest('programs', {
        method: 'POST',
        body: JSON.stringify({
          organization_id: req(body.organization_id, 'Organization ID', 80),
          sport_id: opt(body.sport_id, 80),
          code: req(body.code, 'Program code', 80),
          name: req(body.name, 'Program name'),
          program_type: opt(body.program_type, 100),
          status: req(body.status || 'active', 'Status', 40).toLowerCase(),
        }),
      }))?.[0];
      await audit(actor, tenant, 'TEAM_MANAGER_PROGRAM_CREATED', 'programs', item?.id || null, null, item || body, 'Super User created Team Manager program');
      return NextResponse.json(item);
    }

    if (action === 'set-program-status') {
      const id = req(body.id, 'Program ID', 80);
      const before = await one('programs', id);
      if (!before) return NextResponse.json({ error: 'Program not found.' }, { status: 404 });
      const after = (await rest(`programs?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: req(body.status, 'Status', 40).toLowerCase() }),
      }))?.[0];
      await audit(actor, tenant, 'TEAM_MANAGER_PROGRAM_STATUS_CHANGED', 'programs', id, before, after, 'Super User changed Team Manager program lifecycle');
      return NextResponse.json(after);
    }

    if (action === 'create-season') {
      const item = (await rest('seasons', {
        method: 'POST',
        body: JSON.stringify({
          organization_id: req(body.organization_id, 'Organization ID', 80),
          sport_id: opt(body.sport_id, 80),
          code: req(body.code, 'Season code', 80),
          name: req(body.name, 'Season name'),
          starts_on: opt(body.starts_on, 20),
          ends_on: opt(body.ends_on, 20),
          status: req(body.status || 'planned', 'Status', 40).toLowerCase(),
        }),
      }))?.[0];
      await audit(actor, tenant, 'TEAM_MANAGER_SEASON_CREATED', 'seasons', item?.id || null, null, item || body, 'Super User created Team Manager season');
      return NextResponse.json(item);
    }

    if (action === 'set-season-status') {
      const id = req(body.id, 'Season ID', 80);
      const before = await one('seasons', id);
      if (!before) return NextResponse.json({ error: 'Season not found.' }, { status: 404 });
      const after = (await rest(`seasons?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: req(body.status, 'Status', 40).toLowerCase() }),
      }))?.[0];
      await audit(actor, tenant, 'TEAM_MANAGER_SEASON_STATUS_CHANGED', 'seasons', id, before, after, 'Super User changed Team Manager season lifecycle');
      return NextResponse.json(after);
    }

    if (action === 'create-team') {
      const item = (await rest('teams', {
        method: 'POST',
        body: JSON.stringify({
          organization_id: req(body.organization_id, 'Organization ID', 80),
          sport_id: opt(body.sport_id, 80),
          program_id: opt(body.program_id, 80),
          season_id: opt(body.season_id, 80),
          code: req(body.code, 'Team code', 80),
          name: req(body.name, 'Team name'),
          competitive_level: opt(body.competitive_level, 100),
          status: req(body.status || 'active', 'Status', 40).toLowerCase(),
        }),
      }))?.[0];
      await audit(actor, tenant, 'TEAM_MANAGER_TEAM_CREATED', 'teams', item?.id || null, null, item || body, 'Super User created Team Manager team');
      return NextResponse.json(item);
    }

    if (action === 'set-team-status') {
      const id = req(body.id, 'Team ID', 80);
      const before = await one('teams', id);
      if (!before) return NextResponse.json({ error: 'Team not found.' }, { status: 404 });
      const after = (await rest(`teams?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: req(body.status, 'Status', 40).toLowerCase() }),
      }))?.[0];
      await audit(actor, tenant, 'TEAM_MANAGER_TEAM_STATUS_CHANGED', 'teams', id, before, after, 'Super User changed Team Manager team lifecycle');
      return NextResponse.json(after);
    }

    if (action === 'create-membership') {
      const item = (await rest('memberships', {
        method: 'POST',
        body: JSON.stringify({
          organization_id: req(body.organization_id, 'Organization ID', 80),
          person_id: req(body.person_id, 'Person ID', 80),
          sport_id: opt(body.sport_id, 80),
          membership_number: opt(body.membership_number, 100),
          membership_type: opt(body.membership_type, 100),
          starts_on: opt(body.starts_on, 20),
          ends_on: opt(body.ends_on, 20),
          governing_body_id: opt(body.governing_body_id, 80),
          status: req(body.status || 'active', 'Status', 40).toLowerCase(),
        }),
      }))?.[0];
      await audit(actor, tenant, 'TEAM_MANAGER_MEMBERSHIP_CREATED', 'memberships', item?.id || null, null, item || body, 'Super User created organization membership');
      return NextResponse.json(item);
    }

    if (action === 'set-membership-status') {
      const id = req(body.id, 'Membership ID', 80);
      const before = await one('memberships', id);
      if (!before) return NextResponse.json({ error: 'Membership not found.' }, { status: 404 });
      const after = (await rest(`memberships?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: req(body.status, 'Status', 40).toLowerCase() }),
      }))?.[0];
      await audit(actor, tenant, 'TEAM_MANAGER_MEMBERSHIP_STATUS_CHANGED', 'memberships', id, before, after, 'Super User changed organization membership lifecycle');
      return NextResponse.json(after);
    }

    if (action === 'add-roster-member') {
      const athleteId = opt(body.athlete_id, 80);
      const personId = opt(body.person_id, 80);
      if (!athleteId && !personId) throw new Error('Athlete ID or Person ID is required.');
      const item = (await rest('team_memberships', {
        method: 'POST',
        body: JSON.stringify({
          team_id: req(body.team_id, 'Team ID', 80),
          athlete_id: athleteId,
          person_id: personId,
          membership_type: req(body.membership_type, 'Membership type', 80),
          starts_on: opt(body.starts_on, 20),
          ends_on: opt(body.ends_on, 20),
          jersey_number: opt(body.jersey_number, 40),
          notes: opt(body.notes, 1000),
          status: req(body.status || 'active', 'Status', 40).toLowerCase(),
        }),
      }))?.[0];
      await audit(actor, tenant, 'TEAM_MANAGER_ROSTER_MEMBER_ADDED', 'team_memberships', item?.id || null, null, item || body, 'Super User added Team Manager roster membership');
      return NextResponse.json(item);
    }

    if (action === 'set-roster-status') {
      const id = req(body.id, 'Roster membership ID', 80);
      const before = await one('team_memberships', id);
      if (!before) return NextResponse.json({ error: 'Roster membership not found.' }, { status: 404 });
      const after = (await rest(`team_memberships?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: req(body.status, 'Status', 40).toLowerCase() }),
      }))?.[0];
      await audit(actor, tenant, 'TEAM_MANAGER_ROSTER_STATUS_CHANGED', 'team_memberships', id, before, after, 'Super User changed Team Manager roster membership lifecycle');
      return NextResponse.json(after);
    }

    return NextResponse.json({ error: 'Unknown Team Manager action.' }, { status: 400 });
  } catch (error) {
    if (error instanceof SuperUserAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Team Manager action failed.' }, { status: 500 });
  }
}
