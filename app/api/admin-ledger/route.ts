import { NextRequest, NextResponse } from "next/server";
import { financeScope } from "@/lib/server/adminFinanceScope";
import { hasAdminContextPermission as can } from "@/lib/server/accessControl";
import { recordRest as rest } from "@/lib/server/adminRecordAccess";
import { governanceUuid as uuid } from "@/lib/server/adminGovernance";
import { PersonRecordError } from "@/lib/server/adminPersonRecord";
export const dynamic = "force-dynamic";
const fail = (e: unknown) =>
  NextResponse.json(
    { error: e instanceof Error ? e.message : "Ledger operation failed." },
    { status: e instanceof PersonRecordError ? e.status : 500 },
  );
const rpc = (name: string, body: Record<string, unknown>) =>
  rest(`rpc/${name}`, { method: "POST", body: JSON.stringify(body) });
export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams,
      role = q.get("role") || "treasurer",
      { ctx, tenant, org } = await financeScope(request, role);
    const entities = await rest(
      `legal_entities?select=id,legal_name,base_currency&organization_id=eq.${org}&order=legal_name.asc`,
    );
    const entity = q.get("entity") || entities[0]?.id;
    if (entity && !entities.some((e: { id: string }) => e.id === entity))
      throw new PersonRecordError(404, "Legal entity outside organization.");
    const authorization = {
      create:
        can(ctx, role, "record.create") && can(ctx, role, "record.update"),
      edit: can(ctx, role, "record.update"),
      post:
        can(ctx, role, "workflow.execute") && can(ctx, role, "record.update"),
      setup:
        role === "org_admin" &&
        can(ctx, role, "record.create") &&
        can(ctx, role, "record.update"),
    };
    if (!entity)
      return NextResponse.json({
        entities,
        entity: null,
        ledgers: [],
        accounts: [],
        years: [],
        periods: [],
        journals: [],
        hasMore: false,
        authorization,
      });
    const [ledgers, accounts, years] = await Promise.all([
      rest(
        `accounting_ledgers?select=*&legal_entity_id=eq.${entity}&order=code.asc`,
      ),
      rest(
        `chart_of_accounts?select=id,account_code,account_name,account_type,active&legal_entity_id=eq.${entity}&order=account_code.asc`,
      ),
      rest(
        `fiscal_years?select=*&legal_entity_id=eq.${entity}&order=starts_on.desc`,
      ),
    ]);
    if (q.get("mode") === "report") {
      const ledger = q.get("ledger"),
        from = q.get("from"),
        to = q.get("to");
      if (
        !uuid.test(ledger || "") ||
        !ledgers.some((l: { id: string }) => l.id === ledger) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(from || "") ||
        !/^\d{4}-\d{2}-\d{2}$/.test(to || "")
      )
        throw new PersonRecordError(400, "Select a ledger and report dates.");
      return NextResponse.json(
        await rpc("admin_ledger_report", {
          p_tenant: tenant,
          p_org: org,
          p_ledger: ledger,
          p_from: from,
          p_to: to,
        }),
      );
    }
    const page = Math.max(
      0,
      Math.min(100000, Number.parseInt(q.get("page") || "0", 10) || 0),
    );
    const sort = [
      "journal_date",
      "journal_number",
      "status",
      "description",
    ].includes(q.get("sort") || "")
      ? q.get("sort")
      : "journal_date";
    const direction = q.get("direction") === "asc" ? "asc" : "desc";
    const search = (q.get("search") || "")
      .replace(/[%_*(),.]/g, " ")
      .trim()
      .slice(0, 120);
    const [periods, rows] = await Promise.all([
      years.length
        ? rest(
            `fiscal_periods?select=*&fiscal_year_id=in.(${years.map((y: { id: string }) => y.id).join(",")})&order=starts_on.desc`,
          )
        : [],
      rest(
        `gl_journals?select=*&legal_entity_id=eq.${entity}${search ? `&or=(journal_number.ilike.*${encodeURIComponent(search)}*,description.ilike.*${encodeURIComponent(search)}*)` : ""}&order=${sort}.${direction},id.asc&offset=${page * 25}&limit=26`,
      ),
    ]);
    if (q.get("mode") === "period_history") {
      const id = q.get("period");
      if (
        !uuid.test(id || "") ||
        !periods.some((p: { id: string }) => p.id === id)
      )
        throw new PersonRecordError(404, "Period outside organization.");
      return NextResponse.json({
        history: await rest(
          `audit_events?select=id,action,occurred_at,reason&tenant_id=eq.${tenant}&entity_type=eq.fiscal_period&entity_id=eq.${id}&order=occurred_at.desc&limit=100`,
        ),
      });
    }
    let journal = null,
      lines = [],
      history = [],
      posting = [],
      reversal = [];
    const id = q.get("id");
    if (id) {
      if (!uuid.test(id)) throw new PersonRecordError(400, "Invalid journal.");
      [journal] = await rest(
        `gl_journals?select=*&id=eq.${id}&legal_entity_id=eq.${entity}`,
      );
      if (!journal)
        throw new PersonRecordError(404, "Journal outside organization.");
      [lines, history, posting, reversal] = await Promise.all([
        rest(`gl_lines?select=*&journal_id=eq.${id}&order=id.asc`),
        rest(
          `audit_events?select=id,action,occurred_at,reason,after_data&tenant_id=eq.${tenant}&entity_type=eq.gl_journal&entity_id=eq.${id}&order=occurred_at.desc&limit=100`,
        ),
        rest(`journal_postings?select=*&journal_id=eq.${id}`),
        rest(
          `gl_journals?select=id,journal_number,journal_date,status&reversal_of=eq.${id}`,
        ),
      ]);
    }
    return NextResponse.json({
      entities,
      entity,
      ledgers,
      accounts,
      years,
      periods,
      journals: rows.slice(0, 25),
      hasMore: rows.length > 25,
      journal,
      lines,
      history,
      posting,
      reversal,
      authorization,
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
    if (String(b.reason || "").trim().length < 5)
      throw new PersonRecordError(
        400,
        "Enter a reason of at least five characters.",
      );
    const common = {
      p_tenant: tenant,
      p_org: org,
      p_actor_user: ctx.user.id,
      p_actor_person: ctx.person?.id || null,
      p_reason: String(b.reason).trim(),
    };
    if (b.operation === "ledger" || b.operation === "fiscal_year") {
      if (role !== "org_admin" || !can(ctx, role, "record.create"))
        throw new PersonRecordError(
          403,
          "Ledger setup requires Organization Admin authority.",
        );
      if (!uuid.test(b.entity || ""))
        throw new PersonRecordError(400, "Legal entity required.");
      return NextResponse.json({
        row: await rpc("admin_ledger_setup", {
          ...common,
          p_entity: b.entity,
          p_operation: b.operation,
          p_values: b.values || {},
        }),
      });
    }
    if (b.operation === "period") {
      if (!can(ctx, role, "workflow.execute"))
        throw new PersonRecordError(403, "Period decision authority denied.");
      if (role !== "org_admin" && b.values?.status !== "review")
        throw new PersonRecordError(
          403,
          "Organization Admin decides closure and reopening.",
        );
      if (!uuid.test(b.id || "") || !Number.isInteger(b.expectedVersion))
        throw new PersonRecordError(
          400,
          "Period and current version required.",
        );
      return NextResponse.json({
        row: await rpc("admin_ledger_period", {
          ...common,
          p_role: role,
          p_id: b.id,
          p_expected_version: b.expectedVersion,
          p_status: b.values?.status,
          p_reason: String(b.reason).trim(),
        }),
      });
    }
    if (
      !["create", "edit", "post", "cancel", "reverse"].includes(b.operation) ||
      !uuid.test(b.id || "") ||
      !Number.isInteger(b.expectedVersion) ||
      b.expectedVersion < 0
    )
      throw new PersonRecordError(
        400,
        "Journal, operation and current version required.",
      );
    if (b.operation === "create" && !can(ctx, role, "record.create"))
      throw new PersonRecordError(403, "Journal creation denied.");
    if (
      ["post", "cancel", "reverse"].includes(b.operation) &&
      !can(ctx, role, "workflow.execute")
    )
      throw new PersonRecordError(403, "Journal decision authority denied.");
    if (b.operation === "reverse") {
      const entities = await rest(
        `legal_entities?select=id&organization_id=eq.${org}`,
      );
      const ids = entities.map((e: { id: string }) => e.id);
      const [journal] = ids.length
        ? await rest(
            `gl_journals?select=id,source,reversal_of&legal_entity_id=in.(${ids.join(",")})&id=eq.${b.id}`,
          )
        : [];
      if (!journal)
        throw new PersonRecordError(404, "Journal outside organization.");
      let source = journal.source;
      if (journal.reversal_of) {
        const [original] = await rest(
          `gl_journals?select=source&id=eq.${journal.reversal_of}&legal_entity_id=in.(${ids.join(",")})`,
        );
        source = original?.source;
      }
      const executiveDecisions = await rest(`work_items?select=id&tenant_id=eq.${tenant}&work_type=eq.CLUB_FINANCE_DECISION&entity_id=eq.${journal.reversal_of || b.id}&limit=1`);
      if (executiveDecisions.length) throw new PersonRecordError(409, "Reverse this from Club decisions so the entry fee and accounts stay in step.");
      if (["vendor_bill", "vendor_payment"].includes(source))
        throw new PersonRecordError(
          409,
          "Reverse this transaction from its vendor bill so the payable balance and ledger stay reconciled.",
        );
    }
    return NextResponse.json({
      row: await rpc("admin_ledger_write", {
        ...common,
        p_id: b.id,
        p_operation: b.operation,
        p_expected_version: b.expectedVersion,
        p_values: b.values || {},
      }),
    });
  } catch (e) {
    return fail(e);
  }
}
