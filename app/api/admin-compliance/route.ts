import { NextRequest, NextResponse } from "next/server";
import {
  resolveAccess,
  canUseAdminRoleContext,
  hasAdminContextPermission as can,
} from "@/lib/server/accessControl";
import { recordRest as rest } from "@/lib/server/adminRecordAccess";
import { PersonRecordError } from "@/lib/server/adminPersonRecord";
import { documentTypeFilter } from "@/lib/server/adminDocumentPolicy";
export const dynamic = "force-dynamic";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const tables: Record<string, string> = {
  credentials: "credentials",
  backgroundChecks: "background_checks",
  safeSport: "safesport_records",
};
async function access(
  request: NextRequest,
  role: string,
  permission = "record.read",
) {
  const ctx = await resolveAccess(request);
  if (!ctx) throw new PersonRecordError(401, "Sign in required.");
  if (
    !["org_admin", "registrar"].includes(role) ||
    !ctx.allowedHubs.includes("admin") ||
    !canUseAdminRoleContext(ctx, role) ||
    !can(ctx, role, permission) ||
    !can(ctx, role, "waivers.read")
  )
    throw new PersonRecordError(403, "Compliance evidence access denied.");
  const tenant = ctx.adminScope?.tenantId || ctx.person?.tenant_id;
  const orgs = ctx.adminScope
    ? [ctx.adminScope.organizationId]
    : [
        ...new Set(
          ctx.roles.map((r) => r.scope.organization_id).filter(Boolean),
        ),
      ];
  if (!tenant || orgs.length !== 1)
    throw new PersonRecordError(
      403,
      "Authorized organization context required.",
    );
  return { ctx, tenant, org: String(orgs[0]) };
}
const fail = (e: unknown) =>
  NextResponse.json(
    { error: e instanceof Error ? e.message : "Evidence operation failed." },
    { status: e instanceof PersonRecordError ? e.status : 500 },
  );
export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams,
      role = q.get("role") || "org_admin",
      { ctx, tenant, org } = await access(request, role);
    if (q.get("mode") === "list") {
      const page = Number(q.get("page") || 0),
        domain = q.get("domain") || "credentials";
      if (
        !Number.isInteger(page) ||
        page < 0 ||
        page > 10000 ||
        !tables[domain]
      )
        throw new PersonRecordError(400, "Valid category and page required.");
      const rows = await rest("rpc/admin_compliance_evidence_list", {
        method: "POST",
        body: JSON.stringify({
          p_tenant: tenant,
          p_orgs: [org],
          p_domain: domain,
          p_page: page,
          p_search: q.get("q") || "",
          p_sort: q.get("sort") || "person",
          p_direction: q.get("direction") || "asc",
        }),
      });
      return NextResponse.json({
        rows: rows.slice(0, 25),
        hasMore: rows.length > 25,
        total: rows[0]?.total_count || 0,
        authorization: {
          create: can(ctx, role, "record.create"),
          edit: can(ctx, role, "record.update"),
        },
      });
    }
    const people = await rest("rpc/admin_compliance_people", {
      method: "POST",
      body: JSON.stringify({ p_tenant: tenant, p_orgs: [org] }),
    });
    const person = q.get("personId"),
      id = q.get("id"),
      domain = q.get("domain") || "credentials";
    if (person) {
      if (
        !uuid.test(person) ||
        !people.some((p: { id: string }) => p.id === person)
      )
        throw new PersonRecordError(404, "Person outside organization.");
      const [documents, profile] = await Promise.all([
        rest(
          `documents?select=id,title,verification_status,current_version,expires_at,document_types!inner(code)&tenant_id=eq.${tenant}&owner_person_id=eq.${person}${documentTypeFilter(role)}&order=title.asc&limit=100`,
        ),
        rest(
          `people?select=id,first_name,last_name,preferred_name&id=eq.${person}&tenant_id=eq.${tenant}`,
        ),
      ]);
      let history = [];
      let record = null;
      if (id) {
        if (!uuid.test(id) || !tables[domain])
          throw new PersonRecordError(
            400,
            "Evidence category and record required.",
          );
        const rows = await rest(
          `${tables[domain]}?select=*&id=eq.${id}&person_id=eq.${person}`,
        );
        if (!rows.length)
          throw new PersonRecordError(404, "Evidence record not found.");
        record = rows[0];
        history = await rest(
          `audit_events?select=id,action,occurred_at,actor_person_id,reason,before_data,after_data&tenant_id=eq.${tenant}&entity_type=eq.${domain}&entity_id=eq.${id}&order=occurred_at.desc&limit=100`,
        );
      }
      return NextResponse.json({
        person: profile[0],
        documents,
        history,
        record,
      });
    }
    const search = (q.get("q") || "")
      .trim()
      .slice(0, 100)
      .replace(/[,%_*()\\]/g, "");
    const ids = people.map((p: { id: string }) => p.id);
    const rows = ids.length
      ? await rest(
          `people?select=id,first_name,last_name,preferred_name,email&tenant_id=eq.${tenant}&id=in.(${ids.join(",")})${search ? `&or=(first_name.ilike.*${encodeURIComponent(search)}*,last_name.ilike.*${encodeURIComponent(search)}*,email.ilike.*${encodeURIComponent(search)}*)` : ""}&order=last_name.asc,first_name.asc,id.asc&limit=25`,
        )
      : [];
    return NextResponse.json({
      people: rows,
      authorization: { create: can(ctx, role, "record.create") },
    });
  } catch (e) {
    return fail(e);
  }
}
export async function POST(request: NextRequest) {
  try {
    const b = await request.json(),
      role = String(b.role || "org_admin"),
      { ctx, tenant, org } = await access(request, role, "record.create");
    if (
      !tables[b.domain] ||
      !uuid.test(b.id || "") ||
      !uuid.test(b.personId || "") ||
      String(b.reason || "").trim().length < 5
    )
      throw new PersonRecordError(
        400,
        "Evidence category, person and intake reason required.",
      );
    if (b.values?.document_id) {
      if (!uuid.test(b.values.document_id))
        throw new PersonRecordError(400, "Valid supporting document required.");
      const docs = await rest(
        `documents?select=id,document_types!inner(code)&id=eq.${b.values.document_id}&tenant_id=eq.${tenant}&owner_person_id=eq.${b.personId}${documentTypeFilter(role)}`,
      );
      if (!docs.length)
        throw new PersonRecordError(
          403,
          "Supporting document is outside your evidence authority.",
        );
    }
    const row = await rest("rpc/admin_compliance_intake", {
      method: "POST",
      body: JSON.stringify({
        p_tenant: tenant,
        p_org: org,
        p_actor_user: ctx.user.id,
        p_actor_person: ctx.person?.id || null,
        p_domain: b.domain,
        p_id: b.id,
        p_person: b.personId,
        p_values: b.values,
        p_reason: String(b.reason).trim(),
      }),
    });
    return NextResponse.json({ row });
  } catch (e) {
    return fail(e);
  }
}
