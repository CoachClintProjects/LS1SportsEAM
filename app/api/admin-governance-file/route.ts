import { NextRequest, NextResponse } from "next/server";
import { governanceScope, governanceUuid } from "@/lib/server/adminGovernance";
import { recordRest as rest } from "@/lib/server/adminRecordAccess";
import { PersonRecordError } from "@/lib/server/adminPersonRecord";
import { serviceHeaders } from "@/lib/server/accessControl";
import { supabaseServerConfig } from "@/lib/server/superuserAuth";
export const dynamic = "force-dynamic";
const fail = (e: unknown) =>
  NextResponse.json(
    { error: e instanceof Error ? e.message : "File operation failed." },
    { status: e instanceof PersonRecordError ? e.status : 500 },
  );
export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams,
      { tenant, org } = await governanceScope(
        request,
        q.get("role") || "org_admin",
      );
    const id = q.get("id") || "",
      file = q.get("file") || "";
    if (!governanceUuid.test(id) || !governanceUuid.test(file))
      throw new PersonRecordError(400, "Record and file required.");
    const [record] = await rest(
      `organization_governance_records?select=id&id=eq.${id}&tenant_id=eq.${tenant}&organization_id=eq.${org}`,
    );
    if (!record) throw new PersonRecordError(404, "Record not found.");
    const [document] = await rest(
      `organization_governance_files?select=storage_path&id=eq.${file}&record_id=eq.${id}`,
    );
    if (
      !document?.storage_path?.startsWith(
        `governance-records/${tenant}/${org}/${id}/`,
      )
    )
      throw new PersonRecordError(404, "File not found.");
    const { url } = supabaseServerConfig();
    const r = await fetch(
      `${url}/storage/v1/object/sign/${document.storage_path}`,
      {
        method: "POST",
        headers: serviceHeaders()!,
        body: JSON.stringify({ expiresIn: 60 }),
        cache: "no-store",
      },
    );
    const j = await r.json();
    if (!r.ok) throw new PersonRecordError(502, "Unable to open file.");
    return NextResponse.json({ url: `${url}/storage/v1${j.signedURL}` });
  } catch (e) {
    return fail(e);
  }
}
export async function POST(request: NextRequest) {
  try {
    const form = await request.formData(),
      { ctx, tenant, org } = await governanceScope(
        request,
        String(form.get("role") || "org_admin"),
        "record.update",
      );
    const id = String(form.get("id") || ""),
      title = String(form.get("title") || "").trim(),
      version = Number(form.get("version")),
      file = form.get("file");
    if (
      !governanceUuid.test(id) ||
      !title ||
      title.length > 200 ||
      !Number.isInteger(version) ||
      !(file instanceof File) ||
      !file.size ||
      file.size > 10485760 ||
      !["application/pdf", "image/png", "image/jpeg", "text/plain"].includes(
        file.type,
      )
    )
      throw new PersonRecordError(
        400,
        "Select a PDF, image or text file up to 10 MB and enter a title.",
      );
    const [record] = await rest(
      `organization_governance_records?select=version&id=eq.${id}&tenant_id=eq.${tenant}&organization_id=eq.${org}`,
    );
    if (!record) throw new PersonRecordError(404, "Record not found.");
    if (record.version !== version)
      throw new PersonRecordError(
        409,
        "Record changed. Reload before uploading.",
      );
    const fileId = crypto.randomUUID(),
      path = `governance-records/${tenant}/${org}/${id}/${fileId}`,
      { url } = supabaseServerConfig();
    const upload = await fetch(`${url}/storage/v1/object/${path}`, {
      method: "POST",
      headers: {
        ...serviceHeaders()!,
        "Content-Type": file.type,
        "x-upsert": "false",
      },
      body: await file.arrayBuffer(),
    });
    if (!upload.ok) throw new PersonRecordError(502, "File upload failed.");
    try {
      const row = await rest("rpc/admin_governance_write", {
        method: "POST",
        body: JSON.stringify({
          p_tenant: tenant,
          p_org: org,
          p_actor_user: ctx.user.id,
          p_actor_person: ctx.person?.id || null,
          p_id: id,
          p_operation: "attach",
          p_expected_version: version,
          p_values: {
            file_id: fileId,
            title,
            storage_path: path,
            mime_type: file.type,
            size_bytes: file.size,
          },
          p_reason: "Uploaded governance evidence: " + title,
        }),
      });
      return NextResponse.json({ row });
    } catch (e) {
      // Never delete a successfully committed file after an ambiguous response.
      const linked = await rest(
        `organization_governance_files?select=id&id=eq.${fileId}&record_id=eq.${id}`,
      );
      if (linked.length) return NextResponse.json({ saved: true });
      await fetch(`${url}/storage/v1/object/governance-records`, {
        method: "DELETE",
        headers: serviceHeaders()!,
        body: JSON.stringify({
          prefixes: [`${tenant}/${org}/${id}/${fileId}`],
        }),
      });
      throw e;
    }
  } catch (e) {
    return fail(e);
  }
}
