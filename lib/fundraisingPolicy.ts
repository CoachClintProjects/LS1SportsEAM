import { cents, decimal } from "./client/ledgerAmounts";
export const fundraisingBoundary =
  "[DENY: ERR-801: INSUFFICIENT ACCESS TIER - FUNDRAISING COORDINATOR RESTRICTED FROM GENERAL_FINANCE/LEASES/COMPLIANCE_FLAGS]";
export const campaignTypes = [
  "sponsorship",
  "grant",
  "team_drive",
  "restricted_gift",
];
export const commitmentTypes = [
  "sponsorship",
  "grant",
  "donation",
  "restricted_gift",
];
export function amount(value: unknown) {
  const text = String(value ?? "").trim();
  const n = cents(text);
  if (n < BigInt(0) || n > BigInt(99999999999))
    throw Error(
      "Enter an amount between 0.00 and 999,999,999.99 with at most two decimal places.",
    );
  return decimal(n);
}
export function dates(start: unknown, end: unknown) {
  const parse = (v: unknown) => {
    if (!v) return null;
    const s = String(v);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(s) ||
      !Number.isFinite(Date.parse(s)) ||
      new Date(s).toISOString().slice(0, 10) !== s
    )
      throw Error("Enter valid calendar dates.");
    return s;
  };
  const starts_on = parse(start),
    ends_on = parse(end);
  if (starts_on && ends_on && ends_on < starts_on)
    throw Error("The end date cannot precede the start date.");
  return { starts_on, ends_on };
}
export function campaignInput(b: Record<string, any>) {
  const name = String(b.name || "").trim(),
    code = String(b.code || "").trim(),
    currency = String(b.currency || "")
      .trim()
      .toUpperCase(),
    campaign_type = String(b.campaign_type || "");
  if (!name || name.length > 200 || !code || code.length > 60)
    throw Error("Enter a campaign name and code.");
  if (!["CAD", "USD", "EUR", "GBP", "AUD", "NZD"].includes(currency))
    throw Error("Select a supported tracking currency.");
  if (!campaignTypes.includes(campaign_type))
    throw Error("Select a campaign type.");
  return {
    name,
    code,
    currency,
    campaign_type,
    goal_amount: amount(b.goal_amount || "0"),
    ...dates(b.starts_on, b.ends_on),
  };
}
export function leadInput(b: Record<string, any>) {
  const counterparty_name = String(b.counterparty_name || "").trim(),
    commitment_type = String(b.commitment_type || ""),
    purpose = String(b.purpose || "").trim(),
    obligations = String(b.obligations || "").trim(),
    details = String(b.details || "").trim();
  if (
    !counterparty_name ||
    counterparty_name.length > 200 ||
    !commitmentTypes.includes(commitment_type)
  )
    throw Error("Enter a partner or donor name and a valid lead type.");
  if (
    purpose.length > 2000 ||
    obligations.length > 4000 ||
    details.length > 4000
  )
    throw Error("Shorten the purpose, obligations or notes.");
  if (commitment_type === "restricted_gift" && !purpose)
    throw Error("Record the donor’s specified purpose.");
  return {
    counterparty_name,
    commitment_type,
    amount: amount(b.amount || "0"),
    notes: JSON.stringify({
      workspace: "fundraising_chief",
      purpose,
      obligations,
      details,
    }),
  };
}
export function leadNotes(notes: string | null) {
  try {
    const value = JSON.parse(notes || "");
    if (value?.workspace === "fundraising_chief")
      return {
        purpose: String(value.purpose || ""),
        obligations: String(value.obligations || ""),
        details: String(value.details || ""),
      };
  } catch {}
  return { purpose: "", obligations: "", details: notes || "" };
}
export function totals(
  campaigns: { id: string; currency: string }[],
  leads: { campaign_id: string; amount: string | number; status: string }[],
) {
  const sums: Record<
    string,
    { prospects: bigint; pledged: bigint; recordedReceived: bigint }
  > = {};
  for (const lead of leads) {
    const campaign = campaigns.find((c) => c.id === lead.campaign_id);
    if (!campaign) continue;
    const code = campaign.currency.trim();
    sums[code] ??= {
      prospects: BigInt(0),
      pledged: BigInt(0),
      recordedReceived: BigInt(0),
    };
    const n = cents(lead.amount);
    if (lead.status === "prospect") sums[code].prospects += n;
    else if (lead.status === "committed") sums[code].pledged += n;
    else if (lead.status === "received") sums[code].recordedReceived += n;
  }
  return Object.entries(sums).map(([currency, v]) => ({
    currency,
    prospects: decimal(v.prospects),
    pledged: decimal(v.pledged),
    recordedReceived: decimal(v.recordedReceived),
  }));
}
