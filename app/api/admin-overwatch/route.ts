import { NextRequest, NextResponse } from "next/server";
import {
  governanceScope,
  governanceUuid as uuid,
} from "@/lib/server/adminGovernance";
import { recordRest as rest } from "@/lib/server/adminRecordAccess";
import { PersonRecordError } from "@/lib/server/adminPersonRecord";
import { hasAdminContextPermission as can } from "@/lib/server/accessControl";
import { csvFile } from "@/lib/overwatch/csv";
export const dynamic = "force-dynamic";
const fail = (e: unknown) =>
  NextResponse.json(
    { error: e instanceof Error ? e.message : "Club overview unavailable." },
    { status: e instanceof PersonRecordError ? e.status : 500 },
  );
const rpc = (name: string, body: Record<string, unknown>) =>
  rest("rpc/" + name, { method: "POST", body: JSON.stringify(body) });
export async function GET(req: NextRequest) {
  try {
    const { ctx, tenant, org } = await governanceScope(req, "org_admin");
    if (
      !can(ctx, "org_admin", "finance.read") ||
      !can(ctx, "org_admin", "rosters.read")
    )
      throw new PersonRecordError(
        403,
        "Club finance and roster read permissions required.",
      );
    const q = req.nextUrl.searchParams,
      from = q.get("from") || new Date().getUTCFullYear() + "-01-01",
      to = q.get("to") || new Date().toISOString().slice(0, 10),
      kind = q.get("export");
    const date = (v: string) =>
      /^\d{4}-\d{2}-\d{2}$/.test(v) &&
      Number.isFinite(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v;
    if (
      !date(from) ||
      !date(to) ||
      from > to ||
      (kind && !["personnel", "finance"].includes(kind))
    )
      throw new PersonRecordError(
        400,
        "Select valid report dates and export type.",
      );
    const entities = await rest(
      `legal_entities?select=id,legal_name&organization_id=eq.${org}`,
    );
    const ids = entities.map((e: { id: string }) => e.id);
    const ledgers = ids.length
      ? await rest(
          `accounting_ledgers?select=id,name,currency,legal_entity_id&legal_entity_id=in.(${ids.join(",")})&order=name.asc`,
        )
      : [];
    const ledger = q.get("ledger") || ledgers[0]?.id || null;
    if (
      ledger &&
      (!uuid.test(ledger) ||
        !ledgers.some((l: { id: string }) => l.id === ledger))
    )
      throw new PersonRecordError(404, "Ledger outside club.");
    if (kind === "finance" && !ledger)
      throw new PersonRecordError(409, "Set up a club ledger first.");
    const data = await rpc("admin_overwatch", {
      p_tenant: tenant,
      p_org: org,
      p_ledger: ledger,
      p_from: from,
      p_to: to,
      p_export: kind,
    });
    if (kind) {
      if (kind === "finance" && data.invalidJournals > 0)
        throw new PersonRecordError(
          409,
          "Unbalanced posted transactions require review before export.",
        );
      const rows =
        kind === "personnel" ? data.personnel.rows : data.entries || [];
      const cols =
        kind === "personnel"
          ? [
              "id",
              "name",
              "status",
              "roles",
              "safe_clear",
              "background_clear",
              "expired_safesport",
              "expired_background",
            ]
          : [
              "id",
              "journal_date",
              "journal_number",
              "description",
              "account_code",
              "account_name",
              "account_type",
              "debit",
              "credit",
              "currency",
              "reversal_of",
            ];
      await rest("audit_events", {
        method: "POST",
        body: JSON.stringify({
          tenant_id: tenant,
          actor_user_id: ctx.user.id,
          actor_person_id: ctx.person?.id,
          action: "overwatch.export",
          entity_type: "organization",
          entity_id: org,
          after_data: {
            kind,
            rows: rows.length,
            ledger,
            from,
            to,
            generated_at: data.generatedAt,
          },
          reason: "User downloaded club records",
        }),
      });
      return new NextResponse(
        csvFile(
          cols,
          rows.map((r: Record<string, unknown>) => cols.map((c) => r[c])),
        ),
        {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="ls1-${kind}-${new Date(data.generatedAt).toISOString().replace(/[:.]/g, "-")}.csv"`,
            "Cache-Control": "no-store",
          },
        },
      );
    }
    const accounts = ledger
      ? await rest(
          `chart_of_accounts?select=id,account_name&legal_entity_id=eq.${ledgers.find((l: { id: string }) => l.id === ledger).legal_entity_id}&active=eq.true&account_type=eq.asset&order=account_name.asc`,
        )
      : [];
    return NextResponse.json(
      {
        ...data,
        ledgers,
        ledger,
        from,
        to,
        accounts,
        canSetup: can(ctx, "org_admin", "record.update"),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return fail(e);
  }
}
export async function POST(req: NextRequest) {
  try {
    const { ctx, tenant, org } = await governanceScope(
      req,
      "org_admin",
      "record.update",
    );
    if (!can(ctx, "org_admin", "finance.read"))
      throw new PersonRecordError(403, "Finance permission required.");
    const b = await req.json();
    if (
      ![b.ledger, b.bank, b.reserve].every(
        (v) => typeof v === "string" && uuid.test(v),
      )
    )
      throw new PersonRecordError(
        400,
        "Choose ledger, bank and reserve accounts.",
      );
    return NextResponse.json(
      await rpc("admin_overwatch_settings", {
        p_tenant: tenant,
        p_org: org,
        p_actor: ctx.user.id,
        p_ledger: b.ledger,
        p_bank: b.bank,
        p_reserve: b.reserve,
      }),
    );
  } catch (e) {
    return fail(e);
  }
}
