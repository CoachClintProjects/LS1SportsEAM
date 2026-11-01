import type { NextRequest } from "next/server";
import {
  resolveAccess,
  canUseAdminRoleContext,
  hasAdminContextPermission as can,
  adminRoleCodes,
  type AccessContext,
} from "./accessControl";
import { PersonRecordError } from "./adminPersonRecord";
export const rosterRoles = [
  "org_admin",
  "team_manager",
  "registrar",
  "treasurer",
  "competition_manager",
  "general_manager",
];
export function rosterScope(ctx: AccessContext, role: string) {
  if (
    !ctx.allowedHubs.includes("admin") ||
    !rosterRoles.includes(role) ||
    !canUseAdminRoleContext(ctx, role) ||
    !(
      can(ctx, role, "rosters.read") ||
      (role === "treasurer" && can(ctx, role, "finance.read"))
    )
  )
    throw new PersonRecordError(
      403,
      "Roster access is not assigned to this role.",
    );
  const executive =
    ctx.isPlatformSuperUser ||
    ctx.roles.some((r) =>
      ["ORGANIZATION_ADMIN", "GENERAL_MANAGER"].includes(r.code),
    );
  const relevant = ctx.roles.filter((r) =>
    executive
      ? ["ORGANIZATION_ADMIN", "GENERAL_MANAGER"].includes(r.code)
      : adminRoleCodes(role).includes(r.code),
  );
  const tenant = ctx.adminScope?.tenantId || ctx.person?.tenant_id;
  const orgs = ctx.adminScope
    ? [ctx.adminScope.organizationId]
    : [
        ...new Set(
          relevant
            .map((r) => r.scope.organization_id)
            .filter((id): id is string => !!id),
        ),
      ];
  if (!tenant || !orgs.length)
    throw new PersonRecordError(
      403,
      "Select your club before opening the roster.",
    );
  const teamIds =
    role === "team_manager" && !executive
      ? [
          ...new Set(
            relevant
              .map((r) => r.scope.team_id)
              .filter((id): id is string => !!id),
          ),
        ]
      : null;
  return { tenant, orgs, teamIds };
}
export async function rosterAccess(request: NextRequest, role: string) {
  const ctx = await resolveAccess(request);
  if (!ctx) throw new PersonRecordError(401, "Sign in required.");
  return { ctx, ...rosterScope(ctx, role) };
}
