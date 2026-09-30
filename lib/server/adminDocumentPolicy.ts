import {
  hasAdminContextPermission as can,
  type AccessContext,
} from "./accessControl";
export const registrarDocumentCodes = [
  "IDENTITY",
  "REGISTRATION",
  "SAFE_SPORT",
  "BACKGROUND_CHECK",
  "WAIVER",
  "MEDIA_RELEASE",
];
export function canReadRecordDocuments(ctx: AccessContext, role: string) {
  return (
    ["org_admin", "registrar"].includes(role) && can(ctx, role, "record.read")
  );
}
export function documentTypeFilter(role: string) {
  return role === "registrar"
    ? `&document_types.code=in.(${registrarDocumentCodes.join(",")})`
    : "";
}
