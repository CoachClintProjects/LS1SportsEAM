import type { NextRequest } from "next/server";
import {
  resolveAccess,
  canUseAdminRoleContext,
  hasAdminContextPermission as can,
} from "./accessControl";
import { PersonRecordError } from "./adminPersonRecord";
export const governanceUuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function governanceScope(
  request: NextRequest,
  role: string,
  permission = "record.read",
) {
  const ctx = await resolveAccess(request);
  if (!ctx) throw new PersonRecordError(401, "Sign in required.");
  if (
    role !== "org_admin" ||
    !ctx.allowedHubs.includes("admin") ||
    !canUseAdminRoleContext(ctx, role) ||
    !can(ctx, role, permission)
  )
    throw new PersonRecordError(
      403,
      "Organization Administrator authority required.",
    );
  const tenant = ctx.adminScope?.tenantId || ctx.person?.tenant_id;
  const orgs = ctx.adminScope
    ? [ctx.adminScope.organizationId]
    : [
        ...new Set(
          ctx.roles
            .filter((r) => r.code === "ORGANIZATION_ADMIN")
            .map((r) => r.scope.organization_id)
            .filter(Boolean),
        ),
      ];
  if (!tenant || orgs.length !== 1)
    throw new PersonRecordError(
      403,
      "Authorized organization context required.",
    );
  return { ctx, tenant, org: String(orgs[0]) };
}
