"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { authenticatedFetch } from "@/lib/client/authenticatedFetch";
import { AdminDrawerShell } from "@/components/hubs/admin/AdminDrawerShell";
import {
  closedTask,
  triageRoles,
  type TriageFeed,
  type TriageTask,
} from "@/lib/triage/types";
import "./triage.css";
import CashboxAuthorizationDrawer from "@/components/hubs/admin/CashboxAuthorizationDrawer";
import TriageResolutionPanel from "@/components/hubs/admin/TriageResolutionPanel";
import PersonRecordDrawer from "@/components/hubs/admin/PersonRecordDrawer";
import { TaskBillDrawer } from "@/components/hubs/admin/PayablesWorkspace";
import { Lexend_Deca } from "next/font/google";
const triageFont = Lexend_Deca({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});
type History = {
  id: string;
  action: string;
  occurred_at: string;
  reason: string | null;
};
const roleName = (role: string) =>
  ({
    org_admin: "Organization Admin",
    team_manager: "Team Manager",
    registrar: "Registrar",
    treasurer: "Treasurer",
    competition_manager: "Competition Manager",
    volunteer_coordinator: "Volunteer Coordinator",
    communications_media: "Communications",
    fundraising_coordinator: "Fundraising",
    facilities_equipment_manager: "Facilities",
  })[role] || role.replaceAll("_", " ");
const sourceName = (source: string) =>
  ({
    operational_tasks: "Club task",
    workflow_tasks: "Assigned workflow",
    competition_exceptions: "Competition issue",
  })[source] || source;
const date = (value: string | null) =>
  value ? new Date(value).toLocaleString() : "No due date";
