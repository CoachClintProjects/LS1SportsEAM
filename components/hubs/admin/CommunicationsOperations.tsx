"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { AdminDrawerShell } from "./AdminDrawerShell";
import { authenticatedFetch } from "@/lib/client/authenticatedFetch";
import { recipientIds } from "@/lib/communicationsPolicy";
const Triage = dynamic(() => import("../superuser/TriageTaskHub"));
type Row = Record<string, any>;
const button =
  "rounded border border-[#30363D] bg-[#161B22] px-3 py-2 text-sm disabled:opacity-40";
const input =
  "mt-1 w-full rounded border border-[#30363D] bg-[#0A0C10] p-2 text-white";
const card = "rounded-xl border border-[#30363D] bg-[#161B22] p-4";
const when = (v: unknown) =>
  v ? new Date(String(v)).toLocaleString() : "Not recorded";
const titles: Record<string, string> = {
  "cm-home": "Today’s Tasks",
  "cm-mass": "Send Mass Messages",
  "cm-portal": "Public Web Portal",
  "cm-emergency": "Emergency Fast Alerts",
  "cm-pr": "Public Relations",
  "cm-calendar": "Media Calendars",
};
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
                {rows.slice(current * 25, current * 25 + 25).map((row) => (
                  <tr key={row.id}>
                    {columns.map(([label, render]) => (
                      <td
                        className="border-b border-[#30363D] p-2 align-top"
                        key={label}
                      >
                        {render(row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-3">
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
export function CommunicationsOperations() {
  const params = useSearchParams(),
    view = params.get("view") || "cm-home";
  const [data, setData] = useState<Row | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [loading, setLoading] = useState(false),
    [busy, setBusy] = useState(false),
    [draft, setDraft] = useState<Row | null>(null),
    [reason, setReason] = useState(""),
    [format, setFormat] = useState(false),
    [history, setHistory] = useState<Row[]>([]);
  const generation = useRef(0),
    saving = useRef(false),
    detailGeneration = useRef(0);
  const load = useCallback(async () => {
    const seq = ++generation.current;
    setLoading(true);
    try {
      const r = await authenticatedFetch("/api/admin-communications", {
          cache: "no-store",
        }),
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
          e instanceof Error ? e.message : "Communications unavailable.",
        );
      }
    } finally {
      if (seq === generation.current) setLoading(false);
    }
  }, []);
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
    setDraft(null);
    setReason("");
    detailGeneration.current++;
  }, [view]);
  const open = (m: Row) => {
    setDraft({
      id: m.id,
      body: m.body,
      ...m.metadata,
      status: m.delivery_status,
    });
    setReason("");
    setFormat(false);
    setHistory([]);
    setError("");
    const seq = ++detailGeneration.current;
    void authenticatedFetch(
      "/api/admin-communications?id=" + encodeURIComponent(m.id),
      { cache: "no-store" },
    )
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw Error(j.error);
        if (seq === detailGeneration.current) setHistory(j.history || []);
      })
      .catch((e) => {
        if (seq === detailGeneration.current) setError(e.message);
      });
  };
  const create = (closure?: Row) => {
    detailGeneration.current++;
    setDraft({
      id: crypto.randomUUID(),
      revision: 0,
      title: closure
        ? "Safety update: " +
          (data?.facilities.find((f: Row) => f.id === closure.facility_id)
            ?.name || "Facility closure")
        : "",
      body: closure
        ? `${closure.reason || "Facility closure"}\n\nClosure starts: ${when(closure.starts_at)}\nClosure ends: ${when(closure.ends_at)}\n\n`
        : "",
      channel: "CH_EMAIL_01",
      segments: {
        parents: false,
        coaches: false,
        volunteers: false,
        squads: [],
      },
      planned_at: null,
      status: "draft",
    });
    setReason("");
    setHistory([]);
    setFormat(false);
    setError("");
    setNotice("");
  };
  async function save(action: string) {
    if (!draft || saving.current) return;
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      const r = await authenticatedFetch("/api/admin-communications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...draft, reason, action }),
        }),
        j = await r.json();
      if (!r.ok) throw Error(j.error);
      setNotice(j.warning || j.message);
      open(j.row);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  const messages: Row[] = data?.messages || [],
    recipients: Row[] = data?.recipients || [],
    failures = recipients.filter((r) =>
      ["failed", "bounced", "DELIVERY_FAILED"].includes(r.delivery_status),
    ),
    delivered = recipients.filter((r) => r.delivered_at),
    read = recipients.filter((r) => r.read_at),
    queued = messages.filter((m) => m.delivery_status === "queued");
  const audience =
      draft && data ? recipientIds(draft.segments, data.groups) : [],
    locked = draft && !["draft", "POLICY_HOLD"].includes(draft.status);
  const localTime = (v: string | null) => {
    if (!v) return "";
    const d = new Date(v);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  };
  return (
    <main className="min-h-full space-y-5 bg-[#0A0C10] p-5 text-white">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-400">
            Club Announcer (Communications)
          </p>
          <h1 className="text-2xl font-bold">
            {titles[view] || titles["cm-home"]}
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
          <section className={card}>
            <h2 className="font-bold">
              {!queued.length
                ? "0 OUTGOING BULLETINS ENQUEUED [COMMUNICATION ENGINE IDLE]"
                : `${queued.length} saved queued bulletins`}
            </h2>
            <p className="my-3 text-sm text-slate-300">
              Email, mobile push and ticket email delivery are unconfigured.
              Save and review drafts here; nothing is sent externally.
            </p>
            <button
              className={button}
              disabled={!data.canWrite}
              onClick={() => create()}
            >
              + PROVISION NEW MASS DISTRIBUTION BULLETIN
            </button>
          </section>
          {recipients.length > 0 && (
            <div className="grid gap-3 md:grid-cols-3">
              {[
                ["Recorded deliveries", String(delivered.length)],
                ["Recorded reads", String(read.length)],
                ["Failed recipient records", String(failures.length)],
              ].map(([label, value]) => (
                <div className={card} key={label}>
                  <p className="text-sm text-slate-400">{label}</p>
                  <p className="mt-2 text-xl">{value}</p>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-slate-400">
            Updated {when(data.generatedAt)}. Delivery velocity and parent
            engagement rates are unavailable without verified delivery
            telemetry.
          </p>
          {view === "cm-home" && <Triage role="communications_media" />}
          {view === "cm-portal" && (
            <section className={card}>
              <h2 className="font-semibold">
                Public web publishing is unconfigured
              </h2>
              <p className="my-3 text-sm">
                No public publishing endpoint or approved release workflow is
                connected. Prepare copy as a saved draft.
              </p>
              <button disabled className={button}>
                Publish to public portal — unavailable
              </button>
            </section>
          )}
          {(view === "cm-emergency" || view === "cm-home") && (
            <section className={card}>
              <h2 className="font-semibold">Facility safety updates</h2>
              {!data.closures.length ? (
                <p className="mt-3 text-sm text-slate-400">
                  No unresolved current or upcoming closures are recorded.
                </p>
              ) : (
                data.closures.map((c: Row) => (
                  <div
                    className="mt-3 rounded border border-red-800 p-3"
                    key={c.id}
                  >
                    <strong>
                      🔴{" "}
                      {data.facilities.find((f: Row) => f.id === c.facility_id)
                        ?.name || "Facility closure"}
                    </strong>
                    <p className="my-2 text-sm">
                      {c.reason} · {when(c.starts_at)} — {when(c.ends_at)}
                    </p>
                    <button
                      className={button}
                      disabled={!data.canWrite}
                      onClick={() => create(c)}
                    >
                      Prepare safety wrapper
                    </button>
                  </div>
                ))
              )}
              <p className="mt-3 text-sm text-amber-200">
                Outgoing delivery is disabled. Safety staging creates an
                executive review task and keeps the message on hold; it does not
                authorize release.
              </p>
            </section>
          )}
          <section className={card}>
            <Table
              title={
                view === "cm-calendar"
                  ? "Planned bulletin dates (not scheduled sends)"
                  : "Saved bulletins"
              }
              rows={
                view === "cm-calendar"
                  ? messages
                      .filter((m) => m.metadata?.planned_at)
                      .sort(
                        (a, b) =>
                          Date.parse(a.metadata.planned_at) -
                          Date.parse(b.metadata.planned_at),
                      )
                  : messages
              }
              columns={[
                [
                  "Bulletin",
                  (m) => (
                    <button
                      className="text-left text-sky-300 underline"
                      onClick={() => open(m)}
                    >
                      {m.metadata?.title || "Untitled bulletin"}
                    </button>
                  ),
                ],
                ["Status", (m) => m.delivery_status],
                ["Intended channel", (m) => m.metadata?.channel],
                ["Planned", (m) => when(m.metadata?.planned_at)],
              ]}
            />
          </section>
          <div className="grid gap-4 lg:grid-cols-2">
            <section className={card}>
              <Table
                title="Delivery failures"
                rows={failures}
                columns={[
                  ["Failure", (r) => r.failure_code || r.delivery_status],
                  [
                    "Bulletin",
                    (r) => (
                      <button
                        className={button}
                        onClick={() => {
                          const m = messages.find((m) => m.id === r.message_id);
                          if (m) open(m);
                        }}
                      >
                        Review bulletin
                      </button>
                    ),
                  ],
                  [
                    "Retry",
                    () => (
                      <button disabled className={button}>
                        Gateway unconfigured
                      </button>
                    ),
                  ],
                ]}
              />
            </section>
            <section className={card}>
              <Table
                title="Recorded delivery events"
                rows={data.events}
                columns={[
                  ["Event", (e) => e.event_type],
                  ["When", (e) => when(e.occurred_at)],
                  ["Error", (e) => e.error_code || "None recorded"],
                ]}
              />
            </section>
          </div>
        </>
      )}
      {draft && (
        <AdminDrawerShell
          title={draft.title || "New mass distribution bulletin"}
          busy={busy}
          recordStatus={draft.status}
          onClose={() => {
            setDraft(null);
            detailGeneration.current++;
          }}
        >
          <div className="grid gap-5 lg:grid-cols-[1fr_2fr_1fr]">
            <fieldset disabled={busy || !!locked} className="space-y-4">
              <legend className="font-semibold">Audience & channel</legend>
              {[
                ["parents", "All Club Parents"],
                ["coaches", "Head Coaches"],
                ["volunteers", "Local Volunteers"],
              ].map(([key, label]) => (
                <label className="block text-sm" key={key}>
                  <input
                    type="checkbox"
                    checked={!!draft.segments[key]}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        segments: {
                          ...draft.segments,
                          [key]: e.target.checked,
                        },
                      })
                    }
                  />{" "}
                  {label} ({data?.groups[key]?.length || 0})
                </label>
              ))}
              <p className="text-xs text-slate-400">
                Parents come from current guardian communication links for
                active club squads; volunteers from current shift assignments.
              </p>
              <p className="font-semibold">Scoped squad parents</p>
              {data?.teams.map((t: Row) => (
                <label className="block text-sm" key={t.id}>
                  <input
                    type="checkbox"
                    checked={draft.segments.squads.includes(t.id)}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        segments: {
                          ...draft.segments,
                          squads: e.target.checked
                            ? [...draft.segments.squads, t.id]
                            : draft.segments.squads.filter(
                                (id: string) => id !== t.id,
                              ),
                        },
                      })
                    }
                  />{" "}
                  {t.name} ({data.groups.squads[t.id]?.length || 0})
                </label>
              ))}
              <p className="text-sm">
                {audience.length} unique current recipients
              </p>
              {!audience.length && (
                <p className="text-sm text-amber-200">
                  No recipients match. Drafts can be saved; safety staging
                  requires a populated audience.
                </p>
              )}
              <label className="block text-sm">
                Intended channel
                <select
                  className={input}
                  value={draft.channel}
                  onChange={(e) =>
                    setDraft({ ...draft, channel: e.target.value })
                  }
                >
                  <option value="CH_EMAIL_01">
                    CH_EMAIL_01 — Master Email Array (unconfigured)
                  </option>
                  <option value="CH_PUSH_01">
                    CH_PUSH_01 — Mobile Push Network (unconfigured)
                  </option>
                </select>
              </label>
              <label className="block text-sm">
                Planned date (your local time)
                <input
                  className={input}
                  type="datetime-local"
                  value={localTime(draft.planned_at)}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      planned_at: e.target.value
                        ? new Date(e.target.value).toISOString()
                        : null,
                    })
                  }
                />
              </label>
            </fieldset>
            <section className="space-y-4">
              <label className="block">
                Title
                <input
                  className={input}
                  maxLength={200}
                  value={draft.title}
                  disabled={busy || !!locked}
                  onChange={(e) =>
                    setDraft({ ...draft, title: e.target.value })
                  }
                />
              </label>
              <label className="block">
                Message (Markdown)
                <textarea
                  className={input + " min-h-72 font-mono text-sm"}
                  maxLength={30000}
                  value={draft.body}
                  disabled={busy || !!locked}
                  onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                />
              </label>
              <button
                className={button}
                disabled={busy || !!locked}
                onClick={() => setFormat(true)}
              >
                INLINE FORMAT FIX
              </button>
              {format && (
                <p className="text-sm text-sky-200">
                  Edit the message above and save with a reason. The formatting
                  review is recorded; an existing policy hold remains in force.
                </p>
              )}
              <details>
                <summary className="cursor-pointer text-sm">
                  Read plain-text preview
                </summary>
                <div className="mt-3 whitespace-pre-wrap rounded border border-[#30363D] p-3 text-sm">
                  {draft.body}
                </div>
              </details>
              <label className="block">
                Reason for this change
                <textarea
                  className={input}
                  minLength={10}
                  maxLength={2000}
                  value={reason}
                  disabled={busy}
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
              <div className="flex flex-wrap gap-2">
                <button
                  className={button}
                  disabled={
                    busy ||
                    !!locked ||
                    !data?.canWrite ||
                    reason.trim().length < 10
                  }
                  onClick={() => void save(format ? "format" : "save")}
                >
                  Save draft
                </button>
                <button
                  className={button}
                  disabled={
                    busy ||
                    !data?.canWrite ||
                    reason.trim().length < 10 ||
                    !audience.length ||
                    (!!locked && draft.status !== "Pending_Executive_Approval")
                  }
                  onClick={() => void save("stage")}
                >
                  STAGE SAFETY WRAPPER
                </button>
                <button
                  disabled
                  className={button}
                  title="No external email or push gateway is configured"
                >
                  DISPATCH PAYLOAD TO NETWORK — unavailable
                </button>
              </div>
              <p className="text-xs text-slate-400">
                Saving a draft or staging a safety review does not enqueue
                external delivery.
              </p>
            </section>
            <aside className="space-y-4">
              <h3 className="font-semibold">Review & activity</h3>
              <p className="text-sm">
                Saved recipient snapshot:{" "}
                {draft.recipient_ids?.length ?? "Not yet saved"}. Audience
                membership is checked again on save.
              </p>
              {draft.approval_task_id && (
                <p className="text-sm text-amber-200">
                  Executive approval required. Review task reference:{" "}
                  {draft.approval_task_id}
                </p>
              )}
              <Table
                title="Recent activity"
                rows={history}
                columns={[
                  ["Action", (h) => h.action],
                  ["Reason", (h) => h.reason],
                  ["When", (h) => when(h.occurred_at)],
                ]}
              />
            </aside>
          </div>
        </AdminDrawerShell>
      )}
    </main>
  );
}
export default CommunicationsOperations;
