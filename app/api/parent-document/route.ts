import { NextRequest, NextResponse } from "next/server";
import {
  parentAccess,
  requireParentGrant,
  parentRest as rest,
} from "@/lib/server/parentAccess";
import { serviceHeaders } from "@/lib/server/accessControl";
import { supabaseServerConfig } from "@/lib/server/superuserAuth";
import { PersonRecordError } from "@/lib/server/adminPersonRecord";
import { parentFailure } from "@/lib/server/parentResponse";
const codes = "IDENTITY,REGISTRATION,WAIVER,MEDIA_RELEASE";
export async function GET(req: NextRequest) {
  try {
    const a = await parentAccess(req),
      athleteId = req.nextUrl.searchParams.get("athleteId") || "",
      id = req.nextUrl.searchParams.get("id") || "";
    const g = a.grants.find(
      (g: any) =>
        g.athlete_id === athleteId &&
        g.authority_scopes.includes("parent.documents"),
    );
    if (!g || !/^[0-9a-f-]{36}$/i.test(id))
      throw new PersonRecordError(403, "Document access denied.");
    const [athlete] = await rest(
      `athletes?select=person_id&id=eq.${athleteId}`,
    );
    const [doc] = await rest(
      `documents?select=id,storage_path,document_types!inner(code)&id=eq.${id}&tenant_id=eq.${g.tenant_id}&owner_person_id=eq.${athlete.person_id}&document_types.code=in.(${codes})`,
    );
    if (
      !doc?.storage_path?.startsWith(
        `athlete-records/${g.tenant_id}/${athlete.person_id}/`,
      )
    )
      throw new PersonRecordError(404, "Document file unavailable.");
    const { url } = supabaseServerConfig();
    const r = await fetch(`${url}/storage/v1/object/sign/${doc.storage_path}`, {
      method: "POST",
      headers: serviceHeaders()!,
      body: JSON.stringify({ expiresIn: 60 }),
    });
    const j = await r.json();
    if (!r.ok) throw new PersonRecordError(502, "Unable to open document.");
    return NextResponse.json({ url: `${url}/storage/v1${j.signedURL}` });
  } catch (e) {
    return parentFailure(e);
  }
}
export async function POST(req: NextRequest) {
  try {
    const a = await parentAccess(req),
      form = await req.formData(),
      athleteId = String(form.get("athleteId") || ""),
      g = requireParentGrant(a, athleteId, "parent.documents"),
      file = form.get("file"),
      title = String(form.get("title") || "").trim(),
      type = String(form.get("documentTypeId") || "");
    if (
      !(file instanceof File) ||
      !file.size ||
      file.size > 4 * 1024 * 1024 ||
      !["application/pdf", "image/png", "image/jpeg"].includes(file.type) ||
      !title ||
      title.length > 200 ||
      !/^[0-9a-f-]{36}$/i.test(type)
    )
      throw new PersonRecordError(
        400,
        "Choose a PDF, PNG or JPEG up to 4 MB, title and document type.",
      );
    const [docType] = await rest(
      `document_types?select=id&id=eq.${type}&code=in.(${codes})`,
    );
    if (!docType)
      throw new PersonRecordError(403, "Document type not allowed.");
    const [athlete] = await rest(
      `athletes?select=person_id&id=eq.${athleteId}`,
    );
    const id = crypto.randomUUID(),
      path = `${g.tenant_id}/${athlete.person_id}/${id}`,
      storage = `athlete-records/${path}`,
      { url } = supabaseServerConfig(),
      headers = serviceHeaders()!;
    const r = await fetch(`${url}/storage/v1/object/${storage}`, {
      method: "POST",
      headers: { ...headers, "Content-Type": file.type, "x-upsert": "false" },
      body: await file.arrayBuffer(),
    });
    if (!r.ok) throw new PersonRecordError(502, "Document upload failed.");
    try {
      await rest("rpc/parent_attach_document", {
        method: "POST",
        body: JSON.stringify({
          p_user: a.ctx.user.id,
          p_person: a.personId,
          p_athlete: athleteId,
          p_id: id,
          p_type: type,
          p_title: title,
          p_path: storage,
          p_mime: file.type,
        }),
      });
      return NextResponse.json({ ok: true, id });
    } catch (e) {
      const linked = await rest(`documents?select=id&id=eq.${id}`);
      if (linked.length) return NextResponse.json({ ok: true, id });
      await fetch(`${url}/storage/v1/object/athlete-records`, {
        method: "DELETE",
        headers,
        body: JSON.stringify({ prefixes: [path] }),
      });
      throw e;
    }
  } catch (e) {
    return parentFailure(e);
  }
}