function signal(task: TriageTask) {
  if (closedTask(task.status))
    return { label: "🟢 GOOD TO GO", className: "triage-good" };
  if (
    ["critical", "high", "fatal", "error"].includes(
      task.priority.toLowerCase(),
    ) ||
    (task.dueAt && Date.parse(task.dueAt) < Date.now())
  )
    return { label: "🔴 CRITICAL STOP", className: "triage-critical" };
  return { label: "🟡 NEEDS ATTENTION", className: "triage-attention" };
}
export default function TriageTaskHub({
  role = "org_admin",
}: {
  role?: string;
}) {
  // Parent keys by role; all requests also carry a generation to discard stale results.
  const [feed, setFeed] = useState<TriageFeed | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [team, setTeam] = useState(""),
    [status, setStatus] = useState("open"),
    [search, setSearch] = useState(""),
    [query, setQuery] = useState(""),
    [page, setPage] = useState(1);
  const [cashbox, setCashbox] = useState(false);
  const [notice, setNotice] = useState("");
  const [linked, setLinked] = useState<{
    kind: "person" | "bill";
    id: string;
  } | null>(null);
  const [selected, setSelected] = useState<TriageTask | null>(null),
    [history, setHistory] = useState<History[]>([]),
    [detailLoading, setDetailLoading] = useState(false),
    [note, setNote] = useState("");
  const [creating, setCreating] = useState(false),
    [title, setTitle] = useState(""),
    [description, setDescription] = useState(""),
    [assignedRole, setAssignedRole] = useState(role),
    [taskTeam, setTaskTeam] = useState(""),
    [org, setOrg] = useState(""),
    [due, setDue] = useState(""),
    [priority, setPriority] = useState("normal");
  const version = useRef(0),
    detailVersion = useRef(0),
    mounted = useRef(true),
    saving = useRef(false);
  const invalidate = useCallback(() => {
    version.current++;
    detailVersion.current++;
  }, []);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      invalidate();
    };
  }, [invalidate]);
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search);
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);
  const params = useCallback(
    () =>
      new URLSearchParams({
        role,
        team,
        status,
        search: query,
        page: String(page),
      }),
    [role, team, status, query, page],
  );
  const load = useCallback(async () => {
    const current = ++version.current;
    try {
      if (role !== "team_manager" || team) {
        const sync = await authenticatedFetch("/api/admin-triage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role, team: team || null, action: "sync" }),
        });
        if (!sync.ok) {
          const failure = await sync.json();
          throw new Error(failure.error || "Unable to refresh source records.");
        }
      }
      const r = await authenticatedFetch(`/api/admin-triage?${params()}`, {
          cache: "no-store",
        }),
        j = await r.json();
      if (current !== version.current || !mounted.current) return;
      if (!r.ok) throw new Error(j.error || "Unable to load tasks.");
      if (j.total > 0 && page > Math.ceil(j.total / 25)) {
        setPage(Math.ceil(j.total / 25));
        return;
      }
      setFeed(j);
      setError("");
    } catch (failure) {
      if (current === version.current && mounted.current) throw failure;
    }
  }, [params, page, role, team]);
  useEffect(() => {
    setFeed(null);
    setSelected(null);
    setLinked(null);
    detailVersion.current++;
    void load().catch((e) => {
      if (mounted.current) setError(e.message);
    });
    const refresh = () => {
      if (document.visibilityState === "visible" && !saving.current)
        void load().catch((e) => {
          if (mounted.current) setError(e.message);
        });
    };
    const timer = setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    return () => {
      invalidate();
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [load, invalidate]);
  const open = async (task: TriageTask) => {
    const current = ++detailVersion.current;
    setSelected(task);
    setHistory([]);
    setNote("");
    setDetailLoading(true);
    setError("");
    try {
      const p = params();
      p.set("id", task.id);
      p.set("source", task.source);
      const r = await authenticatedFetch(`/api/admin-triage?${p}`, {
          cache: "no-store",
        }),
        j = await r.json();
      if (current !== detailVersion.current || !mounted.current) return;
      if (!r.ok) {
        setSelected(null);
        throw new Error(j.error || "Unable to open task.");
      }
      setSelected(j.task);
      setHistory(j.history);
    } catch (e) {
      if (current === detailVersion.current)
        setError(e instanceof Error ? e.message : "Unable to open task.");
    } finally {
      if (current === detailVersion.current) setDetailLoading(false);
    }
  };
  const save = async (action: "create" | "complete" | "reopen") => {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      const payload =
        action === "create"
          ? {
              source: "operational_tasks",
              task: {
                title,
                description,
                organization_id: org,
                team_id: taskTeam || null,
                assigned_role: assignedRole,
                priority,
                due_at: due ? new Date(due).toISOString() : null,
              },
              note: description.trim() || `Created task: ${title}`,
            }
          : {
              source: selected?.source,
              id: selected?.id,
              revision: selected?.revision,
              note,
            };
      const r = await authenticatedFetch("/api/admin-triage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...payload,
            action,
            role,
            team: team || null,
          }),
        }),
        j = await r.json();
      if (!r.ok) throw new Error(j.error || "Unable to save task.");
      if (!mounted.current) return;
      setSelected(null);
      setCreating(false);
      setNote("");
      await load();
    } catch (e) {
      if (mounted.current)
        setError(e instanceof Error ? e.message : "Unable to save task.");
    } finally {
      saving.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const close = () => {
    detailVersion.current++;
    setSelected(null);
    setCreating(false);
    setDetailLoading(false);
  };
  const canResolve =
    selected?.canUpdate &&
    !selected.generated &&
    !["fee_voucher", "cashbox"].includes(selected.resolutionKind || "") &&
    (selected.source !== "competition_exceptions" ||
      ["org_admin", "competition_manager"].includes(role));
  return (
    <section
      className="ls1-triage"
      style={{ fontFamily: triageFont.style.fontFamily }}
      aria-label="Today's tasks"
    >
      {notice && <p role="status">{notice}</p>}
      <header className="triage-toolbar">
        <div>
          <h2>Today’s Tasks</h2>
          <p>{roleName(role)} · Live club records</p>
        </div>
        <div className="triage-actions">
          {["org_admin", "competition_manager"].includes(role) && (
            <button disabled={busy} onClick={() => setCashbox(true)}>
              Authorize cash box
            </button>
          )}
          <button
            onClick={() => void load().catch((e) => setError(e.message))}
            disabled={busy}
          >
            Refresh
          </button>
          {feed?.canCreate && (
            <button
              className="triage-primary"
              disabled={feed.needsTeam}
              onClick={() => {
                setCreating(true);
                setError("");
                setTitle("");
                setDescription("");
                setAssignedRole(role);
                setTaskTeam(team);
                setOrg(feed.organizations[0]?.id || "");
                setDue("");
                setPriority("normal");
              }}
            >
              Add task
            </button>
          )}
        </div>
      </header>
      <div className="triage-filters">
        <label>
          Show
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="open">Needs attention</option>
            <option value="closed">Completed and closed</option>
          </select>
        </label>
        <label>
          Find a task
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        {(role === "team_manager" || feed?.needsTeam || !!team) && (
          <label>
            Squad
            <select
              value={team}
              onChange={(e) => {
                setTeam(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Choose your squad</option>
              {feed?.teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {error && (
        <p role="alert" className="triage-error">
          {error}
        </p>
      )}
      {!feed ? (
        <p role="status">
          {error
            ? "Tasks could not be loaded. Use Refresh to retry."
            : "🔵 REFRESHING"}
        </p>
      ) : feed.needsTeam ? (
        <p role="status">
          {feed.teams.length
            ? "Choose a squad to view its tasks."
            : "No squad is assigned to this role. Organization Admin needs to assign one."}
        </p>
      ) : (
        <>
          <div className="triage-table" role="list">
            {feed.tasks.map((task) => {
              const s = signal(task);
              return (
                <div
                  role="listitem"
                  key={`${task.source}:${task.id}`}
                  className="triage-row"
                >
                  <input
                    type="checkbox"
                    aria-label={`${closedTask(task.status) ? "Review completed task" : "Resolve task"}: ${task.title}`}
                    title="Open the task to record its resolution. The checkmark reflects its saved status."
                    checked={closedTask(task.status)}
                    onChange={() => void open(task)}
                  />
                  <button
                    className="triage-row-main"
                    onClick={() => void open(task)}
                  >
                    <span className={`triage-signal ${s.className}`}>
                      {s.label}
                    </span>
                    <strong>{task.title}</strong>
                    <span>{task.problem}</span>
                    <small>
                      {sourceName(task.source)} ·{" "}
                      {task.assignedRole
                        ? roleName(task.assignedRole)
                        : "Awaiting role assignment"}{" "}
                      · {date(task.dueAt)}
                    </small>
                  </button>
                  <button onClick={() => void open(task)}>Review →</button>
                </div>
              );
            })}
            {!feed.tasks.length && (
              <p className="triage-empty">
                {query
                  ? "No tasks match your search."
                  : "No tasks are recorded in this view."}
              </p>
            )}
          </div>
          <footer className="triage-toolbar">
            <small>
              {feed.total} recorded tasks · Updated{" "}
              {new Date(feed.refreshedAt).toLocaleTimeString()} · Refreshes
              every 30 seconds
            </small>
            <div className="triage-actions">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </button>
              <span>
                Page {page} of {Math.max(1, Math.ceil(feed.total / 25))}
              </span>
              <button
                disabled={page * 25 >= feed.total}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </footer>
        </>
      )}
      {(selected || creating) && !linked && (
        <AdminDrawerShell
          title={creating ? "Add a club task" : selected!.title}
          recordStatus={creating ? undefined : selected?.status}
          busy={busy}
          onClose={close}
        >
          <div
            className="ls1-triage triage-drawer"
            style={{ fontFamily: triageFont.style.fontFamily }}
          >
            {error && (
              <p role="alert" className="triage-error">
                {error}
              </p>
            )}
            {creating ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void save("create");
                }}
              >
                <div className="triage-columns">
                  <section>
                    <h3>Task details</h3>
                    <label>
                      Title
                      <input
                        required
                        maxLength={200}
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                      />
                    </label>
                    <label>
                      What needs doing?
                      <textarea
                        maxLength={4000}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                      />
                    </label>
                    <label>
                      Due date
                      <input
                        type="datetime-local"
                        value={due}
                        onChange={(e) => setDue(e.target.value)}
                      />
                    </label>
                  </section>
                  <section>
                    <h3>Responsibility</h3>
                    <label>
                      Club
                      <select
                        value={org}
                        onChange={(e) => {
                          setOrg(e.target.value);
                          setTaskTeam("");
                        }}
                        required
                      >
                        {feed?.organizations.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Role
                      <select
                        value={assignedRole}
                        onChange={(e) => setAssignedRole(e.target.value)}
                        disabled={role !== "org_admin"}
                      >
                        {triageRoles
                          .filter((r) => role === "org_admin" || r === role)
                          .map((r) => (
                            <option key={r} value={r}>
                              {roleName(r)}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label>
                      Squad
                      <select
                        value={taskTeam}
                        onChange={(e) => setTaskTeam(e.target.value)}
                        required={assignedRole === "team_manager"}
                        disabled={!!team}
                      >
                        <option value="">Club-wide</option>
                        {feed?.teams
                          .filter((t) => t.organization_id === org)
                          .map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                      </select>
                    </label>
                  </section>
                  <section>
                    <h3>Priority</h3>
                    <label>
                      Attention level
                      <select
                        value={priority}
                        onChange={(e) => setPriority(e.target.value)}
                      >
                        <option value="critical">🔴 Critical stop</option>
                        <option value="normal">🟡 Needs attention</option>
                        <option value="low">Routine follow-up</option>
                      </select>
                    </label>
                    <button
                      className="triage-primary"
                      type="submit"
                      disabled={busy}
                    >
                      {busy ? "Saving…" : "Create task"}
                    </button>
                  </section>
                </div>
              </form>
            ) : (
              selected && (
                <>
                  <p className={`triage-signal ${signal(selected).className}`}>
                    {signal(selected).label} ·{" "}
                    {selected.status.replaceAll("_", " ")}
                  </p>
                  {detailLoading ? (
                    <p role="status">Loading current task and activity…</p>
                  ) : (
                    <div className="triage-columns">
                      <section>
                        <h3>Task details</h3>
                        <dl>
                          <dt>Assigned role</dt>
                          <dd>
                            {selected.assignedRole
                              ? roleName(selected.assignedRole)
                              : "Not assigned"}
                          </dd>
                          <dt>Squad</dt>
                          <dd>
                            {selected.teamId
                              ? feed?.teams.find(
                                  (t) => t.id === selected.teamId,
                                )?.name || "Assigned squad"
                              : "Club-wide"}
                          </dd>
                          <dt>Due</dt>
                          <dd>{date(selected.dueAt)}</dd>
                          <dt>Type</dt>
                          <dd>{sourceName(selected.source)}</dd>
                          {selected.exceptionCode && (
                            <>
                              <dt>Issue reference</dt>
                              <dd>{selected.exceptionCode}</dd>
                            </>
                          )}
                        </dl>
                        <h3>What needs attention</h3>
                        <p>{selected.problem || selected.title}</p>
                      </section>
                      <section>
                        <h3>Resolve this task</h3>
                        {selected.recommendedAction && (
                          <p>{selected.recommendedAction}</p>
                        )}
                        <TriageResolutionPanel
                          key={selected.id}
                          onBusy={(value) => {
                            setBusy(value);
                            saving.current = value;
                          }}
                          onNotice={setNotice}
                          task={selected}
                          role={role}
                          team={team}
                          onPerson={(id) => setLinked({ kind: "person", id })}
                          onBill={(id) => setLinked({ kind: "bill", id })}
                          onSaved={async () => {
                            await load();
                            await open(selected);
                          }}
                        />
                        {selected.source === "competition_exceptions" && (
                          <p>
                            Confirm resolution only after the underlying
                            competition record has been corrected. This
                            confirmation does not change waivers, eligibility or
                            payments.
                          </p>
                        )}
                        {canResolve &&
                        (!closedTask(selected.status) ||
                          (["completed", "resolved"].includes(
                            selected.status,
                          ) &&
                            selected.source !== "workflow_tasks")) ? (
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              void save(
                                closedTask(selected.status)
                                  ? "reopen"
                                  : "complete",
                              );
                            }}
                          >
                            <label>
                              {closedTask(selected.status)
                                ? "Why are you reopening this?"
                                : "What was done?"}
                              <textarea
                                required
                                minLength={3}
                                maxLength={4000}
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                              />
                            </label>
                            <button
                              type="submit"
                              className="triage-primary"
                              disabled={busy}
                            >
                              {busy
                                ? "Saving…"
                                : closedTask(selected.status)
                                  ? "Reopen task"
                                  : selected.source === "competition_exceptions"
                                    ? "Confirm issue resolved"
                                    : "Complete task"}
                            </button>
                          </form>
                        ) : (
                          <p>
                            {closedTask(selected.status)
                              ? "This task is closed."
                              : selected.generated ||
                                  ["fee_voucher", "cashbox"].includes(
                                    selected.resolutionKind || "",
                                  )
                                ? "This task follows its source record. Use the controls above; the queue refreshes after changes."
                                : "Your role can review this task. An authorized role must record its resolution."}
                          </p>
                        )}
                        <h3>Recent activity</h3>
                        {history.map((h) => (
                          <article key={h.id} className="triage-activity">
                            <time>{date(h.occurred_at)}</time>
                            <p>
                              {h.reason ||
                                h.action
                                  .replaceAll("_", " ")
                                  .replaceAll(".", " ")}
                            </p>
                          </article>
                        ))}
                        {!history.length && (
                          <p>No activity has been recorded for this task.</p>
                        )}
                      </section>
                      <section>
                        <h3>Linked evidence</h3>
                        {selected.entityId && (
                          <p>
                            {selected.entityType?.replaceAll("_", " ") ||
                              "Record"}{" "}
                            reference: {selected.entityId}
                          </p>
                        )}
                        <TaskEvidence evidence={selected.evidence} />
                      </section>
                    </div>
                  )}
                </>
              )
            )}
          </div>
        </AdminDrawerShell>
      )}
      {linked?.kind === "person" && (
        <PersonRecordDrawer
          personId={linked.id}
          role={role}
          initialTab="Documents"
          onClose={() => {
            setLinked(null);
            void load()
              .then(() => selected && open(selected))
              .catch((e) => setError(e.message));
          }}
          onSaved={() => void load().catch((e) => setError(e.message))}
        />
      )}
      {linked?.kind === "bill" && (
        <TaskBillDrawer
          id={linked.id}
          role={role}
          onClose={() => {
            setLinked(null);
            void load()
              .then(() => selected && open(selected))
              .catch((e) => setError(e.message));
          }}
          onSaved={load}
        />
      )}
      {cashbox && (
        <CashboxAuthorizationDrawer
          role={role}
          onClose={() => setCashbox(false)}
          onSaved={async () => {
            setNotice("Cash-box authorization sent to Treasurer.");
            await load();
          }}
        />
      )}
    </section>
  );
}

function TaskEvidence({ evidence }: { evidence: unknown }) {
  if (!evidence) return <p>No supporting evidence is attached to this task.</p>;
  if (typeof evidence !== "object") return <p>{String(evidence)}</p>;
  const data = evidence as Record<string, unknown>;
  const allocations = Array.isArray(data.allocations)
    ? (data.allocations as Record<string, unknown>[])
    : null;
  const lines = Array.isArray(data.lines)
    ? (data.lines as Record<string, unknown>[])
    : null;
  return (
    <>
      {allocations && (
        <table className="w-full text-left text-sm">
          <caption>Authorized official payouts</caption>
          <thead>
            <tr>
              <th>Official</th>
              <th>Role</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {allocations.map((a, i) => (
              <tr key={String(a.assignment_id || i)}>
                <td>{String(a.official || "Assigned official")}</td>
                <td>{String(a.role || "").replaceAll("_", " ")}</td>
                <td>
                  {String(a.amount)} {String(data.currency || "")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {lines && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption>Entry fees reviewed for this squad</caption>
            <thead>
              <tr>
                <th>Event</th>
                <th>Quantity</th>
                <th>Unit fee</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => (
                <tr key={String(line.fee_id || i)}>
                  <td>{String(line.event || "Entry fee")}</td>
                  <td>{String(line.quantity)}</td>
                  <td>{String(line.unit_amount)}</td>
                  <td>
                    {String(line.total_amount)} {String(data.currency || "")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <dl>
        {Object.entries(data)
          .filter(
            ([key, value]) =>
              key !== "lines" &&
              !key.endsWith("_id") &&
              typeof value !== "object",
          )
          .map(([key, value]) => (
            <div key={key}>
              <dt>{key.replaceAll("_", " ")}</dt>
              <dd>{String(value ?? "Not recorded")}</dd>
            </div>
          ))}
      </dl>
      {Array.isArray(evidence) &&
        evidence.map((row, i) => <TaskEvidence key={i} evidence={row} />)}
    </>
  );
}
