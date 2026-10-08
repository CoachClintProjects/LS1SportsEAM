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
    if (q.get("mode") === "cashbox_options") {
      if (
        !["org_admin", "competition_manager"].includes(role) ||
        !hasAdminContextPermission(ctx, role, "workflow.execute") ||
        scope.teamIds?.length
      )
        throw new TriageError(
          "Club-wide competition authorization required.",
          403,
        );
      const competitions = await rest(
        `competitions?select=id,name,organization_id&tenant_id=eq.${scope.tenant}&organization_id=in.(${scope.orgs.join(",")})&status=not.in.(cancelled,completed)&order=starts_at.desc&limit=100`,
      );
      const entities = await rest(
        `legal_entities?select=id,legal_name,organization_id,base_currency&organization_id=in.(${scope.orgs.join(",")})`,
      );
      const competition = q.get("competition");
      if (
        competition &&
        !competitions.some((c: { id: string }) => c.id === competition)
      )
        throw new TriageError("Competition outside your assignment.", 403);
      const officials = competition
        ? await rest(
            `competition_official_assignments?select=id,role_code,status,people(first_name,last_name)&competition_id=eq.${competition}&status=not.in.(cancelled,declined)&person_id=not.is.null&order=role_code.asc&limit=250`,
          )
        : [];
      return reply({ competitions, entities, officials });
    }
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
      if (q.get("domain") === "1") {
        const metadata = rows[0].metadata || {};
        if (
          source !== "operational_tasks" ||
          !uuid.test(metadata.entity_id || "")
        )
          throw new TriageError("This task has no linked resolution record.");
        if (metadata.kind === "waiver") {
          const assignments = await rest(
            `waiver_assignments?select=id,waiver_id&tenant_id=eq.${scope.tenant}&organization_id=eq.${rows[0].organization_id}&id=eq.${metadata.evidence.waiver_assignment_id}`,
          );
          if (!assignments.length)
            throw new TriageError(
              "Waiver assignment is no longer available.",
              404,
            );
          const policies = await rest(
            `triage_consent_policies?select=enabled,team_manager_allowed,policy_reference,version&waiver_id=eq.${assignments[0].waiver_id}&tenant_id=eq.${scope.tenant}&organization_id=eq.${rows[0].organization_id}`,
          );
          const documents = await rest(
            `documents?select=id,title,verification_status,document_types!inner(code)&tenant_id=eq.${scope.tenant}&owner_person_id=eq.${metadata.entity_id}&document_types.code=eq.WAIVER&verification_status=eq.verified&or=(expires_at.is.null,expires_at.gt.${encodeURIComponent(new Date().toISOString())})&limit=100`,
          );
          return reply({ policy: policies[0] || null, documents });
        }
        if (metadata.kind === "lease") {
          if (!hasAdminContextPermission(ctx, role, "record.read"))
            throw new TriageError("Contract review denied.", 403);
          const contracts = await rest(
            `contracts?select=*&id=eq.${metadata.entity_id}&tenant_id=eq.${scope.tenant}&organization_id=in.(${scope.orgs.join(",")})`,
          );
          if (!contracts.length)
            throw new TriageError("Contract is no longer available.", 404);
          const versions = await rest(
            `contract_versions?select=id,version_no,terms,created_at&contract_id=eq.${metadata.entity_id}&order=version_no.desc&limit=5`,
          );
          return reply({ contract: contracts[0], versions });
        }
        if (metadata.kind === "fee_voucher") {
          if (
            !hasAdminContextPermission(ctx, role, "record.read") ||
            !["org_admin", "treasurer"].includes(role)
          )
            throw new TriageError("Voucher review denied.", 403);
          const vouchers = await rest(
            `triage_fee_vouchers?select=*&id=eq.${metadata.entity_id}&tenant_id=eq.${scope.tenant}&organization_id=eq.${rows[0].organization_id}`,
          );
          if (!vouchers.length)
            throw new TriageError("Voucher is no longer available.", 404);
          const entities = await rest(
            `legal_entities?select=id&organization_id=eq.${rows[0].organization_id}`,
          );
          const ids = entities.map((e: { id: string }) => e.id);
          const voucher = vouchers[0];
          const bills = ids.length
            ? await rest(
                `vendor_bills?select=id,bill_number,total,currency,status&legal_entity_id=in.(${ids.join(",")})&total=eq.${Number(voucher.snapshot.amount)}&currency=eq.${encodeURIComponent(voucher.snapshot.currency)}&status=neq.cancelled&order=bill_date.desc&limit=100`,
              )
            : [];
          return reply({ voucher, bills });
        }
        throw new TriageError("Use the linked record controls for this task.");
      }
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
    if (b.action === "sync") {
      if (!taskPermission(ctx, scope.role, "operational_tasks", false))
        throw new TriageError("Task access denied.", 403);
      return reply(
        await rest("rpc/admin_triage_sync", {
          p_tenant: scope.tenant,
          p_orgs: scope.orgs,
        }),
      );
    }
    if (
      !scope.team &&
      (scope.role === "team_manager" || !!scope.teamIds?.length)
    )
      throw new TriageError("[DENY: ERR-901] Select your assigned squad.", 403);
    if (
      [
        "authorize_cashbox",
        "prepare_cashbox",
        "cancel_cashbox",
        "set_consent_policy",
        "consent_override",
      ].includes(b.action)
    ) {
      if (
        !scope.person ||
        !hasAdminContextPermission(ctx, scope.role, "workflow.execute") ||
        !hasAdminContextPermission(ctx, scope.role, "record.update")
      )
        throw new TriageError(
          "Your role lacks authorization for this decision.",
          403,
        );
      if (b.action === "authorize_cashbox") {
        if (
          !["org_admin", "competition_manager"].includes(scope.role) ||
          scope.teamIds?.length
        )
          throw new TriageError(
            "Club-wide competition authorization required.",
            403,
          );
      } else {
        if (!uuid.test(b.id || "") || !Number.isInteger(b.revision))
          throw new TriageError("Reload the task before deciding.");
        const tasks = await rest(`operational_tasks?select=*&id=eq.${b.id}`);
        if (!tasks[0] || !taskInScope(tasks[0], scope))
          throw new TriageError(
            "[DENY: ERR-901] Task is outside your assignment.",
            403,
          );
        if (b.action === "set_consent_policy" && scope.role !== "org_admin")
          throw new TriageError(
            "Organization Admin must configure club policy.",
            403,
          );
        if (
          b.action === "consent_override" &&
          !hasAdminContextPermission(ctx, scope.role, "waivers.update")
        )
          throw new TriageError("Waiver exception authority required.", 403);
      }
      const result = await rest("rpc/admin_triage_authority_action", {
        p_task: b.id || null,
        p_revision: b.revision ?? null,
        p_tenant: scope.tenant,
        p_orgs: scope.orgs,
        p_role: scope.role,
        p_team: scope.team,
        p_actor_user: ctx.user.id,
        p_actor_person: scope.person,
        p_action: b.action,
        p_values: b.values || {},
        p_reason: String(b.note || "").trim(),
      });
      return reply(result);
    }
    if (
      [
        "lease_terms",
        "remind",
        "broadcast",
        "verify_fees",
        "link_bill",
        "return_voucher",
      ].includes(b.action)
    ) {
      if (!uuid.test(b.id || "") || !Number.isInteger(b.revision))
        throw new TriageError("Reload the task before changing it.");
      const rows = await rest(
        `operational_tasks?select=*&id=eq.${b.id}&limit=1`,
      );
      if (
        !rows[0] ||
        !taskInScope(rows[0], scope) ||
        !taskPermission(ctx, scope.role, "operational_tasks", false)
      )
        throw new TriageError(
          "[DENY: ERR-901] Task is outside your assignment.",
          403,
        );
      const permission = ["remind", "broadcast"].includes(b.action)
        ? "communications.send"
        : "record.update";
      if (!hasAdminContextPermission(ctx, scope.role, permission))
        throw new TriageError("Your role cannot perform this action.", 403);
      if (b.action === "broadcast" && scope.role !== "org_admin")
        throw new TriageError(
          "Organization Admin must authorize a club broadcast.",
          403,
        );
      if (
        ["link_bill", "return_voucher"].includes(b.action) &&
        (!["org_admin", "treasurer"].includes(scope.role) ||
          (b.action === "link_bill" && !uuid.test(b.values?.bill_id || "")))
      )
        throw new TriageError(
          "Select a bill using the authorized Treasurer view.",
          403,
        );
      if (!scope.person)
        throw new TriageError("A linked person record is required.", 403);
      const result = await rest("rpc/admin_triage_domain_action", {
        p_task: b.id,
        p_revision: b.revision,
        p_tenant: scope.tenant,
        p_orgs: scope.orgs,
        p_role: scope.role,
        p_team: scope.team,
        p_actor_user: ctx.user.id,
        p_actor_person: scope.person,
        p_action: b.action,
        p_values: b.values || {},
        p_reason: String(b.note || "").trim(),
      });
      try {
        await rest("rpc/admin_triage_sync", {
          p_tenant: scope.tenant,
          p_orgs: scope.orgs,
        });
      } catch {
        return reply({
          ...result,
          message: `${result.message} Refresh the task queue to reconcile its status.`,
        });
      }
      return reply(result);
    }
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
        rows[0].origin_key ||
        ["fee_voucher", "cashbox"].includes(rows[0].metadata?.kind)
      )
        throw new TriageError(
          "Resolve the linked record using this task’s controls. The queue closes it when its condition is cleared.",
          409,
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
