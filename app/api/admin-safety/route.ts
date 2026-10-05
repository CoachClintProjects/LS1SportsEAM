import { NextRequest, NextResponse } from "next/server";
import { governanceScope, governanceUuid } from "@/lib/server/adminGovernance";
import { recordRest as rest } from "@/lib/server/adminRecordAccess";
import { PersonRecordError } from "@/lib/server/adminPersonRecord";
import { hasAdminContextPermission as can } from "@/lib/server/accessControl";
export const dynamic = "force-dynamic";
const fail = (e: unknown) =>
  NextResponse.json(
    {
      error:
        e instanceof Error ? e.message : "Personnel safety operation failed.",
    },
    { status: e instanceof PersonRecordError ? e.status : 500 },
  );
export async function GET(request: NextRequest) {
  try {
    const { ctx, tenant, org } = await governanceScope(
      request,
      request.nextUrl.searchParams.get("role") || "org_admin",
    );
    const q = request.nextUrl.searchParams;
    if (q.get("mode") === "overrides") {
      const person = q.get("person"),
        code = q.get("code"),
        active = q.get("active");
      if (
        !governanceUuid.test(person || "") ||
        !code ||
        !/^[A-Z_]+$/.test(code) ||
        (active && !governanceUuid.test(active))
      )
        throw new PersonRecordError(400, "Valid person and role required.");
      const rows = await rest(
        `personnel_safety_overrides?select=id,person_id,role_code,policy_version,expires_at,reason,status,created_at&tenant_id=eq.${tenant}&organization_id=eq.${org}&person_id=eq.${person}&role_code=eq.${encodeURIComponent(code)}&order=created_at.desc&limit=100`,
      );
      if (active && !rows.some((r: { id: string }) => r.id === active)) {
        const current = await rest(
          `personnel_safety_overrides?select=id,person_id,role_code,policy_version,expires_at,reason,status,created_at&tenant_id=eq.${tenant}&organization_id=eq.${org}&person_id=eq.${person}&role_code=eq.${encodeURIComponent(code)}&id=eq.${active}`,
        );
        rows.unshift(...current);
      }
      return NextResponse.json({ overrides: rows });
    }
    const [policies, roles, roster, overrides, history] = await Promise.all([
      rest(
        `organization_safety_policies?select=*&tenant_id=eq.${tenant}&organization_id=eq.${org}`,
      ),
      rest(
        `role_definitions?select=code,name&is_active=eq.true&or=(tenant_id.is.null,tenant_id.eq.${tenant})&code=not.in.(ORGANIZATION_ADMIN,ORG_ADMIN,CLIENT_SUPERADMIN,SYSTEM_SUPERUSER,ATHLETE,ATHLETE_ASSET,PARENT,PARENT_GUARDIAN,GUARDIAN)&order=name.asc`,
      ),
      rest("rpc/admin_safety_roster", {
        method: "POST",
        body: JSON.stringify({ p_tenant: tenant, p_org: org }),
      }),
      rest(
        `personnel_safety_overrides?select=id,person_id,role_code,policy_version,expires_at,reason,status,created_at,people(first_name,last_name,preferred_name)&tenant_id=eq.${tenant}&organization_id=eq.${org}&order=created_at.desc&limit=100`,
      ),
      rest(
        `audit_events?select=id,action,occurred_at,reason,before_data,after_data&tenant_id=eq.${tenant}&entity_type=eq.organization_safety_policy&entity_id=eq.${org}&order=occurred_at.desc&limit=100`,
      ),
    ]);
    return NextResponse.json({
      policy: policies[0] || null,
      roles,
      roster,
      overrides,
      history,
      authorization: {
        edit: can(ctx, "org_admin", "record.update"),
        decide: can(ctx, "org_admin", "workflow.execute"),
      },
    });
  } catch (e) {
    return fail(e);
  }
}
export async function POST(request: NextRequest) {
  try {
    const b = await request.json(),
      operation = String(b.operation || "");
    if (!["save", "activate", "pause", "grant", "revoke"].includes(operation))
      throw new PersonRecordError(400, "Supported safety action required.");
    const { ctx, tenant, org } = await governanceScope(
      request,
      String(b.role || "org_admin"),
      operation === "save" ? "record.update" : "workflow.execute",
    );
    if (
      !Number.isInteger(b.expectedVersion) ||
      b.expectedVersion < 0 ||
      String(b.reason || "").trim().length < 5
    )
      throw new PersonRecordError(
        400,
        "Policy version and decision reason required.",
      );
    const common = {
      p_tenant: tenant,
      p_org: org,
      p_actor_user: ctx.user.id,
      p_actor_person: ctx.person?.id || null,
      p_operation: operation,
      p_reason: String(b.reason).trim(),
    };
    if (["grant", "revoke"].includes(operation)) {
      if (
        !governanceUuid.test(b.id || "") ||
        (operation === "grant" &&
          (!governanceUuid.test(b.personId || "") ||
            typeof b.roleCode !== "string" ||
            !Number.isFinite(Date.parse(b.expiresAt))))
      )
        throw new PersonRecordError(
          400,
          "Person, role and override expiry required.",
        );
      const row = await rest("rpc/admin_safety_override_write", {
        method: "POST",
        body: JSON.stringify({
          ...common,
          p_id: b.id,
          p_person: b.personId || null,
          p_role: b.roleCode || null,
          p_expires_at: b.expiresAt || null,
          p_expected_policy_version: b.expectedVersion,
        }),
      });
      return NextResponse.json({ row });
    }
    const row = await rest("rpc/admin_safety_policy_write", {
      method: "POST",
      body: JSON.stringify({
        ...common,
        p_expected_version: b.expectedVersion,
        p_values: b.values || {},
      }),
    });
    return NextResponse.json({ row });
  } catch (e) {
    return fail(e);
  }
}
