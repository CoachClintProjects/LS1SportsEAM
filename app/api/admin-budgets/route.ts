import { NextRequest, NextResponse } from "next/server";
import {
  resolveAccess,
  canUseAdminRoleContext,
  hasAdminContextPermission as can,
} from "@/lib/server/accessControl";
import { recordRest as rest } from "@/lib/server/adminRecordAccess";
import { PersonRecordError } from "@/lib/server/adminPersonRecord";
import { governanceUuid as uuid } from "@/lib/server/adminGovernance";
export const dynamic = "force-dynamic";
async function scope(request: NextRequest, role: string, write = false) {
  const ctx = await resolveAccess(request);
  if (!ctx) throw new PersonRecordError(401, "Sign in required.");
  if (
    !["org_admin", "treasurer"].includes(role) ||
    !ctx.allowedHubs.includes("admin") ||
    !canUseAdminRoleContext(ctx, role) ||
    !can(ctx, role, "finance.read") ||
    (write && !can(ctx, role, "record.update"))
  )
    throw new PersonRecordError(403, "Budget authority denied.");
  const tenant = ctx.adminScope?.tenantId || ctx.person?.tenant_id;
  const codes =
    role === "org_admin"
      ? ["ORGANIZATION_ADMIN"]
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
const fail = (e: unknown) =>
  NextResponse.json(
    { error: e instanceof Error ? e.message : "Budget operation failed." },
    { status: e instanceof PersonRecordError ? e.status : 500 },
  );
export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams,
      role = q.get("role") || "org_admin",
      { ctx, tenant, org } = await scope(request, role);
    const entities = await rest(
        `legal_entities?select=id,legal_name,base_currency&organization_id=eq.${org}`,
      ),
      ids = entities.map((e: { id: string }) => e.id);
    const [budgets, accounts] = ids.length
      ? await Promise.all([
          rest(
            `budgets?select=*&legal_entity_id=in.(${ids.join(",")})&order=fiscal_year.desc,name.asc&limit=1000`,
          ),
          rest(
            `chart_of_accounts?select=id,legal_entity_id,account_code,account_name,account_type&legal_entity_id=in.(${ids.join(",")})&active=eq.true&order=account_code.asc&limit=2000`,
          ),
        ])
      : [[], []];
    const id = q.get("id");
    let lines = [],
      history = [];
    if (id) {
      if (!uuid.test(id) || !budgets.some((b: { id: string }) => b.id === id))
        throw new PersonRecordError(404, "Budget outside organization.");
      [lines, history] = await Promise.all([
        rest(
          `budget_lines?select=*&budget_id=eq.${id}&order=period_start.asc,id.asc`,
        ),
        rest(
          `audit_events?select=id,action,occurred_at,reason,before_data,after_data&tenant_id=eq.${tenant}&entity_type=eq.budget&entity_id=eq.${id}&order=occurred_at.desc&limit=100`,
        ),
      ]);
    }
    return NextResponse.json({
      selectedId: id,
      budgets,
      accounts,
      entities,
      lines,
      history,
      authorization: {
        createAccount:
          role === "org_admin" &&
          can(ctx, role, "record.create") &&
          can(ctx, role, "record.update"),
        create:
          can(ctx, role, "record.create") && can(ctx, role, "record.update"),
        edit: can(ctx, role, "record.update"),
        approve: role === "org_admin" && can(ctx, role, "workflow.execute"),
      },
    });
  } catch (e) {
    return fail(e);
  }
}
export async function POST(request: NextRequest) {
  try {
    const b = await request.json(),
      role = String(b.role || "org_admin"),
      { ctx, tenant, org } = await scope(request, role, true);
    if (b.operation === "create_account") {
      if (role !== "org_admin" || !can(ctx, role, "record.create"))
        throw new PersonRecordError(
          403,
          "Account setup requires Organization Administrator authority.",
        );
      const v = b.values || {};
      if (!uuid.test(v.legal_entity_id || "") || !String(b.reason || "").trim())
        throw new PersonRecordError(400, "Entity and reason required.");
      const account = await rest("rpc/admin_budget_account_create", {
        method: "POST",
        body: JSON.stringify({
          p_tenant: tenant,
          p_org: org,
          p_actor_user: ctx.user.id,
          p_actor_person: ctx.person?.id || null,
          p_entity: v.legal_entity_id,
          p_code: v.account_code,
          p_name: v.account_name,
          p_type: v.account_type,
          p_reason: b.reason,
        }),
      });
      return NextResponse.json({ account });
    }
    if (
      !["create", "edit", "save_line", "delete_line", "transition"].includes(
        b.operation,
      ) ||
      !uuid.test(b.id || "") ||
      !String(b.reason || "").trim()
    )
      throw new PersonRecordError(
        400,
        "Valid budget, action and reason required.",
      );
    if (b.operation === "create" && !can(ctx, role, "record.create"))
      throw new PersonRecordError(403, "Budget creation denied.");
    if (b.operation !== "create" && !Number.isInteger(b.expectedVersion))
      throw new PersonRecordError(400, "Current budget version required.");
    if (
      b.operation === "transition" &&
      !["submitted", "draft"].includes(b.values?.status) &&
      (role !== "org_admin" || !can(ctx, role, "workflow.execute"))
    )
      throw new PersonRecordError(
        403,
        "Organization Administrator decision authority required.",
      );
    const row = await rest("rpc/admin_budget_write", {
      method: "POST",
      body: JSON.stringify({
        p_tenant: tenant,
        p_org: org,
        p_actor_user: ctx.user.id,
        p_actor_person: ctx.person?.id || null,
        p_role: role,
        p_id: b.id,
        p_operation: b.operation,
        p_expected_version: b.expectedVersion ?? 0,
        p_values: b.values || {},
        p_reason: String(b.reason).trim(),
      }),
    });
    return NextResponse.json({ row });
  } catch (e) {
    return fail(e);
  }
}
