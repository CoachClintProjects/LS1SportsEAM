import { NextRequest, NextResponse } from "next/server";
import {
  resolveAccess,
  canUseAdminRoleContext,
  hasAdminContextPermission as can,
} from "@/lib/server/accessControl";
import { recordRest as rest } from "@/lib/server/adminRecordAccess";
import { PersonRecordError } from "@/lib/server/adminPersonRecord";
import { governanceUuid as uuid } from "@/lib/server/adminGovernance";
import {
  gmBoundary,
  currentMembership,
  programMetrics,
} from "@/lib/generalManagerPolicy";
export const dynamic = "force-dynamic";
type Row = Record<string, any>;
async function scope(req: NextRequest, permission = "record.read") {
  const ctx = await resolveAccess(req);
  if (!ctx) throw new PersonRecordError(401, "Sign in required.");
  if (
    !ctx.allowedHubs.includes("admin") ||
    !canUseAdminRoleContext(ctx, "general_manager") ||
    !can(ctx, "general_manager", permission)
  )
    throw new PersonRecordError(403, gmBoundary);
  const tenant = ctx.adminScope?.tenantId || ctx.person?.tenant_id;
  const orgs = ctx.adminScope
    ? [ctx.adminScope.organizationId]
    : [
        ...new Set(
          ctx.roles
            .filter(
              (r) =>
                ["GENERAL_MANAGER", "ORGANIZATION_ADMIN"].includes(r.code) &&
                !r.scope.team_id &&
                !r.scope.site_id &&
                !r.scope.program_id &&
                !r.scope.competition_id &&
                !r.scope.sport_id,
            )
            .map((r) => r.scope.organization_id)
            .filter(Boolean),
        ),
      ];
  if (!tenant || orgs.length !== 1)
    throw new PersonRecordError(
      403,
      "Select one authorized club-wide Operations assignment.",
    );
  return { ctx, tenant, org: String(orgs[0]) };
}
async function all(path: string, order = "id.asc"): Promise<Row[]> {
  const rows: Row[] = [];
  for (let offset = 0; offset < 20000; offset += 500) {
    const page = await rest(
      `${path}&order=${order}&limit=500&offset=${offset}`,
    );
    rows.push(...page);
    if (page.length < 500) return rows;
  }
  throw new PersonRecordError(
    409,
    "This report is too large to load completely. Narrow its scope before continuing.",
  );
}
async function related(
  path: string,
  key: string,
  ids: string[],
  order = "id.asc",
) {
  const rows: Row[] = [];
  for (let i = 0; i < ids.length; i += 80)
    rows.push(
      ...(await all(
        `${path}&${key}=in.(${ids.slice(i, i + 80).join(",")})`,
        order,
      )),
    );
  return rows;
}
const fail = (e: unknown) =>
  NextResponse.json(
    { error: e instanceof Error ? e.message : "Operations request failed." },
    { status: e instanceof PersonRecordError ? e.status : 500 },
  );
