import { NextRequest, NextResponse } from "next/server";
import {
  canUseAdminRoleContext,
  hasAdminContextPermission,
  resolveAccess,
  serviceHeaders,
} from "@/lib/server/accessControl";
import { supabaseServerConfig } from "@/lib/server/superuserAuth";
export const dynamic = "force-dynamic";
async function rest(path: string, init: RequestInit = {}) {
  const { url } = supabaseServerConfig(),
    h = serviceHeaders();
  if (!h) throw new Error("Contact store unavailable.");
  const r = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: h,
    cache: "no-store",
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.message || "Contact operation failed.");
  return j;
}
async function scope(request: NextRequest, role: string, write = false) {
  const ctx = await resolveAccess(request);
  if (
    !ctx ||
    !ctx.allowedHubs.includes("admin") ||
    !canUseAdminRoleContext(ctx, role) ||
    !hasAdminContextPermission(
      ctx,
      role,
      write ? "record.update" : "record.read",
    )
  )
    return null;
  const tenant = ctx.adminScope?.tenantId || ctx.person?.tenant_id;
  const orgs = ctx.adminScope
    ? [ctx.adminScope.organizationId]
    : [
        ...new Set(
          ctx.roles.map((r) => r.scope.organization_id).filter(Boolean),
        ),
      ];
  if (!tenant || orgs.length !== 1) return null;
  return { ctx, tenant, org: String(orgs[0]) };
}
export async function GET(request: NextRequest) {
  try {
    const role = request.nextUrl.searchParams.get("role") || "org_admin",
      s = await scope(request, role);
    if (!s)
      return NextResponse.json(
        { error: "Contact access requires an authorized organization." },
        { status: 403 },
      );
    const [contacts, sites, vendors, externalOrganizations] = await Promise.all(
      [
        rest(
          `entity_contacts?select=*&tenant_id=eq.${s.tenant}&organization_id=eq.${s.org}&order=created_at.desc`,
        ),
        rest(`sites?select=id,name&organization_id=eq.${s.org}`),
        rest(`vendors?select=id,name&organization_id=eq.${s.org}`),
        rest(`external_organizations?select=id,name&tenant_id=eq.${s.tenant}`),
      ],
    );
    const personIds = [...new Set(contacts.map((x: any) => x.person_id))];
    const [people, facilities] = await Promise.all([
      personIds.length
        ? rest(
            `people?select=id,first_name,last_name,email,phone&tenant_id=eq.${s.tenant}&id=in.(${personIds.join(",")})`,
          )
        : [],
      sites.length
        ? rest(
            `facilities?select=id,name,site_id&site_id=in.(${sites.map((x: any) => x.id).join(",")})`,
          )
        : [],
    ]);
    return NextResponse.json({
      contacts: contacts.map((c: any) => ({
        ...c,
        person: people.find((p: any) => p.id === c.person_id),
      })),
      facilities,
      vendors,
      externalOrganizations,
      canEdit: hasAdminContextPermission(s.ctx, role, "record.update"),
      canCreate:
        hasAdminContextPermission(s.ctx, role, "record.create") &&
        hasAdminContextPermission(s.ctx, role, "record.update"),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unable to load contacts." },
      { status: 500 },
    );
  }
}
export async function POST(request: NextRequest) {
  try {
    const b = await request.json(),
      role = String(b.role || "org_admin"),
      s = await scope(request, role, true);
    if (
      !s ||
      (!b.id && !hasAdminContextPermission(s.ctx, role, "record.create"))
    )
      return NextResponse.json(
        { error: "Contact editing denied." },
        { status: 403 },
      );
    const v = b.values,
      keys = [
        "first_name",
        "last_name",
        "email",
        "phone",
        "relationship_type",
        "job_title",
        "department",
        "status",
        "notes",
        "facility_id",
        "vendor_id",
        "external_organization_id",
      ];
    if (
      !v ||
      typeof v !== "object" ||
      Array.isArray(v) ||
      Object.entries(v).some(
        ([k, x]) =>
          !keys.includes(k) || typeof x !== "string" || x.length > 10000,
      ) ||
      !v.first_name?.trim() ||
      !v.last_name?.trim() ||
      !v.relationship_type?.trim() ||
      !["active", "inactive"].includes(v.status)
    )
      return NextResponse.json(
        { error: "Name, contact type and status are required." },
        { status: 400 },
      );
    if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email))
      return NextResponse.json(
        { error: "Enter a valid email address." },
        { status: 400 },
      );
    const row = await rest("rpc/admin_save_external_contact", {
      method: "POST",
      body: JSON.stringify({
        p_tenant: s.tenant,
        p_organization: s.org,
        p_id: b.id || null,
        p_actor_user: s.ctx.user.id,
        p_actor_person: s.ctx.person?.id || null,
        p_expected_updated_at: b.expectedUpdatedAt || null,
        p_values: v,
      }),
    });
    return NextResponse.json({ ok: true, row });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Contact save failed.";
    return NextResponse.json(
      { error: message },
      { status: message.includes("changed.") ? 409 : 400 },
    );
  }
}
