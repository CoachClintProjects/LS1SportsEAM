import type { NextRequest } from "next/server";
import {
  canUseAdminRoleContext,
  resolveAccess,
  serviceHeaders,
} from "./accessControl";
import { supabaseServerConfig } from "./superuserAuth";
import { PersonRecordError, personRecordScope } from "./adminPersonRecord";
export async function recordRest(path: string, init: RequestInit = {}) {
  const { url } = supabaseServerConfig(),
    h = serviceHeaders();
  if (!h) throw new PersonRecordError(503, "Record service unavailable.");
  const r = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: { ...h, Prefer: "return=representation", ...init.headers },
    cache: "no-store",
  });
  const j = await r.json();
  if (!r.ok)
    throw new PersonRecordError(
      String(j.message).includes("changed") ? 409 : 400,
      j.message || "Record operation failed.",
    );
  return j;
}
export async function recordAccess(
  request: NextRequest,
  role: string,
  personId: string,
) {
  const ctx = await resolveAccess(request);
  if (!ctx) throw new PersonRecordError(401, "Sign in required.");
  if (!ctx.allowedHubs.includes("admin") || !canUseAdminRoleContext(ctx, role))
    throw new PersonRecordError(403, "Admin access denied.");
  const tenant = ctx.adminScope?.tenantId || ctx.person?.tenant_id,
    orgs = ctx.adminScope
      ? [ctx.adminScope.organizationId]
      : ([
          ...new Set(
            ctx.roles.map((r) => r.scope.organization_id).filter(Boolean),
          ),
        ] as string[]);
  if (!tenant || !orgs.length)
    throw new PersonRecordError(403, "Organization context required.");
  const base = await personRecordScope(
    recordRest,
    ctx,
    role,
    tenant,
    orgs,
    personId,
  );
  return { ctx, tenant, orgs, base };
}
