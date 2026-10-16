import { equipmentBoundary } from "@/lib/equipmentPolicy";
import { fundraisingBoundary } from "@/lib/fundraisingPolicy";
import { communicationsBoundary } from "@/lib/communicationsPolicy";
import { volunteerBoundary } from "@/lib/volunteerPolicy";
import { competitionBoundary } from "@/lib/competitionPolicy";
import { registrarBoundary } from "@/lib/registrarPolicy";
import type { NextRequest } from "next/server";
import {
  resolveAccess,
  canUseAdminRoleContext,
  hasAdminContextPermission as can,
} from "./accessControl";
import { PersonRecordError } from "./adminPersonRecord";
export async function financeScope(
  request: NextRequest,
  role: string,
  permission = "finance.read",
) {
  const ctx = await resolveAccess(request);
  if (!ctx) throw new PersonRecordError(401, "Sign in required.");
  if (
    !["org_admin", "treasurer", "general_manager"].includes(role) ||
    !ctx.allowedHubs.includes("admin") ||
    !canUseAdminRoleContext(ctx, role) ||
    !can(ctx, role, "finance.read") ||
    !can(ctx, role, permission)
  )
    throw new PersonRecordError(
      403,
      role === "facilities_equipment_manager"
        ? equipmentBoundary
        : role === "fundraising_coordinator"
          ? fundraisingBoundary
          : role === "communications_media"
            ? communicationsBoundary
            : role === "volunteer_coordinator"
              ? volunteerBoundary
              : role === "competition_manager"
                ? competitionBoundary
                : role === "registrar"
                  ? registrarBoundary
                  : "Financial authority denied.",
    );
  const tenant = ctx.adminScope?.tenantId || ctx.person?.tenant_id;
  const codes =
    role === "org_admin"
      ? ["ORGANIZATION_ADMIN"]
      : role === "general_manager"
        ? ["GENERAL_MANAGER", "ORGANIZATION_ADMIN"]
        : ["TREASURER", "FINANCE", "ORGANIZATION_ADMIN"];
  const orgs = ctx.adminScope
    ? [ctx.adminScope.organizationId]
    : [
        ...new Set(
          ctx.roles
            .filter((r) => codes.includes(r.code))
            .map((r) => r.scope.organization_id)
            .filter(Boolean),
        ),
      ];
  if (!tenant || orgs.length !== 1)
    throw new PersonRecordError(403, "Authorized organization required.");
  return { ctx, tenant, org: String(orgs[0]) };
}
