// Quote every field and neutralize formulas even after leading whitespace.
export function csvCell(value: unknown): string {
  let s = value == null ? "" : String(value).replace(/[\r\n]+$/g, "");
  if (/^[\s\uFEFF]*[=+\-@]/u.test(s) || /^[\t\r\n]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}
export function csvFile(headers: string[], rows: unknown[][]): string {
  return (
    "\uFEFF" +
    [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") +
    "\r\n"
  );
}
