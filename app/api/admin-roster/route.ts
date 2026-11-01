import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { rosterAccess } from "@/lib/server/rosterAccess";
import { recordRest as rest } from "@/lib/server/adminRecordAccess";
import { hasAdminContextPermission as can } from "@/lib/server/accessControl";
import { PersonRecordError } from "@/lib/server/adminPersonRecord";
export const dynamic = "force-dynamic";
const ids = (xs: string[]) => `in.(${xs.join(",")})`;
const fail = (e: unknown) =>
  NextResponse.json(
    { error: e instanceof Error ? e.message : "Roster unavailable." },
    { status: e instanceof PersonRecordError ? e.status : 500 },
  );
async function all(path: string) {
  const rows: any[] = [];
  for (let offset = 0; offset < 50000; offset += 1000) {
    const batch = await rest(`${path}&limit=1000&offset=${offset}`);
    rows.push(...batch);
    if (batch.length < 1000) return rows;
  }
  throw new PersonRecordError(
    413,
    "Roster exceeds the supported size. Narrow the club scope.",
  );
}
export async function GET(req: NextRequest) {
  try {
    const role = req.nextUrl.searchParams.get("role") || "org_admin";
    const { ctx, tenant, orgs, teamIds } = await rosterAccess(req, role);
    const financeOnly = role === "treasurer";
    const [organizations, allTeams] = await Promise.all([
      rest(
        `organizations?select=id,name,code,status&tenant_id=eq.${tenant}&id=${ids(orgs)}`,
      ),
      all(
        `teams?select=id,name,code,organization_id,status&organization_id=${ids(orgs)}&order=id`,
      ),
    ]);
    const teams = allTeams.filter(
      (t: any) => teamIds === null || teamIds.includes(t.id),
    );
    const today = new Date().toISOString().slice(0, 10);
    const memberships = teams.length
      ? await all(
          `team_memberships?select=id,athlete_id,team_id,status,starts_on,ends_on,membership_type&team_id=${ids(teams.map((t: any) => t.id))}${role === "team_manager" ? `&status=eq.active&and=(or(starts_on.is.null,starts_on.lte.${today}),or(ends_on.is.null,ends_on.gte.${today}))` : ""}&order=id`,
        )
      : [];
    const registrations =
      teamIds === null && !financeOnly && role !== "team_manager"
        ? await all(
            `registrations?select=id,athlete_id,program_id,season_id,status&organization_id=${ids(orgs)}&order=id`,
          )
        : [];
    const athleteIds = [
      ...new Set<string>(
        [...memberships, ...registrations]
          .map((m: any) => m.athlete_id)
          .filter(Boolean),
      ),
    ];
    // Chunk identifiers to keep PostgREST URLs within normal limits.
    const chunks = async (
      values: string[],
      query: (part: string[]) => string,
    ) => {
      const out: any[] = [];
      for (let i = 0; i < values.length; i += 100)
        out.push(...(await all(query(values.slice(i, i + 100)))));
      return out;
    };
    const athletes = await chunks(
      athleteIds,
      (x) =>
        `athletes?select=id,person_id,athlete_number,athlete_status,status,primary_family_id,privacy_level&id=${ids(x)}&order=id`,
    );
    const people = await chunks(
      athletes.map((a) => a.person_id),
      (x) =>
        `people?select=id,first_name,last_name,preferred_name${financeOnly ? "" : ",birth_date,email,phone"}&tenant_id=eq.${tenant}&id=${ids(x)}&order=id`,
    );
    const families = financeOnly
      ? []
      : [
          ...new Set<string>(
            athletes.map((a) => a.primary_family_id).filter(Boolean),
          ),
        ];
    const familyMembers = await chunks(
      families,
      (x) =>
        `family_members?select=family_id,person_id,relationship_type,is_primary_guardian&family_id=${ids(x)}&order=family_id,person_id`,
    );
    const guardians = familyMembers.filter(
      (g) =>
        g.is_primary_guardian ||
        /parent|guardian|mother|father/i.test(g.relationship_type || ""),
    );
    const guardianPeople = await chunks(
      [...new Set<string>(guardians.map((g) => g.person_id))],
      (x) =>
        `people?select=id,first_name,last_name,email,phone&tenant_id=eq.${tenant}&id=${ids(x)}&order=id`,
    );
    return NextResponse.json({
      viewerId: ctx.user.id,
      registrar: {
        athletes: athletes.map((a) => ({
          ...a,
          person: people.find((p) => p.id === a.person_id),
          guardians: guardians
            .filter(
              (g) =>
                g.family_id === a.primary_family_id &&
                g.person_id !== a.person_id,
            )
            .map((g) => guardianPeople.find((p) => p.id === g.person_id))
            .filter(Boolean),
        })),
        teamMemberships: memberships,
        registrations,
        memberships: [],
      },
      controls: { organizations, teams, programs: [], seasons: [] },
      authorization: {
        financeOnly,
        onboard:
          ["org_admin", "registrar"].includes(role) &&
          can(ctx, role, "record.create") &&
          can(ctx, role, "rosters.update") &&
          !!ctx.person?.id,
        import:
          ["org_admin", "registrar"].includes(role) &&
          can(ctx, role, "record.create") &&
          can(ctx, role, "rosters.update") &&
          !!ctx.person?.id,
      },
    });
  } catch (e) {
    return fail(e);
  }
}
export async function POST(req: NextRequest) {
  try {
    if (Number(req.headers.get("content-length") || 0) > 5_000_000)
      throw new PersonRecordError(
        413,
        "CSV is too large. Use at most 1,000 rows.",
      );
    const b = await req.json(),
      role = String(b.role || "org_admin");
    const { ctx, tenant, orgs } = await rosterAccess(req, role);
    if (
      !["org_admin", "registrar"].includes(role) ||
      !can(ctx, role, "record.create") ||
      !can(ctx, role, "rosters.update") ||
      !ctx.person?.id
    )
      throw new PersonRecordError(
        403,
        "Roster import requires athlete creation and roster editing permission.",
      );
    if (
      !orgs.includes(b.organizationId) ||
      !Array.isArray(b.rows) ||
      !b.rows.length ||
      b.rows.length > 1000 ||
      !["preview", "commit"].includes(b.action)
    )
      throw new PersonRecordError(
        400,
        "Choose your club and supply 1–1,000 mapped rows.",
      );
    const digest = createHash("sha256")
      .update(JSON.stringify([tenant, b.organizationId, b.rows]))
      .digest("hex");
    const result = await rest("rpc/admin_import_roster", {
      method: "POST",
      body: JSON.stringify({
        p_tenant: tenant,
        p_org: b.organizationId,
        p_actor_user: ctx.user.id,
        p_actor_person: ctx.person.id,
        p_source: String(b.sourceFile || "roster.csv").slice(0, 200),
        p_key: `roster:${b.organizationId}:${digest}`,
        p_rows: b.rows,
        p_commit: b.action === "commit",
      }),
    });
    return NextResponse.json(result);
  } catch (e) {
    return fail(e);
  }
}
