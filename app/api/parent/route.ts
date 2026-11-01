import { parentFailure } from "@/lib/server/parentResponse";
import { NextRequest, NextResponse } from "next/server";
import {
  parentAccess,
  requireParentGrant,
  parentRest,
} from "@/lib/server/parentAccess";
import { parentSnapshot } from "@/lib/server/parentSnapshot";
import { PersonRecordError } from "@/lib/server/adminPersonRecord";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export async function GET(req: NextRequest) {
  try {
    return NextResponse.json(await parentSnapshot(await parentAccess(req)), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return parentFailure(e);
  }
}
export async function POST(req: NextRequest) {
  try {
    const a = await parentAccess(req),
      b = await req.json();
    if (
      ![
        "respond",
        "request",
        "contact",
        "sign",
        "volunteer_join",
        "volunteer_cancel",
      ].includes(b.action)
    )
      throw new PersonRecordError(400, "Unsupported parent action.");
    for (const id of [b.athleteId, b.organizationId, b.id])
      if (!/^[0-9a-f-]{36}$/i.test(id || ""))
        throw new PersonRecordError(400, "Choose the athlete and club.");
    const scope =
      b.action === "respond"
        ? "parent.respond"
        : b.action === "sign"
          ? "parent.sign"
          : b.action === "contact"
            ? "parent.contact"
            : b.values?.kind === "billing"
              ? "parent.finance"
              : "parent.read";
    requireParentGrant(a, b.athleteId, scope);
    return NextResponse.json(
      await parentRest("rpc/parent_action", {
        method: "POST",
        body: JSON.stringify({
          p_user: a.ctx.user.id,
          p_person: a.personId,
          p_athlete: b.athleteId,
          p_org: b.organizationId,
          p_action: b.action,
          p_id: b.id,
          p_values: b.values || {},
        }),
      }),
    );
  } catch (e) {
    return parentFailure(e);
  }
}
