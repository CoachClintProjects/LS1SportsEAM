// Decimal arithmetic for reports. Never sum money using floating-point numbers.
export function cents(value: string | number): bigint {
  const s = String(value),
    m = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(s);
  if (!m) throw new Error("Invalid monetary amount.");
  return (
    (m[1] ? -BigInt(1) : BigInt(1)) *
    (BigInt(m[2]) * BigInt(100) + BigInt((m[3] || "").padEnd(2, "0")))
  );
}
export function decimal(value: bigint): string {
  const a = value < BigInt(0) ? -value : value;
  return `${value < BigInt(0) ? "-" : ""}${a / BigInt(100)}.${String(a % BigInt(100)).padStart(2, "0")}`;
}
export function ledgerCsv(rows: (string | number)[][]): string {
  return rows
    .map((row) =>
      row
        .map((value) => {
          let v = String(value);
          if (
            /^[=+@\t\r]/.test(v) ||
            (/^-.*/.test(v) && !/^-[0-9]+(?:\.[0-9]+)?$/.test(v))
          )
            v = "'" + v;
          return '"' + v.replaceAll('"', '""') + '"';
        })
        .join(","),
    )
    .join("\r\n");
}
