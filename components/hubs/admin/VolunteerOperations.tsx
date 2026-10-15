"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { authenticatedFetch } from "@/lib/client/authenticatedFetch";
import { AdminDrawerShell } from "./AdminDrawerShell";
const Triage = dynamic(() => import("../superuser/TriageTaskHub"));
type Row = Record<string, any>;
const button =
  "rounded border border-[#30363D] bg-[#161B22] px-3 py-2 text-sm disabled:opacity-40";
const field =
  "mt-1 w-full rounded border border-[#30363D] bg-[#0A0C10] p-2 text-white";
const card = "rounded-xl border border-[#30363D] bg-[#161B22] p-4";
const titles: Record<string, string> = {
  "vl-home": "Today’s Tasks",
  "vl-signups": "Parent Worker Sign-ups",
  "vl-shifts": "Configure Meet Shifts",
  "vl-clearance": "Deck Zone Clearances",
  "vl-attendance": "Check-In Attendance",
  "vl-hours": "Family Hours Log",
};
const when = (v: unknown) =>
  v ? new Date(String(v)).toLocaleString() : "Not recorded";
function Table({
  title,
  rows,
  columns,
}: {
  title: string;
  rows: Row[];
  columns: [string, (r: Row) => React.ReactNode][];
}) {
  const [page, setPage] = useState(0),
    last = Math.max(0, Math.ceil(rows.length / 25) - 1),
    current = Math.min(page, last);
  return (
    <section className="space-y-3">
      <h3 className="font-semibold">
        {title} · {rows.length}
      </h3>
      {rows.length ? (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  {columns.map(([label]) => (
                    <th key={label} className="border-b border-[#30363D] p-2">
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
                        key={label}
                        className="border-b border-[#30363D] p-2 align-top"
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
      ) : (
        <p className="text-sm text-slate-400">No saved records.</p>
      )}
    </section>
  );
}
export function VolunteerOperations() {
  const params = useSearchParams(),
    view = params.get("view") || "vl-home";
  const [data, setData] = useState<Row | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [loading, setLoading] = useState(false),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState(""),
    [creating, setCreating] = useState(false),
    [draft, setDraft] = useState<Row>({}),
    [reason, setReason] = useState("");
  const generation = useRef(0),
    saving = useRef(false);
  const load = useCallback(async () => {
    const seq = ++generation.current;
    setLoading(true);
    try {
      const r = await authenticatedFetch(
          "/api/admin-volunteers" +
            (selected ? "?id=" + encodeURIComponent(selected) : ""),
          { cache: "no-store" },
        ),
        j = await r.json();
      if (!r.ok) throw Error(j.error);
      if (seq === generation.current) {
        setData(j);
        setError("");
      }
    } catch (e) {
      if (seq === generation.current) {
        setData(null);
        setError(
          e instanceof Error ? e.message : "Volunteer records unavailable.",
        );
      }
    } finally {
      if (seq === generation.current) setLoading(false);
    }
  }, [selected]);
  useEffect(() => {
    void load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 30000);
    return () => {
      clearInterval(timer);
      generation.current++;
    };
  }, [load]);
  useEffect(() => {
    setSelected("");
    setCreating(false);
    setReason("");
  }, [view]);
  async function save(body: Row) {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const r = await authenticatedFetch("/api/admin-volunteers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...body, reason }),
        }),
        j = await r.json();
      if (!r.ok) throw Error(j.error);
      setNotice(j.warning || j.message || "Saved.");
      setReason("");
      if (body.action === "create") {
        setCreating(false);
        setSelected(j.row.id);
      } else {
        await load();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  const opportunities: Row[] = data?.opportunities || [],
    assignments: Row[] = data?.assignments || [],
    active = opportunities.filter(
      (o) => String(o.status).toUpperCase() === "OPEN",
    ),
    activeIds = new Set(active.map((o) => o.id)),
    current = assignments.filter(
      (a) =>
        activeIds.has(a.opportunity_id) &&
        ["assigned", "checked_in"].includes(a.status),
    ),
    capacity = active.reduce((n, o) => n + Number(o.capacity || 0), 0),
    unknownCapacity = active.some((o) => o.capacity == null),
    approved = current.filter(
      (a) => data?.checks.find((c: Row) => c.id === a.id)?.ok,
    ).length;
  const selectedShift = opportunities.find((o) => o.id === selected),
    worker = (id: string) => {
      const p = data?.people.find((p: Row) => p.id === id);
      return p
        ? [p.preferred_name || p.first_name, p.last_name]
            .filter(Boolean)
            .join(" ")
        : "Worker name unavailable";
    };
  const openCreate = () => {
    setCreating(true);
    setSelected("");
    setReason("");
    setDraft({
      id: crypto.randomUUID(),
      title: "",
      starts_at: "",
      ends_at: "",
      capacity: "",
    });
  };
  const localTime = (iso: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    return Number.isFinite(d.getTime())
      ? new Date(d.getTime() - d.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16)
      : "";
  };
  return (
    <main className="min-h-full space-y-5 bg-[#0A0C10] p-5 text-white">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-400">
            Volunteer Helper (Coordinator)
          </p>
          <h1 className="text-2xl font-bold">
            {titles[view] || titles["vl-home"]}
          </h1>
        </div>
        <button
          className={button}
          disabled={loading || busy}
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
      {notice && (
        <p role="status" className="text-amber-200">
          {notice}
        </p>
      )}
      {data && (
        <>
          {!active.length ? (
            <section className={card}>
              <h2 className="font-bold">
                0 ACTIVE SHIFTS PROVISIONED [WORKFORCE INITIALIZED IN EMPTY
                MODE]
              </h2>
              <p className="my-3 text-sm text-slate-300">
                Create a shift with its time and required worker count.
                Automatic league staffing rules are not configured.
              </p>
              <button
                className={button}
                disabled={!data.canCreate}
                onClick={openCreate}
              >
                + PROVISION MEET WORKFORCE SHIFTS
              </button>
            </section>
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-3">
                {[
                  [
                    "Shift places filled",
                    unknownCapacity
                      ? "Capacity not fully configured"
                      : `${current.length} / ${capacity}`,
                  ],
                  [
                    "Current credential checks",
                    `${approved} / ${current.length}`,
                  ],
                  [
                    "Recorded no-shows",
                    String(
                      assignments.filter((a) => a.status === "no_show").length,
                    ),
                  ],
                ].map(([label, value]) => (
                  <div className={card} key={label}>
                    <p className="text-sm text-slate-400">{label}</p>
                    <p className="mt-2 text-xl">{value}</p>
                  </div>
                ))}
              </div>
              <button
                className={button}
                disabled={!data.canCreate}
                onClick={openCreate}
              >
                + PROVISION MEET WORKFORCE SHIFTS
              </button>
            </>
          )}
          <p className="text-xs text-slate-400">
            Updated {when(data.generatedAt)} · Saved club records · Refreshes
            every 30 seconds while this page is visible.
          </p>
          {view === "vl-home" && <Triage role="volunteer_coordinator" />}
          {(view === "vl-signups" || view === "vl-home") && (
            <p className="rounded border border-amber-700 p-3 text-sm text-amber-200">
              Manual recruitment and replacements need configured volunteer
              roles and a capacity-controlled assignment transaction. Existing
              sign-ups are shown below.
            </p>
          )}
          {view === "vl-hours" && (
            <section className={card}>
              <h2 className="font-semibold">
                Family-hour targets are not configured
              </h2>
              <p className="mt-2 text-sm text-slate-300">
                There is no family-hour obligation store in the connected
                database. Saved assignment credits below are not verified hours
                or seasonal family balances.
              </p>
              <Table
                title="Recorded assignment credits"
                rows={assignments.filter((a) => a.completed_at)}
                columns={[
                  ["Worker", (a) => worker(a.volunteer_person_id)],
                  ["Completed", (a) => when(a.completed_at)],
                  ["Saved credits", (a) => a.credits_awarded ?? "Not recorded"],
                ]}
              />
            </section>
          )}
          <section className={card}>
            <Table
              title="Club shifts"
              rows={opportunities}
              columns={[
                [
                  "Shift",
                  (o) => (
                    <button
                      className="text-left text-sky-300 underline"
                      onClick={() => {
                        setSelected(o.id);
                        setReason("");
                      }}
                    >
                      {o.title}
                    </button>
                  ),
                ],
                ["Start", (o) => when(o.starts_at)],
                ["Status", (o) => o.status],
                [
                  "Vacancies",
                  (o) =>
                    o.capacity == null
                      ? "Capacity unknown"
                      : Math.max(
                          0,
                          o.capacity -
                            assignments.filter(
                              (a) =>
                                a.opportunity_id === o.id &&
                                [
                                  "assigned",
                                  "checked_in",
                                  "completed",
                                ].includes(a.status),
                            ).length,
                        ),
                ],
              ]}
            />
          </section>
          {view === "vl-clearance" && (
            <section className={card}>
              <Table
                title="Worker clearance checks"
                rows={assignments.filter((a) =>
                  ["assigned", "checked_in"].includes(a.status),
                )}
                columns={[
                  ["Worker", (a) => worker(a.volunteer_person_id)],
                  [
                    "Screening",
                    (a) => {
                      const check = data.checks.find((c: Row) => c.id === a.id);
                      return (
                        <span
                          className={
                            check?.ok ? "text-green-300" : "text-red-300"
                          }
                        >
                          {check?.reason || "[UNVETTED WORKER BLOCKED]"}
                        </span>
                      );
                    },
                  ],
                  [
                    "Review",
                    (a) => (
                      <button
                        className={button}
                        onClick={() => setSelected(a.opportunity_id)}
                      >
                        Open shift
                      </button>
                    ),
                  ],
                ]}
              />
            </section>
          )}
        </>
      )}
      {creating && (
        <AdminDrawerShell
          title="Provision workforce shifts"
          busy={busy}
          onClose={() => setCreating(false)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save({
                ...draft,
                starts_at: draft.starts_at
                  ? new Date(draft.starts_at).toISOString()
                  : "",
                ends_at: draft.ends_at
                  ? new Date(draft.ends_at).toISOString()
                  : "",
                action: "create",
              });
            }}
            className="grid gap-5 lg:grid-cols-3"
          >
            <aside>
              <h3 className="font-semibold">Session reference</h3>
              <p className="my-3 text-sm text-slate-300">
                Choose a saved session to copy its name and times, or enter a
                shift manually. This creates one shift with the worker count you
                enter; it does not calculate league requirements.
              </p>
              <label>
                Copy session
                <select
                  className={field}
                  value={draft.session || ""}
                  onChange={(e) => {
                    const session = data?.sessions.find(
                        (s: Row) => s.id === e.target.value,
                      ),
                      meet = data?.competitions.find(
                        (c: Row) => c.id === session?.competition_id,
                      );
                    setDraft({
                      ...draft,
                      session: e.target.value,
                      ...(session
                        ? {
                            title: `${meet?.name || "Competition"} · ${session.name}`,
                            starts_at: localTime(session.starts_at),
                            ends_at: localTime(session.ends_at),
                          }
                        : {}),
                    });
                  }}
                >
                  <option value="">Enter manually</option>
                  {data?.sessions.map((s: Row) => (
                    <option key={s.id} value={s.id}>
                      {
                        data.competitions.find(
                          (c: Row) => c.id === s.competition_id,
                        )?.name
                      }{" "}
                      · {s.name}
                    </option>
                  ))}
                </select>
              </label>
            </aside>
            <section className="space-y-4">
              {[
                ["title", "Shift name", "text"],
                ["starts_at", "Start (your local time)", "datetime-local"],
                ["ends_at", "End (your local time)", "datetime-local"],
                ["capacity", "Required workers", "number"],
              ].map(([key, label, type]) => (
                <label className="block" key={key}>
                  {label}
                  <input
                    className={field}
                    type={type}
                    required
                    min={type === "number" ? 1 : undefined}
                    max={type === "number" ? 1000 : undefined}
                    value={draft[key] || ""}
                    onChange={(e) =>
                      setDraft({ ...draft, [key]: e.target.value })
                    }
                  />
                </label>
              ))}
              <label className="block">
                Reason
                <textarea
                  className={field}
                  required
                  minLength={10}
                  maxLength={2000}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              {error && (
                <p role="alert" className="text-red-300">
                  {error}
                </p>
              )}
              <button
                className={button}
                disabled={busy || !data?.canCreate}
                type="submit"
              >
                {busy ? "Saving…" : "Save shift"}
              </button>
            </section>
            <aside>
              <h3 className="font-semibold">Before opening sign-ups</h3>
              <p className="mt-3 text-sm text-slate-300">
                Volunteer roles and screening requirements must be configured
                before workers can be checked in. New shifts start with zero
                awarded credits.
              </p>
            </aside>
          </form>
        </AdminDrawerShell>
      )}
      {selected && (
        <AdminDrawerShell
          title={selectedShift?.title || "Shift details"}
          busy={busy}
          onClose={() => setSelected("")}
          recordStatus={selectedShift?.status}
        >
          {!data || !selectedShift ? (
            <p>{error || "Loading shift…"}</p>
          ) : (
            <div className="grid gap-5 lg:grid-cols-[1fr_2fr_1fr]">
              <aside className="space-y-3">
                <h3 className="font-semibold">Shift details</h3>
                <p>
                  {when(selectedShift.starts_at)} —{" "}
                  {when(selectedShift.ends_at)}
                </p>
                <p>
                  Worker places: {selectedShift.capacity ?? "Not configured"}
                </p>
                <p className="text-sm text-slate-400">
                  Cancelled assignments retain the original worker and history
                  and no longer occupy a place.
                </p>
              </aside>
              <section className="space-y-4">
                <label className="block">
                  Reason for attendance or cancellation
                  <textarea
                    className={field}
                    minLength={10}
                    maxLength={2000}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </label>
                {error && (
                  <p role="alert" className="text-red-300">
                    {error}
                  </p>
                )}
                {notice && (
                  <p role="status" className="text-amber-200">
                    {notice}
                  </p>
                )}
                <Table
                  title="Worker assignments"
                  rows={assignments.filter(
                    (a) => a.opportunity_id === selected,
                  )}
                  columns={[
                    ["Worker", (a) => worker(a.volunteer_person_id)],
                    ["Status", (a) => a.status],
                    [
                      "Actions",
                      (a) => (
                        <div className="space-y-2">
                          {a.status === "assigned" && (
                            <button
                              className={button}
                              disabled={
                                busy ||
                                reason.trim().length < 10 ||
                                !data.canUpdate ||
                                !data.checks.find((c: Row) => c.id === a.id)?.ok
                              }
                              onClick={() =>
                                void save({
                                  action: "check_in",
                                  id: a.id,
                                  updated_at: a.updated_at,
                                })
                              }
                            >
                              Check in
                            </button>
                          )}
                          {["assigned", "checked_in"].includes(a.status) &&
                            !a.completed_at && (
                              <button
                                className={button}
                                disabled={
                                  busy ||
                                  reason.trim().length < 10 ||
                                  !data.canUpdate
                                }
                                onClick={() =>
                                  void save({
                                    action: "cancel",
                                    id: a.id,
                                    updated_at: a.updated_at,
                                  })
                                }
                              >
                                Dissociate worker / log cancellation
                              </button>
                            )}
                        </div>
                      ),
                    ],
                  ]}
                />
                <p className="text-sm text-amber-200">
                  No-show escalation and family-hour closeout are not available
                  yet. Attendance changes do not award family hours.
                </p>
              </section>
              <aside className="space-y-4">
                <h3 className="font-semibold">Clearances & history</h3>
                {assignments
                  .filter(
                    (a) =>
                      a.opportunity_id === selected &&
                      ["assigned", "checked_in"].includes(a.status),
                  )
                  .map((a) => {
                    const check = data.checks.find((c: Row) => c.id === a.id);
                    return (
                      <p
                        key={a.id}
                        className={
                          check?.ok
                            ? "text-sm text-green-300"
                            : "text-sm text-red-300"
                        }
                      >
                        {worker(a.volunteer_person_id)}:{" "}
                        {check?.reason || "[UNVETTED WORKER BLOCKED]"}
                      </p>
                    );
                  })}
                <Table
                  title="Saved activity"
                  rows={[...data.history].sort(
                    (a: Row, b: Row) =>
                      Date.parse(b.occurred_at) - Date.parse(a.occurred_at),
                  )}
                  columns={[
                    ["Action", (a) => a.action],
                    ["Reason", (a) => a.reason],
                    ["When", (a) => when(a.occurred_at)],
                  ]}
                />
              </aside>
            </div>
          )}
        </AdminDrawerShell>
      )}
    </main>
  );
}
export default VolunteerOperations;
