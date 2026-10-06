import { NextRequest, NextResponse } from "next/server";
import { financeScope } from "@/lib/server/adminFinanceScope";
import { recordRest as rest } from "@/lib/server/adminRecordAccess";
import { hasAdminContextPermission as can } from "@/lib/server/accessControl";
import { governanceUuid as uuid } from "@/lib/server/adminGovernance";
import { PersonRecordError } from "@/lib/server/adminPersonRecord";
export const dynamic = "force-dynamic";
const fail = (e: unknown) =>
  NextResponse.json(
    { error: e instanceof Error ? e.message : "Approval policy unavailable." },
    { status: e instanceof PersonRecordError ? e.status : 500 },
  );
export async function GET(request: NextRequest) {
  try {
    const role = request.nextUrl.searchParams.get("role") || "treasurer";
    const { ctx, tenant, org } = await financeScope(request, role);
    const entities = await rest(
      `legal_entities?select=id,legal_name,base_currency&organization_id=eq.${org}&order=legal_name.asc`,
    );
    const ids = entities.map((e: { id: string }) => e.id);
    const policies = ids.length
      ? await rest(
          `payable_authority_policies?select=*,threshold_text:executive_threshold::text&legal_entity_id=in.(${ids.join(",")})`,
        )
      : [];
    const history = ids.length
      ? await rest(
          `audit_events?select=id,entity_id,action,reason,occurred_at,before_data,after_data&tenant_id=eq.${tenant}&entity_type=eq.payable_authority&entity_id=in.(${ids.join(",")})&order=occurred_at.desc&limit=100`,
        )
      : [];
    return NextResponse.json({
      entities,
      policies,
      history,
      canEdit:
        role === "org_admin" &&
        can(ctx, role, "record.update") &&
        can(ctx, role, "workflow.execute"),
    });
  } catch (e) {
    return fail(e);
  }
}
export async function POST(request: NextRequest) {
  try {
    const b = await request.json(),
      role = String(b.role || "treasurer");
    const { ctx, tenant, org } = await financeScope(
      request,
      role,
      "record.update",
    );
    if (role !== "org_admin" || !can(ctx, role, "workflow.execute"))
      throw new PersonRecordError(
        403,
        "Only Organization Admin can set spending authority.",
      );
    if (
      !uuid.test(b.entityId || "") ||
      !Number.isInteger(b.expectedVersion) ||
      b.expectedVersion < 0 ||
      typeof b.threshold !== "string" ||
      !/^\d{1,12}(\.\d{1,2})?$/.test(b.threshold) ||
      String(b.reason || "").trim().length < 5
    )
      throw new PersonRecordError(
        400,
        "Legal entity, current version, non-negative threshold and reason required.",
      );
    const row = await rest("rpc/admin_payable_authority_write", {
      method: "POST",
      body: JSON.stringify({
        p_tenant: tenant,
        p_org: org,
        p_actor_user: ctx.user.id,
        p_actor_person: ctx.person?.id || null,
        p_role: role,
        p_entity: b.entityId,
        p_expected_version: b.expectedVersion,
        p_threshold: b.threshold,
        p_reason: String(b.reason).trim(),
      }),
    });
    return NextResponse.json({ row });
  } catch (e) {
    return fail(e);
  }
}
