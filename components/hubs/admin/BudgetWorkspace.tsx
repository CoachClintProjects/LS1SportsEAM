"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createPortal } from "react-dom";
import { authenticatedFetch } from "@/lib/client/authenticatedFetch";
type Budget = {
  id: string;
  legal_entity_id: string;
  name: string;
  fiscal_year: number;
  currency: string;
  status: string;
  version: number;
};
type Line = {
  id: string;
  account_id: string;
  period_start: string;
  period_end: string;
  budget_amount: string;
};
type Data = {
  selectedId: string | null;
  budgets: Budget[];
  entities: { id: string; legal_name: string; base_currency: string }[];
  accounts: {
    id: string;
    legal_entity_id: string;
    account_code: string;
    account_name: string;
    account_type: string;
  }[];
  lines: Line[];
  history: {
    id: string;
    action: string;
    reason: string;
    occurred_at: string;
  }[];
  authorization: {
    createAccount: boolean;
    create: boolean;
    edit: boolean;
    approve: boolean;
  };
};
const input =
  "mt-1 w-full rounded border border-neutral-600 bg-[#17191d] px-3 py-2 text-sm text-white";
const button = "rounded px-3 py-2 text-sm font-semibold disabled:opacity-40";
const states: Record<string, string[]> = {
  draft: ["submitted", "cancelled"],
  submitted: ["draft", "approved", "cancelled"],
  approved: ["locked", "cancelled"],
  locked: ["closed"],
};
const labels: Record<string, string> = {
  submitted: "Submit for approval",
  draft: "Return to draft",
  approved: "Approve budget",
  locked: "Lock budget",
  closed: "Close budget",
  cancelled: "Cancel budget",
};
export function BudgetWorkspace({ role = "org_admin" }: { role?: string }) {
  const params = useSearchParams(),
    deep = params.get("record");
  const [data, setData] = useState<Data | null>(null),
    [selected, setSelected] = useState<string | null>(deep),
    [creating, setCreating] = useState(false),
    [editingBudget, setEditingBudget] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [notice, setNotice] = useState("");
  const [query, setQuery] = useState(""),
    [page, setPage] = useState(0),
    [sort, setSort] = useState<keyof Budget>("name"),
    [ascending, setAscending] = useState(true);
  const [draft, setDraft] = useState({
    id: "",
    legal_entity_id: "",
    name: "",
    fiscal_year: "",
    currency: "",
  });
  const [line, setLine] = useState({
      line_id: "",
      account_id: "",
      period_start: "",
      period_end: "",
      budget_amount: "",
    }),
    [reason, setReason] = useState("");
  const [account, setAccount] = useState({
    account_code: "",
    account_name: "",
    account_type: "expense",
    reason: "",
  });
  const requestVersion = useRef(0),
    panel = useRef<HTMLElement>(null);
  const load = useCallback(async () => {
    const v = ++requestVersion.current;
    setLoading(true);
    try {
      const q = new URLSearchParams({ role });
      if (selected) q.set("id", selected);
      const r = await authenticatedFetch(`/api/admin-budgets?${q}`, {
        cache: "no-store",
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      if (v === requestVersion.current) {
        setData(j);
        setError("");
      }
    } catch (e) {
      if (v === requestVersion.current)
        setError(e instanceof Error ? e.message : "Budget load failed.");
    } finally {
      if (v === requestVersion.current) setLoading(false);
    }
  }, [role, selected]);
  useEffect(() => {
    void load();
    return () => {
      requestVersion.current++;
    };
  }, [load]);
  useEffect(() => {
    setSelected(deep);
  }, [deep]);
  const close = useCallback(() => {
    setSelected(null);
    setCreating(false);
    setEditingBudget(false);
    setReason("");
    setLine({
      line_id: "",
      account_id: "",
      period_start: "",
      period_end: "",
      budget_amount: "",
    });
  }, []);
  useEffect(() => {
    if (!selected && !creating) return;
    const before = document.activeElement as HTMLElement | null,
      overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) close();
      if (e.key === "Tab") {
        const items = Array.from(
          panel.current?.querySelectorAll<HTMLElement>(
            "button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled)",
          ) || [],
        );
        const first = items[0],
          last = items.at(-1);
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === panel.current)
        ) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", key);
      before?.focus();
    };
  }, [selected, creating, busy, close]);
  const budget = data?.budgets.find((b) => b.id === selected);
  const act = async (operation: string, values: unknown) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const r = await authenticatedFetch("/api/admin-budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          id: operation === "create" ? draft.id : selected,
          operation,
          expectedVersion: budget?.version,
          values,
          reason,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      if (operation === "create") {
        setCreating(false);
        setSelected(j.row.id);
      } else await load();
      setEditingBudget(false);
      setReason("");
      setLine({
        line_id: "",
        account_id: "",
        period_start: "",
        period_end: "",
        budget_amount: "",
      });
      setNotice("Budget saved. Audit history and review work updated.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Budget save failed.");
    } finally {
      setBusy(false);
    }
  };
  const createAccount = async () => {
    if (!budget) return;
    setBusy(true);
    setError("");
    try {
      const r = await authenticatedFetch("/api/admin-budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          operation: "create_account",
          reason: account.reason,
          values: { ...account, legal_entity_id: budget.legal_entity_id },
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      await load();
      setAccount({
        account_code: "",
        account_name: "",
        account_type: "expense",
        reason: "",
      });
      setNotice("Account created.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Account creation failed.");
    } finally {
      setBusy(false);
    }
  };
  const rows = (data?.budgets || [])
    .filter((b) => b.name.toLowerCase().includes(query.toLowerCase()))
    .sort(
      (a, b) =>
        String(a[sort]).localeCompare(String(b[sort]), undefined, {
          numeric: true,
        }) * (ascending ? 1 : -1),
    );
  return (
    <main className="p-5 text-white lg:p-7">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs text-orange-400">{role.replaceAll("_", " ")}</p>
          <h1 className="text-2xl font-bold">Budgets & approval</h1>
        </div>
        {data?.authorization.create && (
          <button
            className={`${button} bg-orange-600`}
            onClick={() => {
              setDraft({
                id: crypto.randomUUID(),
                legal_entity_id:
                  data.entities.length === 1 ? data.entities[0].id : "",
                name: "",
                fiscal_year: "",
                currency:
                  data.entities.length === 1
                    ? data.entities[0].base_currency.trim()
                    : "",
              });
              setReason("");
              setError("");
              setCreating(true);
            }}
          >
            + Budget
          </button>
        )}
      </header>
      {error && (
        <p role="alert" className="mt-4 text-red-300">
          {error}{" "}
          <button className="underline" onClick={() => void load()}>
            Retry
          </button>
        </p>
      )}
      {notice && (
        <p role="status" className="mt-4 text-emerald-200">
          {notice}
        </p>
      )}
      <label className="mt-5 block max-w-sm text-sm">
        Search budgets
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(0);
          }}
          className={input}
        />
      </label>
      <div className="mt-4 overflow-x-auto rounded border border-neutral-700">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              {[
                ["name", "Budget"],
                ["fiscal_year", "Fiscal year"],
                ["currency", "Currency"],
                ["status", "Status"],
              ].map(([key, label]) => (
                <th key={key} className="p-3">
                  <button
                    onClick={() => {
                      setSort(key as keyof Budget);
                      setAscending(sort === key ? !ascending : true);
                      setPage(0);
                    }}
                  >
                    {label} {sort === key ? (ascending ? "↑" : "↓") : "↕"}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(page * 25, page * 25 + 25).map((b) => (
              <tr key={b.id} className="border-t border-neutral-700">
                <td className="p-3">
                  <button
                    onClick={() => {
                      setSelected(b.id);
                      setReason("");
                      setNotice("");
                    }}
                    className="text-blue-200 hover:underline"
                  >
                    {b.name}
                  </button>
                </td>
                <td className="p-3">{b.fiscal_year}</td>
                <td className="p-3">{b.currency}</td>
                <td className="p-3">{b.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && (
          <p role="status" className="p-4">
            Loading…
          </p>
        )}
        {!loading && !rows.length && (
          <p className="p-4 text-neutral-400">No matching budgets.</p>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between text-sm">
        <p>Page {page + 1} · 25 per page</p>
        <div className="flex gap-2">
          <button
            className={button}
            disabled={!page}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </button>
          <button
            className={button}
            disabled={(page + 1) * 25 >= rows.length}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      </div>
      {(selected || creating) &&
        createPortal(
          <div className="fixed inset-0 z-[170] bg-black/70">
            <aside
              tabIndex={-1}
              ref={panel}
              role="dialog"
              aria-modal="true"
              aria-labelledby="budget-heading"
              className="ml-auto h-full w-full max-w-5xl overflow-y-auto border-l border-neutral-600 bg-[#242529] p-6 text-white"
            >
              <header className="flex justify-between">
                <div>
                  <h2 id="budget-heading" className="text-xl font-bold">
                    {creating ? "New budget" : budget?.name || "Budget"}
                  </h2>
                  {budget && (
                    <p className="mt-1 text-sm text-neutral-400">
                      {budget.fiscal_year} · {budget.currency} · {budget.status}{" "}
                      · Version {budget.version}
                    </p>
                  )}
                </div>
                <button
                  disabled={busy}
                  className={`${button} border border-neutral-600`}
                  onClick={close}
                >
                  Close
                </button>
              </header>
              {error && (
                <p role="alert" className="my-4 text-red-300">
                  {error}{" "}
                  <button className="underline" onClick={() => void load()}>
                    Reload
                  </button>
                </p>
              )}
              {notice && (
                <p role="status" className="my-4 text-emerald-200">
                  {notice}
                </p>
              )}
              {creating || editingBudget ? (
                <form
                  className="mt-6 max-w-lg space-y-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void act(creating ? "create" : "edit", draft);
                  }}
                >
                  <label className="block text-sm">
                    Legal entity
                    <select
                      required
                      disabled={editingBudget}
                      value={draft.legal_entity_id}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          legal_entity_id: e.target.value,
                          currency:
                            data?.entities
                              .find((x) => x.id === e.target.value)
                              ?.base_currency.trim() || "",
                        })
                      }
                      className={input}
                    >
                      <option value="">Select legal entity</option>
                      {data?.entities.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.legal_name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {[
                    ["name", "Budget name", "text"],
                    ["fiscal_year", "Fiscal year", "number"],
                    ["currency", "Currency", "text"],
                  ].map(([key, label, type]) => (
                    <label key={key} className="block text-sm">
                      {label}
                      <input
                        required
                        type={type}
                        value={draft[key as keyof typeof draft]}
                        onChange={(e) =>
                          setDraft({ ...draft, [key]: e.target.value })
                        }
                        className={input}
                      />
                    </label>
                  ))}
                  <label className="block text-sm">
                    Reason
                    <textarea
                      required
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className={input}
                    />
                  </label>
                  <button
                    disabled={busy || !data?.entities.length}
                    className={`${button} bg-orange-600`}
                  >
                    {creating ? "Create draft" : "Save properties"}
                  </button>
                  {!data?.entities.length && (
                    <p className="text-sm text-amber-200">
                      Create the organization’s legal entity in Finance setup
                      first.
                    </p>
                  )}
                </form>
              ) : data?.selectedId !== selected ? (
                <p className="mt-6" role="status">
                  Loading budget…
                </p>
              ) : (
                budget && (
                  <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
                    <section>
                      <h3 className="font-semibold">Planned allocations</h3>
                      {budget.status === "draft" &&
                        data?.authorization.edit && (
                          <button
                            className={`${button} mt-3 bg-blue-700`}
                            onClick={() => {
                              setDraft({
                                id: budget.id,
                                legal_entity_id: budget.legal_entity_id,
                                name: budget.name,
                                fiscal_year: String(budget.fiscal_year),
                                currency: budget.currency.trim(),
                              });
                              setReason("");
                              setEditingBudget(true);
                            }}
                          >
                            Edit budget properties
                          </button>
                        )}
                      <div className="mt-3 space-y-3">
                        {data?.lines.map((l) => {
                          const a = data.accounts.find(
                            (a) => a.id === l.account_id,
                          );
                          return (
                            <article
                              key={l.id}
                              className="rounded border border-neutral-600 p-3 text-sm"
                            >
                              <p className="font-semibold">
                                {a
                                  ? `${a.account_code} · ${a.account_name}`
                                  : "Account unavailable"}
                              </p>
                              <p className="mt-1">
                                {l.period_start} → {l.period_end} ·{" "}
                                {Number(l.budget_amount).toFixed(2)}{" "}
                                {budget.currency}
                              </p>
                              {budget.status === "draft" &&
                                data.authorization.edit && (
                                  <button
                                    className={`${button} mt-2 bg-blue-700`}
                                    onClick={() =>
                                      setLine({
                                        line_id: l.id,
                                        account_id: l.account_id,
                                        period_start: l.period_start,
                                        period_end: l.period_end,
                                        budget_amount: String(l.budget_amount),
                                      })
                                    }
                                  >
                                    Edit allocation
                                  </button>
                                )}
                            </article>
                          );
                        })}
                        {!data?.lines.length && (
                          <p className="text-sm text-neutral-400">
                            No budget lines recorded.
                          </p>
                        )}
                      </div>
                      {budget.status === "draft" &&
                        data?.authorization.edit && (
                          <form
                            className="mt-5 space-y-3 rounded border border-neutral-600 p-4"
                            onSubmit={(e) => {
                              e.preventDefault();
                              void act("save_line", {
                                ...line,
                                line_id: line.line_id || crypto.randomUUID(),
                              });
                            }}
                          >
                            <h4 className="font-semibold">
                              {line.line_id
                                ? "Edit allocation"
                                : "Add allocation"}
                            </h4>
                            <label className="block text-xs">
                              Account
                              <select
                                required
                                value={line.account_id}
                                onChange={(e) =>
                                  setLine({
                                    ...line,
                                    account_id: e.target.value,
                                  })
                                }
                                className={input}
                              >
                                <option value="">Select account</option>
                                {data.accounts
                                  .filter(
                                    (a) =>
                                      a.legal_entity_id ===
                                      budget.legal_entity_id,
                                  )
                                  .map((a) => (
                                    <option key={a.id} value={a.id}>
                                      {a.account_code} · {a.account_name}
                                    </option>
                                  ))}
                              </select>
                            </label>
                            {[
                              ["period_start", "Period start", "date"],
                              ["period_end", "Period end", "date"],
                              ["budget_amount", "Planned amount", "number"],
                            ].map(([key, label, type]) => (
                              <label key={key} className="block text-xs">
                                {label}
                                <input
                                  required
                                  type={type}
                                  step={type === "number" ? "0.01" : undefined}
                                  min={type === "number" ? 0 : undefined}
                                  value={line[key as keyof typeof line]}
                                  onChange={(e) =>
                                    setLine({ ...line, [key]: e.target.value })
                                  }
                                  className={input}
                                />
                              </label>
                            ))}
                            <label className="block text-xs">
                              Change reason
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
                                className={`${button} bg-blue-700`}
                              >
                                Save allocation
                              </button>
                              {line.line_id && (
                                <button
                                  type="button"
                                  disabled={busy || !reason.trim()}
                                  onClick={() =>
                                    void act("delete_line", {
                                      line_id: line.line_id,
                                    })
                                  }
                                  className={`${button} bg-red-800`}
                                >
                                  Remove allocation
                                </button>
                              )}
                            </div>
                          </form>
                        )}
                    </section>
                    <section>
                      <h3 className="font-semibold">Approval & control</h3>
                      {data?.authorization.edit &&
                        (states[budget.status] || []).filter(
                          (s) =>
                            data.authorization.approve ||
                            ["submitted", "draft"].includes(s),
                        ).length > 0 && (
                          <div className="mt-3 space-y-3 rounded border border-neutral-600 p-4">
                            <label className="block text-xs">
                              Decision reason
                              <textarea
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                className={input}
                              />
                            </label>
                            {(states[budget.status] || [])
                              .filter(
                                (s) =>
                                  data.authorization.approve ||
                                  ["submitted", "draft"].includes(s),
                              )
                              .map((status) => (
                                <button
                                  key={status}
                                  disabled={busy || !reason.trim()}
                                  onClick={() =>
                                    void act("transition", { status })
                                  }
                                  className={`${button} mr-2 ${status === "cancelled" ? "bg-red-800" : status === "draft" ? "bg-blue-700" : "bg-emerald-700"}`}
                                >
                                  {labels[status]}
                                </button>
                              ))}
                          </div>
                        )}
                      {data?.authorization.createAccount && (
                        <details className="mt-5 rounded border border-neutral-600 p-3">
                          <summary className="cursor-pointer text-sm text-blue-200">
                            Create ledger account
                          </summary>
                          <div className="mt-3 space-y-3">
                            {[
                              ["account_code", "Account code"],
                              ["account_name", "Account name"],
                              ["reason", "Setup reason"],
                            ].map(([key, label]) => (
                              <label key={key} className="block text-xs">
                                {label}
                                <input
                                  value={account[key as keyof typeof account]}
                                  onChange={(e) =>
                                    setAccount({
                                      ...account,
                                      [key]: e.target.value,
                                    })
                                  }
                                  className={input}
                                />
                              </label>
                            ))}
                            <label className="block text-xs">
                              Account type
                              <select
                                value={account.account_type}
                                onChange={(e) =>
                                  setAccount({
                                    ...account,
                                    account_type: e.target.value,
                                  })
                                }
                                className={input}
                              >
                                {[
                                  "asset",
                                  "liability",
                                  "equity",
                                  "revenue",
                                  "expense",
                                ].map((v) => (
                                  <option key={v}>{v}</option>
                                ))}
                              </select>
                            </label>
                            <button
                              disabled={
                                busy ||
                                !account.account_code.trim() ||
                                !account.account_name.trim() ||
                                !account.reason.trim()
                              }
                              onClick={() => void createAccount()}
                              className={`${button} bg-orange-600`}
                            >
                              Create account
                            </button>
                          </div>
                        </details>
                      )}
                      <h3 className="mt-6 font-semibold">History</h3>
                      {data?.history.map((h) => (
                        <article
                          key={h.id}
                          className="mt-3 rounded border border-neutral-600 p-3 text-sm"
                        >
                          <p>
                            {h.action
                              .replace("budget.", "")
                              .replaceAll("_", " ")}
                          </p>
                          <p className="mt-1">{h.reason}</p>
                          <p className="mt-1 text-xs text-neutral-400">
                            {new Date(h.occurred_at).toLocaleString()}
                          </p>
                        </article>
                      ))}
                    </section>
                  </div>
                )
              )}
            </aside>
          </div>,
          document.body,
        )}
    </main>
  );
}
export default BudgetWorkspace;
