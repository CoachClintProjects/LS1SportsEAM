"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import { authenticatedFetch } from "@/lib/client/authenticatedFetch";

type Field = {
  key: string;
  label: string;
  type: string;
  required: boolean;
  options?: string[];
};
type Definition = {
  code: string;
  name: string;
  initial_status: string;
  fields: Field[];
  transitions: Record<string, string[]>;
};
type RecordRow = {
  id: string;
  kind: string;
  title: string;
  status: string;
  details: Record<string, string>;
  due_on: string | null;
  owner_person_id: string | null;
  version: number;
  updated_at: string;
};
type Person = {
  id: string;
  first_name: string;
  last_name: string;
  preferred_name: string | null;
};
type Config = {
  types: Definition[];
  rows: RecordRow[];
  hasMore: boolean;
  owners: Person[];
  replacements: { id: string; title: string }[];
  organization: { name: string };
  authorization: { create: boolean; edit: boolean; decide: boolean };
};
type Detail = {
  row: RecordRow;
  files: { id: string; title: string; created_at: string }[];
  history: {
    id: string;
    action: string;
    occurred_at: string;
    reason: string;
    before_data: RecordRow | null;
    after_data: RecordRow;
  }[];
};
const human = (s: string) => s.replaceAll("_", " ");
const personName = (p: Person) =>
  [p.preferred_name || p.first_name, p.last_name].filter(Boolean).join(" ");
const input =
  "mt-1 w-full rounded border border-neutral-600 bg-[#17191d] px-3 py-2 text-sm text-white";
const button = "rounded px-3 py-2 text-sm font-semibold disabled:opacity-40";
const transitionLabel: Record<string, string> = {
  review: "Submit for review",
  active: "Record approval",
  submitted: "Record external submission",
  superseded: "Supersede policy",
  resolved: "Record resolution",
  closed: "Close incident",
  investigating: "Open investigation",
  expired: "Mark expired",
  cancelled: "Cancel record",
  withdrawn: "Withdraw",
  draft: "Return to draft",
  rejected: "Record rejection",
};

