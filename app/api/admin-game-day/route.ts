import { NextRequest, NextResponse } from "next/server";
import {
  resolveAccess,
  canUseAdminRoleContext,
  hasAdminContextPermission as can,
} from "@/lib/server/accessControl";
import { recordRest as rest } from "@/lib/server/adminRecordAccess";
import { PersonRecordError } from "@/lib/server/adminPersonRecord";
import { overlaps, staffingCoverage } from "@/lib/competitionPolicy";
export const dynamic = "force-dynamic";
type Row = Record<string, any>;
async function all(path: string): Promise<Row[]> {
  const result: Row[] = [];
  for (let offset = 0; offset < 10000; offset += 500) {
    const page = await rest(`${path}&order=id.asc&limit=500&offset=${offset}`);
    result.push(...page);
    if (page.length < 500) return result;
  }
  throw new PersonRecordError(
    409,
    "Too many competition records to show a complete view. Narrow the scope.",
  );
}
async function related(
  path: string,
  key: string,
  ids: string[],
): Promise<Row[]> {
  const result: Row[] = [];
  for (let i = 0; i < ids.length; i += 100)
    result.push(
      ...(await all(`${path}&${key}=in.(${ids.slice(i, i + 100).join(",")})`)),
    );
  return result;
}
const unique = (ids: string[]) => [...new Set(ids.filter(Boolean))];
export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveAccess(request);
    if (!ctx) throw new PersonRecordError(401, "Sign in required.");
    if (
      !ctx.allowedHubs.includes("admin") ||
      !canUseAdminRoleContext(ctx, "competition_manager") ||
      !can(ctx, "competition_manager", "record.read")
    )
      throw new PersonRecordError(403, "Competition access denied.");
    const tenant = ctx.adminScope?.tenantId || ctx.person?.tenant_id,
      orgs = ctx.adminScope
        ? [ctx.adminScope.organizationId]
        : unique(
            ctx.roles
              .filter((r) =>
                ["COMPETITION_MANAGER", "ORGANIZATION_ADMIN"].includes(r.code),
              )
              .map((r) => r.scope.organization_id)
              .filter((x): x is string => Boolean(x)),
          );
    if (!tenant || orgs.length !== 1)
      throw new PersonRecordError(403, "Select one authorized club.");
    const org = orgs[0],
      id = request.nextUrl.searchParams.get("id");
    const [competitions, sites, organizations, teams] = await Promise.all([
      all(
        `competitions?select=*&tenant_id=eq.${tenant}&organization_id=eq.${org}`,
      ),
      all(`sites?select=id,name,organization_id&organization_id=eq.${org}`),
      all(`organizations?select=id,name&tenant_id=eq.${tenant}&id=eq.${org}`),
      all(`teams?select=id,name,organization_id&organization_id=eq.${org}`),
    ]);
    if (id && !competitions.some((c) => c.id === id))
      throw new PersonRecordError(404, "Competition outside your club.");
    const ids = id ? [id] : competitions.map((c) => c.id);
    const facilities = await related(
      "facilities?select=id,name,site_id,status",
      "site_id",
      sites.map((s) => s.id),
    );
    const [
      sessions,
      events,
      deadlines,
      officials,
      requirements,
      cases,
      seedingRuns,
      exceptions,
      closures,
      batches,
    ] = await Promise.all([
      related("competition_sessions?select=*", "competition_id", ids),
      related("competition_events?select=*", "competition_id", ids),
      related("competition_deadlines?select=*", "competition_id", ids),
      related(
        "competition_official_assignments?select=id,competition_id,session_id,requirement_id,person_id,role_code,status,check_in_at,check_out_at,assigned_at",
        "competition_id",
        ids,
      ),
      related(
        "competition_official_requirements?select=id,competition_id,session_id,role_code,required_count,active",
        "competition_id",
        ids,
      ),
      related(
        "competition_judicial_cases?select=id,competition_id,case_type,status,summary,rule_reference,filed_at,decided_at,decision",
        "competition_id",
        ids,
      ),
      related("competition_seeding_runs?select=*", "competition_id", ids),
      related(
        `competition_exceptions?select=id,competition_id,exception_code,severity,status,problem,recommended_action,created_at&tenant_id=eq.${tenant}&organization_id=eq.${org}`,
        "competition_id",
        ids,
      ),
      related(
        "facility_closures?select=*",
        "facility_id",
        facilities.map((f) => f.id),
      ),
      related(
        `competition_entry_batches?select=id,competition_id,batch_code,status,locked_at&tenant_id=eq.${tenant}&organization_id=eq.${org}`,
        "competition_id",
        ids,
      ),
    ]);
    const entries = await related(
      "competition_entries?select=*",
      "competition_event_id",
      events.map((e) => e.id),
    );
    const [results, seedingAssignments, timingSessions, bookings] =
      await Promise.all([
        related(
          "competition_results?select=*",
          "competition_entry_id",
          entries.map((e) => e.id),
        ),
        related(
          "competition_seeding_assignments?select=*",
          "seeding_run_id",
          seedingRuns.map((r) => r.id),
        ),
        related(
          "competition_timing_sessions?select=id,competition_id,session_id,status,opened_at,closed_at",
          "competition_id",
          ids,
        ),
        related(
          "facility_bookings?select=id,facility_id,resource_id,team_id,event_id,starts_at,ends_at,status",
          "facility_id",
          facilities.map((f) => f.id),
        ),
      ]);
    const roster = await related(
      "team_memberships?select=id,athlete_id&status=eq.active",
      "team_id",
      teams.map((t) => t.id),
    );
    const athletes = await related(
      `athletes?select=id,athlete_number,person_id,people!inner(id,first_name,last_name,preferred_name,tenant_id)&people.tenant_id=eq.${tenant}`,
      "id",
      unique([
        ...entries.map((e) => e.athlete_id),
        ...roster.map((r) => r.athlete_id),
      ]),
    );
    const [people, timingMessages, versions] = await Promise.all([
      related(
        `people?select=id,first_name,last_name,preferred_name&tenant_id=eq.${tenant}`,
        "id",
        unique(officials.map((o) => o.person_id)),
      ),
      id
        ? related(
            "competition_timing_messages?select=id,timing_session_id,event_id,heat_no,lane_no,message_type,validation_status,received_at,processed_at",
            "timing_session_id",
            timingSessions.map((t) => t.id),
          )
        : [],
      id
        ? related(
            "competition_result_versions?select=id,competition_result_id,version_no,change_reason,source_system,changed_at,canonical",
            "competition_result_id",
            results.map((r) => r.id),
          )
        : [],
    ]);
    const overview = competitions
      .filter((c) => !id || c.id === id)
      .map((c) => {
        const activeClosures = closures.filter(
          (x) =>
            x.facility_id === c.venue_facility_id &&
            !["cancelled", "resolved", "completed", "inactive"].includes(
              x.status,
            ) &&
            overlaps(c.starts_at, c.ends_at, x.starts_at, x.ends_at),
        );
        const staffing = staffingCoverage(
          requirements.filter((r) => r.competition_id === c.id) as any,
          officials.filter((o) => o.competition_id === c.id) as any,
        );
        return { ...c, closureRisks: activeClosures, staffing };
      });
    const audit = id
      ? await rest(
          `audit_events?select=id,action,reason,occurred_at&tenant_id=eq.${tenant}&entity_type=eq.competition&entity_id=eq.${id}&order=occurred_at.desc&limit=100`,
        )
      : [];
    return NextResponse.json({
      canAuthorizeCashbox:
        can(ctx, "competition_manager", "workflow.execute") &&
        can(ctx, "competition_manager", "record.update"),
      competitions: overview,
      sessions,
      events,
      deadlines,
      officials,
      requirements,
      cases,
      seedingRuns,
      seedingAssignments,
      entries,
      athletes,
      people,
      results,
      versions,
      exceptions,
      closures,
      bookings,
      batches,
      timingSessions,
      timingMessages,
      facilities,
      sites,
      organizations,
      teams,
      audit,
      generatedAt: new Date().toISOString(),
      controls: {
        competitions,
        competitionEvents: events,
        competitionEntries: entries,
        deadlines,
        organizations,
        teams,
      },
      enterprise: { facilities, sites },
      orgAdmin: { audit },
    });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error ? e.message : "Competition records unavailable.",
      },
      { status: e instanceof PersonRecordError ? e.status : 500 },
    );
  }
}
