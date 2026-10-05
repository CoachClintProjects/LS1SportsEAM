import { NextRequest, NextResponse } from "next/server";
import { financeScope } from "@/lib/server/adminFinanceScope";
import { recordRest as rest } from "@/lib/server/adminRecordAccess";
import { hasAdminContextPermission as can } from "@/lib/server/accessControl";
import { governanceUuid as uuid } from "@/lib/server/adminGovernance";
import { PersonRecordError } from "@/lib/server/adminPersonRecord";
export const dynamic = "force-dynamic";
const fail = (e: unknown) =>
  NextResponse.json(
    { error: e instanceof Error ? e.message : "Payables unavailable." },
    { status: e instanceof PersonRecordError ? e.status : 500 },
  );
export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams,
      role = q.get("role") || "treasurer",
      { ctx, tenant, org } = await financeScope(request, role);
    const [entities, vendors, methods] = await Promise.all([
      rest(
        `legal_entities?select=id,legal_name,base_currency&organization_id=eq.${org}`,
      ),
      rest(
        `vendors?select=id,name,status&organization_id=eq.${org}&tenant_id=eq.${tenant}&order=name.asc`,
      ),
      rest(
        `payment_methods?select=id,code,name&tenant_id=eq.${tenant}&organization_id=eq.${org}&status=eq.active&order=name.asc`,
      ),
    ]);
    const ids = entities.map((e: { id: string }) => e.id),
      page = Math.max(0, Math.min(100000, parseInt(q.get("page") || "0") || 0)),
      sort = [
        "bill_number",
        "bill_date",
        "due_date",
        "total",
        "balance_due",
        "status",
      ].includes(q.get("sort") || "")
        ? q.get("sort")
        : "bill_date",
      direction = q.get("direction") === "asc" ? "asc" : "desc",
      search = (q.get("search") || "")
        .replace(/[%_*(),.]/g, " ")
        .trim()
        .slice(0, 120);
    const rows = ids.length
      ? await rest(
          `vendor_bills?select=*,vendors(name)&legal_entity_id=in.(${ids.join(",")})${search ? `&bill_number=ilike.*${encodeURIComponent(search)}*` : ""}&order=${sort}.${direction},id.asc&limit=26&offset=${page * 25}`,
        )
      : [];
    let bill = null,
      lines = [],
      payments = [],
      history = [];
    const id = q.get("id");
    if (id) {
      if (!uuid.test(id) || !ids.length)
        throw new PersonRecordError(404, "Bill outside organization.");
      [bill] = await rest(
        `vendor_bills?select=*,vendors(name)&id=eq.${id}&legal_entity_id=in.(${ids.join(",")})`,
      );
      if (!bill) throw new PersonRecordError(404, "Bill outside organization.");
      [lines, payments, history] = await Promise.all([
        rest(
          `vendor_bill_lines?select=*&vendor_bill_id=eq.${id}&order=line_no.asc`,
        ),
        rest(
          `ap_payments?select=*&vendor_bill_id=eq.${id}&order=payment_date.desc`,
        ),
        rest(
          `audit_events?select=id,action,reason,occurred_at&tenant_id=eq.${tenant}&entity_type=eq.vendor_bill&entity_id=eq.${id}&order=occurred_at.desc&limit=100`,
        ),
      ]);
    }
    return NextResponse.json({
      entities,
      vendors,
      methods,
      rows: rows.slice(0, 25),
      hasMore: rows.length > 25,
      bill,
      lines,
      payments,
      history,
      authorization: {
        create:
          can(ctx, role, "record.create") && can(ctx, role, "record.update"),
        edit: can(ctx, role, "record.update"),
        decide:
          can(ctx, role, "workflow.execute") && can(ctx, role, "record.update"),
        approve:
          role === "org_admin" &&
          can(ctx, role, "workflow.execute") &&
          can(ctx, role, "record.update"),
      },
    });
  } catch (e) {
    return fail(e);
  }
}
export async function POST(request: NextRequest) {
  try {
    const b = await request.json(),
      role = String(b.role || "treasurer"),
      { ctx, tenant, org } = await financeScope(request, role, "record.update");
    if (
      ![
        "create",
        "edit",
        "submit",
        "approve",
        "return",
        "cancel",
        "payment",
      ].includes(b.operation) ||
      !uuid.test(b.id || "") ||
      !Number.isInteger(b.expectedVersion) ||
      String(b.reason || "").trim().length < 5
    )
      throw new PersonRecordError(
        400,
        "Bill, supported action, current version and reason required.",
      );
    if (b.operation === "create" && !can(ctx, role, "record.create"))
      throw new PersonRecordError(403, "Bill creation denied.");
    if (
      !["create", "edit"].includes(b.operation) &&
      !can(ctx, role, "workflow.execute")
    )
      throw new PersonRecordError(403, "Bill decision denied.");
    if (b.operation === "approve" && role !== "org_admin")
      throw new PersonRecordError(403, "Organization Admin approval required.");
    const row = await rest("rpc/admin_vendor_bill_write", {
      method: "POST",
      body: JSON.stringify({
        p_tenant: tenant,
        p_org: org,
        p_actor_user: ctx.user.id,
        p_actor_person: ctx.person?.id || null,
        p_role: role,
        p_id: b.id,
        p_operation: b.operation,
        p_expected_version: b.expectedVersion,
        p_values: b.values || {},
        p_reason: String(b.reason).trim(),
      }),
    });
    return NextResponse.json({ row });
  } catch (e) {
    return fail(e);
  }
}
