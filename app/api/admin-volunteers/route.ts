import { NextRequest, NextResponse } from "next/server";
import {
  resolveAccess,
  canUseAdminRoleContext,
  hasAdminContextPermission as can,
} from "@/lib/server/accessControl";
import { recordRest as rest } from "@/lib/server/adminRecordAccess";
import { PersonRecordError } from "@/lib/server/adminPersonRecord";
import {
  clearance,
  shiftInput,
  volunteerBoundary,
} from "@/lib/volunteerPolicy";
export const dynamic = "force-dynamic";
type Row = Record<string, any>;
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
async function scope(request: NextRequest, permission = "record.read") {
  const ctx = await resolveAccess(request);
  if (!ctx) throw new PersonRecordError(401, "Sign in required.");
  if (
    !ctx.allowedHubs.includes("admin") ||
    !canUseAdminRoleContext(ctx, "volunteer_coordinator") ||
    !can(ctx, "volunteer_coordinator", permission)
  )
    throw new PersonRecordError(403, volunteerBoundary);
  const tenant = ctx.adminScope?.tenantId || ctx.person?.tenant_id,
    orgs = ctx.adminScope
      ? [ctx.adminScope.organizationId]
      : [
          ...new Set(
            ctx.roles
              .filter((r) =>
                [
                  "VOLUNTEER_COORDINATOR",
                  "VOLUNTEER",
                  "ORGANIZATION_ADMIN",
                ].includes(r.code),
              )
              .map((r) => r.scope.organization_id)
              .filter(Boolean),
          ),
        ];
  if (!tenant || orgs.length !== 1)
    throw new PersonRecordError(403, "One authorized club is required.");
  return { ctx, tenant, org: String(orgs[0]) };
}
async function all(path: string, order = "id.asc"): Promise<Row[]> {
  const rows: Row[] = [];
  for (let offset = 0; offset < 10000; offset += 500) {
    const page = await rest(
      `${path}&order=${order}&limit=500&offset=${offset}`,
    );
    rows.push(...page);
    if (page.length < 500) return rows;
  }
  throw new PersonRecordError(
    409,
    "Record limit reached. Ask the club administrator to narrow the volunteer scope.",
  );
}
async function related(path: string, key: string, ids: string[]) {
  const rows: Row[] = [];
  const unique = [...new Set(ids.filter(Boolean))];
  for (let i = 0; i < unique.length; i += 100)
    rows.push(
      ...(await all(
        `${path}&${key}=in.(${unique.slice(i, i + 100).join(",")})`,
      )),
    );
  return rows;
}
const fail = (e: unknown) =>
  NextResponse.json(
    { error: e instanceof Error ? e.message : "Volunteer request failed." },
    { status: e instanceof PersonRecordError ? e.status : 500 },
  );
