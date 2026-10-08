import {
  adminRoleCodes,
  canUseAdminRoleContext,
  hasAdminContextPermission,
  type AccessContext,
} from "./accessControl";
import {
  triageRoles,
  type TriageSource,
  type TriageTask,
} from "@/lib/triage/types";

export class TriageError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export type TriageScope = {
  tenant: string;
  orgs: string[];
  role: string;
  team: string | null;
  teamIds: string[] | null;
  person: string | null;
  executive: boolean;
};
export function triageScope(
  ctx: AccessContext,
  role: string,
  team: string | null,
): TriageScope {
  if (
    !ctx.allowedHubs.includes("admin") ||
    !triageRoles.some((r) => r === role) ||
    !canUseAdminRoleContext(ctx, role)
  )
    throw new TriageError("This role is not assigned to your account.", 403);
  const tenant = ctx.adminScope?.tenantId || ctx.person?.tenant_id;
  const executive =
    ctx.isPlatformSuperUser ||
    ctx.roles.some((r) => r.code === "ORGANIZATION_ADMIN");
  const relevant = ctx.roles.filter((r) =>
    executive
      ? r.code === "ORGANIZATION_ADMIN"
      : adminRoleCodes(role).includes(r.code),
  );
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
    throw new TriageError(
      "Your club assignment is missing. Ask Organization Admin to review your access.",
      403,
    );
  const teamIds = executive
    ? null
    : [
        ...new Set(
          relevant
            .map((r) => r.scope.team_id)
            .filter((id): id is string => !!id),
        ),
      ];
  if (team && teamIds && !teamIds.includes(team))
    throw new TriageError(
      "[DENY: ERR-901] This squad is outside your assignment.",
      403,
    );
  return {
    tenant,
    orgs,
    role,
    team,
    teamIds,
    person: ctx.person?.id || null,
    executive,
  };
}
export function taskInScope(
  row: Record<string, unknown>,
  scope: TriageScope,
): boolean {
  if (
    row.tenant_id !== scope.tenant ||
    typeof row.organization_id !== "string" ||
    !scope.orgs.includes(row.organization_id)
  )
    return false;
  if (scope.role !== "org_admin" && row.assigned_role !== scope.role)
    return false;
  if (
    scope.role === "team_manager" &&
    (!scope.team || row.team_id !== scope.team)
  )
    return false;
  if (scope.team && row.team_id !== scope.team) return false;
  if (
    !scope.executive &&
    scope.teamIds?.length &&
    !scope.teamIds.includes(String(row.team_id))
  )
    return false;
  return (
    scope.executive || !row.assigned_to || row.assigned_to === scope.person
  );
}
export function taskPermission(
  ctx: AccessContext,
  role: string,
  source: TriageSource,
  write: boolean,
) {
  const permission =
    source === "workflow_tasks"
      ? "workflow.execute"
      : source === "competition_exceptions"
        ? write
          ? "competition_entries.update"
          : "competition_entries.read"
        : write
          ? "admin_tasks.update"
          : "admin_tasks.read";
  return hasAdminContextPermission(ctx, role, permission);
}
const readable = (value: unknown) => (typeof value === "string" ? value : "");
export function mapTriageTask(
  row: Record<string, unknown>,
  source: TriageSource,
  canUpdate: boolean,
): TriageTask {
  const metadata = (row.metadata || {}) as Record<string, unknown>;
  const recommended = row.recommended_action || metadata.recommended_action;
  return {
    id: String(row.id),
    source,
    title:
      readable(row.title) ||
      readable(metadata.title) ||
      readable(row.problem) ||
      readable(row.task_code).replaceAll("_", " "),
    problem:
      readable(row.description) ||
      readable(row.problem) ||
      readable(metadata.problem),
    exceptionCode:
      readable(row.exception_code) || readable(metadata.exception_code) || null,
    recommendedAction:
      readable(recommended) ||
      readable((recommended as Record<string, unknown>)?.description),
    priority:
      readable(row.priority) ||
      readable(row.severity) ||
      readable(metadata.priority) ||
      "normal",
    status: readable(row.status),
    dueAt: readable(row.due_at) || null,
    organizationId: readable(row.organization_id) || null,
    teamId: readable(row.team_id) || null,
    assignedRole: readable(row.assigned_role) || null,
    assignedTo: readable(row.assigned_to) || null,
    revision: Number(row.revision),
    entityId: readable(row.entity_id) || readable(metadata.entity_id) || null,
    entityType:
      readable(row.entity_type) || readable(metadata.entity_type) || null,
    canUpdate,
    evidence: row.evidence || metadata.evidence || null,
    resolutionKind:
      readable(metadata.kind) ||
      (["vendor_bill", "vendor_bills"].includes(
        readable(row.entity_type) || readable(metadata.entity_type),
      )
        ? "payable"
        : null),
    personId: readable(metadata.person_id) || null,
    generated: !!row.origin_key,
  };
}
