import { NextRequest, NextResponse } from "next/server";
import {
  resolveAccess,
  serviceHeaders,
  hasAdminContextPermission,
} from "@/lib/server/accessControl";
import { supabaseServerConfig } from "@/lib/server/superuserAuth";
import {
  TriageError,
  triageScope,
  taskInScope,
  taskPermission,
  mapTriageTask,
} from "@/lib/server/adminTriage";
import {
  triageRoles,
  triageSources,
  type TriageSource,
} from "@/lib/triage/types";
export const dynamic = "force-dynamic";
export const revalidate = 0;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function rest(path: string, body?: unknown) {
  const { url } = supabaseServerConfig();
  const headers = serviceHeaders();
  if (!url || !headers)
    throw new TriageError("Task service is unavailable.", 503);
  const r = await fetch(`${url}/rest/v1/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers,
    cache: "no-store",
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = await r.json();
  if (!r.ok) {
    const msg = String(result.message || "Task request failed.");
    if (result.code === "40001") throw new TriageError(msg, 409);
    if (msg.includes("ERR-901")) throw new TriageError(msg, 403);
    if (result.code === "P0001") throw new TriageError(msg, 409);
    console.error("admin-triage database error", result.code);
    throw new TriageError(
      "The task could not be saved or loaded. Refresh and try again.",
      503,
    );
  }
  return result;
}
const fail = (e: unknown) =>
  NextResponse.json(
    {
      error:
        e instanceof TriageError
          ? e.message
          : "Task service is unavailable. Try again.",
    },
    {
      status: e instanceof TriageError ? e.status : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
const reply = (data: unknown) =>
  NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
async function context(
  request: NextRequest,
  role: string,
  team: string | null,
) {
  if (team && !uuid.test(team)) throw new TriageError("Select a valid squad.");
  const ctx = await resolveAccess(request);
  if (!ctx) throw new TriageError("Sign in to view your tasks.", 401);
  const scope = triageScope(ctx, role, team);
  const orgFilter = `in.(${scope.orgs.join(",")})`;
  const [organizations, allTeams] = await Promise.all([
    rest(
      `organizations?select=id,name&id=${orgFilter}&tenant_id=eq.${scope.tenant}`,
    ),
    rest(
      `teams?select=id,name,organization_id&organization_id=${orgFilter}&order=name.asc`,
    ),
  ]);
  const teams = (
    allTeams as { id: string; name: string; organization_id: string }[]
  ).filter(
    (t) =>
      !scope.teamIds ||
      (role !== "team_manager" && !scope.teamIds.length) ||
      scope.teamIds.includes(t.id),
  );
  if (team && !teams.some((t) => t.id === team))
    throw new TriageError(
      "[DENY: ERR-901] This squad is outside your assignment.",
      403,
    );
  return { ctx, scope, teams, organizations };
}
export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams,
      role = q.get("role") || "org_admin";
    const { ctx, scope, teams, organizations } = await context(
      request,
      role,
      q.get("team") || null,
    );
    const id = q.get("id"),
      source = q.get("source") as TriageSource;
    if (id) {
      if (
        !uuid.test(id) ||
        !triageSources.includes(source) ||
        !taskPermission(ctx, role, source, false)
      )
        throw new TriageError("Task access denied.", 403);
      const rows = await rest(`${source}?select=*&id=eq.${id}&limit=1`);
      if (!rows[0] || !taskInScope(rows[0], scope))
        throw new TriageError(
          "[DENY: ERR-901] Task is outside your assignment.",
          403,
        );
      const history = await rest(
        `audit_events?select=id,action,occurred_at,reason&tenant_id=eq.${scope.tenant}&entity_type=eq.${source}&entity_id=eq.${id}&order=occurred_at.desc&limit=30`,
      );
      return reply({
        task: mapTriageTask(
          rows[0],
          source,
          taskPermission(ctx, role, source, true),
        ),
        history,
      });
    }
    const page = Math.max(1, Math.min(100000, Number(q.get("page")) || 1));
    const needsTeam =
      !scope.team && (role === "team_manager" || !!scope.teamIds?.length);
    const sources = needsTeam
      ? []
      : triageSources.filter((s) => taskPermission(ctx, role, s, false));
    const feed = await rest("rpc/admin_triage_feed", {
      p_tenant: scope.tenant,
      p_orgs: scope.orgs,
      p_role: role,
      p_team: scope.team,
      p_person: scope.person,
      p_executive: scope.executive,
      p_sources: sources,
      p_status: q.get("status") === "closed" ? "closed" : "open",
      p_search: (q.get("search") || "").slice(0, 200),
      p_page: Math.floor(page),
    });
    return reply({
      tasks: feed.rows.map(
        (r: { source: TriageSource; row: Record<string, unknown> }) =>
          mapTriageTask(
            r.row,
            r.source,
            taskPermission(ctx, role, r.source, true),
          ),
      ),
      total: feed.total,
      page: Math.floor(page),
      pageSize: 25,
      teams,
      organizations,
      needsTeam,
      canCreate:
        hasAdminContextPermission(ctx, role, "admin_tasks.create") &&
        !!scope.person,
      refreshedAt: new Date().toISOString(),
    });
  } catch (e) {
    return fail(e);
  }
}
export async function POST(request: NextRequest) {
  try {
    const b = await request.json();
    const { ctx, scope, teams } = await context(
      request,
      String(b.role || "org_admin"),
      b.team || null,
    );
    if (
      !scope.team &&
      (scope.role === "team_manager" || !!scope.teamIds?.length)
    )
      throw new TriageError("[DENY: ERR-901] Select your assigned squad.", 403);
    const source = b.source as TriageSource;
    if (!triageSources.includes(source))
      throw new TriageError("Unknown task source.");
    const creating = b.action === "create";
    if (
      creating
        ? !hasAdminContextPermission(ctx, scope.role, "admin_tasks.create")
        : !taskPermission(ctx, scope.role, source, true)
    )
      throw new TriageError(
        "You do not have permission to change this task.",
        403,
      );
    if (!scope.person)
      throw new TriageError(
        "Your account needs a person record before changing tasks.",
        403,
      );
    let create = null;
    if (creating) {
      const c = b.task || {},
        title = String(c.title || "").trim(),
        assignedRole = String(c.assigned_role || scope.role);
      if (
        source !== "operational_tasks" ||
        !title ||
        title.length > 200 ||
        !triageRoles.some((r) => r === assignedRole) ||
        !scope.orgs.includes(c.organization_id)
      )
        throw new TriageError("Enter a task title, club and valid role.");
      if (scope.role !== "org_admin" && assignedRole !== scope.role)
        throw new TriageError(
          "Only Organization Admin can assign work to another role.",
          403,
        );
      const team = c.team_id || null;
      if (
        team &&
        !teams.some(
          (t) => t.id === team && t.organization_id === c.organization_id,
        )
      )
        throw new TriageError(
          "[DENY: ERR-901] This squad is outside your club.",
          403,
        );
      if (assignedRole === "team_manager" && !team)
        throw new TriageError("Select a squad for Team Manager work.");
      if (scope.team && scope.team !== team)
        throw new TriageError(
          "[DENY: ERR-901] Task must stay in your selected squad.",
          403,
        );
      if (c.due_at && !Number.isFinite(Date.parse(c.due_at)))
        throw new TriageError("Enter a valid due date.");
      create = {
        title,
        description: String(c.description || "").slice(0, 4000),
        organization_id: c.organization_id,
        team_id: team,
        assigned_role: assignedRole,
        priority: ["critical", "normal", "low"].includes(c.priority)
          ? c.priority
          : "normal",
        due_at: c.due_at || null,
      };
    } else {
      if (
        !uuid.test(String(b.id)) ||
        !Number.isInteger(b.revision) ||
        !["complete", "reopen"].includes(b.action)
      )
        throw new TriageError("Reload the task before changing it.");
      const rows = await rest(`${source}?select=*&id=eq.${b.id}&limit=1`);
      if (!rows[0] || !taskInScope(rows[0], scope))
        throw new TriageError(
          "[DENY: ERR-901] Task is outside your assignment.",
          403,
        );
      if (
        source === "competition_exceptions" &&
        !["org_admin", "competition_manager"].includes(scope.role)
      )
        throw new TriageError(
          "Ask Organization Admin or the Competition Manager to confirm this issue is resolved.",
          403,
        );
    }
    const note = String(b.note || "").trim();
    if (note.length < 3 || note.length > 4000)
      throw new TriageError("Enter a note between 3 and 4000 characters.");
    const result = await rest("rpc/admin_triage_change", {
      p_source: source,
      p_id: creating ? null : b.id,
      p_revision: creating ? null : b.revision,
      p_action: b.action,
      p_note: note,
      p_tenant: scope.tenant,
      p_orgs: scope.orgs,
      p_role: scope.role,
      p_team: scope.team,
      p_actor_user: ctx.user.id,
      p_actor_person: scope.person,
      p_create: create,
    });
    return reply({ ok: true, ...result });
  } catch (e) {
    return fail(e);
  }
}
