import { NextRequest, NextResponse } from "next/server";
import { resolveAccess, serviceHeaders } from "@/lib/server/accessControl";
import { supabaseServerConfig } from "@/lib/server/superuserAuth";
export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) {
  try {
    const ctx = await resolveAccess(request);
    if (!ctx)
      return NextResponse.json(
        { error: "Sign in to submit a ticket." },
        { status: 401 },
      );
    if (!ctx.person)
      return NextResponse.json(
        { error: "A linked person record is required to submit a ticket." },
        { status: 403 },
      );
    const b = await request.json();
    if (
      !/^[0-9a-f-]{36}$/i.test(b.id || "") ||
      typeof b.title !== "string" ||
      !b.title.trim() ||
      b.title.length > 200 ||
      typeof b.description !== "string" ||
      !b.description.trim() ||
      b.description.length > 10000 ||
      !["low", "normal", "high", "critical"].includes(b.severity)
    )
      return NextResponse.json(
        { error: "Enter a title, description and valid priority." },
        { status: 400 },
      );
    const { url } = supabaseServerConfig(),
      h = serviceHeaders();
    if (!h) throw new Error("Support store unavailable.");
    const r = await fetch(`${url}/rest/v1/rpc/submit_support_ticket`, {
      method: "POST",
      headers: h,
      body: JSON.stringify({
        p_id: b.id,
        p_tenant: ctx.person.tenant_id,
        p_person: ctx.person.id,
        p_title: b.title,
        p_description: b.description,
        p_severity: b.severity,
        p_context: typeof b.page === "string" ? b.page.slice(0, 1000) : "",
      }),
      cache: "no-store",
    });
    if (!r.ok)
      throw new Error("Ticket could not be saved. Retry your submission.");
    return NextResponse.json(await r.json());
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Ticket submission failed." },
      { status: 500 },
    );
  }
}
