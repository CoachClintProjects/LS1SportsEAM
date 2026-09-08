import type { SuperUserIdentity } from '@/lib/server/requireSuperUser';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export type AuditWrite = {
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  tenantId?: string | null;
  beforeData?: Record<string, unknown> | null;
  afterData?: Record<string, unknown> | null;
  reason?: string | null;
  privileged?: boolean;
};

export async function writeAuditEvent(actor: SuperUserIdentity, event: AuditWrite) {
  if (!URL || !KEY) throw new Error('Audit service credentials are not configured.');

  const response = await fetch(`${URL}/rest/v1/audit_events`, {
    method: 'POST',
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      tenant_id: event.tenantId || null,
      actor_user_id: actor.userId,
      actor_person_id: null,
      action: event.action,
      entity_type: event.entityType || null,
      entity_id: event.entityId || null,
      before_data: event.beforeData || null,
      after_data: {
        ...(event.afterData || {}),
        superuser_operator_id: actor.operatorId,
        superuser_email: actor.email,
      },
      reason: event.reason || null,
      privileged: event.privileged ?? true,
    }),
    cache: 'no-store',
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Audit write failed (${response.status}): ${text.slice(0, 400)}`);
  }

  const rows = text ? JSON.parse(text) : [];
  return rows?.[0] || null;
}
