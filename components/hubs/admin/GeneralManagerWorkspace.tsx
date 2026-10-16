"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { authenticatedFetch } from "@/lib/client/authenticatedFetch";
import { AdminDrawerShell } from "./AdminDrawerShell";
import { TransactionEngine } from "../superuser/TransactionEngine";
import EquipmentWorkspace from "./EquipmentWorkspace";
type Row = Record<string, any>;
const button =
  "rounded border border-[#30363D] bg-[#161B22] px-3 py-2 text-sm disabled:opacity-40";
const input =
  "mt-1 w-full rounded border border-[#30363D] bg-[#0A0C10] p-2 text-white";
const card = "rounded-lg border border-[#30363D] bg-[#161B22] p-4";
const titles: Record<string, string> = {
  "gm-home": "Today’s Tasks / What Needs Attention",
  "gm-programs": "Program Health",
  "gm-capacity": "Roster Capacities",
  "gm-facilities": "Facility Bookings",
  "gm-incidents": "Incident Logs",
  "gm-telemetry": "Multi-Engine Telemetry",
};
const name = (a: Row) =>
  [a.people?.preferred_name || a.people?.first_name, a.people?.last_name]
    .filter(Boolean)
    .join(" ") || a.id;
const openStatus = (s: string) =>
  ![
    "completed",
    "closed",
    "cancelled",
    "resolved",
    "denied",
    "rejected",
    "approved",
  ].includes(s);
const href = (folder: string, view: string) =>
  `/admin?role=general_manager&folder=${folder}${view === "home" ? "" : `&view=${view}`}`;
