import { NextRequest, NextResponse } from "next/server";
import { financeScope } from "@/lib/server/adminFinanceScope";
import { governanceUuid as uuid } from "@/lib/server/adminGovernance";
import { recordRest as rest } from "@/lib/server/adminRecordAccess";
import { PersonRecordError } from "@/lib/server/adminPersonRecord";
import { hasAdminContextPermission as can } from "@/lib/server/accessControl";
export const dynamic = "force-dynamic";
const fail = (e: unknown) =>
  NextResponse.json(
    { error: e instanceof Error ? e.message : "Club action failed." },
    { status: e instanceof PersonRecordError ? e.status : 500 },
  );
export async function GET(req: NextRequest) {
  try {
    const role = req.nextUrl.searchParams.get("role") || "org_admin";
    const { tenant, org } = await financeScope(req, role);
    const person = req.nextUrl.searchParams.get("personId");
    if (person && !uuid.test(person))
      throw new PersonRecordError(400, "Invalid person.");
    const [
      groups,
      teams,
      settings,
      squadSettings,
      entities,
      holdings,
      tasks,
      invoices,
      fees,
      vendors,
      programs,
    ] = await Promise.all([
      rest(
        `groups?select=*,teams!inner(organization_id,season_id)&teams.organization_id=eq.${org}&order=name.asc&limit=1000`,
      ),
      rest(
        `teams?select=id,name,season_id&organization_id=eq.${org}&order=name.asc&limit=1000`,
      ),
      rest(
        `system_configurations?select=config_value,version&tenant_id=eq.${tenant}&config_namespace=eq.admin.cross_engine&config_key=eq.${org}&active=eq.true&order=version.desc&limit=1`,
      ),
      rest(
        `system_configurations?select=config_key,config_value&tenant_id=eq.${tenant}&config_namespace=eq.admin.squad&config_value->>organization_id=eq.${org}&active=eq.true`,
      ),
      rest(`legal_entities?select=id,legal_name&organization_id=eq.${org}`),
      rest(
        `work_items?select=id,payload,status&tenant_id=eq.${tenant}&work_type=eq.DECK_CASH&payload->>organization_id=eq.${org}&status=eq.open&limit=1000`,
      ),
      rest(
        `operational_tasks?select=id,title,metadata&tenant_id=eq.${tenant}&organization_id=eq.${org}&metadata->>cross_engine=eq.true&status=eq.open&limit=1000`,
      ),
      rest(
        `invoices?select=*,customers!inner(display_name,person_id,organization_id)&customers.organization_id=eq.${org}&status=not.in.(draft,void,cancelled)&order=invoice_date.desc&limit=1000`,
      ),
      rest(
        `competition_entry_fees?select=*,competitions!inner(name,organization_id),competition_entries(athlete_id)&competitions.organization_id=eq.${org}&status=eq.assessed&limit=1000`,
      ),
      rest(
        `vendors?select=id,name&organization_id=eq.${org}&tenant_id=eq.${tenant}&status=eq.active&limit=1000`,
      ),
      rest(
        `programs?select=id,name,status&organization_id=eq.${org}&limit=1000`,
      ),
    ]);
    const groupIds = groups.map((g: { id: string }) => g.id),
      entityIds = entities.map((e: { id: string }) => e.id),
      invoiceIds = invoices.map((i: { id: string }) => i.id);
    const [memberships, ledgers, accounts, lines, athletes] = await Promise.all(
      [
        groupIds.length
          ? rest(
              `group_memberships?select=*&group_id=in.(${groupIds.join(",")})&status=eq.active&limit=10000`,
            )
          : [],
        entityIds.length
          ? rest(
              `accounting_ledgers?select=id,name,currency,legal_entity_id&legal_entity_id=in.(${entityIds.join(",")})`,
            )
          : [],
        entityIds.length
          ? rest(
              `chart_of_accounts?select=id,account_name,account_type,legal_entity_id&legal_entity_id=in.(${entityIds.join(",")})&active=eq.true`,
            )
          : [],
        invoiceIds.length
          ? rest(
              `invoice_lines?select=*&invoice_id=in.(${invoiceIds.join(",")})&entity_type=eq.group&limit=10000`,
            )
          : [],
        person
          ? rest(
              `athletes?select=id,person_id,people!inner(tenant_id)&person_id=eq.${person}&people.tenant_id=eq.${tenant}`,
            )
          : [],
      ],
    );
    return NextResponse.json({
      fees: person
        ? fees.filter(
            (f: any) => f.competition_entries?.athlete_id === athletes[0]?.id,
          )
        : fees,
      vendors,
      programs,
      groups,
      teams,
      settings: settings[0]?.config_value || null,
      squadSettings,
      holdings,
      tasks,
      invoices: person
        ? invoices.filter((i: any) => i.customers.person_id === person)
        : invoices,
      lines,
      memberships,
      ledgers,
      accounts,
      athleteId: athletes[0]?.id || null,
    });
  } catch (e) {
    return fail(e);
  }
}
export async function POST(req: NextRequest) {
  try {
    const b = await req.json(),
      role = String(b.role || "org_admin");
    const { ctx, tenant, org } = await financeScope(req, role, "record.update");
    const allowed = [
      "settings",
      "squad_settings",
      "preview_transfer",
      "transfer",
      "cash",
      "deposit",
      "approve_credit",
      "cover_fee",
      "deactivate",
      "reverse_fee",
    ];
    if (
      !allowed.includes(b.operation) ||
      !uuid.test(b.requestId || "") ||
      !b.values ||
      typeof b.values !== "object" ||
      Array.isArray(b.values)
    )
      throw new PersonRecordError(400, "Choose an action and its details.");
    if (
      !ctx.person?.id ||
      !can(ctx, role, "workflow.execute") ||
      (role !== "org_admin" &&
        !["deposit", "approve_credit"].includes(b.operation))
    )
      throw new PersonRecordError(403, "Club decision authority required.");
    const reason = String(b.reason || "").trim();
    if (reason.length < 5 || reason.length > 4000)
      throw new PersonRecordError(
        400,
        "Explain this action in 5 to 4000 characters.",
      );
    const row = await rest("rpc/admin_cross_engine", {
      method: "POST",
      body: JSON.stringify({
        p_tenant: tenant,
        p_org: org,
        p_actor_user: ctx.user.id,
        p_actor_person: ctx.person.id,
        p_request: b.requestId,
        p_operation: b.operation,
        p_values: b.values,
        p_reason: reason,
      }),
    });
    return NextResponse.json({ row });
  } catch (e) {
    return fail(e);
  }
}
