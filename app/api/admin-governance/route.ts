import { NextRequest, NextResponse } from "next/server";
import { governanceScope, governanceUuid } from "@/lib/server/adminGovernance";
import { recordRest as rest } from "@/lib/server/adminRecordAccess";
import { PersonRecordError } from "@/lib/server/adminPersonRecord";
import { hasAdminContextPermission as can } from "@/lib/server/accessControl";
export const dynamic = "force-dynamic";
const fail = (e: unknown) =>
  NextResponse.json(
    { error: e instanceof Error ? e.message : "Governance operation failed." },
    { status: e instanceof PersonRecordError ? e.status : 500 },
  );
export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams,
      { ctx, tenant, org } = await governanceScope(
        request,
        q.get("role") || "org_admin",
      );
    const id = q.get("id");
    if (id) {
      if (!governanceUuid.test(id))
        throw new PersonRecordError(400, "Valid record required.");
      const [row] = await rest(
        `organization_governance_records?select=*&id=eq.${id}&tenant_id=eq.${tenant}&organization_id=eq.${org}`,
      );
      if (!row)
        throw new PersonRecordError(404, "Governance record not found.");
      const [files, history] = await Promise.all([
        rest(
          `organization_governance_files?select=id,title,mime_type,size_bytes,created_at&record_id=eq.${id}&order=created_at.desc`,
        ),
        rest(
          `audit_events?select=id,action,occurred_at,actor_person_id,reason,before_data,after_data&tenant_id=eq.${tenant}&entity_type=eq.organization_governance&entity_id=eq.${id}&order=occurred_at.desc&limit=100`,
        ),
      ]);
      return NextResponse.json({ row, files, history });
    }
    const types = await rest(
      "organization_governance_types?select=*&order=name.asc",
    );
    const kind = q.get("kind") || types[0]?.code;
    if (!types.some((t: { code: string }) => t.code === kind))
      throw new PersonRecordError(400, "Select a governance category.");
    const page = Number(q.get("page") || 0);
    if (!Number.isInteger(page) || page < 0 || page > 10000)
      throw new PersonRecordError(400, "Invalid page.");
    const sort = ["title", "status", "due_on", "updated_at"].includes(
      q.get("sort") || "",
    )
      ? q.get("sort")
      : "updated_at";
    const direction = q.get("direction") === "asc" ? "asc" : "desc";
    const search = (q.get("q") || "")
      .trim()
      .slice(0, 100)
      .replace(/[\\%_*]/g, "");
    const [rows, owners, organizations, replacements] = await Promise.all([
      rest(
        `organization_governance_records?select=id,kind,title,status,due_on,owner_person_id,version,updated_at&tenant_id=eq.${tenant}&organization_id=eq.${org}&kind=eq.${kind}${search ? `&title=ilike.*${encodeURIComponent(search)}*` : ""}&order=${sort}.${direction}.nullslast,id.asc&limit=26&offset=${page * 25}`,
      ),
      rest(
        `role_assignments?select=person_id,starts_at,ends_at,people!inner(id,first_name,last_name,preferred_name,status),role_definitions!inner(code)&tenant_id=eq.${tenant}&organization_id=eq.${org}&status=eq.active&role_definitions.code=eq.ORGANIZATION_ADMIN&people.status=eq.active`,
      ),
      rest(`organizations?select=id,name&id=eq.${org}&tenant_id=eq.${tenant}`),
      rest(
        `organization_governance_records?select=id,title&tenant_id=eq.${tenant}&organization_id=eq.${org}&kind=eq.policy&status=eq.active&order=title.asc&limit=500`,
      ),
    ]);
    const now = Date.now();
    const validOwners = owners
      .filter(
        (o: { starts_at: string | null; ends_at: string | null }) =>
          (!o.starts_at || Date.parse(o.starts_at) <= now) &&
          (!o.ends_at || Date.parse(o.ends_at) > now),
      )
      .map((o: { people: unknown }) => o.people);
    return NextResponse.json({
      types,
      rows: rows.slice(0, 25),
      hasMore: rows.length > 25,
      page,
      owners: validOwners,
      replacements,
      organization: organizations[0],
      authorization: {
        create: can(ctx, "org_admin", "record.create"),
        edit: can(ctx, "org_admin", "record.update"),
        decide: can(ctx, "org_admin", "workflow.execute"),
      },
    });
  } catch (e) {
    return fail(e);
  }
}
export async function POST(request: NextRequest) {
  try {
    const b = await request.json();
    if (!["create", "edit", "assign", "transition"].includes(b.operation))
      throw new PersonRecordError(400, "Unsupported governance action.");
    const permission =
      b.operation === "create"
        ? "record.create"
        : b.operation === "transition"
          ? "workflow.execute"
          : "record.update";
    const { ctx, tenant, org } = await governanceScope(
      request,
      b.role || "org_admin",
      permission,
    );
    if (
      !governanceUuid.test(b.id || "") ||
      !String(b.reason || "").trim() ||
      (b.operation !== "create" && !Number.isInteger(b.expectedVersion))
    )
      throw new PersonRecordError(400, "Record, version and reason required.");
    const row = await rest("rpc/admin_governance_write", {
      method: "POST",
      body: JSON.stringify({
        p_tenant: tenant,
        p_org: org,
        p_actor_user: ctx.user.id,
        p_actor_person: ctx.person?.id || null,
        p_id: b.id,
        p_operation: b.operation,
        p_expected_version: b.expectedVersion ?? 0,
        p_values: b.values || {},
        p_reason: String(b.reason).trim(),
      }),
    });
    return NextResponse.json({ row });
  } catch (e) {
    return fail(e);
  }
}
