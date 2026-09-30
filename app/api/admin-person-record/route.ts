import { NextRequest, NextResponse } from "next/server";
import {
  canUseAdminRoleContext,
  hasAdminContextPermission,
  resolveAccess,
  serviceHeaders,
} from "@/lib/server/accessControl";
import { supabaseServerConfig } from "@/lib/server/superuserAuth";
import {
  personRecordScope,
  readPersonRecord,
  PersonRecordError,
} from "@/lib/server/adminPersonRecord";
export const dynamic = "force-dynamic";
async function rest(path: string, init: RequestInit = {}) {
  const { url } = supabaseServerConfig(),
    headers = serviceHeaders();
  if (!headers) throw new Error("Record store unavailable.");
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: { ...headers, Prefer: "return=representation" },
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    if (String(body.message).includes("changed. Reload"))
      throw new PersonRecordError(409, body.message);
    throw new Error("Unable to complete the record operation.");
  }
  return response.json();
}
async function context(request: NextRequest, role: string) {
  const ctx = await resolveAccess(request);
  if (!ctx) throw new PersonRecordError(401, "Sign in to view this record.");
  if (!ctx.allowedHubs.includes("admin") || !canUseAdminRoleContext(ctx, role))
    throw new PersonRecordError(403, "Admin role access denied.");
  const tenant = ctx.adminScope?.tenantId || ctx.person?.tenant_id;
  const orgs = ctx.adminScope
    ? [ctx.adminScope.organizationId]
    : [
        ...new Set(
          ctx.roles
            .filter((r) => r.scope.organization_id)
            .map((r) => r.scope.organization_id!),
        ),
      ];
  if (!tenant || !orgs.length)
    throw new PersonRecordError(403, "Organization context required.");
  return { ctx, tenant, orgs };
}
const failure = (e: unknown) =>
  NextResponse.json(
    { error: e instanceof Error ? e.message : "Record operation failed." },
    { status: e instanceof PersonRecordError ? e.status : 500 },
  );
export async function GET(request: NextRequest) {
  try {
    const role = request.nextUrl.searchParams.get("role") || "org_admin";
    const { ctx, tenant, orgs } = await context(request, role);
    return NextResponse.json(
      await readPersonRecord(
        rest,
        ctx,
        role,
        tenant,
        orgs,
        request.nextUrl.searchParams.get("personId") || "",
      ),
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: NextRequest) {
  try {
    const body = await request.json(),
      role = String(body.role || "org_admin");
    const { ctx, tenant, orgs } = await context(request, role);
    if (
      !hasAdminContextPermission(ctx, role, "record.update") ||
      !["org_admin", "registrar", "team_manager"].includes(role)
    )
      throw new PersonRecordError(403, "Profile editing denied.");
    const base = await personRecordScope(
      rest,
      ctx,
      role,
      tenant,
      orgs,
      String(body.personId || ""),
    );
    if (
      !body.changes ||
      typeof body.changes !== "object" ||
      Array.isArray(body.changes)
    )
      throw new PersonRecordError(400, "Changes are required.");
    if (body.section === "emergency") {
      if (!base.athlete)
        throw new PersonRecordError(400, "Athlete record required.");
      if (
        !body.contactId &&
        !hasAdminContextPermission(ctx, role, "record.create")
      )
        throw new PersonRecordError(403, "Contact creation denied.");
      if (body.contactId && !/^[0-9a-f-]{36}$/i.test(body.contactId))
        throw new PersonRecordError(400, "Invalid contact record.");
      const keys = [
        "name",
        "relationship",
        "phone_primary",
        "phone_secondary",
        "email",
      ];
      if (
        !Object.keys(body.changes).length ||
        Object.entries(body.changes).some(
          ([k, v]) =>
            !keys.includes(k) ||
            (v !== null && typeof v !== "string") ||
            (typeof v === "string" && v.length > 1000),
        )
      )
        throw new PersonRecordError(400, "Invalid contact fields.");
      const row = await rest("rpc/admin_save_emergency_contact", {
        method: "POST",
        body: JSON.stringify({
          p_tenant: tenant,
          p_athlete: base.athlete.id,
          p_contact: body.contactId || null,
          p_actor_user: ctx.user.id,
          p_actor_person: ctx.person?.id || null,
          p_expected_updated_at: body.expectedUpdatedAt || null,
          p_changes: body.changes,
        }),
      });
      return NextResponse.json({ ok: true, row });
    }
    const medical = body.section === "medical";
    if (
      medical &&
      (role !== "org_admin" ||
        !base.athlete ||
        orgs.length !== 1 ||
        !hasAdminContextPermission(ctx, role, "record.read"))
    )
      throw new PersonRecordError(
        403,
        "Medical editing requires Organization Administrator in a single organization.",
      );
    if (!medical && !["profile", "contact", "identity"].includes(body.section))
      throw new PersonRecordError(400, "Unknown record section.");
    const allowed = medical
      ? [
          "allergies",
          "conditions",
          "medications",
          "participation_restrictions",
          "emergency_instructions",
          "reviewed_on",
        ]
      : body.section === "contact"
        ? ["email", "phone"]
        : body.section === "identity"
          ? ["first_name", "last_name", "preferred_name", "birth_date"]
          : [
              "first_name",
              "last_name",
              "preferred_name",
              "birth_date",
              "email",
              "phone",
            ];
    const changes: Record<string, string | null> = {};
    for (const [key, value] of Object.entries(body.changes)) {
      if (
        !allowed.includes(key) ||
        (value !== null && typeof value !== "string")
      )
        throw new PersonRecordError(400, "Unsupported field or value.");
      if (typeof value === "string" && value.length > 10000)
        throw new PersonRecordError(400, "A field exceeds the maximum length.");
      changes[key] = value as string | null;
    }
    if (!Object.keys(changes).length)
      throw new PersonRecordError(400, "No changes supplied.");
    if (changes.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(changes.email))
      throw new PersonRecordError(400, "Enter a valid email address.");
    if (
      changes.birth_date &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(changes.birth_date) ||
        Number.isNaN(Date.parse(changes.birth_date)) ||
        Date.parse(changes.birth_date) > Date.now())
    )
      throw new PersonRecordError(400, "Enter a valid birth date.");
    const row = await rest(
      `rpc/${medical ? "admin_save_medical_profile" : "admin_save_person_profile"}`,
      {
        method: "POST",
        body: JSON.stringify({
          p_tenant: tenant,
          ...(medical
            ? { p_organization: orgs[0], p_athlete: base.athlete.id }
            : { p_person: base.person.id }),
          p_actor_user: ctx.user.id,
          p_actor_person: ctx.person?.id || null,
          p_expected_updated_at: body.expectedUpdatedAt || null,
          p_changes: changes,
        }),
      },
    );
    return NextResponse.json({ ok: true, row });
  } catch (e) {
    return failure(e);
  }
}
