export const volunteerBoundary =
  "[DENY: ERR-301: INSUFFICIENT ACCESS TIER - VOLUNTEER COORDINATOR RESTRICTED FROM FINANCE/LEASES/BRACKET_MUTATIONS]";
export type Credential = {
  credential_type: string;
  status: string;
  verification_status: string;
  issued_on: string | null;
  expires_on: string | null;
};
export type VolunteerRole = {
  certification_required: boolean;
  metadata: Record<string, unknown>;
};
export function clearance(
  role: VolunteerRole | undefined,
  credentials: Credential[],
  through: string,
  now = Date.now(),
) {
  if (!role)
    return {
      ok: false,
      reason: "[UNVETTED WORKER BLOCKED] Volunteer role not configured.",
    };
  const types = role.metadata?.required_credential_types;
  const required = Array.isArray(types)
    ? types.filter((x): x is string => typeof x === "string" && !!x.trim())
    : [];
  if (
    (role.certification_required || role.metadata?.restricted_zone === true) &&
    !required.length
  )
    return {
      ok: false,
      reason:
        "[UNVETTED WORKER BLOCKED] Required screening types have not been configured.",
    };
  const end = Date.parse(through);
  if (!Number.isFinite(end))
    return {
      ok: false,
      reason: "Shift end time is required before checking clearance.",
    };
  const missing = required.filter(
    (type) =>
      !credentials.some(
        (c) =>
          c.credential_type === type &&
          ["active", "valid", "verified"].includes(c.status.toLowerCase()) &&
          c.verification_status === "verified" &&
          !!c.issued_on &&
          Date.parse(c.issued_on) <= now &&
          !!c.expires_on &&
          Date.parse(c.expires_on + "T23:59:59.999Z") >= Math.max(end, now),
      ),
  );
  return {
    ok: !missing.length,
    reason: missing.length
      ? "[UNVETTED WORKER BLOCKED] Missing or expired: " + missing.join(", ")
      : required.length
        ? "Required credentials current through shift end."
        : "No credential requirements configured for this role.",
  };
}
export function shiftInput(input: Record<string, unknown>) {
  const title = String(input.title || "").trim(),
    start = String(input.starts_at || ""),
    end = String(input.ends_at || ""),
    capacity = Number(input.capacity);
  if (!title || title.length > 200)
    throw Error("Enter a shift name of at most 200 characters.");
  if (
    !Number.isFinite(Date.parse(start)) ||
    !Number.isFinite(Date.parse(end)) ||
    Date.parse(end) <= Date.parse(start)
  )
    throw Error("Enter valid shift times with the end after the start.");
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 1000)
    throw Error("Enter between 1 and 1000 worker places.");
  return {
    title,
    starts_at: new Date(start).toISOString(),
    ends_at: new Date(end).toISOString(),
    capacity,
  };
}
