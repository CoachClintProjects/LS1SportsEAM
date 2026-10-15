import { NextRequest, NextResponse } from "next/server";
import {
  resolveAccess,
  canUseAdminRoleContext,
  hasAdminContextPermission as can,
} from "@/lib/server/accessControl";
import { recordRest as rest } from "@/lib/server/adminRecordAccess";
import { PersonRecordError } from "@/lib/server/adminPersonRecord";
import {
  bulletinInput,
  recipientIds,
  communicationsBoundary,
} from "@/lib/communicationsPolicy";
export const dynamic = "force-dynamic";
type Row = Record<string, any>;
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
async function scope(req: NextRequest, permission = "communications.read") {
  const ctx = await resolveAccess(req);
  if (!ctx) throw new PersonRecordError(401, "Sign in required.");
  if (
    !ctx.allowedHubs.includes("admin") ||
    !canUseAdminRoleContext(ctx, "communications_media") ||
    !can(ctx, "communications_media", permission)
  )
    throw new PersonRecordError(403, communicationsBoundary);
  const tenant = ctx.adminScope?.tenantId || ctx.person?.tenant_id,
    orgs = ctx.adminScope
      ? [ctx.adminScope.organizationId]
      : [
          ...new Set(
            ctx.roles
              .filter((r) =>
                [
                  "COMMUNICATIONS_MEDIA",
                  "COMMUNICATIONS",
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
async function all(path: string): Promise<Row[]> {
  const rows: Row[] = [];
  for (let offset = 0; offset < 10000; offset += 500) {
    const page = await rest(`${path}&order=id.asc&limit=500&offset=${offset}`);
    rows.push(...page);
    if (page.length < 500) return rows;
  }
  throw new PersonRecordError(
    409,
    "Too many communications records for a complete view. Narrow the club scope.",
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
async function audiences(tenant: string, org: string) {
  const [teams, opportunities] = await Promise.all([
    all(`teams?select=id,name&organization_id=eq.${org}`),
    all(`volunteer_opportunities?select=id&organization_id=eq.${org}`),
  ]);
  const [members, staff, volunteers] = await Promise.all([
    related(
      "team_memberships?select=id,team_id,athlete_id&status=eq.active",
      "team_id",
      teams.map((t) => t.id),
    ),
    related(
      "staff_assignments?select=id,person_id,team_id,role_code,starts_on,ends_on&status=eq.active&role_code=eq.HEAD_COACH",
      "team_id",
      teams.map((t) => t.id),
    ),
    related(
      "volunteer_assignments?select=id,volunteer_person_id&status=in.(assigned,checked_in)",
      "opportunity_id",
      opportunities.map((o) => o.id),
    ),
  ]);
  const links = await related(
    `communication_guardian_links?select=id,athlete_id,guardian_person_id,valid_from,valid_until&tenant_id=eq.${tenant}&status=eq.active`,
    "athlete_id",
    members.map((m) => m.athlete_id),
  );
  const now = Date.now(),
    today = new Date().toISOString().slice(0, 10);
  const valid = links.filter(
    (l) =>
      (!l.valid_from || Date.parse(l.valid_from) <= now) &&
      (!l.valid_until || Date.parse(l.valid_until) > now),
  );
  const groups = {
    parents: [...new Set<string>(valid.map((l) => l.guardian_person_id))],
    coaches: [
      ...new Set<string>(
        staff
          .filter(
            (s) =>
              (!s.starts_on || s.starts_on <= today) &&
              (!s.ends_on || s.ends_on >= today),
          )
          .map((s) => s.person_id),
      ),
    ],
    volunteers: [
      ...new Set<string>(volunteers.map((v) => v.volunteer_person_id)),
    ],
    squads: Object.fromEntries(
      teams.map((t) => {
        const athletes = new Set(
          members.filter((m) => m.team_id === t.id).map((m) => m.athlete_id),
        );
        return [
          t.id,
          [
            ...new Set(
              valid
                .filter((l) => athletes.has(l.athlete_id))
                .map((l) => l.guardian_person_id),
            ),
          ],
        ];
      }),
    ) as Record<string, string[]>,
  };
  const people = await related(
    `people?select=id,first_name,last_name,preferred_name&tenant_id=eq.${tenant}&status=eq.active`,
    "id",
    [...groups.parents, ...groups.coaches, ...groups.volunteers],
  );
  const safe = new Set(people.map((p) => p.id));
  groups.parents = groups.parents.filter((id) => safe.has(id));
  groups.coaches = groups.coaches.filter((id) => safe.has(id));
  groups.volunteers = groups.volunteers.filter((id) => safe.has(id));
  for (const id of Object.keys(groups.squads))
    groups.squads[id] = groups.squads[id].filter((p) => safe.has(p));
  return { teams, groups, people };
}
const fail = (e: unknown) =>
  NextResponse.json(
    {
      error: e instanceof Error ? e.message : "Communications request failed.",
    },
    { status: e instanceof PersonRecordError ? e.status : 500 },
  );
export async function GET(req: NextRequest) {
  try {
    const { ctx, tenant, org } = await scope(req);
    const [audience, threads, channels, sites] = await Promise.all([
      audiences(tenant, org),
      all(
        `communication_threads?select=id&tenant_id=eq.${tenant}&organization_id=eq.${org}&thread_type=eq.admin_bulletin`,
      ),
      all(
        `communication_channels?select=id,code,name,channel_type,provider,status&tenant_id=eq.${tenant}`,
      ),
      all(`sites?select=id&organization_id=eq.${org}`),
    ]);
    const facilities = await related(
      "facilities?select=id,name",
      "site_id",
      sites.map((s) => s.id),
    );
    const [messages, closures] = await Promise.all([
      related(
        "communication_messages?select=id,body,delivery_status,metadata,sent_at&metadata->>workspace=eq.club_announcer",
        "thread_id",
        threads.map((t) => t.id),
      ),
      related(
        "facility_closures?select=id,facility_id,starts_at,ends_at,reason,status",
        "facility_id",
        facilities.map((f) => f.id),
      ),
    ]);
    const activeClosures = closures.filter(
      (c) =>
        !["cancelled", "resolved", "completed", "inactive"].includes(
          c.status,
        ) &&
        (!c.ends_at || Date.parse(c.ends_at) > Date.now()),
    );
    const [recipients, events] = await Promise.all([
      related(
        "communication_message_recipients?select=id,message_id,recipient_person_id,delivery_status,delivered_at,read_at,failure_code",
        "message_id",
        messages.map((m) => m.id),
      ),
      related(
        "communication_delivery_events?select=id,message_id,event_type,occurred_at,error_code",
        "message_id",
        messages.map((m) => m.id),
      ),
    ]);
    const id = req.nextUrl.searchParams.get("id");
    if (id && !messages.some((m) => m.id === id))
      throw new PersonRecordError(404, "Bulletin not found in your club.");
    const history = id
      ? await all(
          `audit_events?select=id,action,reason,occurred_at&tenant_id=eq.${tenant}&entity_type=eq.communication_message&entity_id=eq.${id}`,
        )
      : [];
    return NextResponse.json({
      ...audience,
      messages,
      channels,
      closures: activeClosures,
      facilities,
      recipients,
      events,
      history,
      canWrite: can(ctx, "communications_media", "communications.send"),
      externalDeliveryAvailable: false,
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    return fail(e);
  }
}
export async function POST(req: NextRequest) {
  try {
    const { ctx, tenant, org } = await scope(req, "communications.send"),
      b = await req.json();
    if (!ctx.person?.id)
      throw new PersonRecordError(403, "A linked club person is required.");
    if (!["save", "format", "stage"].includes(b.action))
      throw new PersonRecordError(
        403,
        "External dispatch and retry are unavailable. " +
          communicationsBoundary,
      );
    if (!uuid.test(b.id || ""))
      throw new PersonRecordError(400, "Valid bulletin ID required.");
    const reason = String(b.reason || "").trim();
    if (reason.length < 10 || reason.length > 2000)
      throw new PersonRecordError(
        400,
        "Record a reason of 10–2000 characters.",
      );
    const audience = await audiences(tenant, org);
    let input;
    try {
      input = bulletinInput(
        b,
        audience.teams.map((t) => t.id),
      );
    } catch (e) {
      throw new PersonRecordError(
        400,
        e instanceof Error ? e.message : "Invalid bulletin.",
      );
    }
    const recipients = recipientIds(input.segments, audience.groups);
    if (b.action === "stage" && !recipients.length)
      throw new PersonRecordError(
        409,
        "Selected groups contain no eligible club recipients.",
      );
    const threads = await rest(`communication_threads?select=*&id=eq.${b.id}`);
    if (
      threads.length &&
      (threads[0].tenant_id !== tenant ||
        threads[0].organization_id !== org ||
        threads[0].thread_type !== "admin_bulletin")
    )
      throw new PersonRecordError(404, "Bulletin not found in your club.");
    const existing = threads.length
      ? await rest(
          `communication_messages?select=*&id=eq.${b.id}&thread_id=eq.${b.id}`,
        )
      : [];
    const prior = existing[0];
    if (prior && prior.metadata?.workspace !== "club_announcer")
      throw new PersonRecordError(403, communicationsBoundary);
    if (prior && Number(b.revision) !== Number(prior.metadata.revision))
      throw new PersonRecordError(
        409,
        "Bulletin changed. Reload before saving.",
      );
    if (
      prior &&
      !["draft", "POLICY_HOLD"].includes(prior.delivery_status) &&
      !(
        prior.delivery_status === "Pending_Executive_Approval" &&
        b.action === "stage"
      )
    )
      throw new PersonRecordError(
        409,
        "This bulletin is locked for review or delivery.",
      );
    if (
      prior?.delivery_status === "Pending_Executive_Approval" &&
      (prior.body !== input.body ||
        prior.metadata.title !== input.title ||
        JSON.stringify(prior.metadata.segments) !==
          JSON.stringify(input.segments) ||
        prior.metadata.channel !== input.channel ||
        prior.metadata.planned_at !== input.planned_at)
    )
      throw new PersonRecordError(
        409,
        "A staged safety bulletin cannot be edited while approval is pending.",
      );
    if (!threads.length)
      await rest("communication_threads", {
        method: "POST",
        body: JSON.stringify({
          id: b.id,
          tenant_id: tenant,
          organization_id: org,
          thread_type: "admin_bulletin",
          title: "Club bulletin preparation",
          status: "draft",
          minor_safe_mode: true,
          created_by: ctx.person.id,
          team_id: null,
        }),
      });
    let metadata = {
      ...prior?.metadata,
      workspace: "club_announcer",
      title: input.title,
      segments: input.segments,
      channel: input.channel,
      planned_at: input.planned_at,
      recipient_ids: recipients,
      revision: Number(prior?.metadata?.revision || 0) + 1,
      updated_at: new Date().toISOString(),
      ...(b.action === "format"
        ? { format_reviewed_at: new Date().toISOString() }
        : {}),
      ...(b.action === "stage" ? { approval_task_id: b.id } : {}),
    };
    if (prior?.delivery_status === "Pending_Executive_Approval") metadata = prior.metadata;
    const status =
      b.action === "stage"
        ? "Pending_Executive_Approval"
        : prior?.delivery_status === "POLICY_HOLD"
          ? "POLICY_HOLD"
          : "draft";
    const payload = {
      body: input.body,
      metadata,
      delivery_status: status,
      sent_at: null,
    };
    const saved = prior
      ? await rest(
          `communication_messages?id=eq.${b.id}&thread_id=eq.${b.id}&metadata->>revision=eq.${prior.metadata.revision}&delivery_status=eq.${encodeURIComponent(prior.delivery_status)}`,
          { method: "PATCH", body: JSON.stringify(payload) },
        )
      : await rest("communication_messages", {
          method: "POST",
          body: JSON.stringify({
            id: b.id,
            thread_id: b.id,
            sender_person_id: ctx.person.id,
            message_type: "markdown",
            moderated: false,
            ...payload,
          }),
        });
    if (!saved.length)
      throw new PersonRecordError(
        409,
        "Bulletin changed. Reload before saving.",
      );
    let warning = "";
    if (b.action === "stage") {
      try {
        const tasks = await rest(
          `operational_tasks?select=id,tenant_id,organization_id,metadata&id=eq.${b.id}`,
        );
        if (tasks.length) {
          if (
            tasks[0].tenant_id !== tenant ||
            tasks[0].organization_id !== org ||
            tasks[0].metadata?.bulletin_id !== b.id
          )
            throw Error("Task ID conflict");
        } else
          await rest("operational_tasks", {
            method: "POST",
            body: JSON.stringify({
              id: b.id,
              tenant_id: tenant,
              organization_id: org,
              assigned_role: "org_admin",
              title: "Review safety bulletin: " + input.title.slice(0, 150),
              description: input.body.slice(0, 3500),
              priority: "critical",
              status: "open",
              metadata: {
                kind: "communication_approval",
                bulletin_id: b.id,
                revision: metadata.revision,
                channel: input.channel,
                recipient_count: metadata.recipient_ids.length,
              },
            }),
          });
      } catch {
        warning =
          "Safety bulletin saved on hold, but executive task creation failed. Reopen and stage again to retry the task; nothing was sent.";
      }
    }
    try {
      await rest("audit_events", {
        method: "POST",
        body: JSON.stringify({
          tenant_id: tenant,
          actor_user_id: ctx.user.id,
          actor_person_id: ctx.person.id,
          action: "communication." + b.action,
          entity_type: "communication_message",
          entity_id: b.id,
          before_data: prior || null,
          after_data: saved[0],
          reason,
          correlation_id: crypto.randomUUID(),
        }),
      });
    } catch {
      warning +=
        (warning ? " " : "") +
        "Bulletin saved, but its audit entry failed. Contact Organization Admin; nothing was sent.";
    }
    return NextResponse.json({
      ok: true,
      row: saved[0],
      warning,
      message:
        b.action === "stage"
          ? "Safety bulletin held for executive review. External delivery remains disabled."
          : "Draft saved. Nothing was sent.",
    });
  } catch (e) {
    return fail(e);
  }
}