export async function GET(request: NextRequest) {
  try {
    const { ctx, tenant, org } = await scope(request);
    const [opportunities, roles, competitions] = await Promise.all([
      all(`volunteer_opportunities?select=*&organization_id=eq.${org}`),
      all(`volunteer_roles?select=*&organization_id=eq.${org}`),
      all(
        `competitions?select=id,name,starts_at,ends_at,status&tenant_id=eq.${tenant}&organization_id=eq.${org}&status=not.in.(cancelled,completed)`,
      ),
    ]);
    const [assignments, sessions] = await Promise.all([
      related(
        "volunteer_assignments?select=*",
        "opportunity_id",
        opportunities.map((o) => o.id),
      ),
      related(
        "competition_sessions?select=id,competition_id,name,starts_at,ends_at,status",
        "competition_id",
        competitions.map((c) => c.id),
      ),
    ]);
    const people = await related(
      `people?select=id,first_name,last_name,preferred_name&tenant_id=eq.${tenant}`,
      "id",
      assignments.map((a) => a.volunteer_person_id),
    );
    const credentials = await related(
      "credentials?select=id,person_id,credential_type,status,verification_status,issued_on,expires_on",
      "person_id",
      people.map((p) => p.id),
    );
    const checks = assignments.map((a) => {
      const o = opportunities.find((o) => o.id === a.opportunity_id),
        r = roles.find((r) => r.id === a.role_id);
      return {
        id: a.id,
        ...clearance(
          r as any,
          credentials.filter(
            (c) => c.person_id === a.volunteer_person_id,
          ) as any,
          o?.ends_at || "",
        ),
      };
    });
    const id = request.nextUrl.searchParams.get("id");
    if (id && !opportunities.some((o) => o.id === id))
      throw new PersonRecordError(404, "Shift not found in your club.");
    const ids = id
      ? [
          id,
          ...assignments
            .filter((a) => a.opportunity_id === id)
            .map((a) => a.id),
        ]
      : [];
    const history = await related(
      `audit_events?select=id,entity_id,action,reason,occurred_at&tenant_id=eq.${tenant}&entity_type=in.(volunteer_opportunity,volunteer_assignment)`,
      "entity_id",
      ids,
    );
    return NextResponse.json({
      opportunities,
      roles,
      competitions,
      sessions,
      assignments,
      people,
      credentials,
      checks,
      history,
      canCreate: can(ctx, "volunteer_coordinator", "record.create"),
      canUpdate: can(ctx, "volunteer_coordinator", "record.update"),
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    return fail(e);
  }
}
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!["create", "check_in", "cancel"].includes(body.action))
      throw new PersonRecordError(403, volunteerBoundary);
    const { ctx, tenant, org } = await scope(
      request,
      body.action === "create" ? "record.create" : "record.update",
    );
    if (!ctx.person?.id)
      throw new PersonRecordError(
        403,
        "A linked club person is required to record changes.",
      );
    if (!uuid.test(body.id || ""))
      throw new PersonRecordError(400, "A valid record ID is required.");
    const reason = String(body.reason || "").trim();
    if (reason.length < 10 || reason.length > 2000)
      throw new PersonRecordError(
        400,
        "Record a reason of 10–2000 characters.",
      );
    let row: Row,
      prior: Row | null = null;
    let type = "volunteer_opportunity";
    if (body.action === "create") {
      let values;
      try {
        values = shiftInput(body);
      } catch (e) {
        throw new PersonRecordError(
          400,
          e instanceof Error ? e.message : "Invalid shift.",
        );
      }
      const existing = await rest(
        `volunteer_opportunities?select=*&id=eq.${body.id}`,
      );
      if (existing.length) {
        const e = existing[0];
        if (
          e.organization_id !== org ||
          e.title !== values.title ||
          Date.parse(e.starts_at) !== Date.parse(values.starts_at) ||
          Date.parse(e.ends_at) !== Date.parse(values.ends_at) ||
          e.capacity !== values.capacity
        )
          throw new PersonRecordError(
            409,
            "This request ID is already used by a different shift.",
          );
        return NextResponse.json({
          ok: true,
          row: e,
          message:
            "This shift was already saved. Review history before retrying.",
        });
      }
      const saved = await rest("volunteer_opportunities", {
        method: "POST",
        body: JSON.stringify({
          id: body.id,
          organization_id: org,
          ...values,
          credits: 0,
          status: "OPEN",
        }),
      });
      row = saved[0];
    } else {
      type = "volunteer_assignment";
      const rows = await rest(
        `volunteer_assignments?select=*&id=eq.${body.id}`,
      );
      prior = rows[0];
      if (!prior) throw new PersonRecordError(404, "Assignment not found.");
      const opps = await rest(
          `volunteer_opportunities?select=*&id=eq.${prior.opportunity_id}&organization_id=eq.${org}`,
        ),
        opp = opps[0];
      if (!opp)
        throw new PersonRecordError(404, "Assignment not found in your club.");
      if (
        !["assigned", "checked_in"].includes(prior.status) ||
        prior.completed_at
      )
        throw new PersonRecordError(409, "This assignment is already closed.");
      if (body.updated_at !== prior.updated_at)
        throw new PersonRecordError(
          409,
          "Assignment changed. Refresh before saving.",
        );
      let changes: Row = { status: "cancelled" };
      if (body.action === "check_in") {
        if (prior.status !== "assigned" || prior.checked_in_at)
          throw new PersonRecordError(409, "Worker is already checked in.");
        if (
          String(opp.status).toUpperCase() !== "OPEN" ||
          !opp.ends_at ||
          Date.parse(opp.ends_at) <= Date.now()
        )
          throw new PersonRecordError(
            409,
            "This shift is closed or has ended.",
          );
        const people = await rest(
          `people?select=id&id=eq.${prior.volunteer_person_id}&tenant_id=eq.${tenant}`,
        );
        if (!people.length)
          throw new PersonRecordError(
            403,
            "Worker is outside your club tenant.",
          );
        const roles = prior.role_id
            ? await rest(
                `volunteer_roles?select=*&id=eq.${prior.role_id}&organization_id=eq.${org}`,
              )
            : [],
          credentials = await rest(
            `credentials?select=credential_type,status,verification_status,issued_on,expires_on&person_id=eq.${prior.volunteer_person_id}`,
          );
        const check = clearance(roles[0], credentials, opp.ends_at);
        if (!check.ok) throw new PersonRecordError(409, check.reason);
        changes = {
          status: "checked_in",
          checked_in_at: new Date().toISOString(),
        };
      }
      const saved = await rest(
        `volunteer_assignments?id=eq.${body.id}&status=eq.${encodeURIComponent(prior.status)}&updated_at=${prior.updated_at ? "eq." + encodeURIComponent(prior.updated_at) : "is.null"}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            ...changes,
            updated_at: new Date().toISOString(),
          }),
        },
      );
      if (!saved.length)
        throw new PersonRecordError(
          409,
          "Assignment changed. Refresh before saving.",
        );
      row = saved[0];
    }
    if (!row) throw new Error("No saved record returned.");
    try {
      await rest("audit_events", {
        method: "POST",
        body: JSON.stringify({
          tenant_id: tenant,
          actor_user_id: ctx.user.id,
          actor_person_id: ctx.person.id,
          action: "volunteer." + body.action,
          entity_type: type,
          entity_id: row.id,
          before_data: prior,
          after_data: row,
          reason,
          correlation_id: crypto.randomUUID(),
        }),
      });
    } catch {
      return NextResponse.json({
        ok: true,
        row,
        warning:
          "The change saved, but its audit entry failed. Contact Organization Admin; do not repeat the change.",
      });
    }
    return NextResponse.json({ ok: true, row });
  } catch (e) {
    return fail(e);
  }
}
