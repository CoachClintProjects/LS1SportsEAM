import { NextRequest, NextResponse } from "next/server";
import { resolveAccess, serviceHeaders } from "@/lib/server/accessControl";
import { supabaseServerConfig } from "@/lib/server/superuserAuth";
export const dynamic = "force-dynamic";
async function handle(request: NextRequest, markRead: boolean) {
  const ctx = await resolveAccess(request);
  if (!ctx?.person)
    return NextResponse.json(
      { error: "Sign in with a linked person record." },
      { status: 401 },
    );
  const headers = serviceHeaders(),
    { url } = supabaseServerConfig();
  if (!headers)
    return NextResponse.json(
      { error: "Notifications are unavailable." },
      { status: 503 },
    );
  const base = `tenant_id=eq.${ctx.person.tenant_id}&recipient_person_id=eq.${ctx.person.id}`;
  let path = `notification_events?select=id,title,body,created_at,read_at&${base}&order=created_at.desc,id.desc&limit=50`;
  if (markRead) {
    const b = await request.json();
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        b.id || "",
      )
    )
      return NextResponse.json(
        { error: "Select a notification." },
        { status: 400 },
      );
    path = `notification_events?${base}&id=eq.${b.id}&read_at=is.null`;
  }
  const r = await fetch(`${url}/rest/v1/${path}`, {
    method: markRead ? "PATCH" : "GET",
    headers,
    cache: "no-store",
    ...(markRead
      ? { body: JSON.stringify({ read_at: new Date().toISOString() }) }
      : {}),
  });
  if (!r.ok)
    return NextResponse.json(
      { error: "Unable to load or update notifications." },
      { status: 503 },
    );
  return NextResponse.json(markRead ? { ok: true } : await r.json(), {
    headers: { "Cache-Control": "no-store" },
  });
}
export async function GET(r: NextRequest) {
  try {
    return await handle(r, false);
  } catch {
    return NextResponse.json(
      { error: "Notifications are unavailable." },
      { status: 503 },
    );
  }
}
export async function POST(r: NextRequest) {
  try {
    return await handle(r, true);
  } catch {
    return NextResponse.json(
      { error: "Unable to update notification." },
      { status: 503 },
    );
  }
}
