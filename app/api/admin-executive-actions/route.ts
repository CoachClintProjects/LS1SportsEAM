import { NextRequest, NextResponse } from "next/server";
import {
  governanceScope,
  governanceUuid as uuid,
} from "@/lib/server/adminGovernance";
import { hasAdminContextPermission as can } from "@/lib/server/accessControl";
import { recordRest as rest } from "@/lib/server/adminRecordAccess";
import { PersonRecordError } from "@/lib/server/adminPersonRecord";
export const dynamic = "force-dynamic";
const kinds = [
  "waiver",
  "cash",
  "cover_entry_fee",
  "release_escrow",
  "reverse",
];
const fail = (e: unknown) =>
  NextResponse.json(
    { error: e instanceof Error ? e.message : "Club action failed." },
    { status: e instanceof PersonRecordError ? e.status : 500 },
  );
export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams,
      role = q.get("role") || "org_admin",
      kind = q.get("kind") || "waiver";
    const { ctx, tenant, org } = await governanceScope(request, role);
    if (!kinds.includes(kind))
      throw new PersonRecordError(400, "Unknown club action.");
    if (!can(ctx, role, kind === "waiver" ? "waivers.read" : "finance.read"))
      throw new PersonRecordError(
        403,
        "You do not have access to these records.",
      );
    const page = Number(q.get("page") || 0);
    if (!Number.isInteger(page) || page < 0 || page > 100000)
      throw new PersonRecordError(400, "Invalid page.");
    const window = `&order=id.asc&offset=${page * 25}&limit=26`;
    let rows: any[] = [],
      entities: any[] = [],
      ledgers: any[] = [],
      accounts: any[] = [],
      methods: any[] = [];
    if (kind === "waiver")
      rows = await rest(
        `waiver_assignments?select=*,person:people!waiver_assignments_person_id_fkey(first_name,last_name),waivers(name)&organization_id=eq.${org}&status=in.(assigned,pending,waived)${window}`,
      );
    else {
      entities = await rest(
        `legal_entities?select=id,legal_name,base_currency&organization_id=eq.${org}&order=legal_name.asc`,
      );
      const entity = q.get("entity") || entities[0]?.id;
      if (entity && !entities.some((row) => row.id === entity))
        throw new PersonRecordError(404, "Club billing details not found.");
      if (entity)
        [ledgers, accounts] = await Promise.all([
          rest(
            `accounting_ledgers?select=id,name,code,currency,legal_entity_id&legal_entity_id=eq.${entity}&order=code.asc`,
          ),
          rest(
            `chart_of_accounts?select=id,account_code,account_name,account_type&legal_entity_id=eq.${entity}&active=eq.true&order=account_code.asc`,
          ),
        ]);
      if (kind === "cash") {
        [rows, methods] = await Promise.all([
          rest(
            `invoices?select=id,invoice_number,balance_due,currency,status,customers!inner(display_name,organization_id)&customers.organization_id=eq.${org}&balance_due=gt.0${window}`,
          ),
          rest(
            `payment_methods?select=code,name&organization_id=eq.${org}&tenant_id=eq.${tenant}&status=eq.active&method_type=eq.cash`,
          ),
        ]);
      }
      if (kind === "cover_entry_fee")
        rows = await rest(
          `competition_entry_fees?select=*,competitions!inner(name,organization_id)&competitions.organization_id=eq.${org}&status=eq.assessed${window}`,
        );
      if (kind === "reverse")
        rows = await rest(
          `work_items?select=id,entity_id,payload,status&tenant_id=eq.${tenant}&work_type=eq.CLUB_FINANCE_DECISION&payload->>organization_id=eq.${org}&payload->>operation=neq.reverse&payload->>reversed_by=is.null${window}`,
        );
    }
    const history = await rest(
      `audit_events?select=id,action,occurred_at,reason,entity_id&tenant_id=eq.${tenant}&action=in.(waiver.exception,club_finance.cash,club_finance.cover_entry_fee,club_finance.release_escrow,club_finance.reverse)&or=(after_data->payload->>organization_id.eq.${org},after_data->record->>organization_id.eq.${org})&order=occurred_at.desc&limit=30`,
    );
    return NextResponse.json({
      rows: rows.slice(0, 25),
      hasMore: rows.length > 25,
      entities,
      ledgers,
      accounts,
      methods,
      history,
      canWrite:
        can(ctx, role, "record.update") &&
        can(ctx, role, "workflow.execute") &&
        can(ctx, role, kind === "waiver" ? "waivers.update" : "record.create"),
    });
  } catch (e) {
    return fail(e);
  }
}
export async function POST(request: NextRequest) {
  try {
    const b = await request.json(),
      role = String(b.role || "org_admin"),
      kind = String(b.kind || "");
    const { ctx, tenant, org } = await governanceScope(
      request,
      role,
      "record.update",
    );
    if (!kinds.includes(kind) || !uuid.test(b.requestId || ""))
      throw new PersonRecordError(
        400,
        "Select an action and provide a request identifier.",
      );
    if (
      !ctx.person?.id ||
      !can(ctx, role, kind === "waiver" ? "waivers.update" : "record.create") ||
      !can(ctx, role, "workflow.execute") ||
      !can(ctx, role, kind === "waiver" ? "waivers.read" : "finance.read")
    )
      throw new PersonRecordError(403, "Club decision permission required.");
    const reason = String(b.reason || "").trim();
    if (reason.length < 5 || reason.length > 4000)
      throw new PersonRecordError(
        400,
        "Explain the decision in 5 to 4000 characters.",
      );
    const common = {
      p_tenant: tenant,
      p_org: org,
      p_actor_user: ctx.user.id,
      p_actor_person: ctx.person.id,
    };
    let row;
    if (kind === "waiver") {
      if (
        !uuid.test(b.id || "") ||
        !["waive", "restore"].includes(b.operation) ||
        !Number.isFinite(Date.parse(b.expectedUpdatedAt))
      )
        throw new PersonRecordError(
          400,
          "Select a current waiver requirement and action.",
        );
      row = await rest("rpc/admin_waiver_exception", {
        method: "POST",
        body: JSON.stringify({
          ...common,
          p_id: b.id,
          p_expected_updated_at: b.expectedUpdatedAt,
          p_operation: b.operation,
          p_reason: reason,
          p_request: b.requestId,
        }),
      });
    } else if (kind === "cash") {
      if (
        !uuid.test(b.id || "") ||
        !Number.isFinite(Number(b.amount)) ||
        Number(b.amount) <= 0
      )
        throw new PersonRecordError(
          400,
          "Select an invoice and positive amount received.",
        );
      const [method] = await rest(
        `payment_methods?select=code&tenant_id=eq.${tenant}&organization_id=eq.${org}&status=eq.active&method_type=eq.cash&code=eq.${encodeURIComponent(String(b.method || ""))}&limit=1`,
      );
      if (!method)
        throw new PersonRecordError(
          409,
          "Set up an active cash payment method first.",
        );
      row = await rest("rpc/admin_club_cash_receipt", {
        method: "POST",
        body: JSON.stringify({
          ...common,
          p_request: b.requestId,
          p_invoice: b.id,
          p_amount: Number(b.amount),
          p_method: method.code,
          p_reason: reason,
        }),
      });
    } else {
      const values = b.values;
      if (!values || typeof values !== "object" || Array.isArray(values))
        throw new PersonRecordError(400, "Enter the financial details.");
      row = await rest("rpc/admin_club_finance_action", {
        method: "POST",
        body: JSON.stringify({
          ...common,
          p_request: b.requestId,
          p_operation: kind,
          p_values: values,
          p_reason: reason,
        }),
      });
    }
    return NextResponse.json({ row });
  } catch (e) {
    return fail(e);
  }
}
