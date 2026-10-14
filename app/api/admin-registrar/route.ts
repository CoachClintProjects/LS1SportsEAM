import { NextRequest, NextResponse } from "next/server";
import {
  resolveAccess,
  canUseAdminRoleContext,
  hasAdminContextPermission as can,
} from "@/lib/server/accessControl";
import {
  recordRest as rest,
  recordAccess,
} from "@/lib/server/adminRecordAccess";
import { PersonRecordError } from "@/lib/server/adminPersonRecord";
import { currentIdentityEvidence } from "@/lib/registrarPolicy";
export const dynamic = "force-dynamic";
type Row = Record<string, any>;
const unique = (values: string[]) => [...new Set(values.filter(Boolean))];
export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveAccess(request);
    if (!ctx) throw new PersonRecordError(401, "Sign in required.");
    if (
      !ctx.allowedHubs.includes("admin") ||
      !canUseAdminRoleContext(ctx, "registrar") ||
      !can(ctx, "registrar", "rosters.read") ||
      !can(ctx, "registrar", "record.read")
    )
      throw new PersonRecordError(403, "Registrar access denied.");
    const tenant = ctx.adminScope?.tenantId || ctx.person?.tenant_id;
    const orgs = ctx.adminScope
      ? [ctx.adminScope.organizationId]
      : unique(
          ctx.roles
            .map((r) => r.scope.organization_id)
            .filter((id): id is string => Boolean(id)),
        );
    if (!tenant || orgs.length !== 1)
      throw new PersonRecordError(403, "Select one authorized organization.");
    const person = request.nextUrl.searchParams.get("personId");
    if (person) {
      await recordAccess(request, "registrar", person);
      const history = await rest(
        `audit_events?select=id,action,reason,occurred_at,after_data&tenant_id=eq.${tenant}&entity_type=eq.person&entity_id=eq.${person}&action=eq.person.document_reviewed&order=occurred_at.desc&limit=100`,
      );
      return NextResponse.json({ history });
    }
    let truncated = false;
    async function rows(path: string): Promise<Row[]> {
      const result = await rest(`${path}&order=id.asc&limit=1000`);
      if (result.length >= 1000) truncated = true;
      return result;
    }
    async function related(
      path: string,
      key: string,
      ids: string[],
    ): Promise<Row[]> {
      const result: Row[] = [];
      for (let i = 0; i < ids.length; i += 100)
        result.push(
          ...(await rows(
            `${path}&${key}=in.(${ids.slice(i, i + 100).join(",")})`,
          )),
        );
      return result;
    }
    const org = orgs[0];
    const [teams, registrations, memberships, exceptions, assignments] =
      await Promise.all([
        rows(`teams?select=id,name,status&organization_id=eq.${org}`),
        rows(
          `registrations?select=id,athlete_id,status,submitted_at&organization_id=eq.${org}`,
        ),
        rows(
          `memberships?select=id,person_id,membership_number,membership_type,governing_body_id,status,starts_on,ends_on&organization_id=eq.${org}`,
        ),
        rows(
          `membership_exceptions?select=id,membership_id,exception_type,reason_category,status,requested_start_on,requested_end_on&organization_id=eq.${org}`,
        ),
        rows(
          `role_assignments?select=id,person_id,status&tenant_id=eq.${tenant}&organization_id=eq.${org}&status=eq.active`,
        ),
      ]);
    const teamMemberships = await related(
      "team_memberships?select=id,team_id,athlete_id,status,starts_on,ends_on",
      "team_id",
      teams.map((t) => t.id),
    );
    const athleteIds = unique([
      ...registrations.map((r) => r.athlete_id),
      ...teamMemberships.map((r) => r.athlete_id),
    ]);
    const athletes = await related(
      "athletes?select=id,person_id,athlete_number,athlete_status",
      "id",
      athleteIds,
    );
    const personIds = unique([
      ...athletes.map((a) => a.person_id),
      ...assignments.map((a) => a.person_id),
    ]);
    const [people, documents, backgroundChecks, safeSport, governingBodies] =
      await Promise.all([
        related(
          `people?select=id,first_name,last_name,preferred_name,birth_date&tenant_id=eq.${tenant}`,
          "id",
          personIds,
        ),
        related(
          `documents?select=id,owner_person_id,title,verification_status,current_version,expires_at,document_types!inner(code)&tenant_id=eq.${tenant}&document_types.code=eq.IDENTITY`,
          "owner_person_id",
          personIds,
        ),
        can(ctx, "registrar", "waivers.read")
          ? related(
              "background_checks?select=id,person_id,check_type,status,expires_on",
              "person_id",
              personIds,
            )
          : [],
        can(ctx, "registrar", "waivers.read")
          ? related(
              "safesport_records?select=id,person_id,certification_type,status,expires_on",
              "person_id",
              personIds,
            )
          : [],
        rows("governing_bodies?select=id,code,name"),
      ]);
    const today = new Date().toISOString().slice(0, 10);
    return NextResponse.json({
      people,
      athletes,
      documents,
      registrations,
      memberships: memberships.filter((m) => personIds.includes(m.person_id)),
      exceptions: exceptions.filter((e) =>
        memberships.some(
          (m) => m.id === e.membership_id && personIds.includes(m.person_id),
        ),
      ),
      teams: teams.map((t) => ({
        ...t,
        headcount: new Set(
          teamMemberships
            .filter(
              (m) =>
                m.team_id === t.id &&
                m.status === "active" &&
                (!m.starts_on || m.starts_on <= today) &&
                (!m.ends_on || m.ends_on >= today),
            )
            .map((m) => m.athlete_id),
        ).size,
      })),
      teamMemberships,
      governingBodies,
      backgroundChecks,
      safeSport,
      identityNeedsReview: athletes
        .filter(
          (a) =>
            !documents.some(
              (d) =>
                d.owner_person_id === a.person_id &&
                currentIdentityEvidence(
                  d as { verification_status: string; expires_at?: string },
                ),
            ),
        )
        .map((a) => a.person_id),
      truncated,
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error ? e.message : "Registrar records unavailable.",
      },
      { status: e instanceof PersonRecordError ? e.status : 500 },
    );
  }
}
