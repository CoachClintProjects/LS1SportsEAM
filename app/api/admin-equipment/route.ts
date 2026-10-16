import { NextRequest, NextResponse } from "next/server";
import {
  resolveAccess,
  canUseAdminRoleContext,
  hasAdminContextPermission as can,
} from "@/lib/server/accessControl";
import { recordRest as rest } from "@/lib/server/adminRecordAccess";
import { PersonRecordError } from "@/lib/server/adminPersonRecord";
import {
  equipmentRole,
  equipmentBoundary,
  equipmentActions,
  equipmentPermission,
} from "@/lib/equipmentPolicy";
export const dynamic = "force-dynamic";
type Row = Record<string, any>;
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
async function scope(
  req: NextRequest,
  permission = "record.read",
  role = equipmentRole,
) {
  const ctx = await resolveAccess(req);
  if (!ctx) throw new PersonRecordError(401, "Sign in required.");
  if (
    !ctx.allowedHubs.includes("admin") ||
    !canUseAdminRoleContext(ctx, role) ||
    !can(ctx, role, permission)
  )
    throw new PersonRecordError(403, equipmentBoundary);
  const tenant = ctx.adminScope?.tenantId || ctx.person?.tenant_id,
    orgs = ctx.adminScope
      ? [ctx.adminScope.organizationId]
      : [
          ...new Set(
            ctx.roles
              .filter((r) =>
                [
                  role === "treasurer"
                    ? "TREASURER"
                    : "FACILITIES_EQUIPMENT_MANAGER",
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
    "Too many equipment records for a complete report. Narrow the scope.",
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
    { error: e instanceof Error ? e.message : "Equipment request failed." },
    { status: e instanceof PersonRecordError ? e.status : 500 },
  );
export async function GET(req: NextRequest) {
  try {
    const { ctx, tenant, org } = await scope(req);
    const [sites, items, teams, requests, tasks] = await Promise.all([
      all(`sites?select=id,name&organization_id=eq.${org}`),
      all(`inventory_items?select=*&organization_id=eq.${org}`),
      all(`teams?select=id,name,status&organization_id=eq.${org}`),
      all(`purchase_requests?select=id&organization_id=eq.${org}`),
      all(
        `operational_tasks?select=*&tenant_id=eq.${tenant}&organization_id=eq.${org}&metadata->>kind=like.equipment_*`,
      ),
    ]);
    const [facilities, orders] = await Promise.all([
      related(
        "facilities?select=*",
        "site_id",
        sites.map((x) => x.id),
      ),
      related(
        "purchase_orders?select=id,po_number,status,vendor_id,currency",
        "purchase_request_id",
        requests.map((x) => x.id),
      ),
    ]);
    const facilityIds = facilities.map((x) => x.id),
      itemIds = items.map((x) => x.id);
    const [bins, bookings, closures, maintenance, lines, transactions] =
      await Promise.all([
        related("inventory_locations?select=*", "facility_id", facilityIds),
        related("facility_bookings?select=*", "facility_id", facilityIds),
        related("facility_closures?select=*", "facility_id", facilityIds),
        related("maintenance_work_orders?select=*", "facility_id", facilityIds),
        related(
          "purchase_order_lines?select=id,purchase_order_id,line_no,item_id,description,quantity,received_quantity,status",
          "purchase_order_id",
          orders.map((x) => x.id),
        ),
        related("inventory_transactions?select=*", "item_id", itemIds),
      ]);
    const balances: Row[] = [];
    for (let i = 0; i < itemIds.length; i += 100) {
      for (let offset = 0; offset < 10000; offset += 500) {
        const rows = await rest(
          `inventory_balances?select=*&item_id=in.(${itemIds.slice(i, i + 100).join(",")})&order=item_id,location_id&limit=500&offset=${offset}`,
        );
        balances.push(...rows);
        if (rows.length < 500) break;
        if (offset === 9500)
          throw new PersonRecordError(409, "Too many stock balances.");
      }
    }
    const binIds = new Set(bins.map((x) => x.id));
    const id = req.nextUrl.searchParams.get("id");
    const known = new Set(
      [
        ...items,
        ...bins,
        ...bookings,
        ...closures,
        ...maintenance,
        ...tasks,
        ...transactions,
        ...orders,
      ].map((x) => x.id),
    );
    if (id && (!uuid.test(id) || !known.has(id)))
      throw new PersonRecordError(
        404,
        "Equipment record not found in your club.",
      );
    const history = id
      ? await all(
          `audit_events?select=id,action,reason,occurred_at&tenant_id=eq.${tenant}&entity_type=eq.equipment&entity_id=eq.${id}`,
        )
      : [];
    return NextResponse.json({
      sites,
      items,
      teams,
      facilities,
      orders,
      lines,
      bins,
      bookings,
      closures,
      maintenance,
      tasks,
      transactions: transactions.filter((x) => binIds.has(x.location_id)),
      balances: balances.filter((x) => binIds.has(x.location_id)),
      history,
      canCreate: can(ctx, equipmentRole, "record.create"),
      canUpdate: can(ctx, equipmentRole, "record.update"),
      canReopen:
        canUseAdminRoleContext(ctx, "org_admin") &&
        can(ctx, "org_admin", "record.update"),
      canReleaseHold:
        canUseAdminRoleContext(ctx, "treasurer") &&
        can(ctx, "treasurer", "record.update"),
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    return fail(e);
  }
}
export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    if (!equipmentActions.includes(b.action))
      throw new PersonRecordError(403, equipmentBoundary);
    const role =
      b.action === "reopen"
        ? "org_admin"
        : b.action === "release_hold"
          ? "treasurer"
          : equipmentRole;
    const { ctx, tenant, org } = await scope(
      req,
      equipmentPermission(b.action),
      role,
    );
    if (!ctx.person?.id)
      throw new PersonRecordError(403, "Linked club person required.");
    if (!uuid.test(b.request_id || ""))
      throw new PersonRecordError(400, "Valid request ID required.");
    if (
      !b.values ||
      typeof b.values !== "object" ||
      Array.isArray(b.values) ||
      JSON.stringify(b.values).length > 50000
    )
      throw new PersonRecordError(400, "Invalid equipment values.");
    if (["release_hold", "reopen"].includes(b.action) && b.authority !== role)
      throw new PersonRecordError(
        403,
        "Use the authorized executive or Treasurer action.",
      );
    const result = await rest("rpc/admin_equipment_write", {
      method: "POST",
      body: JSON.stringify({
        p_tenant: tenant,
        p_org: org,
        p_actor_user: ctx.user.id,
        p_actor_person: ctx.person.id,
        p_role: role,
        p_action: b.action,
        p_request: b.request_id,
        p_values: b.values,
        p_reason: String(b.reason || "").trim(),
      }),
    });
    return NextResponse.json(result);
  } catch (e) {
    return fail(e);
  }
}
