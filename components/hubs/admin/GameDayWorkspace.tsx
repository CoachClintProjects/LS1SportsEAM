"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { authenticatedFetch } from "@/lib/client/authenticatedFetch";
import { AdminDrawerShell } from "./AdminDrawerShell";
const Planning = dynamic(() => import("./AdminCompetitionOperations"));
const Cashbox = dynamic(() => import("./CashboxAuthorizationDrawer"));
const Triage = dynamic(() => import("../superuser/TriageTaskHub"));
type Row = Record<string, any>;
const button =
  "rounded border border-[#30363D] bg-[#161B22] px-3 py-2 text-sm disabled:opacity-40";
const card = "rounded-xl border border-[#30363D] bg-[#161B22] p-4";
const titles: Record<string, string> = {
  "gd-home": "Today’s Tasks",
  "gd-venues": "Venue Lane Bookings",
  "gd-seeding": "Seed Race Brackets",
  "gd-officials": "Assign Deck Officials",
  "gd-protests": "Rule Protests & Jury",
  "gd-clocks": "Master Venue Clocks",
};
const date = (v: unknown) =>
  v ? new Date(String(v)).toLocaleString() : "Not recorded";
function Records({
  title,
  rows,
  columns,
}: {
  title: string;
  rows: Row[];
  columns: [string, (r: Row) => React.ReactNode][];
}) {
  const [page, setPage] = useState(0);
  const last = Math.max(0, Math.ceil(rows.length / 25) - 1),
    current = Math.min(page, last);
  return (
    <section className="space-y-3">
      <h3 className="font-semibold">
        {title} · {rows.length}
      </h3>
      {!rows.length ? (
        <p className="text-sm text-slate-400">No saved records.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  {columns.map(([label]) => (
                    <th className="border-b border-[#30363D] p-2" key={label}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(current * 25, current * 25 + 25).map((r) => (
                  <tr key={r.id}>
                    {columns.map(([label, render]) => (
                      <td
                        className="border-b border-[#30363D] p-2 align-top"
                        key={label}
                      >
                        {render(r)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-3">
            <button
              className={button}
              disabled={!current}
              onClick={() => setPage(current - 1)}
            >
              Previous
            </button>
            <span>
              {current + 1} / {last + 1}
            </span>
            <button
              className={button}
              disabled={current === last}
              onClick={() => setPage(current + 1)}
            >
              Next
            </button>
          </div>
        </>
      )}
    </section>
  );
}
export default function GameDayWorkspace() {
  const [competitionPage, setCompetitionPage] = useState(0);
  const params = useSearchParams(),
    view = params.get("view") || "gd-home";
  const [data, setData] = useState<Row | null>(null),
    [detail, setDetail] = useState<Row | null>(null),
    [selected, setSelected] = useState(""),
    [error, setError] = useState(""),
    [detailError, setDetailError] = useState(""),
    [loading, setLoading] = useState(false),
    [cashbox, setCashbox] = useState(false),
    [planning, setPlanning] = useState(false);
  const sequence = useRef(0),
    detailSequence = useRef(0);
  const load = useCallback(async () => {
    const seq = ++sequence.current;
    setLoading(true);
    try {
      const r = await authenticatedFetch("/api/admin-game-day", {
        cache: "no-store",
      });
      const j = await r.json();
      if (!r.ok) throw Error(j.error);
      if (seq === sequence.current) {
        setData(j);
        setError("");
      }
    } catch (e) {
      if (seq === sequence.current) {
        setData(null);
        setError(
          e instanceof Error ? e.message : "Competition records unavailable.",
        );
      }
    } finally {
      if (seq === sequence.current) setLoading(false);
    }
  }, []);
  const loadDetail = useCallback(async () => {
    const seq = ++detailSequence.current;
    if (!selected) {
      setDetail(null);
      return;
    }
    try {
      const r = await authenticatedFetch(
        `/api/admin-game-day?id=${encodeURIComponent(selected)}`,
        { cache: "no-store" },
      );
      const j = await r.json();
      if (!r.ok) throw Error(j.error);
      if (seq === detailSequence.current) {
        setDetail(j);
        setDetailError("");
      }
    } catch (e) {
      if (seq === detailSequence.current) {
        setDetail(null);
        setDetailError(
          e instanceof Error ? e.message : "Competition unavailable.",
        );
      }
    }
  }, [selected]);
  useEffect(() => {
    void load();
    const refresh = () => {
      if (document.visibilityState === "visible") void load();
    };
    const timer = setInterval(refresh, 30000);
    window.addEventListener("ls1:competition-saved", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("ls1:competition-saved", refresh);
      sequence.current++;
    };
  }, [load]);
  useEffect(() => {
    setDetail(null);
    setDetailError("");
    void loadDetail();
    const refresh = () => {
      if (document.visibilityState === "visible") void loadDetail();
    };
    const timer = setInterval(refresh, 30000);
    window.addEventListener("ls1:competition-saved", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("ls1:competition-saved", refresh);
      detailSequence.current++;
    };
  }, [loadDetail]);
  useEffect(() => {
    setSelected("");
    setPlanning(false);
    setCashbox(false);
  }, [view]);
  const competitions: Row[] = data?.competitions || [],
    c = detail?.competitions?.[0];
  const person = (id: string) => {
    const p = (detail?.people || []).find((r: Row) => r.id === id);
    return p
      ? [p.preferred_name || p.first_name, p.last_name]
          .filter(Boolean)
          .join(" ")
      : "Unassigned";
  };
  const athlete = (entryId: string) => {
    const entry = (detail?.entries || []).find((r: Row) => r.id === entryId),
      a = (detail?.athletes || []).find((r: Row) => r.id === entry?.athlete_id);
    return a?.people
      ? [a.people.preferred_name || a.people.first_name, a.people.last_name]
          .filter(Boolean)
          .join(" ")
      : "Entry " + entryId;
  };
  const openCases = (data?.cases || []).filter(
    (r: Row) =>
      !["closed", "resolved", "dismissed", "decided"].includes(r.status),
  );
  const required = competitions.reduce((n, c) => n + c.staffing.required, 0),
    filled = competitions.reduce((n, c) => n + c.staffing.filled, 0);
  return (
    <main className="min-h-full space-y-5 bg-[#0A0C10] p-5 text-white">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-400">
            Game Day Director · Live club records
          </p>
          <h1 className="text-2xl font-bold">
            {titles[view] || titles["gd-home"]}
          </h1>
        </div>
        <button
          className={button}
          disabled={loading}
          onClick={() => void load()}
        >
          {loading ? "🔵 Refreshing" : "Refresh"}
        </button>
      </header>
      {error && (
        <p role="alert" className="text-red-300">
          {error}
        </p>
      )}
      {data && (
        <>
          <div className="grid gap-3 md:grid-cols-4">
            {[
              [
                "Assigned officials",
                required
                  ? `${filled} / ${required}`
                  : "Requirements not recorded",
              ],
              ["Open protests", String(openCases.length)],
              ["Schedule delay", "Actual start times not recorded"],
              ["Result closeout speed", "Signoff times not recorded"],
            ].map(([label, value]) => (
              <div key={label} className={card}>
                <p className="text-sm text-slate-400">{label}</p>
                <p className="mt-2 font-semibold">{value}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400">
            Updated {date(data.generatedAt)}. Assignment counts do not certify
            officials’ qualifications or neutrality.
          </p>
          <div className="flex flex-wrap gap-3">
            <button className={button} onClick={() => setPlanning((v) => !v)}>
              {planning
                ? "Hide competition planning"
                : "Manage competitions, entries & deadlines"}
            </button>
            <button
              className={button}
              disabled={!data.canAuthorizeCashbox}
              onClick={() => setCashbox(true)}
            >
              Authorize officials cash box
            </button>
            {!data.canAuthorizeCashbox && (
              <p className="text-sm text-amber-200">
                Your role needs cash-box approval permission from the club
                administrator.
              </p>
            )}
          </div>
          {planning && (
            <section className={card}>
              <Planning role="competition_manager" />
            </section>
          )}
          {view === "gd-home" && <Triage role="competition_manager" />}
          <section className={card}>
            <h2 className="mb-3 text-lg font-semibold">
              Competitions · {competitions.length}
            </h2>
            {!competitions.length ? (
              <p>No competitions saved for your club.</p>
            ) : (
              competitions
                .slice(
                  Math.min(
                    competitionPage,
                    Math.max(0, Math.ceil(competitions.length / 25) - 1),
                  ) * 25,
                  Math.min(
                    competitionPage,
                    Math.max(0, Math.ceil(competitions.length / 25) - 1),
                  ) *
                    25 +
                    25,
                )
                .map((row) => (
                  <button
                    key={row.id}
                    className="mb-2 block w-full rounded border border-[#30363D] p-3 text-left hover:bg-[#222933]"
                    onClick={() => setSelected(row.id)}
                  >
                    <strong>{row.name}</strong>
                    <span className="mt-1 block text-sm text-slate-300">
                      {date(row.starts_at)} · {row.status}
                    </span>
                    <span className="mt-2 block text-sm">
                      {row.closureRisks.length
                        ? "🔴 Venue closure overlaps this competition"
                        : row.staffing.required > row.staffing.filled
                          ? "🟡 Officials staffing shortfall"
                          : row.staffing.required
                            ? "🟢 Required assignment slots filled"
                            : "🟡 Staffing requirements not recorded"}
                    </span>
                  </button>
                ))
            )}
            {competitions.length > 25 && (
              <div className="flex gap-3">
                <button
                  className={button}
                  disabled={!competitionPage}
                  onClick={() => setCompetitionPage((p) => Math.max(0, p - 1))}
                >
                  Previous
                </button>
                <button
                  className={button}
                  disabled={(competitionPage + 1) * 25 >= competitions.length}
                  onClick={() => setCompetitionPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            )}
          </section>
        </>
      )}
      {selected && (
        <AdminDrawerShell
          title={c?.name || "Competition details"}
          onClose={() => setSelected("")}
          recordStatus={c?.status}
        >
          {detailError ? (
            <p role="alert" className="text-red-300">
              {detailError}
            </p>
          ) : !detail ? (
            <p>🔵 Loading competition…</p>
          ) : (
            <div className="grid gap-5 lg:grid-cols-[1fr_2fr_1fr]">
              <aside className="space-y-4">
                <h3 className="font-semibold">Competition details</h3>
                <p>
                  {date(c.starts_at)} — {date(c.ends_at)}
                </p>
                <p>
                  {(detail.facilities || []).find(
                    (f: Row) => f.id === c.venue_facility_id,
                  )?.name || "Venue not assigned"}
                </p>
                <p>
                  Officials: {c.staffing.filled} /{" "}
                  {c.staffing.required || "requirements not set"}
                </p>
                {c.closureRisks.map((r: Row) => (
                  <p
                    key={r.id}
                    className="rounded border border-red-600 p-3 text-red-300"
                  >
                    🔴 CRITICAL SHUTDOWN RISK
                    <br />
                    {r.reason}
                    <br />
                    {date(r.starts_at)} — {date(r.ends_at)}
                  </p>
                ))}
                <button
                  className={button}
                  onClick={() => {
                    setSelected("");
                    setPlanning(true);
                  }}
                >
                  Open competition planning
                </button>
              </aside>
              <section className="space-y-7">
                {(view === "gd-home" || view === "gd-officials") && (
                  <>
                    <Records
                      title="Staffing requirements"
                      rows={detail.requirements}
                      columns={[
                        ["Role", (r) => r.role_code],
                        ["Required", (r) => r.required_count],
                        ["Active", (r) => (r.active ? "Yes" : "No")],
                      ]}
                    />
                    <Records
                      title="Assigned officials"
                      rows={detail.officials}
                      columns={[
                        ["Official", (r) => person(r.person_id)],
                        ["Role", (r) => r.role_code],
                        ["Status", (r) => r.status],
                        ["Checked in", (r) => date(r.check_in_at)],
                      ]}
                    />
                    <p className="text-sm text-amber-200">
                      Qualified regional assignment is not available yet. Saved
                      assignments are shown here.
                    </p>
                  </>
                )}
                {(view === "gd-home" || view === "gd-seeding") && (
                  <>
                    <Records
                      title="Entry manifests"
                      rows={detail.batches}
                      columns={[
                        ["Batch", (r) => r.batch_code],
                        ["Status", (r) => r.status],
                        ["Locked", (r) => date(r.locked_at)],
                      ]}
                    />
                    <Records
                      title="Seeding runs"
                      rows={detail.seedingRuns}
                      columns={[
                        ["Run", (r) => r.run_no],
                        ["Method", (r) => r.algorithm_code],
                        ["Status", (r) => r.status],
                        ["Approved", (r) => date(r.approved_at)],
                      ]}
                    />
                    <Records
                      title="Saved heat sheets"
                      rows={[...detail.seedingAssignments].sort(
                        (a: Row, b: Row) =>
                          a.heat_no - b.heat_no || a.lane_no - b.lane_no,
                      )}
                      columns={[
                        ["Swimmer", (r) => athlete(r.competition_entry_id)],
                        ["Heat", (r) => r.heat_no],
                        ["Lane", (r) => r.lane_no],
                        [
                          "Seed",
                          (r) => `${r.seed_value ?? "—"} ${r.seed_unit || ""}`,
                        ],
                        ["Status", (r) => r.assignment_status],
                      ]}
                    />
                    <p className="text-sm text-amber-200">
                      Automated seeding and heat-sheet publication are not
                      available yet.
                    </p>
                  </>
                )}
                {(view === "gd-home" || view === "gd-protests") && (
                  <>
                    <Records
                      title="Protests and jury decisions"
                      rows={detail.cases}
                      columns={[
                        ["Issue", (r) => r.summary],
                        ["Rule", (r) => r.rule_reference || "Not recorded"],
                        ["Status", (r) => r.status],
                        [
                          "Decision",
                          (r) =>
                            typeof r.decision === "string"
                              ? r.decision
                              : JSON.stringify(r.decision ?? "Not recorded"),
                        ],
                      ]}
                    />
                    <Records
                      title="Recorded results"
                      rows={detail.results}
                      columns={[
                        ["Swimmer", (r) => athlete(r.competition_entry_id)],
                        [
                          "Result",
                          (r) =>
                            `${r.result_value ?? "—"} ${r.result_unit || ""}`,
                        ],
                        ["Rank", (r) => r.rank ?? "—"],
                        ["Status", (r) => r.status],
                        ["Validation", (r) => r.validation_status],
                      ]}
                    />
                    <Records
                      title="Timing feed receipts"
                      rows={detail.timingMessages}
                      columns={[
                        ["Received", (r) => date(r.received_at)],
                        ["Type", (r) => r.message_type],
                        [
                          "Heat / lane",
                          (r) => `${r.heat_no ?? "—"} / ${r.lane_no ?? "—"}`,
                        ],
                        ["Validation", (r) => r.validation_status],
                      ]}
                    />
                    <p className="text-sm text-amber-200">
                      Jury rulings, disqualifications and permanent result
                      signoff are not available yet. These are saved results,
                      not a simulated timing stream.
                    </p>
                  </>
                )}
                {(view === "gd-home" ||
                  view === "gd-venues" ||
                  view === "gd-clocks") && (
                  <>
                    <Records
                      title="Session timetable"
                      rows={detail.sessions}
                      columns={[
                        ["Session", (r) => r.name],
                        ["Start", (r) => date(r.starts_at)],
                        ["End", (r) => date(r.ends_at)],
                        ["Status", (r) => r.status],
                      ]}
                    />
                    <Records
                      title="Venue bookings"
                      rows={detail.bookings.filter(
                        (r: Row) => r.facility_id === c.venue_facility_id,
                      )}
                      columns={[
                        ["Start", (r) => date(r.starts_at)],
                        ["End", (r) => date(r.ends_at)],
                        ["Status", (r) => r.status],
                      ]}
                    />
                    <Records
                      title="Competition deadlines"
                      rows={detail.deadlines}
                      columns={[
                        ["Deadline", (r) => r.name],
                        ["Due", (r) => date(r.due_at)],
                        ["Status", (r) => r.status],
                      ]}
                    />
                    <p className="text-sm text-amber-200">
                      Competition planning saves venue and competition dates.
                      Session shifting, automatic rerouting and manager
                      notifications are not available yet.
                    </p>
                  </>
                )}
                <Records
                  title="Open scheduling exceptions"
                  rows={detail.exceptions.filter(
                    (r: Row) => !["closed", "resolved"].includes(r.status),
                  )}
                  columns={[
                    ["Issue", (r) => r.problem],
                    ["Status", (r) => r.status],
                    [
                      "Next step",
                      (r) => r.recommended_action || "Review required",
                    ],
                  ]}
                />
              </section>
              <aside className="space-y-5">
                <h3 className="font-semibold">Activity & handoffs</h3>
                <p className="text-sm">
                  Cash box authorization sends a voucher to the Treasurer. It
                  does not lock the officials schedule or calculate pay rates.
                </p>
                <button
                  className={button}
                  disabled={!detail.canAuthorizeCashbox}
                  onClick={() => {
                    setSelected("");
                    setCashbox(true);
                  }}
                >
                  Authorize cash box
                </button>
                <Records
                  title="Competition history"
                  rows={detail.audit}
                  columns={[
                    ["Action", (r) => r.action],
                    ["When", (r) => date(r.occurred_at)],
                  ]}
                />
                <Records
                  title="Result corrections"
                  rows={detail.versions}
                  columns={[
                    ["Version", (r) => r.version_no],
                    ["Reason", (r) => r.change_reason],
                    ["When", (r) => date(r.changed_at)],
                  ]}
                />
              </aside>
            </div>
          )}
        </AdminDrawerShell>
      )}
      {cashbox && (
        <Cashbox
          role="competition_manager"
          onClose={() => setCashbox(false)}
          onSaved={async () => {
            setCashbox(false);
            await load();
          }}
        />
      )}
    </main>
  );
}
