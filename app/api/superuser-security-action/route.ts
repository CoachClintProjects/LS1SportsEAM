import { NextRequest, NextResponse } from 'next/server';
import { requireSuperUser, SuperUserAuthError } from '@/lib/server/requireSuperUser';
import { writeAuditEvent } from '@/lib/server/writeAuditEvent';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function headers() {
  if (!KEY) throw new Error('Supabase service credentials are not configured.');
  return { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' };
}

async function rest(path: string, init: RequestInit = {}) {
  if (!URL || !KEY) throw new Error('Supabase service credentials are not configured.');
  const response = await fetch(`${URL}/rest/v1/${path}`, { ...init, headers: { ...headers(), ...(init.headers || {}) }, cache: 'no-store' });
  const text = await response.text();
  if (!response.ok) throw new Error(`Supabase ${path} returned ${response.status}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : null;
}

function required(value: unknown, label: string, max = 160) {
  const result = String(value || '').trim();
  if (!result) throw new Error(`${label} is required.`);
  if (result.length > max) throw new Error(`${label} must be ${max} characters or fewer.`);
  return result;
}

function nullable(value: unknown, max = 500) {
  const result = String(value || '').trim();
  if (!result) return null;
  if (result.length > max) throw new Error(`Value must be ${max} characters or fewer.`);
  return result;
}

async function defaultTenant() {
  return (await rest('tenants?select=id&limit=1'))?.[0]?.id || null;
}

async function getRow(table: string, id: string) {
  return (await rest(`${table}?id=eq.${encodeURIComponent(id)}&select=*&limit=1`))?.[0] || null;
}

async function securityEvent(actor: Awaited<ReturnType<typeof requireSuperUser>>, eventType: string, details: Record<string, unknown>, tenantId?: string | null) {
  const row = await rest('security_events', {
    method: 'POST',
    body: JSON.stringify({
      tenant_id: tenantId || null,
      person_id: null,
      event_type: eventType,
      severity: 'info',
      success: true,
      details: { ...details, actor_user_id: actor.userId, operator_id: actor.operatorId, operator_email: actor.email },
    }),
  });
  return row?.[0] || null;
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireSuperUser(request);
    if (!actor.canManagePlatformSettings) throw new SuperUserAuthError('Platform-management permission required.', 403);
    const body = await request.json();
    const action = String(body.action || '');
    const tenantId = String(body.tenant_id || '') || await defaultTenant();

    if (action === 'create-role') {
      const created = await rest('roles', { method: 'POST', body: JSON.stringify({
        code: required(body.code, 'Role code', 80).toUpperCase(),
        name: required(body.name, 'Role name'),
        description: nullable(body.description),
        privilege_level: Math.max(0, Number(body.privilege_level || 0)),
      }) });
      const item = created?.[0];
      await securityEvent(actor, 'ROLE_CREATED', { role_id: item?.id, code: item?.code, privilege_level: item?.privilege_level }, tenantId);
      await writeAuditEvent(actor, { action: 'ROLE_CREATED', entityType: 'roles', entityId: item?.id || null, tenantId, afterData: item || body, reason: 'Super User created role' });
      return NextResponse.json(item);
    }

    if (action === 'create-permission') {
      const created = await rest('permissions', { method: 'POST', body: JSON.stringify({
        code: required(body.code, 'Permission code', 100).toUpperCase(),
        name: required(body.name, 'Permission name'),
        resource: nullable(body.resource, 120),
        action: nullable(body.permission_action, 120),
        field_scope: nullable(body.field_scope, 160),
      }) });
      const item = created?.[0];
      await securityEvent(actor, 'PERMISSION_CREATED', { permission_id: item?.id, code: item?.code }, tenantId);
      await writeAuditEvent(actor, { action: 'PERMISSION_CREATED', entityType: 'permissions', entityId: item?.id || null, tenantId, afterData: item || body, reason: 'Super User created permission' });
      return NextResponse.json(item);
    }

    if (action === 'grant-role-permission') {
      const roleId = required(body.role_id, 'Role ID', 80);
      const permissionId = required(body.permission_id, 'Permission ID', 80);
      const existing = await rest(`role_permissions?role_id=eq.${encodeURIComponent(roleId)}&permission_id=eq.${encodeURIComponent(permissionId)}&select=*`);
      if (existing?.length) return NextResponse.json(existing[0]);
      const created = await rest('role_permissions', { method: 'POST', body: JSON.stringify({ role_id: roleId, permission_id: permissionId }) });
      await securityEvent(actor, 'ROLE_PERMISSION_GRANTED', { role_id: roleId, permission_id: permissionId }, tenantId);
      await writeAuditEvent(actor, { action: 'ROLE_PERMISSION_GRANTED', entityType: 'role_permissions', tenantId, afterData: { role_id: roleId, permission_id: permissionId }, reason: 'Super User granted permission to role' });
      return NextResponse.json(created?.[0] || { role_id: roleId, permission_id: permissionId });
    }

    if (action === 'revoke-role-permission') {
      const roleId = required(body.role_id, 'Role ID', 80);
      const permissionId = required(body.permission_id, 'Permission ID', 80);
      const before = (await rest(`role_permissions?role_id=eq.${encodeURIComponent(roleId)}&permission_id=eq.${encodeURIComponent(permissionId)}&select=*`))?.[0] || null;
      await rest(`role_permissions?role_id=eq.${encodeURIComponent(roleId)}&permission_id=eq.${encodeURIComponent(permissionId)}`, { method: 'DELETE' });
      await securityEvent(actor, 'ROLE_PERMISSION_REVOKED', { role_id: roleId, permission_id: permissionId }, tenantId);
      await writeAuditEvent(actor, { action: 'ROLE_PERMISSION_REVOKED', entityType: 'role_permissions', tenantId, beforeData: before, afterData: { role_id: roleId, permission_id: permissionId, revoked: true }, reason: 'Super User revoked permission from role' });
      return NextResponse.json({ ok: true });
    }

    if (action === 'assign-person-role') {
      if (!tenantId) throw new Error('Tenant is required for role assignment.');
      const created = await rest('person_role_assignments', { method: 'POST', body: JSON.stringify({
        tenant_id: tenantId,
        person_id: required(body.person_id, 'Person ID', 80),
        role_id: required(body.role_id, 'Role ID', 80),
        organization_id: nullable(body.organization_id, 80),
        sport_id: nullable(body.sport_id, 80),
        site_id: nullable(body.site_id, 80),
        team_id: nullable(body.team_id, 80),
        starts_at: body.starts_at || new Date().toISOString(),
        ends_at: body.ends_at || null,
        status: String(body.status || 'active').toLowerCase(),
      }) });
      const item = created?.[0];
      await securityEvent(actor, 'PERSON_ROLE_ASSIGNED', { assignment_id: item?.id, person_id: item?.person_id, role_id: item?.role_id }, tenantId);
      await writeAuditEvent(actor, { action: 'PERSON_ROLE_ASSIGNED', entityType: 'person_role_assignments', entityId: item?.id || null, tenantId, afterData: item || body, reason: 'Super User assigned scoped role' });
      return NextResponse.json(item);
    }

    if (action === 'end-person-role') {
      const id = required(body.id, 'Assignment ID', 80);
      const before = await getRow('person_role_assignments', id);
      if (!before) return NextResponse.json({ error: 'Role assignment not found.' }, { status: 404 });
      const updated = await rest(`person_role_assignments?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ status: 'ended', ends_at: new Date().toISOString() }) });
      const after = updated?.[0] || await getRow('person_role_assignments', id);
      await securityEvent(actor, 'PERSON_ROLE_ENDED', { assignment_id: id, person_id: before.person_id, role_id: before.role_id }, before.tenant_id || tenantId);
      await writeAuditEvent(actor, { action: 'PERSON_ROLE_ENDED', entityType: 'person_role_assignments', entityId: id, tenantId: before.tenant_id || tenantId, beforeData: before, afterData: after, reason: 'Super User ended scoped role assignment' });
      return NextResponse.json(after);
    }

    if (action === 'create-raci-assignment') {
      if (!tenantId) throw new Error('Tenant is required for RACI assignment.');
      const responsibility = required(body.responsibility, 'Responsibility', 1).toUpperCase();
      if (!['R','A','C','I'].includes(responsibility)) throw new Error('Responsibility must be R, A, C, or I.');
      if (!body.person_id && !body.role_id) throw new Error('RACI assignment requires a person or role.');
      const created = await rest('platform_raci_assignments', { method: 'POST', body: JSON.stringify({
        tenant_id: tenantId,
        project_id: nullable(body.project_id, 80),
        task_id: nullable(body.task_id, 80),
        person_id: nullable(body.person_id, 80),
        role_id: nullable(body.role_id, 80),
        responsibility,
        effective_from: body.effective_from || new Date().toISOString().slice(0, 10),
        effective_to: body.effective_to || null,
        notes: nullable(body.notes),
      }) });
      const item = created?.[0];
      await securityEvent(actor, 'RACI_ASSIGNMENT_CREATED', { raci_id: item?.id, responsibility }, tenantId);
      await writeAuditEvent(actor, { action: 'RACI_ASSIGNMENT_CREATED', entityType: 'platform_raci_assignments', entityId: item?.id || null, tenantId, afterData: item || body, reason: 'Super User assigned RACI authority' });
      return NextResponse.json(item);
    }

    if (action === 'end-raci-assignment') {
      const id = required(body.id, 'RACI ID', 80);
      const before = await getRow('platform_raci_assignments', id);
      if (!before) return NextResponse.json({ error: 'RACI assignment not found.' }, { status: 404 });
      const updated = await rest(`platform_raci_assignments?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ effective_to: new Date().toISOString().slice(0, 10) }) });
      const after = updated?.[0] || await getRow('platform_raci_assignments', id);
      await securityEvent(actor, 'RACI_ASSIGNMENT_ENDED', { raci_id: id }, before.tenant_id || tenantId);
      await writeAuditEvent(actor, { action: 'RACI_ASSIGNMENT_ENDED', entityType: 'platform_raci_assignments', entityId: id, tenantId: before.tenant_id || tenantId, beforeData: before, afterData: after, reason: 'Super User ended RACI authority' });
      return NextResponse.json(after);
    }

    if (action === 'decide-approval') {
      const id = required(body.id, 'Approval ID', 80);
      const decision = required(body.decision, 'Decision', 40).toLowerCase();
      if (!['approved','rejected'].includes(decision)) throw new Error('Decision must be approved or rejected.');
      const before = await getRow('approvals', id);
      if (!before) return NextResponse.json({ error: 'Approval not found.' }, { status: 404 });
      const updated = await rest(`approvals?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ status: decision, decided_at: new Date().toISOString(), decision_note: nullable(body.decision_note) }) });
      const after = updated?.[0] || await getRow('approvals', id);
      await securityEvent(actor, 'APPROVAL_DECIDED', { approval_id: id, decision }, before.tenant_id || tenantId);
      await writeAuditEvent(actor, { action: 'APPROVAL_DECIDED', entityType: 'approvals', entityId: id, tenantId: before.tenant_id || tenantId, beforeData: before, afterData: after, reason: `Super User ${decision} privileged approval` });
      return NextResponse.json(after);
    }

    return NextResponse.json({ error: 'Unsupported security action.' }, { status: 400 });
  } catch (error) {
    if (error instanceof SuperUserAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Security action failed.' }, { status: 400 });
  }
}
