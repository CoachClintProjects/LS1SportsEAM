export type Account = {
  id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  opening: string;
  debit: string;
  credit: string;
  closing: string;
};
export function cents(v: string): bigint {
  if (!/^-?\d+(\.\d{1,2})?$/.test(v)) throw new Error("Invalid posted amount");
  const negative = v.startsWith("-"),
    [a, b = ""] = v.replace("-", "").split(".");
  return (
    (BigInt(a) * BigInt(100) + BigInt(b.padEnd(2, "0"))) *
    (negative ? -BigInt(1) : BigInt(1))
  );
}
export function money(v: bigint): string {
  const a = v < BigInt(0) ? -v : v;
  return (
    (v < BigInt(0) ? "-" : "") +
    a / BigInt(100) +
    "." +
    (a % BigInt(100)).toString().padStart(2, "0")
  );
}
export function reports(rows: Account[]) {
  let income = BigInt(0),
    expense = BigInt(0),
    assets = BigInt(0),
    liabilities = BigInt(0),
    equity = BigInt(0),
    earnings = BigInt(0),
    debit = BigInt(0),
    credit = BigInt(0);
  for (const r of rows) {
    const close = cents(r.closing),
      movement = cents(r.credit) - cents(r.debit),
      kind = r.account_type.toLowerCase();
    debit += close > BigInt(0) ? close : BigInt(0);
    credit += close < BigInt(0) ? -close : BigInt(0);
    if (["revenue", "income"].includes(kind)) {
      income += movement;
      earnings -= close;
    } else if (kind === "expense") {
      expense -= movement;
      earnings -= close;
    } else if (kind === "asset") assets += close;
    else if (kind === "liability") liabilities -= close;
    else if (kind === "equity") equity -= close;
    else throw new Error("Unclassified account type: " + r.account_type);
  }
  return {
    income: money(income),
    expense: money(expense),
    netIncome: money(income - expense),
    assets: money(assets),
    liabilities: money(liabilities),
    equity: money(equity),
    earnings: money(earnings),
    balanceDifference: money(assets - liabilities - equity - earnings),
    trialDebit: money(debit),
    trialCredit: money(credit),
    trialDifference: money(debit - credit),
  };
}
