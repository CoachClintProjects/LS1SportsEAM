"use client";
import { useState } from "react";
import { authenticatedFetch } from "@/lib/client/authenticatedFetch";
import { parseRosterCsv, rosterFields, csvDate } from "@/lib/rosterCsv";
import { AdminDrawerShell } from "./AdminDrawerShell";
const control =
  "mt-1 w-full rounded border border-neutral-600 bg-[#161B22] p-2";
export default function RosterImport({
  role,
  data,
  onClose,
  onSaved,
}: {
  role: string;
  data: any;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [file, setFile] = useState(""),
    [csv, setCsv] = useState<ReturnType<typeof parseRosterCsv> | null>(null),
    [mapping, setMapping] = useState<Record<string, string>>({}),
    [team, setTeam] = useState(""),
    [org, setOrg] = useState(
      data.controls.organizations.length === 1
        ? data.controls.organizations[0].id
        : "",
    ),
    [format, setFormat] = useState("ymd"),
    [preview, setPreview] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [result, setResult] = useState<any>(null);
  const mapped = () =>
    csv!.rows.map((row) => {
      const x = Object.fromEntries(
        rosterFields.map(([k]) => [
          k,
          mapping[k] === undefined || mapping[k] === ""
            ? ""
            : row[Number(mapping[k])],
        ]),
      );
      x.team = x.team || team;
      x.birth_date = csvDate(x.birth_date, format);
      return x;
    });
  async function run(action: "preview" | "commit") {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const r = await authenticatedFetch("/api/admin-roster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          role,
          organizationId: org,
          sourceFile: file,
          rows: mapped(),
        }),
      });
      const j = await r.json();
      if (!r.ok) throw Error(j.error);
      if ((action === "commit" && j.ok) || j.alreadyImported) {
        setResult(j);
        await onSaved();
      } else setPreview(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <AdminDrawerShell title="Import roster CSV" busy={busy} onClose={onClose}>
      <p className="mb-4 text-sm text-neutral-300">
        Upload a CSV exported from your previous platform, match its columns,
        then review before importing. Existing athletes are skipped; their
        information is never overwritten.
      </p>
      {error && (
        <p role="alert" className="my-3 text-red-300">
          {error}
        </p>
      )}
      {result ? (
        <div role="status">
          <h3 className="text-lg font-semibold">
            {result.alreadyImported
              ? "This file was already imported"
              : "Import complete"}
          </h3>
          <p>
            {result.created} athletes added · {result.skipped} existing records
            skipped.
          </p>
          <button
            onClick={onClose}
            className="mt-4 rounded bg-emerald-700 px-4 py-2"
          >
            Return to roster
          </button>
        </div>
      ) : (
        <fieldset disabled={busy} className="space-y-4">
          <label className="block">
            CSV file
            <input
              type="file"
              accept=".csv,text/csv"
              className={control}
              onChange={async (e) => {
                const f = e.target.files?.[0];
                setPreview(null);
                setCsv(null);
                setError("");
                if (!f) return;
                try {
                  if (f.size > 2_000_000)
                    throw Error("Use a CSV smaller than 2 MB.");
                  const parsed = parseRosterCsv(await f.text());
                  setCsv(parsed);
                  setFile(f.name);
                  const aliases: Record<string, string[]> = {
                    first_name: ["firstname", "first", "givenname"],
                    last_name: ["lastname", "last", "surname"],
                    birth_date: ["dateofbirth", "dob", "birthdate"],
                    team: ["team", "squad", "group", "traininggroup"],
                    athlete_number: ["athletenumber", "memberid", "athleteid"],
                    email: ["email", "athleteemail"],
                    phone: ["phone", "telephone"],
                    preferred_name: ["preferredname", "nickname"],
                  };
                  setMapping(
                    Object.fromEntries(
                      rosterFields.map(([k]) => {
                        const index = parsed.headers.findIndex((h) =>
                          aliases[k]?.includes(
                            h.toLowerCase().replace(/[^a-z]/g, ""),
                          ),
                        );
                        return [k, index < 0 ? "" : String(index)];
                      }),
                    ),
                  );
                } catch (e) {
                  setError(
                    e instanceof Error ? e.message : "Unable to read CSV.",
                  );
                }
              }}
            />
          </label>
          {csv && (
            <>
              <p>
                {csv.rows.length} athletes · {csv.headers.length} columns
              </p>
              {data.controls.organizations.length > 1 && (
                <label className="block">
                  Club
                  <select
                    className={control}
                    value={org}
                    onChange={(e) => {
                      setOrg(e.target.value);
                      setTeam("");
                      setPreview(null);
                    }}
                  >
                    <option value="">Choose club</option>
                    {data.controls.organizations.map((o: any) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                {rosterFields.map(([key, label]) => (
                  <label key={key}>
                    {label}
                    <select
                      className={control}
                      value={mapping[key] || ""}
                      onChange={(e) => {
                        setMapping({ ...mapping, [key]: e.target.value });
                        setPreview(null);
                      }}
                    >
                      <option value="">
                        {key === "team"
                          ? "Use selected squad"
                          : "Do not import"}
                      </option>
                      {csv.headers.map((h, i) => (
                        <option key={i} value={i}>
                          {h} — {csv.rows[0][i]?.slice(0, 35)}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
              <label className="block">
                Dates in this file
                <select
                  className={control}
                  value={format}
                  onChange={(e) => {
                    setFormat(e.target.value);
                    setPreview(null);
                  }}
                >
                  <option value="ymd">YYYY-MM-DD</option>
                  <option value="mdy">MM/DD/YYYY</option>
                  <option value="dmy">DD/MM/YYYY</option>
                </select>
              </label>
              <label className="block">
                Squad for rows without a mapped squad
                <select
                  className={control}
                  value={team}
                  onChange={(e) => {
                    setTeam(e.target.value);
                    setPreview(null);
                  }}
                >
                  <option value="">Choose a squad</option>
                  {data.controls.teams
                    .filter(
                      (t: any) =>
                        t.organization_id === org && t.status === "active",
                    )
                    .map((t: any) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                </select>
              </label>
              <button
                disabled={
                  !org ||
                  ["first_name", "last_name", "birth_date"].some(
                    (k) => !mapping[k],
                  )
                }
                onClick={() => run("preview")}
                className="rounded bg-blue-700 px-4 py-2 disabled:opacity-40"
              >
                {busy ? "Checking…" : "Preview import"}
              </button>
              {preview && (
                <div>
                  <h3 className="font-semibold">Review import</h3>
                  <p className="text-sm">
                    {
                      preview.rows.filter((r: any) => r.status === "create")
                        .length
                    }{" "}
                    new ·{" "}
                    {
                      preview.rows.filter((r: any) => r.status === "skip")
                        .length
                    }{" "}
                    existing · {preview.errors.length} errors
                  </p>
                  <div className="my-3 max-h-72 overflow-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr>
                          <th>CSV row</th>
                          <th>Athlete</th>
                          <th>Date of birth</th>
                          <th>Squad</th>
                          <th>Result</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.rows.map((r: any) => (
                          <tr key={r.row}>
                            <td>{r.row}</td>
                            <td>{r.name}</td>
                            <td className="whitespace-nowrap">
                              {r.values.birth_date}
                            </td>
                            <td>
                              {data.controls.teams.find(
                                (t: any) => t.id === r.team_id,
                              )?.name || r.values.team}
                            </td>
                            <td>
                              {preview.errors.find((e: any) => e.row === r.row)
                                ?.error ||
                                (r.status === "skip"
                                  ? "Existing — skip"
                                  : "Add athlete")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {!preview.ok && (
                    <p className="text-amber-200">
                      Fix the listed rows in your CSV and upload again. Nothing
                      has been imported.
                    </p>
                  )}
                  <button
                    disabled={
                      !preview.ok ||
                      !preview.rows.some((r: any) => r.status === "create")
                    }
                    onClick={() => run("commit")}
                    className="rounded bg-emerald-700 px-4 py-2 disabled:opacity-40"
                  >
                    {busy ? "Importing…" : "Import new athletes"}
                  </button>
                </div>
              )}
            </>
          )}
        </fieldset>
      )}
    </AdminDrawerShell>
  );
}
