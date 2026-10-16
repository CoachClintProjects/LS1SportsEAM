import { NextRequest, NextResponse } from "next/server";
import {
  resolveAccess,
  hasAdminContextPermission as can,
} from "@/lib/server/accessControl";
import { recordRest as rest } from "@/lib/server/adminRecordAccess";
import { TriageError } from "@/lib/server/adminTriage";
import { PersonRecordError } from "@/lib/server/adminPersonRecord";
import {
  teamManagerScope,
  squadMembers,
  squadBoundary,
} from "@/lib/server/teamManagerScope";
import { governanceUuid as uuid } from "@/lib/server/adminGovernance";
export const dynamic = "force-dynamic";
const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
const failure = (e: unknown) =>
  reply(
    { error: e instanceof Error ? e.message : "Squad records unavailable." },
    e instanceof TriageError || e instanceof PersonRecordError ? e.status : 503,
  );
async function context(req: NextRequest, team?: string) {
  const ctx = await resolveAccess(req);
  if (!ctx) throw new TriageError("Sign in required.", 401);
  const scope = await teamManagerScope(rest, ctx, team);
  const memberships = await squadMembers(rest, scope.team);
  if (memberships.length >= 1000)
    throw new TriageError(
      "Squad exceeds the supported roster page. Narrow the assigned squad before continuing.",
      409,
    );
  const athleteIds = [
    ...new Set<string>(
      memberships.map((m: { athlete_id: string }) => m.athlete_id),
    ),
  ];
  const athletes = athleteIds.length
    ? await rest(
        `athletes?select=id,person_id,athlete_number,athlete_status,people!inner(id,first_name,last_name,preferred_name,tenant_id)&id=in.(${athleteIds.join(",")})&people.tenant_id=eq.${scope.tenant}`,
      )
    : [];
  return { ctx, scope, athletes, athleteIds };
}
export async function GET(req: NextRequest) {
  try {
    const { ctx, scope, athletes, athleteIds } = await context(req, req.nextUrl.searchParams.get("team") || undefined);
    const af = `in.(${athleteIds.join(",")})`;
    const personIds = athletes.map((a: { person_id: string }) => a.person_id);
    const [
      registrations,
      responses,
      participants,
      practices,
      holdings,
      customers,
      settings,
    ] = await Promise.all([
      athleteIds.length
        ? rest(
            `registrations?select=id,athlete_id,status,submitted_at&organization_id=eq.${scope.org}&athlete_id=${af}&limit=1000`,
          )
        : [],
      athleteIds.length
        ? rest(
            `competition_participation_responses?select=id,athlete_id,competition_id,invitation_status,response_status,last_reminded_at,competitions(name)&tenant_id=eq.${scope.tenant}&organization_id=eq.${scope.org}&athlete_id=${af}&limit=1000`,
          )
        : [],
      athleteIds.length
        ? rest(
            `travel_participants?select=id,athlete_id,status,guardian_required,travel_plans!inner(id,name,starts_at,ends_at,status,destination_city,destination_region,destination_country,organization_id,tenant_id)&athlete_id=${af}&travel_plans.organization_id=eq.${scope.org}&travel_plans.tenant_id=eq.${scope.tenant}&limit=1000`,
          )
        : [],
      rest(
        `calendar_events?select=id,title,event_type,starts_at,ends_at,status,timezone&tenant_id=eq.${scope.tenant}&organization_id=eq.${scope.org}&metadata->>team_id=eq.${scope.team}&event_type=in.(practice,training)&order=starts_at.asc&limit=500`,
      ),
      can(ctx, "team_manager", "finance.read")
        ? rest(
            `work_items?select=id,status,payload&tenant_id=eq.${scope.tenant}&work_type=eq.DECK_CASH&payload->>organization_id=eq.${scope.org}&payload->>team_id=eq.${scope.team}&status=eq.open&limit=1000`,
          )
        : [],
      can(ctx, "team_manager", "finance.read") && personIds.length
        ? rest(
            `customers?select=id,person_id,display_name&organization_id=eq.${scope.org}&person_id=in.(${personIds.join(",")})&limit=1000`,
          )
        : [],
      rest(
        `system_configurations?select=config_value&tenant_id=eq.${scope.tenant}&config_namespace=eq.admin.cross_engine&config_key=eq.${scope.org}&active=eq.true&order=version.desc&limit=1`,
      ),
    ]);
    const invoices = customers.length
      ? await rest(
          `invoices?select=id,customer_id,invoice_number,currency,total,balance_due,status&customer_id=in.(${customers.map((c: { id: string }) => c.id).join(",")})&status=not.in.(draft,void,cancelled)&order=invoice_date.desc&limit=1000`,
        )
      : [];
    return reply({
      squad: scope.squad,
      availableTeams:scope.availableTeams,
      athletes,
      registrations,
      responses,
      participants,
      practices,
      holdings,
      customers,
      invoices,
      postingConfigured: !!settings[0],
      canCash:
        can(ctx, "team_manager", "finance.read") &&
        can(ctx, "team_manager", "record.create") &&
        can(ctx, "team_manager", "workflow.execute"),
      generatedAt: new Date().toISOString(),
      truncated:
        [
          registrations,
          responses,
          participants,
          holdings,
          customers,
          invoices,
        ].some((x) => x.length >= 1000) || practices.length >= 500,
    });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    if (
      b.action !== "cash" ||
      !uuid.test(b.requestId || "") ||
      !uuid.test(b.invoiceId || "") ||
      !uuid.test(b.team || "")
    )
      throw new TriageError("Valid cash receipt details are required.");
    const { ctx, scope, athletes } = await context(req, b.team);
    if (
      !ctx.person ||
      !can(ctx, "team_manager", "finance.read") ||
      !can(ctx, "team_manager", "record.create") ||
      !can(ctx, "team_manager", "workflow.execute")
    )
      throw new TriageError("Cash receipt authority is required.", 403);
    const amount = String(b.amount || "");
    const reason = String(b.reason || "").trim();
    if (
      !/^\d+(\.\d{1,2})?$/.test(amount) ||
      Number(amount) <= 0 ||
      reason.length < 5 ||
      reason.length > 4000
    )
      throw new TriageError(
        "Enter the exact positive cash amount and a reason of 5–4000 characters.",
      );
    const invoices = await rest(
      `invoices?select=id,customers!inner(person_id,organization_id)&id=eq.${b.invoiceId}&customers.organization_id=eq.${scope.org}`,
    );
    if (
      !invoices[0] ||
      !athletes.some(
        (a: { person_id: string }) =>
          a.person_id === invoices[0].customers.person_id,
      )
    )
      throw new TriageError(squadBoundary, 403);
    const row = await rest("rpc/admin_cross_engine", {
      method: "POST",
      body: JSON.stringify({
        p_tenant: scope.tenant,
        p_org: scope.org,
        p_actor_user: ctx.user.id,
        p_actor_person: ctx.person.id,
        p_request: b.requestId,
        p_operation: "cash",
        p_values: { team_id: scope.team, invoice_id: b.invoiceId, amount },
        p_reason: reason,
      }),
    });
    return reply({ row });
  } catch (e) {
    return failure(e);
  }
}
