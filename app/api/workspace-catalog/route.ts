import { NextRequest, NextResponse } from "next/server";
import {
  canUseAdminRoleContext,
  hasAdminContextPermission,
  resolveAccess,
  serviceHeaders,
} from "@/lib/server/accessControl";
import { supabaseServerConfig } from "@/lib/server/superuserAuth";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveAccess(request);
    if (!ctx)
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    const hub = request.nextUrl.searchParams.get("hub"),
      role = request.nextUrl.searchParams.get("role") || "org_admin",
      kind = request.nextUrl.searchParams.get("kind");
    if (
      !["admin", "coach"].includes(hub || "") ||
      !ctx.allowedHubs.includes(hub!) ||
      (hub === "admin" && !canUseAdminRoleContext(ctx, role))
    )
      return NextResponse.json(
        {
          error:
            "This catalog is available to authorized Admin and Coach roles.",
        },
        { status: 403 },
      );
    const tenant = ctx.adminScope?.tenantId || ctx.person?.tenant_id;
    if (!tenant)
      return NextResponse.json(
        { error: "Organization context required." },
        { status: 403 },
      );
    if (!["automations", "marketplace"].includes(kind || ""))
      return NextResponse.json({ error: "Unknown catalog." }, { status: 400 });
    if (
      kind === "automations" &&
      hub === "admin" &&
      !hasAdminContextPermission(ctx, role, "workflow.execute")
    )
      return NextResponse.json(
        { error: "Workflow access is not granted to this role." },
        { status: 403 },
      );
    const { url } = supabaseServerConfig(),
      h = serviceHeaders();
    if (!h) throw new Error("Catalog unavailable.");
    const path =
      kind === "automations"
        ? `workflow_definitions?select=id,code,name,version,status&tenant_id=eq.${tenant}&order=name.asc`
        : `integration_definitions?select=id,code,name,description,integration_type,is_active&tenant_id=eq.${tenant}&is_active=eq.true&order=name.asc`;
    const r = await fetch(`${url}/rest/v1/${path}`, {
      headers: h,
      cache: "no-store",
    });
    if (!r.ok) throw new Error("Unable to load the catalog.");
    return NextResponse.json({ rows: await r.json() });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Catalog unavailable." },
      { status: 500 },
    );
  }
}