function Records({
  rows,
  columns,
  open,
}: {
  rows: Row[];
  columns: [string, (r: Row) => React.ReactNode][];
  open: (r: Row) => void;
}) {
  const [page, setPage] = useState(0);
  const last = Math.max(0, Math.ceil(rows.length / 25) - 1),
    current = Math.min(page, last);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr>
            {columns.map(([h]) => (
              <th className="p-3 border-b border-[#30363D]" key={h}>
                {h}
              </th>
            ))}
            <th>Review</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(current * 25, current * 25 + 25).map((r) => (
            <tr key={r.id}>
              {columns.map(([h, f]) => (
                <td className="p-3 border-b border-[#30363D]" key={h}>
                  {f(r)}
                </td>
              ))}
              <td>
                <button className={button} onClick={() => open(r)}>
                  Open
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && (
        <p className="p-4 text-slate-400">No saved records match this view.</p>
      )}
      <div className="flex gap-3 p-3">
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
    </div>
  );
}
export default function GeneralManagerWorkspace() {
  const params = useSearchParams(),
    view = params.get("view") || "gm-home";
  const [data, setData] = useState<Row | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState<Row | null>(null),
    [details, setDetails] = useState<Row>({}),
    [title, setTitle] = useState(""),
    [reason, setReason] = useState(""),
    [history, setHistory] = useState<Row[]>([]),
    [transaction, setTransaction] = useState<{ personId?: string } | null>(
      null,
    ),
    [search, setSearch] = useState(""),
    [season, setSeason] = useState(""),
    [decision, setDecision] = useState("");
  const generation = useRef(0),
    saving = useRef(false),
    detailGeneration = useRef(0);
  const load = useCallback(async () => {
    const seq = ++generation.current;
    setLoading(true);
    try {
      const r = await authenticatedFetch("/api/admin-general-manager");
      const j = await r.json();
      if (seq !== generation.current) return;
      if (!r.ok) throw new Error(j.error);
      setData(j);
      setError("");
    } catch (e) {
      if (seq === generation.current) {
        setData(null);
        setError(e instanceof Error ? e.message : "Unable to load Operations.");
      }
    } finally {
      if (seq === generation.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
    return () => {
      generation.current++;
      detailGeneration.current++;
    };
  }, [load]);
  useEffect(() => {
    setSelected(null);
    setTransaction(null);
    setSearch("");
    setNotice("");
    detailGeneration.current++;
  }, [view]);
  async function open(row: Row, type: string) {
    const seq = ++detailGeneration.current;
    setSelected({ ...row, _type: type });
    setDetails({ ...row.details });
    setTitle(row.title || "");
    setReason("");
    setDecision("");
    setHistory([]);
    setNotice("");
    setError("");
    if (type === "incident" && !row._new) {
      try {
        const r = await authenticatedFetch(
            `/api/admin-general-manager?id=${row.id}`,
          ),
          j = await r.json();
        if (seq !== detailGeneration.current) return;
        if (!r.ok) throw new Error(j.error);
        setSelected({ ...j.row, _type: type });
        setDetails(j.row.details || {});
        setTitle(j.row.title);
        setHistory(j.history);
      } catch (e) {
        if (seq === detailGeneration.current)
          setError(e instanceof Error ? e.message : "Could not load history.");
      }
    }
  }
  async function save(operation: string, status?: string) {
    if (!selected || saving.current) return;
    saving.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const r = await authenticatedFetch("/api/admin-general-manager", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            operation,
            id: selected.id,
            expectedVersion: selected.version,
            expectedStatus: selected.status,
            expectedCase: {
              summary: selected.summary,
              rule_reference: selected.rule_reference,
              evidence: selected.evidence,
            },
            values:
              operation === "transition"
                ? { status }
                : {
                    kind: selected.kind,
                    title,
                    details,
                    due_on: selected.due_on,
                  },
            reason,
            decision,
          }),
        }),
        j = await r.json();
      if (!r.ok) throw new Error(j.error);
      await load();
      if (j.row && operation !== "jury_signoff") await open(j.row, "incident");
      else setSelected(null);
      setNotice(j.warning || "Saved to the club records.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  const filtered = (rows: Row[]) =>
    rows.filter((r) =>
      JSON.stringify(r).toLowerCase().includes(search.toLowerCase()),
    );
  const tasks = (data?.tasks || []).filter((r: Row) => openStatus(r.status)),
    exceptions = (data?.exceptions || []).filter((r: Row) =>
      openStatus(r.status),
    ),
    incidents = (data?.incidents || []).filter(
      (r: Row) => r.kind === "incident" && openStatus(r.status),
    ),
    caps = (data?.capacities || []).filter((r: Row) => r.status === "active"),
    full = caps.filter((r: Row) => r.cap && r.count >= r.cap),
    definition = data?.types?.find((t: Row) => t.code === selected?.kind),
    metrics = (data?.metrics || []).filter(
      (r: Row) => !season || r.season_id === season,
    );
  const selectedAthletes = (data?.athletes || []).filter((a: Row) =>
    selected?.athleteIds?.includes(a.id),
  );
  return (
    <main className="min-h-full bg-[#0A0C10] p-6 text-white">
      <header className="flex flex-wrap justify-between gap-4">
        <div>
          <p className="text-orange-300">General Manager (Operations)</p>
          <h1 className="text-2xl font-bold mt-2">
            {titles[view] || titles["gm-home"]}
          </h1>
          <p className="text-sm text-slate-400 mt-2">
            {loading
              ? "🔵 REFRESHING/SYNC"
              : data
                ? `Updated ${new Date(data.generatedAt).toLocaleString()}`
                : "Records unavailable"}
          </p>
        </div>
        <div className="flex gap-2 items-start">
          <button
            className={button}
            disabled={loading || busy}
            onClick={() => void load()}
          >
            Refresh
          </button>
          <button
            className={button}
            disabled={!data}
            onClick={() => setTransaction({})}
          >
            Club transactions
          </button>
        </div>
      </header>
      {error && (
        <p
          role="alert"
          className="my-4 rounded border border-red-600 bg-red-950 p-3"
        >
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="my-4 rounded border border-blue-500 p-3">
          {notice}
        </p>
      )}
      {data && (
        <>
          <div className="grid gap-3 my-5 md:grid-cols-4">
            {[
              ["Open tasks", tasks.length],
              ["Membership exceptions", exceptions.length],
              ["Squads at capacity", full.length],
              ["Open incidents", incidents.length],
            ].map(([label, value]) => (
              <div className={card} key={String(label)}>
                <p className="text-slate-400">{label}</p>
                <strong className="text-2xl">{value}</strong>
              </div>
            ))}
          </div>
          {view === "gm-facilities" ? (
            <>
              <div className="flex gap-3 my-4">
                <Link
                  className={button}
                  href={href("competition_manager", "gd-venues")}
                >
                  Review competition venues
                </Link>
                <Link
                  className={button}
                  href={href("communications_media", "cm-emergency")}
                >
                  Send closure alerts
                </Link>
              </div>
              <EquipmentWorkspace viewOverride="eq-schedules" />
            </>
          ) : (
            <>
              <label className="block max-w-md my-4">
                Search current records
                <input
                  className={input}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              {view === "gm-home" && (
                <div className="space-y-5">
                  <section className={card}>
                    <h2 className="text-xl mb-3">Today’s alerts</h2>
                    {tasks.length +
                      exceptions.length +
                      full.length +
                      incidents.length ===
                      0 && (
                      <p>🟢 GOOD TO GO · No open items in the saved records.</p>
                    )}
                    {filtered(tasks)
                      .slice(0, 100)
                      .map((t) => (
                        <label
                          key={t.id}
                          className="flex gap-3 border-b border-[#30363D] p-3"
                        >
                          <input
                            type="checkbox"
                            checked={selected?.id === t.id}
                            onChange={() => void open(t, "task")}
                            aria-label={`Review ${t.title}`}
                          />
                          <span>
                            {t.priority === "critical"
                              ? "🔴 CRITICAL STOP"
                              : "🟡 NEEDS ATTENTION"}{" "}
                            · {t.title}
                            <small className="block text-slate-400">
                              {t.assigned_role?.replaceAll("_", " ")} ·{" "}
                              {t.status}
                            </small>
                          </span>
                        </label>
                      ))}
                    {tasks.length > 100 && (
                      <p>
                        Showing the first 100 alerts. Use the role folders for
                        the full task queue.
                      </p>
                    )}
                    {full.map((r: Row) => (
                      <button
                        key={r.id}
                        className="block w-full text-left p-3 border-b border-[#30363D]"
                        onClick={() => void open(r, "capacity")}
                      >
                        🔴 ROSTER OVERRUN EXCEPTION · {r.name} · {r.count}/
                        {r.cap}
                      </button>
                    ))}
                    {incidents.map((r: Row) => (
                      <button
                        key={r.id}
                        className="block w-full text-left p-3"
                        onClick={() => void open(r, "incident")}
                      >
                        🟡 INCIDENT ESCALATION · {r.title}
                      </button>
                    ))}
                  </section>
                  <section className={card}>
                    <h2 className="text-xl mb-3">Membership exceptions</h2>
                    <Records
                      rows={filtered(exceptions)}
                      columns={[
                        ["Type", (r) => r.exception_type],
                        ["Reason", (r) => r.reason_category],
                        ["Status", (r) => r.status],
                      ]}
                      open={(r) => void open(r, "exception")}
                    />
                  </section>
                </div>
              )}
              {view === "gm-programs" && (
                <section className={card}>
                  <label>
                    Season
                    <select
                      className={input}
                      value={season}
                      onChange={(e) => setSeason(e.target.value)}
                    >
                      <option value="">Every season</option>
                      {data.seasons.map((s: Row) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Records
                    rows={filtered(metrics)}
                    columns={[
                      ["Program / season", (r) => `${r.program} · ${r.season}`],
                      ["Participants", (r) => r.participants],
                      ["Pending registrations", (r) => r.pending],
                      ["Intake / 30 days", (r) => r.intake30],
                      [
                        "Prior cohort retained",
                        (r) =>
                          r.priorCount
                            ? `${r.retained}/${r.priorCount} (${Math.round((100 * r.retained) / r.priorCount)}%)`
                            : "No prior cohort",
                      ],
                    ]}
                    open={(r) => void open(r, "program")}
                  />
                  <p className="text-sm text-slate-400">
                    Participants use approved or active registrations. Retention
                    compares the most recent completed season with the selected
                    season; the same athlete is counted once.
                  </p>
                </section>
              )}
              {view === "gm-capacity" && (
                <section className={card}>
                  <Records
                    rows={filtered(caps)}
                    columns={[
                      ["Squad / group", (r) => `${r.team} · ${r.name}`],
                      ["Athletes", (r) => r.count],
                      ["Hard cap", (r) => r.cap || "Not configured"],
                      [
                        "Utilization",
                        (r) =>
                          r.cap
                            ? `${Math.round((r.count / r.cap) * 100)}%`
                            : "—",
                      ],
                      [
                        "Readiness",
                        (r) =>
                          !r.cap
                            ? "🟡 NEEDS ATTENTION"
                            : r.count >= r.cap
                              ? "🔴 CRITICAL STOP"
                              : "🟢 GOOD TO GO",
                      ],
                    ]}
                    open={(r) => void open(r, "capacity")}
                  />
                </section>
              )}
              {view === "gm-incidents" && (
                <div className="space-y-5">
                  <div className="flex gap-3">
                    {["incident", "insurance"].map((kind) => (
                      <button
                        className={button}
                        key={kind}
                        onClick={() =>
                          void open(
                            {
                              id: crypto.randomUUID(),
                              kind,
                              _new: true,
                              details: {},
                            },
                            "incident",
                          )
                        }
                      >
                        New {kind} record
                      </button>
                    ))}
                  </div>
                  <section className={card}>
                    <Records
                      rows={filtered(data.incidents)}
                      columns={[
                        ["Record", (r) => r.title],
                        ["Type", (r) => r.kind],
                        ["Status", (r) => r.status],
                        ["Severity", (r) => r.details?.severity || "—"],
                      ]}
                      open={(r) => void open(r, "incident")}
                    />
                  </section>
                  <section className={card}>
                    <h2 className="text-xl mb-3">Technical jury decisions</h2>
                    <Records
                      rows={filtered(data.cases)}
                      columns={[
                        ["Case", (r) => r.summary],
                        ["Rule", (r) => r.rule_reference || "Not recorded"],
                        ["Status", (r) => r.status],
                        ["Decision", (r) => r.decision || "Not recorded"],
                      ]}
                      open={(r) => void open(r, "jury")}
                    />
                  </section>
                </div>
              )}
              {view === "gm-telemetry" && (
                <section className={card}>
                  <h2 className="text-xl mb-3">Unresolved work by role</h2>
                  <Records
                    rows={Object.entries(
                      tasks.reduce((acc: Row, t: Row) => {
                        const role = t.assigned_role || "unassigned";
                        acc[role] = (acc[role] || 0) + 1;
                        return acc;
                      }, {}),
                    ).map(([id, count]) => ({ id, count }))}
                    columns={[
                      ["Role", (r) => r.id.replaceAll("_", " ")],
                      ["Open tasks", (r) => r.count],
                    ]}
                    open={(r) =>
                      void open(
                        {
                          ...r,
                          items: tasks.filter(
                            (t: Row) =>
                              (t.assigned_role || "unassigned") === r.id,
                          ),
                        },
                        "telemetry",
                      )
                    }
                  />
                  <p className="text-slate-400">
                    Counts reflect saved open work, not service uptime or
                    external delivery confirmations.
                  </p>
                </section>
              )}
            </>
          )}
        </>
      )}
      {selected && !transaction && (
        <AdminDrawerShell
          title={
            selected.title ||
            selected.name ||
            selected.summary ||
            "Operations review"
          }
          busy={busy}
          onClose={() => {
            detailGeneration.current++;
            setSelected(null);
          }}
          recordStatus={selected.status}
        >
          <div className="grid gap-5 lg:grid-cols-[1fr_2fr_1fr]">
            <aside className="space-y-3">
              <h3 className="font-semibold">Record details</h3>
              <p className="text-sm break-all">{selected.id}</p>
              <p>{selected.kind || selected._type}</p>
              {selected._type === "capacity" && (
                <p>
                  {selected.count} athletes · capacity{" "}
                  {selected.cap || "not configured"}
                </p>
              )}
              {selected._type === "incident" && (
                <p>Version {selected.version || "new"}</p>
              )}
            </aside>
            <section className="space-y-4">
              {selected._type === "incident" && (
                <>
                  <label className="block">
                    Title
                    <input
                      className={input}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      disabled={busy}
                    />
                  </label>
                  {definition?.fields.map((f: Row) => (
                    <label key={f.key} className="block">
                      {f.label}
                      {f.required ? " *" : ""}
                      {f.type === "textarea" ? (
                        <textarea
                          className={input}
                          value={details[f.key] ?? ""}
                          onChange={(e) =>
                            setDetails({ ...details, [f.key]: e.target.value })
                          }
                        />
                      ) : f.type === "select" ? (
                        <select
                          className={input}
                          value={details[f.key] ?? ""}
                          onChange={(e) =>
                            setDetails({ ...details, [f.key]: e.target.value })
                          }
                        >
                          <option value="">Select</option>
                          {f.options.map((o: string) => (
                            <option key={o}>{o}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          className={input}
                          type={
                            f.type === "number"
                              ? "number"
                              : f.type === "date"
                                ? "date"
                                : "text"
                          }
                          value={details[f.key] ?? ""}
                          onChange={(e) =>
                            setDetails({ ...details, [f.key]: e.target.value })
                          }
                        />
                      )}
                    </label>
                  ))}
                  <label className="block">
                    Reason for this action
                    <textarea
                      className={input}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </label>
                  <button
                    className={button}
                    disabled={busy || reason.trim().length < 3 || !title.trim()}
                    onClick={() => void save(selected._new ? "create" : "edit")}
                  >
                    Save record
                  </button>
                  {!selected._new && (
                    <>
                      <p className="text-sm text-slate-400">
                        Save findings before changing status. Coverage
                        activation requires filed evidence.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {(definition?.transitions[selected.status] || []).map(
                          (s: string) => (
                            <button
                              key={s}
                              className={button}
                              disabled={busy || reason.trim().length < 3}
                              onClick={() => void save("transition", s)}
                            >
                              Mark {s}
                            </button>
                          ),
                        )}
                        <button
                          className={button}
                          disabled={busy || reason.trim().length < 3}
                          onClick={() => void save("registrar_followup")}
                        >
                          Assign Registrar follow-up
                        </button>
                      </div>
                    </>
                  )}
                </>
              )}
              {selected._type === "capacity" && (
                <>
                  <h3 className="text-xl">Move an athlete</h3>
                  <p className="text-sm text-slate-400">
                    Transfers use the saved fee quote and club posting controls.
                    At-capacity moves require the explicit capacity exemption
                    switch and a reason.
                  </p>
                  {selectedAthletes.map((a: Row) => (
                    <button
                      key={a.id}
                      className={`${button} block w-full text-left`}
                      onClick={() => setTransaction({ personId: a.person_id })}
                    >
                      {name(a)} · Open transfer
                    </button>
                  ))}
                  {!selectedAthletes.length && (
                    <p>No active athletes in this group.</p>
                  )}
                  <button className={button} onClick={() => setTransaction({})}>
                    Configure squad hard cap
                  </button>
                </>
              )}
              {selected._type === "jury" && (
                <>
                  <p>{selected.summary}</p>
                  <p>Rule: {selected.rule_reference || "Not recorded"}</p>
                  <pre className="whitespace-pre-wrap text-sm">
                    {JSON.stringify(selected.evidence || {}, null, 2)}
                  </pre>
                  {selected.decided_at ? (
                    <>
                      <p>{selected.decision}</p>
                      <p>
                        Signed {new Date(selected.decided_at).toLocaleString()}
                      </p>
                    </>
                  ) : (
                    <>
                      <label className="block">
                        Technical jury findings and decision
                        <textarea
                          className={input}
                          value={decision}
                          onChange={(e) => setDecision(e.target.value)}
                        />
                      </label>
                      <label className="block">
                        Reason
                        <textarea
                          className={input}
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                        />
                      </label>
                      <button
                        className={button}
                        disabled={
                          busy ||
                          decision.trim().length < 10 ||
                          reason.trim().length < 3
                        }
                        onClick={() => void save("jury_signoff")}
                      >
                        Sign final jury decision
                      </button>
                      <p className="text-sm text-slate-400">
                        This records the ruling. Athlete clearance and
                        competition results retain their separate approval
                        controls.
                      </p>
                    </>
                  )}
                </>
              )}
              {selected._type === "task" && (
                <>
                  <p>{selected.description}</p>
                  <p>
                    Assigned to {selected.assigned_role?.replaceAll("_", " ")}
                  </p>
                  <p className="text-sm text-slate-400">
                    Resolve the source record through its role controls;
                    selecting this alert does not complete it.
                  </p>
                  <Link
                    className={button}
                    href={href(
                      selected.assigned_role === "org_admin"
                        ? "general_manager"
                        : selected.assigned_role || "general_manager",
                      selected.assigned_role === "facilities_equipment_manager"
                        ? "eq-maintenance"
                        : selected.assigned_role === "competition_manager"
                          ? "gd-venues"
                          : selected.assigned_role === "org_admin"
                            ? "gm-incidents"
                            : "home",
                    )}
                  >
                    Open role workspace
                  </Link>
                  {selected.metadata?.kind?.startsWith("equipment_") && (
                    <Link
                      className={`${button} block`}
                      href={href("general_manager", "gm-facilities")}
                    >
                      Review facility schedule
                    </Link>
                  )}
                </>
              )}
              {selected._type === "exception" && (
                <>
                  <p>
                    {selected.exception_type} · {selected.reason_category}
                  </p>
                  <p>
                    {selected.decision_note || "No decision note recorded."}
                  </p>
                  <Link
                    className={button}
                    href={href("registrar", "rg-transfers")}
                  >
                    Open Registrar review
                  </Link>
                </>
              )}
              {selected._type === "program" && (
                <>
                  <p>
                    {selected.program} · {selected.season}
                  </p>
                  <p>
                    {selected.participants} active participants ·{" "}
                    {selected.pending} pending registrations
                  </p>
                  <p>
                    {selected.retained} retained from {selected.priorCount}{" "}
                    previous participants
                  </p>
                  <Link
                    className={button}
                    href={href("registrar", "rg-identity")}
                  >
                    Open registration reviews
                  </Link>
                </>
              )}
              {selected._type === "telemetry" &&
                selected.items.map((t: Row) => (
                  <button
                    className={`${button} block w-full text-left`}
                    key={t.id}
                    onClick={() => void open(t, "task")}
                  >
                    {t.title} · {t.status}
                  </button>
                ))}
            </section>
            <aside className="space-y-3">
              <h3 className="font-semibold">Recorded history</h3>
              {history.map((h) => (
                <div
                  key={h.id}
                  className="border-b border-[#30363D] py-2 text-sm"
                >
                  <p>{h.action}</p>
                  <p>{h.reason}</p>
                  <time>{new Date(h.occurred_at).toLocaleString()}</time>
                </div>
              ))}
              {!history.length && (
                <p className="text-sm text-slate-400">
                  {selected._type === "incident"
                    ? "No recorded actions loaded."
                    : "Use the source workspace for its full transaction history."}
                </p>
              )}
            </aside>
          </div>
          {error && (
            <p role="alert" className="text-red-300 mt-4">
              {error}
            </p>
          )}
        </AdminDrawerShell>
      )}
      {transaction && (
        <TransactionEngine
          role="general_manager"
          personId={transaction.personId}
          onClose={() => setTransaction(null)}
          onSaved={() => {
            setSelected(null);
            void load();
          }}
        />
      )}
    </main>
  );
}
