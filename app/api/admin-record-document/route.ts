import { NextRequest, NextResponse } from "next/server";
import { recordAccess, recordRest } from "@/lib/server/adminRecordAccess";
import {
  hasAdminContextPermission as can,
  serviceHeaders,
} from "@/lib/server/accessControl";
import { supabaseServerConfig } from "@/lib/server/superuserAuth";
import { PersonRecordError } from "@/lib/server/adminPersonRecord";
import {
  canReadRecordDocuments,
  documentTypeFilter,
  registrarDocumentCodes,
} from "@/lib/server/adminDocumentPolicy";
export const dynamic = "force-dynamic";
const fail = (e: unknown) =>
  NextResponse.json(
    { error: e instanceof Error ? e.message : "Document action failed." },
    { status: e instanceof PersonRecordError ? e.status : 500 },
  );
export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams,
      role = q.get("role") || "org_admin",
      personId = q.get("personId") || "",
      { ctx, tenant } = await recordAccess(request, role, personId);
    if (!canReadRecordDocuments(ctx, role))
      throw new PersonRecordError(403, "Restricted document access denied.");
    const docId = q.get("id") || "";
    if (!/^[0-9a-f-]{36}$/i.test(docId))
      throw new PersonRecordError(400, "Document ID required.");
    const [doc] = await recordRest(
      `documents?select=id,title,storage_path,document_types!inner(code)&tenant_id=eq.${tenant}&owner_person_id=eq.${personId}&id=eq.${docId}${documentTypeFilter(role)}`,
    );
    if (!doc) throw new PersonRecordError(404, "Document not found.");
    if (!doc.storage_path?.startsWith(`athlete-records/${tenant}/${personId}/`))
      throw new PersonRecordError(
        409,
        "This document uses a legacy storage location and cannot yet be opened here.",
      );
    const { url } = supabaseServerConfig();
    const r = await fetch(`${url}/storage/v1/object/sign/${doc.storage_path}`, {
      method: "POST",
      headers: serviceHeaders()!,
      body: JSON.stringify({ expiresIn: 60 }),
      cache: "no-store",
    });
    const j = await r.json();
    if (!r.ok)
      throw new PersonRecordError(502, "Unable to open this stored document.");
    return NextResponse.json({ url: `${url}/storage/v1${j.signedURL}` });
  } catch (e) {
    return fail(e);
  }
}
export async function POST(request: NextRequest) {
  try {
    if (request.headers.get("content-type")?.includes("application/json")) {
      const b = await request.json(),
        role = String(b.role || "org_admin"),
        personId = String(b.personId || "");
      const { ctx, tenant } = await recordAccess(request, role, personId);
      if (
        !canReadRecordDocuments(ctx, role) ||
        !can(ctx, role, "record.update")
      )
        throw new PersonRecordError(403, "Document review denied.");
      if (
        !/^[0-9a-f-]{36}$/i.test(b.id || "") ||
        !Number.isInteger(b.expectedVersion) ||
        !["verified", "rejected", "pending"].includes(b.status) ||
        !String(b.reason || "").trim()
      )
        throw new PersonRecordError(
          400,
          "Document, version, decision and reason are required.",
        );
      return NextResponse.json(
        await recordRest("rpc/admin_review_person_document", {
          method: "POST",
          body: JSON.stringify({
            p_tenant: tenant,
            p_person: personId,
            p_document: b.id,
            p_actor_user: ctx.user.id,
            p_actor_person: ctx.person?.id || null,
            p_role: role,
            p_expected_version: b.expectedVersion,
            p_expected_status: b.expectedStatus ?? null,
            p_status: b.status,
            p_reason: String(b.reason).trim(),
          }),
        }),
      );
    }
    const form = await request.formData(),
      role = String(form.get("role") || "org_admin"),
      personId = String(form.get("personId") || ""),
      { ctx, tenant } = await recordAccess(request, role, personId);
    if (!canReadRecordDocuments(ctx, role) || !can(ctx, role, "record.create"))
      throw new PersonRecordError(403, "Document upload denied.");
    const file = form.get("file"),
      title = String(form.get("title") || "").trim(),
      type = String(form.get("documentTypeId") || "");
    if (
      !(file instanceof File) ||
      file.size === 0 ||
      file.size > 10 * 1024 * 1024 ||
      !title ||
      title.length > 200 ||
      !["application/pdf", "image/png", "image/jpeg", "text/plain"].includes(
        file.type,
      )
    )
      throw new PersonRecordError(
        400,
        "Select a PDF, PNG, JPEG or text file up to 10 MB and enter a title.",
      );
    if (!/^[0-9a-f-]{36}$/i.test(type))
      throw new PersonRecordError(400, "Select a document type.");
    const types = await recordRest(
      `document_types?select=id,code&id=eq.${type}`,
    );
    if (!types.length)
      throw new PersonRecordError(400, "Document type unavailable.");
    if (role === "registrar" && !registrarDocumentCodes.includes(types[0].code))
      throw new PersonRecordError(
        403,
        "Document type outside Registrar authority.",
      );
    const documentId = crypto.randomUUID(),
      objectPath = `${tenant}/${personId}/${documentId}`,
      storagePath = `athlete-records/${objectPath}`,
      { url } = supabaseServerConfig(),
      h = serviceHeaders()!;
    const upload = await fetch(`${url}/storage/v1/object/${storagePath}`, {
      method: "POST",
      headers: { ...h, "Content-Type": file.type, "x-upsert": "false" },
      body: await file.arrayBuffer(),
    });
    if (!upload.ok)
      throw new PersonRecordError(502, "File could not be stored.");
    try {
      const row = await recordRest("rpc/admin_attach_person_document", {
        method: "POST",
        body: JSON.stringify({
          p_id: documentId,
          p_tenant: tenant,
          p_person: personId,
          p_actor_user: ctx.user.id,
          p_actor_person: ctx.person?.id || null,
          p_type: type,
          p_title: title,
          p_path: storagePath,
          p_mime: file.type,
        }),
      });
      return NextResponse.json({ ok: true, row });
    } catch (e) {
      // An interrupted response may follow a committed transaction. Never
      // remove an object until the database confirms no document references it.
      const committed = await recordRest(
        `documents?select=id&id=eq.${documentId}&tenant_id=eq.${tenant}&owner_person_id=eq.${personId}`,
      );
      if (committed.length)
        return NextResponse.json({ ok: true, row: committed[0] });
      await fetch(`${url}/storage/v1/object/athlete-records`, {
        method: "DELETE",
        headers: h,
        body: JSON.stringify({ prefixes: [objectPath] }),
      });
      throw e;
    }
  } catch (e) {
    return fail(e);
  }
}
