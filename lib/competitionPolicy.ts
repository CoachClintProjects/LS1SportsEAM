export const competitionBoundary =
  "[DENY: ERR-601: INSUFFICIENT ACCESS TIER - COMPETITION MANAGER ACCOUNT RESTRICTED FROM STRUCTURE/LEASES/MEDICALS]";
export const competitionCommands = [
  "create-competition",
  "update-competition",
  "create-competition-event",
  "update-competition-event",
  "create-competition-entry",
  "update-competition-entry",
  "create-competition-deadline",
  "update-competition-deadline",
];
export function overlaps(
  start: string | null,
  end: string | null,
  otherStart: string | null,
  otherEnd: string | null,
) {
  if (!start || !otherStart) return false;
  const a = Date.parse(start),
    b = end ? Date.parse(end) : Infinity,
    c = Date.parse(otherStart),
    d = otherEnd ? Date.parse(otherEnd) : Infinity;
  return (
    Number.isFinite(a) && Number.isFinite(c) && b > a && d > c && a < d && c < b
  );
}
export function hasCurrentEligibility(
  record: { status: string; expires_at?: string | null } | null,
  now = Date.now(),
) {
  return (
    !!record &&
    ["eligible", "approved", "cleared"].includes(
      String(record.status).toLowerCase(),
    ) &&
    (!record.expires_at || Date.parse(record.expires_at) > now)
  );
}
export function staffingCoverage(
  requirements: {
    id: string;
    role_code: string;
    session_id?: string | null;
    required_count: number;
    active: boolean;
  }[],
  assignments: {
    requirement_id?: string | null;
    person_id?: string | null;
    role_code: string;
    session_id?: string | null;
    status: string;
  }[],
) {
  let required = 0,
    filled = 0;
  for (const r of requirements.filter((r) => r.active)) {
    required += r.required_count;
    const people = new Set(
      assignments
        .filter(
          (a) =>
            a.person_id &&
            ["active", "assigned", "confirmed", "checked_in"].includes(
              a.status,
            ) &&
            a.role_code === r.role_code &&
            (r.session_id ? a.session_id === r.session_id : true) &&
            a.requirement_id === r.id,
        )
        .map((a) => a.person_id),
    );
    filled += Math.min(r.required_count, people.size);
  }
  return { required, filled, ratio: required > 0 ? filled / required : null };
}
