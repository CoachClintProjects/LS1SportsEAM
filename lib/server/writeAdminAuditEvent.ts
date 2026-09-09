import type { AdminIdentity } from '@/lib/server/requireAdmin';
import { adminRest } from '@/lib/server/adminRest';

export type AdminAuditWrite = {
  action: string;
  entityType: string;
  entityId?: string | null;
  tenantId?: string | null;
  beforeData?: Record<string, unknown> | null;
  afterData?: Record<string, unknown> | null;
  reason?: string | null;
};

export async function writeAdminAuditEvent(actor: AdminIdentity, event: AdminAuditWrite) {
  const rows = await adminRest<any[]>(actor, 'audit_events', {
    method: 'POST',
    body: JSON.stringify({
      tenant_id: event.tenantId || actor.tenantIds[0] || null,
      actor_user_id: actor.userId,
      actor_person_id: actor.personId,
      action: event.action,
      entity_type: event.entityType,
      entity_id: event.entityId || null,
      before_data: event.beforeData || null,
      after_data: {
        ...(event.afterData || {}),
        admin_roles: actor.roles,
        admin_email: actor.email,
      },
      reason: event.reason || null,
      privileged: true,
    }),
  });
  return rows?.[0] || null;
}