export async function GET(req: NextRequest) {
  try {
    const { tenant, org } = await scope(req),
      id = req.nextUrl.searchParams.get("id");
    if (id) {
      if (!uuid.test(id))
        throw new PersonRecordError(400, "Valid incident required.");
      const [row] = await rest(
        `organization_governance_records?select=*&id=eq.${id}&tenant_id=eq.${tenant}&organization_id=eq.${org}&kind=in.(incident,insurance)`,
      );
      if (!row) throw new PersonRecordError(404, "Record not found.");
      const history = await all(
        `audit_events?select=id,action,occurred_at,reason,actor_person_id&tenant_id=eq.${tenant}&entity_type=eq.organization_governance&entity_id=eq.${id}`,
        "occurred_at.desc,id.asc",
      );
      return NextResponse.json({ row, history });
    }
    const [
      programs,
      seasons,
      teams,
      registrations,
      incidents,
      types,
      tasks,
      exceptions,
      settings,
      competitions,
    ] = await Promise.all([
      all(`programs?select=id,name,status&organization_id=eq.${org}`),
      all(
        `seasons?select=id,name,starts_on,ends_on,status&organization_id=eq.${org}`,
      ),
      all(
        `teams?select=id,name,season_id,program_id,status&organization_id=eq.${org}`,
      ),
      all(
        `registrations?select=id,athlete_id,season_id,program_id,status,submitted_at&organization_id=eq.${org}`,
      ),
      all(
        `organization_governance_records?select=*&tenant_id=eq.${tenant}&organization_id=eq.${org}&kind=in.(incident,insurance)`,
      ),
      all(
        "organization_governance_types?select=code,name,fields,transitions&code=in.(incident,insurance)",
        "code.asc",
      ),
      all(
        `operational_tasks?select=id,title,description,status,assigned_role,priority,team_id,due_at,revision,metadata&tenant_id=eq.${tenant}&organization_id=eq.${org}`,
      ),
      all(
        `membership_exceptions?select=id,exception_type,reason_category,status,created_at,decision_note&organization_id=eq.${org}`,
      ),
      all(
        `system_configurations?select=id,config_key,config_value&tenant_id=eq.${tenant}&config_namespace=eq.admin.squad&active=eq.true&config_value->>organization_id=eq.${org}`,
      ),
      all(
        `competitions?select=id,name,status,starts_at,ends_at,venue_facility_id&organization_id=eq.${org}`,
      ),
    ]);
    const groups = await related(
      "groups?select=id,team_id,name,status",
      "team_id",
      teams.map((t) => t.id),
    );
    const memberships = await related(
      "group_memberships?select=group_id,athlete_id,status,starts_on,ends_on",
      "group_id",
      groups.map((g) => g.id),
      "group_id.asc,athlete_id.asc,starts_on.asc",
    );
    const athleteIds = [
      ...new Set<string>(memberships.map((m) => m.athlete_id).filter(Boolean)),
    ];
    const [athletes, cases] = await Promise.all([
      related(
        `athletes?select=id,person_id,people!inner(first_name,last_name,preferred_name,tenant_id)&people.tenant_id=eq.${tenant}`,
        "id",
        athleteIds,
      ),
      related(
        "competition_judicial_cases?select=*",
        "competition_id",
        competitions.map((c) => c.id),
      ),
    ]);
    const capacities = groups.map((g) => {
      const active = memberships.filter(
        (m) =>
          m.group_id === g.id && currentMembership(m as { status: string }),
      );
      const count = new Set(active.map((m) => m.athlete_id)).size;
      const cap =
        Number(
          settings.find((s) => s.config_key === g.id)?.config_value?.hard_cap,
        ) || null;
      return {
        ...g,
        team: teams.find((t) => t.id === g.team_id)?.name,
        count,
        cap,
        athleteIds: [...new Set(active.map((m) => m.athlete_id))],
      };
    });
    return NextResponse.json({
      org,
      programs,
      seasons,
      teams,
      registrations,
      metrics: programMetrics(programs, seasons, registrations),
      incidents,
      types,
      tasks,
      exceptions,
      capacities,
      athletes,
      cases,
      competitions,
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    return fail(e);
  }
}
export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    const allowed = [
      "create",
      "edit",
      "transition",
      "registrar_followup",
      "jury_signoff",
    ];
    if (!allowed.includes(b.operation))
      throw new PersonRecordError(403, gmBoundary);
    const { ctx, tenant, org } = await scope(
      req,
      b.operation === "create"
        ? "record.create"
        : b.operation === "edit"
          ? "record.update"
          : "workflow.execute",
    );
    if (!ctx.person)
      throw new PersonRecordError(403, "A staff person record is required.");
    const reason = String(b.reason || "").trim();
    if (
      reason.length < 3 ||
      reason.length > 4000 ||
      !uuid.test(String(b.id || ""))
    )
      throw new PersonRecordError(
        400,
        "Valid record and a reason of 3–4000 characters required.",
      );
    if (b.operation === "jury_signoff") {
      const [row] = await rest(
        `competition_judicial_cases?select=*,competitions!inner(organization_id)&id=eq.${b.id}&competitions.organization_id=eq.${org}`,
      );
      if (!row)
        throw new PersonRecordError(404, "Jury case not found in this club.");
      const caseFields = ["summary", "rule_reference", "evidence"];
      if (
        caseFields.some(
          (k) => JSON.stringify(row[k]) !== JSON.stringify(b.expectedCase?.[k]),
        )
      )
        throw new PersonRecordError(
          409,
          "Case evidence changed. Reload before signing.",
        );
      if (
        row.decided_at ||
        ["closed", "decided", "resolved"].includes(row.status)
      )
        throw new PersonRecordError(
          409,
          "A signed decision is retained. Open a new review through the club appeals process.",
        );
      if (
        ![
          "open",
          "filed",
          "pending",
          "under_review",
          "review",
          "investigating",
        ].includes(row.status) ||
        row.status !== b.expectedStatus
      )
        throw new PersonRecordError(409, "Reload the case before deciding.");
      const decision = String(b.decision || "").trim();
      if (decision.length < 10 || decision.length > 10000)
        throw new PersonRecordError(
          400,
          "Enter a decision of 10–10000 characters.",
        );
      const saved = await rest(
        `competition_judicial_cases?id=eq.${b.id}&competition_id=eq.${row.competition_id}&status=eq.${encodeURIComponent(row.status)}&decided_at=is.null${caseFields.map((k) => `&${k}=${row[k] === null ? "is.null" : `eq.${encodeURIComponent(typeof row[k] === "object" ? JSON.stringify(row[k]) : String(row[k]))}`}`).join("")}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            status: "decided",
            decision: `${decision}\n\nDecision reason: ${reason}`,
            decided_by: ctx.person.id,
            decided_at: new Date().toISOString(),
          }),
        },
      );
      if (!saved.length)
        throw new PersonRecordError(
          409,
          "Another reviewer changed the case. Reload before continuing.",
        );
      let warning = "";
      try {
        await rest("audit_events", {
          method: "POST",
          body: JSON.stringify({
            tenant_id: tenant,
            actor_user_id: ctx.user.id,
            actor_person_id: ctx.person.id,
            action: "general_manager.jury_signoff",
            entity_type: "competition_judicial_cases",
            entity_id: b.id,
            reason,
            before_data: row,
            after_data: saved[0],
          }),
        });
      } catch {
        warning =
          "Decision saved with signer, time and reason on the case. The separate audit event could not be written; contact Organization Admin before further action.";
      }
      return NextResponse.json({ row: saved[0], warning });
    }
    let record: Row | null = null;
    if (b.operation !== "create") {
      [record] = await rest(
        `organization_governance_records?select=*&id=eq.${b.id}&tenant_id=eq.${tenant}&organization_id=eq.${org}&kind=in.(incident,insurance)`,
      );
      if (!record)
        throw new PersonRecordError(
          404,
          "Incident or insurance record not found.",
        );
    }
    if (b.operation === "registrar_followup") {
      if (!can(ctx, "general_manager", "admin_tasks.create"))
        throw new PersonRecordError(403, gmBoundary);
      // Narrow delegation: only a Registrar follow-up on this already scoped record.
      const result = await rest("rpc/admin_triage_change", {
        method: "POST",
        body: JSON.stringify({
          p_source: "operational_tasks",
          p_id: null,
          p_revision: null,
          p_action: "create",
          p_note: reason,
          p_tenant: tenant,
          p_orgs: [org],
          p_role: "registrar",
          p_team: null,
          p_actor_user: ctx.user.id,
          p_actor_person: ctx.person.id,
          p_create: {
            title: `Follow up: ${record!.title}`.slice(0, 200),
            description: `Operations review ${record!.id}. ${reason}`,
            organization_id: org,
            team_id: null,
            assigned_role: "registrar",
            priority: "normal",
            due_at: null,
          },
        }),
      });
      return NextResponse.json({ result });
    }
    const values = b.values || {};
    if (
      b.operation === "create" &&
      !["incident", "insurance"].includes(values.kind)
    )
      throw new PersonRecordError(403, gmBoundary);
    if (record && values.kind && values.kind !== record.kind)
      throw new PersonRecordError(403, gmBoundary);
    if (b.operation !== "create" && !Number.isInteger(b.expectedVersion))
      throw new PersonRecordError(400, "Reload the record version.");
    const filtered: Row =
      b.operation === "transition"
        ? { status: values.status }
        : Object.fromEntries(
            Object.entries(values).filter(([k]) =>
              ["kind", "title", "details", "due_on"].includes(k),
            ),
          );
    if (b.operation === "edit" && record)
      filtered.owner_person_id = record.owner_person_id;
    const row = await rest("rpc/admin_governance_write", {
      method: "POST",
      body: JSON.stringify({
        p_tenant: tenant,
        p_org: org,
        p_actor_user: ctx.user.id,
        p_actor_person: ctx.person.id,
        p_id: b.id,
        p_operation: b.operation,
        p_expected_version: b.expectedVersion ?? 0,
        p_values: filtered,
        p_reason: reason,
      }),
    });
    return NextResponse.json({ row });
  } catch (e) {
    return fail(e);
  }
}
