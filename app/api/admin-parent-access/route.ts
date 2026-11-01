import { NextRequest, NextResponse } from "next/server";
import { recordAccess, recordRest } from "@/lib/server/adminRecordAccess";
import { hasAdminContextPermission as can } from "@/lib/server/accessControl";
import { PersonRecordError } from "@/lib/server/adminPersonRecord";
import { parentFailure } from "@/lib/server/parentResponse";
export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    if (b.role !== "org_admin")
      throw new PersonRecordError(403, "Organization Admin is required.");
    const { ctx, tenant, orgs, base } = await recordAccess(
      req,
      b.role,
      b.personId,
    );
    if (
      !base.athlete ||
      orgs.length !== 1 ||
      !can(ctx, b.role, "role_assignments.manage")
    )
      throw new PersonRecordError(
        403,
        "Parent access administration is not permitted.",
      );
    return NextResponse.json(
      await recordRest("rpc/admin_parent_portal_access", {
        method: "POST",
        body: JSON.stringify({
          p_tenant: tenant,
          p_org: orgs[0],
          p_athlete: base.athlete.id,
          p_guardian: b.guardianId,
          p_actor_user: ctx.user.id,
          p_actor_person: ctx.person?.id || null,
          p_scopes: b.scopes,
        }),
      }),
    );
  } catch (e) {
    return parentFailure(e);
  }
}
