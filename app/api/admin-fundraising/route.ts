import { NextRequest, NextResponse } from "next/server";
import {
  resolveAccess,
  canUseAdminRoleContext,
  hasAdminContextPermission as can,
} from "@/lib/server/accessControl";
import { recordRest as rest } from "@/lib/server/adminRecordAccess";
import { PersonRecordError } from "@/lib/server/adminPersonRecord";
import {
  fundraisingBoundary,
  campaignInput,
  leadInput,
  leadNotes,
  totals,
} from "@/lib/fundraisingPolicy";
export const dynamic = "force-dynamic";
type Row = Record<string, any>;
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
async function scope(req: NextRequest, permission = "record.read") {
  const ctx = await resolveAccess(req);
  if (!ctx) throw new PersonRecordError(401, "Sign in required.");
  if (
    !ctx.allowedHubs.includes("admin") ||
    !canUseAdminRoleContext(ctx, "fundraising_coordinator") ||
    !can(ctx, "fundraising_coordinator", permission)
  )
    throw new PersonRecordError(403, fundraisingBoundary);
  const tenant = ctx.adminScope?.tenantId || ctx.person?.tenant_id,
    orgs = ctx.adminScope
      ? [ctx.adminScope.organizationId]
      : [
          ...new Set(
            ctx.roles
              .filter((r) =>
                ["FUNDRAISING_COORDINATOR", "ORGANIZATION_ADMIN"].includes(
                  r.code,
                ),
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
    "Too many fundraising records for a complete report. Narrow the scope.",
  );
}
async function related(path: string, key: string, ids: string[]) {
  const rows: Row[] = [];
  for (let i = 0; i < ids.length; i += 100)
    rows.push(
      ...(await all(`${path}&${key}=in.(${ids.slice(i, i + 100).join(",")})`)),
    );
  return rows;
}
const fail = (e: unknown) =>
  NextResponse.json(
    { error: e instanceof Error ? e.message : "Fundraising request failed." },
    { status: e instanceof PersonRecordError ? e.status : 500 },
  );
export async function GET(req: NextRequest) {
  try {
    const { ctx, tenant, org } = await scope(req);
    const campaigns = await all(
        `fundraising_campaigns?select=*&tenant_id=eq.${tenant}&organization_id=eq.${org}`,
      ),
      leads = await related(
        "fundraising_commitments?select=*",
        "campaign_id",
        campaigns.map((c) => c.id),
      );
    const id = req.nextUrl.searchParams.get("id");
    if (
      id &&
      !campaigns.some((c) => c.id === id) &&
      !leads.some((l) => l.id === id)
    )
      throw new PersonRecordError(
        404,
        "Fundraising record not found in your club.",
      );
    const history = id
      ? await all(
          `audit_events?select=id,action,reason,occurred_at&tenant_id=eq.${tenant}&entity_type=in.(fundraising_campaign,fundraising_commitment)&entity_id=eq.${id}`,
        )
      : [];
    const handoffs = await all(
      `operational_tasks?select=id,title,status,assigned_role,metadata&tenant_id=eq.${tenant}&organization_id=eq.${org}&metadata->>kind=eq.fundraising_asset`,
    );
    return NextResponse.json({
      campaigns,
      leads,
      handoffs,
      history,
      totals: totals(campaigns as any, leads as any),
      canCreate: can(ctx, "fundraising_coordinator", "record.create"),
      canUpdate: can(ctx, "fundraising_coordinator", "record.update"),
      canHandoff: can(ctx, "fundraising_coordinator", "admin_tasks.create"),
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    return fail(e);
  }
}
export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    if (
      ![
        "create_campaign",
        "create_lead",
        "save_lead",
        "commit",
        "asset_handoff",
      ].includes(b.action)
    )
      throw new PersonRecordError(
        403,
        fundraisingBoundary +
          " Posting, receiving, deleting and reversing funds are unavailable from this workspace.",
      );
    const { ctx, tenant, org } = await scope(
      req,
      b.action.startsWith("create")
        ? "record.create"
        : b.action === "asset_handoff"
          ? "admin_tasks.create"
          : "record.update",
    );
    if (!ctx.person?.id)
      throw new PersonRecordError(403, "A linked club person is required.");
    if (!uuid.test(b.id || ""))
      throw new PersonRecordError(400, "A valid request ID is required.");
    const reason = String(b.reason || "").trim();
    if (reason.length < 10 || reason.length > 2000)
      throw new PersonRecordError(
        400,
        "Record a reason of 10–2000 characters.",
      );
    let row: Row,
      prior: Row | null = null,
      type = "fundraising_commitment";
    if (b.action === "create_campaign") {
      let values;
      try {
        values = campaignInput(b);
      } catch (e) {
        throw new PersonRecordError(
          400,
          e instanceof Error ? e.message : "Invalid campaign.",
        );
      }
      const existing = await rest(
        `fundraising_campaigns?select=*&id=eq.${b.id}`,
      );
      if (existing.length) {
        if (
          existing[0].tenant_id !== tenant ||
          existing[0].organization_id !== org ||
          existing[0].code !== values.code
        )
          throw new PersonRecordError(409, "Request ID already used.");
        return NextResponse.json({
          ok: true,
          row: existing[0],
          message:
            "Campaign already saved. Review the saved values before continuing.",
        });
      }
      const duplicate = await rest(
        `fundraising_campaigns?select=id&organization_id=eq.${org}&code=eq.${encodeURIComponent(values.code)}`,
      );
      if (duplicate.length)
        throw new PersonRecordError(409, "This campaign code already exists.");
      const saved = await rest("fundraising_campaigns", {
        method: "POST",
        body: JSON.stringify({
          id: b.id,
          tenant_id: tenant,
          organization_id: org,
          ...values,
          status: "draft",
        }),
      });
      row = saved[0];
      type = "fundraising_campaign";
    } else {
      if (!uuid.test(b.campaign_id || ""))
        throw new PersonRecordError(400, "Select a campaign.");
      const cs = await rest(
          `fundraising_campaigns?select=*&id=eq.${b.campaign_id}&tenant_id=eq.${tenant}&organization_id=eq.${org}`,
        ),
        campaign = cs[0];
      if (!campaign)
        throw new PersonRecordError(404, "Campaign not found in your club.");
      if (["void", "cancelled", "closed"].includes(campaign.status))
        throw new PersonRecordError(409, "This campaign is closed.");
      const records = await rest(
        `fundraising_commitments?select=*&id=eq.${b.id}`,
      );
      prior = records[0] || null;
      if (prior && prior.campaign_id !== campaign.id)
        throw new PersonRecordError(404, "Lead not found in this campaign.");
      if (b.action === "create_lead") {
        let values;
        try {
          values = leadInput(b);
        } catch (e) {
          throw new PersonRecordError(
            400,
            e instanceof Error ? e.message : "Invalid lead.",
          );
        }
        if (prior)
          return NextResponse.json({
            ok: true,
            row: prior,
            message: "This lead was already saved. Review the saved record.",
          });
        const saved = await rest("fundraising_commitments", {
          method: "POST",
          body: JSON.stringify({
            id: b.id,
            campaign_id: campaign.id,
            ...values,
            status: "prospect",
            committed_on: null,
            received_on: null,
          }),
        });
        row = saved[0];
      } else {
        if (!prior) throw new PersonRecordError(404, "Lead not found.");
        if (prior.updated_at !== b.updated_at)
          throw new PersonRecordError(
            409,
            "Lead changed. Reload before saving.",
          );
        if (b.action === "asset_handoff") {
          const notes = leadNotes(prior.notes);
          if (
            prior.commitment_type !== "sponsorship" ||
            prior.status !== "committed" ||
            notes.obligations.length < 10
          )
            throw new PersonRecordError(
              409,
              "A committed sponsorship and recorded club obligations are required.",
            );
          const tasks = await rest(`operational_tasks?select=*&id=eq.${b.id}`);
          if (tasks.length) {
            if (
              tasks[0].tenant_id !== tenant ||
              tasks[0].organization_id !== org ||
              tasks[0].metadata?.commitment_id !== b.id ||
              tasks[0].metadata?.kind !== "fundraising_asset"
            )
              throw new PersonRecordError(409, "Task ID already used.");
            return NextResponse.json({
              ok: true,
              row: prior,
              message:
                "The Communications task already exists. Review its current status.",
            });
          }
          await rest("operational_tasks", {
            method: "POST",
            body: JSON.stringify({
              id: b.id,
              tenant_id: tenant,
              organization_id: org,
              assigned_role: "communications_media",
              title: "Sponsor assets: " + prior.counterparty_name.slice(0, 160),
              description: notes.obligations,
              priority: "normal",
              status: "open",
              metadata: {
                kind: "fundraising_asset",
                campaign_id: campaign.id,
                commitment_id: b.id,
                counterparty: prior.counterparty_name,
                reason,
              },
            }),
          });
          row = prior;
        } else {
          if (prior.status !== "prospect" || prior.received_on)
            throw new PersonRecordError(
              409,
              "Only uncommitted prospects can be changed. Signed pledges and receipts require a controlled amendment.",
            );
          let changes: Row;
          if (b.action === "commit") {
            if (Number(prior.amount) <= 0)
              throw new PersonRecordError(
                409,
                "Record a positive pledged amount before marking committed.",
              );
            changes = {
              status: "committed",
              committed_on: new Date().toISOString().slice(0, 10),
            };
          } else {
            try {
              changes = leadInput(b);
            } catch (e) {
              throw new PersonRecordError(
                400,
                e instanceof Error ? e.message : "Invalid lead.",
              );
            }
          }
          const saved = await rest(
            `fundraising_commitments?id=eq.${b.id}&campaign_id=eq.${campaign.id}&status=eq.prospect&updated_at=${prior.updated_at ? "eq." + encodeURIComponent(prior.updated_at) : "is.null"}`,
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
              "Lead changed. Reload before saving.",
            );
          row = saved[0];
        }
      }
    }
    if (!row) throw new Error("No saved record returned.");
    let warning = "";
    try {
      await rest("audit_events", {
        method: "POST",
        body: JSON.stringify({
          tenant_id: tenant,
          actor_user_id: ctx.user.id,
          actor_person_id: ctx.person.id,
          action: "fundraising." + b.action,
          entity_type: type,
          entity_id: b.id,
          before_data: prior,
          after_data: row,
          reason,
          correlation_id: crypto.randomUUID(),
        }),
      });
    } catch {
      warning =
        "The change saved, but its audit entry failed. Contact Organization Admin; do not repeat the change.";
    }
    return NextResponse.json({
      ok: true,
      row,
      warning,
      message:
        b.action === "asset_handoff"
          ? "Implementation task sent to Communications."
          : "Saved. No money was received or posted.",
    });
  } catch (e) {
    return fail(e);
  }
}
