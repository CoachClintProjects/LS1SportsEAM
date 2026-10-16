export const equipmentRole = "facilities_equipment_manager";
export const equipmentBoundary =
  "[DENY: ERR-101: INSUFFICIENT ACCESS TIER - FACILITIES MANAGER RESTRICTED FROM BANKING_TOKENS/GOVERNANCE_BYLAWS/COMPLIANCE_STRATEGY/SCHEDULING]";
export const equipmentActions = [
  "create_item",
  "create_bin",
  "receive",
  "scrap",
  "create_crate",
  "safety_pass",
  "return_crate",
  "maintenance",
  "reschedule",
  "shutdown",
  "blackout",
  "complete_maintenance",
  "reopen",
  "release_hold",
] as const;
export function equipmentPermission(action: string) {
  return [
    "create_item",
    "create_bin",
    "receive",
    "create_crate",
    "maintenance",
    "shutdown",
    "blackout",
  ].includes(action)
    ? "record.create"
    : "record.update";
}
export function timeWindow(start: string, end: string) {
  const a = Date.parse(start),
    b = Date.parse(end);
  if (
    !Number.isFinite(a) ||
    !Number.isFinite(b) ||
    b <= a ||
    b - a > 366 * 86400000
  )
    throw new Error("Enter a valid time window of at most one year.");
  return {
    starts_at: new Date(a).toISOString(),
    ends_at: new Date(b).toISOString(),
  };
}
