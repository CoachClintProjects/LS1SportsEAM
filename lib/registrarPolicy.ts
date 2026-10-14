export const registrarBoundary =
  "[DENY: ERR-501: INSUFFICIENT ACCESS TIER - REGISTRAR ACCOUNT RESTRICTED FROM LEASES/FINANCE]";
export const registrarSections = ["registrar", "roster"];
export const registrarCommands = [
  "create-registration",
  "update-registration-status",
  "onboard-athlete",
];
export function currentIdentityEvidence(
  doc: { verification_status: string; expires_at?: string | null },
  now = Date.now(),
) {
  return (
    doc.verification_status === "verified" &&
    (!doc.expires_at || Date.parse(doc.expires_at) > now)
  );
}
