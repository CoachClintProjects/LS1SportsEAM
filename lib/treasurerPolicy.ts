export const treasurerBoundary =
  "[DENY: ERR-401: INSUFFICIENT ACCESS TIER - TREASURER RESTRICTED FROM LEASE ASSIGNMENTS/COMPETITION FIXED STRUCTURES/COMPLIANCE FLAGS]";
export const treasurerCommands = [
  "create-legal-entity",
  "create-customer",
  "create-billing-account",
  "create-invoice",
  "record-payment",
  "issue-invoice-credit",
];
export function cashPacket(values: Record<string, unknown>) {
  const counts = [20, 10, 5].map((unit) => {
    const raw = String(
      (values.denominations as Record<string, unknown> | undefined)?.[unit] ??
        "",
    );
    if (!/^\d{1,7}$/.test(raw))
      throw new Error("Enter whole, non-negative note counts.");
    return Number(raw);
  });
  const total = counts[0] * 20 + counts[1] * 10 + counts[2] * 5;
  const recipient = String(values.handoff_to || "").trim();
  if (total <= 0 || values.handoff_confirmed !== true || recipient.length < 3)
    throw new Error("Confirm the counted cash handoff and name the recipient.");
  return {
    amount: total.toFixed(2),
    note: `Cash packet: 20 x ${counts[0]}, 10 x ${counts[1]}, 5 x ${counts[2]}; counted total ${total.toFixed(2)}; handed to ${recipient.slice(0, 200)}.`,
  };
}