export function GovernanceWorkspace({ role = "org_admin" }: { role?: string }) {
  const params = useSearchParams(),
    deepRecord = params.get("record");
  const [kind, setKind] = useState("policy"),
    [page, setPage] = useState(0),
    [query, setQuery] = useState(""),
    [sort, setSort] = useState("updated_at"),
    [direction, setDirection] = useState("desc");
  const [data, setData] = useState<Config | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [selected, setSelected] = useState<string | null>(deepRecord),
    [creating, setCreating] = useState(false);
  const seq = useRef(0);
  const load = useCallback(async () => {
    const version = ++seq.current;
    setLoading(true);
    try {
      const r = await authenticatedFetch(
        `/api/admin-governance?${new URLSearchParams({ role, kind, page: String(page), q: query, sort, direction })}`,
        { cache: "no-store" },
      );
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      if (version === seq.current) {
        setData(j);
        setError("");
      }
    } catch (e) {
      if (version === seq.current)
        setError(
          e instanceof Error ? e.message : "Could not load governance records.",
        );
    } finally {
      if (version === seq.current) setLoading(false);
    }
  }, [role, kind, page, query, sort, direction]);
  useEffect(() => {
    const timer = setTimeout(() => void load(), 150);
    return () => {
      clearTimeout(timer);
      seq.current++;
    };
  }, [load]);
  useEffect(() => {
    setSelected(deepRecord);
  }, [deepRecord]);
  const definition = data?.types.find((t) => t.code === kind);
  const owners = useMemo(
    () => new Map(data?.owners.map((p) => [p.id, personName(p)]) || []),
    [data],
  );
  return (
    <main className="p-5 text-white lg:p-7">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs text-orange-400">
            {data?.organization.name} · Organization Administrator
          </p>
          <h1 className="mt-1 text-2xl font-bold">Governance & risk</h1>
        </div>
        {data?.authorization.create && (
          <button
            className={`${button} bg-orange-600`}
            onClick={() => setCreating(true)}
          >
            + New record
          </button>
        )}
      </div>
      <p className="mt-3 text-sm text-neutral-400">
        Policies, coverage, governing-body renewals and incident decisions.
      </p>
      {error && (
        <p role="alert" className="mt-4 text-red-300">
          {error}{" "}
          <button className="underline" onClick={() => void load()}>
            Retry
          </button>
        </p>
      )}
      <nav
        aria-label="Governance categories"
        className="my-5 flex flex-wrap gap-2"
      >
        {data?.types.map((t) => (
          <button
            key={t.code}
            onClick={() => {
              setKind(t.code);
              setPage(0);
            }}
            className={`${button} ${kind === t.code ? "bg-orange-600" : "border border-neutral-600"}`}
          >
            {t.name}
          </button>
        ))}
      </nav>
      <label className="block max-w-sm text-sm">
        Search titles
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(0);
          }}
          className={input}
        />
      </label>
      <div
        className="mt-4 overflow-x-auto rounded-xl border border-neutral-700"
        aria-busy={loading}
      >
        <table className="w-full text-left text-sm">
          <thead className="bg-[#202226]">
            <tr>
              {[
                ["title", "Record"],
                ["status", "Status"],
                ["due_on", "Follow-up due"],
                ["updated_at", "Updated"],
              ].map(([key, label]) => (
                <th
                  key={key}
                  aria-sort={
                    sort === key
                      ? direction === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                  className="p-3"
                >
                  <button
                    onClick={() => {
                      setSort(key);
                      setDirection(
                        sort === key && direction === "asc" ? "desc" : "asc",
                      );
                      setPage(0);
                    }}
                  >
                    {label}{" "}
                    {sort === key ? (direction === "asc" ? "↑" : "↓") : "↕"}
                  </button>
                </th>
              ))}
              <th className="p-3">Owner</th>
            </tr>
          </thead>
          <tbody>
            {!loading &&
              data?.rows.map((r) => (
                <tr key={r.id} className="border-t border-neutral-700">
                  <td className="p-3">
                    <button
                      className="text-blue-200 hover:underline"
                      onClick={() => setSelected(r.id)}
                    >
                      {r.title}
                    </button>
                  </td>
                  <td className="p-3">{human(r.status)}</td>
                  <td className="p-3">{r.due_on || "Not set"}</td>
                  <td className="p-3">
                    {new Date(r.updated_at).toLocaleDateString()}
                  </td>
                  <td className="p-3">
                    {r.owner_person_id
                      ? owners.get(r.owner_person_id) ||
                        "Assigned administrator"
                      : "Organization Admin queue"}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        {loading ? (
          <p role="status" className="p-5 text-neutral-400">
            Loading records…
          </p>
        ) : (
          !data?.rows.length && (
            <p className="p-5 text-neutral-400">No matching records.</p>
          )
        )}
      </div>
      <div className="mt-4 flex items-center justify-between text-sm">
        <span>Page {page + 1} · 25 records per page</span>
        <div className="flex gap-2">
          <button
            className={`${button} border border-neutral-600`}
            disabled={!page || loading}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </button>
          <button
            className={`${button} border border-neutral-600`}
            disabled={!data?.hasMore || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      </div>
      {data && (selected || creating) && (
        <GovernanceDrawer
          key={selected || `new-${kind}`}
          role={role}
          id={selected}
          definition={definition!}
          config={data}
          onClose={() => {
            setSelected(null);
            setCreating(false);
          }}
          onSaved={() => void load()}
        />
      )}
    </main>
  );
}

function GovernanceDrawer({
  role,
  id,
  definition,
  config,
  onClose,
  onSaved,
}: {
  role: string;
  id: string | null;
  definition: Definition;
  config: Config;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [detail, setDetail] = useState<Detail | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [editing, setEditing] = useState(!id),
    [notice, setNotice] = useState("");
  const [recordId, setRecordId] = useState(() => id || crypto.randomUUID());
  const [draft, setDraft] = useState({
    title: "",
    due_on: "",
    owner_person_id: "",
    details: {} as Record<string, string>,
  });
  const [reason, setReason] = useState(""),
    [decision, setDecision] = useState(""),
    [replacement, setReplacement] = useState("");
  const root = useRef<HTMLElement>(null);
  const currentType =
    config.types.find((t) => t.code === detail?.row.kind) || definition;
  const load = useCallback(async () => {
    const r = await authenticatedFetch(
      `/api/admin-governance?${new URLSearchParams({ role, id: recordId })}`,
      { cache: "no-store" },
    );
    const j = await r.json();
    if (!r.ok) throw new Error(j.error);
    setDetail(j);
    setDraft({
      title: j.row.title,
      due_on: j.row.due_on || "",
      owner_person_id: j.row.owner_person_id || "",
      details: j.row.details,
    });
    setDecision("");
  }, [role, recordId]);
  useEffect(() => {
    if (id) void load().catch((e) => setError(e.message));
  }, [id, load]);
  useEffect(() => {
    const focused = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    root.current?.focus();
    function key(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
      if (e.key === "Tab") {
        const elements = Array.from(
          root.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]',
          ) || [],
        );
        const first = elements[0],
          last = elements.at(-1);
        if (!first) return;
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === root.current)
        ) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", key);
      focused?.focus();
    };
  }, [onClose]);
  const mutate = async (operation: string, values: unknown) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const r = await authenticatedFetch("/api/admin-governance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          id: recordId,
          operation,
          expectedVersion: detail?.row.version,
          reason,
          values,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setRecordId(j.row.id);
      await load();
      setEditing(false);
      setReason("");
      setNotice("Record saved. Linked work and audit history updated.");
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  };
  const upload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(true);
    setError("");
    try {
      const body = new FormData(form);
      body.set("id", recordId);
      body.set("role", role);
      body.set("version", String(detail?.row.version));
      const r = await authenticatedFetch("/api/admin-governance-file", {
        method: "POST",
        body,
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      await load();
      form.reset();
      setNotice("Evidence saved.");
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  };
  const openFile = async (file: string) => {
    setError("");
    try {
      const r = await authenticatedFetch(
        `/api/admin-governance-file?${new URLSearchParams({ role, id: recordId, file })}`,
      );
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      window.open(j.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to open file.");
    }
  };
  const locked =
    detail &&
    [
      "active",
      "closed",
      "superseded",
      "withdrawn",
      "cancelled",
      "expired",
    ].includes(detail.row.status);
  return createPortal(
    <div
      className="fixed inset-0 z-[170] bg-black/70"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <aside
        ref={root}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="governance-title"
        className="ml-auto h-full w-full max-w-6xl overflow-y-auto border-l border-neutral-600 bg-[#242529] p-5 text-white"
      >
        <header className="flex justify-between gap-4">
          <div>
            <p className="text-xs text-orange-300">{currentType.name}</p>
            <h2 id="governance-title" className="mt-1 text-xl font-bold">
              {detail?.row.title || "New record"}
            </h2>
            {detail && (
              <p className="mt-1 text-sm text-neutral-300">
                {human(detail.row.status)} · Version {detail.row.version}
              </p>
            )}
          </div>
          <button
            disabled={busy}
            onClick={onClose}
            className={`${button} border border-neutral-600`}
          >
            Close
          </button>
        </header>
        {error && (
          <p
            role="alert"
            className="my-4 rounded border border-red-700 p-3 text-red-200"
          >
            {error}{" "}
            {detail && (
              <button
                className="underline"
                onClick={() => void load().catch((e) => setError(e.message))}
              >
                Reload record
              </button>
            )}
          </p>
        )}
        {notice && (
          <p role="status" className="my-4 text-emerald-200">
            {notice}
          </p>
        )}
        {!detail && id && !error ? (
          <p className="mt-6">Loading record…</p>
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr_0.8fr]">
            <section>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Record details</h3>
                {detail && config.authorization.edit && !locked && !editing && (
                  <button
                    onClick={() => {
                      setEditing(true);
                      setReason("");
                    }}
                    className={`${button} bg-blue-700`}
                  >
                    Edit record
                  </button>
                )}
              </div>
              {editing ? (
                <form
                  className="mt-3 space-y-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void mutate(detail ? "edit" : "create", {
                      ...draft,
                      kind: currentType.code,
                    });
                  }}
                >
                  <label className="block text-xs">
                    Title
                    <input
                      required
                      maxLength={250}
                      value={draft.title}
                      onChange={(e) =>
                        setDraft({ ...draft, title: e.target.value })
                      }
                      className={input}
                    />
                  </label>
                  {currentType.fields.map((f) => (
                    <label key={f.key} className="block text-xs">
                      {f.label}
                      {f.required ? " *" : ""}
                      {f.type === "textarea" ? (
                        <textarea
                          required={f.required}
                          maxLength={50000}
                          rows={6}
                          value={draft.details[f.key] || ""}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              details: {
                                ...draft.details,
                                [f.key]: e.target.value,
                              },
                            })
                          }
                          className={input}
                        />
                      ) : f.options ? (
                        <select
                          required={f.required}
                          value={draft.details[f.key] || ""}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              details: {
                                ...draft.details,
                                [f.key]: e.target.value,
                              },
                            })
                          }
                          className={input}
                        >
                          <option value="">Select</option>
                          {f.options.map((v) => (
                            <option key={v}>{v}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          required={f.required}
                          type={f.type}
                          step={f.type === "number" ? "0.01" : undefined}
                          min={f.type === "number" ? 0 : undefined}
                          value={draft.details[f.key] || ""}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              details: {
                                ...draft.details,
                                [f.key]: e.target.value,
                              },
                            })
                          }
                          className={input}
                        />
                      )}
                    </label>
                  ))}
                  <OwnerFields
                    config={config}
                    draft={draft}
                    change={setDraft}
                  />
                  <label className="block text-xs">
                    Reason for this change
                    <textarea
                      required
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className={input}
                    />
                  </label>
                  <div className="flex gap-2">
                    <button
                      disabled={busy}
                      className={`${button} bg-orange-600`}
                    >
                      Save record
                    </button>
                    {detail && (
                      <button
                        type="button"
                        disabled={busy}
                        className={button}
                        onClick={() => {
                          setEditing(false);
                          void load().catch((e) => setError(e.message));
                        }}
                      >
                        Cancel edit
                      </button>
                    )}
                  </div>
                </form>
              ) : (
                detail && (
                  <dl className="mt-3 space-y-4">
                    {currentType.fields.map((f) => (
                      <div key={f.key}>
                        <dt className="text-xs text-neutral-400">{f.label}</dt>
                        <dd className="mt-1 whitespace-pre-wrap break-words text-sm">
                          {detail.row.details[f.key] || "Not recorded"}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )
              )}
            </section>
            <section className="space-y-5">
              <h3 className="font-semibold">Work & decisions</h3>
              {detail && !editing && (
                <>
                  {config.authorization.edit && (
                    <form
                      className="space-y-3 rounded border border-neutral-600 p-3"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void mutate("assign", {
                          owner_person_id: draft.owner_person_id,
                          due_on: draft.due_on,
                        });
                      }}
                    >
                      <OwnerFields
                        config={config}
                        draft={draft}
                        change={setDraft}
                      />
                      <label className="block text-xs">
                        Assignment reason
                        <input
                          required
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          className={input}
                        />
                      </label>
                      <button
                        disabled={busy}
                        className={`${button} bg-blue-700`}
                      >
                        Update responsibility
                      </button>
                    </form>
                  )}
                  {config.authorization.decide &&
                    currentType.transitions[detail.row.status]?.length > 0 && (
                      <form
                        className="space-y-3 rounded border border-neutral-600 p-3"
                        onSubmit={(e) => {
                          e.preventDefault();
                          void mutate("transition", {
                            status: decision,
                            replacement_id: replacement || null,
                          });
                        }}
                      >
                        <label className="block text-xs">
                          Next action
                          <select
                            required
                            value={decision}
                            onChange={(e) => setDecision(e.target.value)}
                            className={input}
                          >
                            <option value="">Select action</option>
                            {currentType.transitions[detail.row.status].map(
                              (s) => (
                                <option key={s} value={s}>
                                  {transitionLabel[s] || human(s)}
                                </option>
                              ),
                            )}
                          </select>
                        </label>
                        {decision === "superseded" && (
                          <label className="block text-xs">
                            Active replacement policy
                            <select
                              required
                              value={replacement}
                              onChange={(e) => setReplacement(e.target.value)}
                              className={input}
                            >
                              <option value="">
                                Select active replacement
                              </option>
                              {config.replacements
                                .filter((r) => r.id !== recordId)
                                .map((r) => (
                                  <option key={r.id} value={r.id}>
                                    {r.title}
                                  </option>
                                ))}
                            </select>
                          </label>
                        )}
                        <label className="block text-xs">
                          Decision reason
                          <textarea
                            required
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className={input}
                          />
                        </label>
                        <button
                          disabled={busy || !decision}
                          className={`${button} ${["cancelled", "withdrawn", "rejected"].includes(decision) ? "bg-red-800" : "bg-emerald-700"}`}
                        >
                          Record decision
                        </button>
                        {currentType.code === "sanction" && (
                          <p className="text-xs text-neutral-400">
                            Record the governing body’s submission or decision
                            here after it occurs.
                          </p>
                        )}
                      </form>
                    )}
                </>
              )}
              <h3 className="font-semibold">Activity</h3>
              {detail?.history.map((h) => (
                <article
                  key={h.id}
                  className="rounded border border-neutral-600 p-3 text-sm"
                >
                  <p className="font-semibold">
                    {human(h.action.replace("governance.", ""))} ·{" "}
                    {h.after_data.status}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap">{h.reason}</p>
                  <time className="mt-2 block text-xs text-neutral-400">
                    {new Date(h.occurred_at).toLocaleString()}
                  </time>
                </article>
              ))}
              {!detail && (
                <p className="text-sm text-neutral-400">
                  Save the record to start its history.
                </p>
              )}
            </section>
            <section className="space-y-4">
              <h3 className="font-semibold">Evidence & associations</h3>
              <p className="text-sm">{config.organization.name}</p>
              {detail && (
                <>
                  <p className="text-xs text-neutral-400">
                    Record reference: {recordId}
                  </p>
                  {detail.files.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => void openFile(f.id)}
                      className="block w-full rounded border border-neutral-600 p-3 text-left text-sm text-blue-200"
                    >
                      {f.title}
                    </button>
                  ))}
                  {!detail.files.length && (
                    <p className="text-sm text-neutral-400">
                      No evidence uploaded.
                    </p>
                  )}
                  {config.authorization.edit && (
                    <form
                      onSubmit={upload}
                      className="space-y-3 rounded border border-neutral-600 p-3"
                    >
                      <label className="block text-xs">
                        Evidence title
                        <input
                          required
                          name="title"
                          maxLength={200}
                          className={input}
                        />
                      </label>
                      <label className="block text-xs">
                        File (up to 10 MB)
                        <input
                          required
                          type="file"
                          name="file"
                          accept=".pdf,.png,.jpg,.jpeg,.txt"
                          className={input}
                        />
                      </label>
                      <button
                        disabled={busy || editing}
                        className={`${button} bg-orange-600`}
                      >
                        Upload evidence
                      </button>
                    </form>
                  )}
                </>
              )}
            </section>
          </div>
        )}
      </aside>
    </div>,
    document.body,
  );
}
function OwnerFields<T extends { owner_person_id: string; due_on: string }>({
  config,
  draft,
  change,
}: {
  config: Config;
  draft: T;
  change: (draft: T) => void;
}) {
  return (
    <>
      <label className="block text-xs">
        Responsible administrator
        <select
          value={draft.owner_person_id}
          onChange={(e) =>
            change({ ...draft, owner_person_id: e.target.value })
          }
          className={input}
        >
          <option value="">Organization Admin queue</option>
          {config.owners.map((p) => (
            <option key={p.id} value={p.id}>
              {personName(p)}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs">
        Follow-up due
        <input
          type="date"
          value={draft.due_on}
          onChange={(e) => change({ ...draft, due_on: e.target.value })}
          className={input}
        />
      </label>
    </>
  );
}
export default GovernanceWorkspace;

export function GovernanceRecordDrawer({
  role,
  id,
  onClose,
  onSaved,
}: {
  role: string;
  id: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [config, setConfig] = useState<Config | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    authenticatedFetch(
      `/api/admin-governance?role=${encodeURIComponent(role)}`,
      { cache: "no-store" },
    )
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        if (!cancelled) setConfig(j);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [role]);
  if (!config)
    return createPortal(
      <div className="fixed inset-0 z-[170] bg-black/70">
        <aside
          role="dialog"
          aria-modal="true"
          aria-label="Governance record"
          className="ml-auto h-full w-full max-w-xl bg-[#242529] p-6 text-white"
        >
          <button onClick={onClose}>Close</button>
          <p role={error ? "alert" : "status"} className="mt-6">
            {error || "Loading governance record…"}
          </p>
        </aside>
      </div>,
      document.body,
    );
  return (
    <GovernanceDrawer
      role={role}
      id={id}
      definition={config.types[0]}
      config={config}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}
