export const rosterFields = [
  ["first_name", "First name *"],
  ["last_name", "Last name *"],
  ["birth_date", "Date of birth *"],
  ["preferred_name", "Preferred name"],
  ["athlete_number", "Athlete number"],
  ["email", "Athlete email"],
  ["phone", "Athlete telephone"],
  ["team", "Squad / group"],
] as const;
export function parseRosterCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [],
    value = "",
    quoted = false,
    closed = false;
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          value += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else value += c;
      continue;
    }
    if (c === '"') {
      if (value || closed)
        throw Error("Unexpected quote in CSV. Export the file as CSV again.");
      quoted = true;
    } else if (c === "," || c === "\n" || c === "\r") {
      row.push(value.trim());
      value = "";
      closed = false;
      if (c !== ",") {
        if (row.some(Boolean)) rows.push(row);
        row = [];
        if (c === "\r" && text[i + 1] === "\n") i++;
      }
    } else {
      if (closed && c.trim())
        throw Error("Unexpected text after a quoted CSV field.");
      if (!closed) value += c;
    }
  }
  if (quoted) throw Error("CSV has an unclosed quoted field.");
  row.push(value.trim());
  if (row.some(Boolean)) rows.push(row);
  if (rows.length < 2)
    throw Error("CSV needs a header row and at least one athlete.");
  const headers = rows.shift()!;
  if (
    headers.some((h) => !h) ||
    new Set(headers.map((h) => h.toLowerCase())).size !== headers.length
  )
    throw Error("Every column needs a unique, non-empty header.");
  if (rows.length > 1000)
    throw Error("Import at most 1,000 athletes per file.");
  if (rows.some((r) => r.length !== headers.length))
    throw Error("A row has a different number of fields from the headers.");
  return { headers, rows };
}
export function csvDate(value: string, format: string) {
  if (!value) return "";
  if (format === "ymd") return value;
  const m = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!m) return value;
  return `${m[3]}-${(format === "mdy" ? m[1] : m[2]).padStart(2, "0")}-${(format === "mdy" ? m[2] : m[1]).padStart(2, "0")}`;
}
