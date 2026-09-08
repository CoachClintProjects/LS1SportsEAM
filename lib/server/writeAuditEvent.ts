import type { SuperUserIdentity } from '@/lib/server/requireSuperUser';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://xedfstgwotzxnztpembv.supabase.co';
const PUBLIC_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;

export type AuditWrite = {
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  tenantId?: string | null;
  beforeData?: unknown;
  afterData?: unknown;
  reason?: string | null;
  privileged?: boolean;
};

function normalizeAuditPayload(value: unknown): Record<string, unknown> | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object' && !Array.isArray(value)) return { ...(value as Record<string, unknown>) };
  return { value };
}

export async function writeAuditEvent(actor: SuperUserIdentity, event: AuditWrite) {
  if (!URL || !PUBLIC_KEY) throw new Error('Audit authentication is not configured.');

  const beforeData = normalizeAuditPayload(event.beforeData);
  const afterData = normalizeAuditPayload(event.afterData);
  const response = await fetch(`${URL}/rest/v1/audit_events`, {
    method: 'POST',
    headers: {
      apikey: PUBLIC_KEY,
      Authorization: `Bearer ${actor.accessToken}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      tenant_id: event.tenantId || null,
      actor_user_id: actor.userId,
      actor_person_id: actor.personId || null,
      action: event.action,
      entity_type: event.entityType || null,
      entity_id: event.entityId || null,
      before_data: beforeData,
      after_data: {
        ...(afterData || {}),
        superuser_operator_id: actor.operatorId,
        superuser_email: actor.email,
      },
      reason: event.reason || null,
      privileged: event.privileged ?? true,
    }),
    cache: 'no-store',
  });

  const text = await response.text();
  if (!response.ok) throw new Error(`Audit write failed (${response.status}): ${text.slice(0, 400)}`);
  const rows = text ? JSON.parse(text) : [];
  return rows?.[0] || null;
}
