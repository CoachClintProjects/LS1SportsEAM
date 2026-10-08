"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { authenticatedFetch } from "@/lib/client/authenticatedFetch";
import { cents, decimal, ledgerCsv } from "@/lib/client/ledgerAmounts";
import { AdminDrawerShell } from "./AdminDrawerShell";
type Account = {
  id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  active: boolean;
};
type Ledger = {
  id: string;
  name: string;
  code: string;
  currency: string;
  accounting_basis: string;
};
type Journal = {
  id: string;
  legal_entity_id: string;
  ledger_id: string;
  journal_number: string;
  journal_date: string;
  description: string;
  status: string;
  version: number;
  reversal_of: string | null;
};
type Line = {
  account_id: string;
  debit: string;
  credit: string;
  description: string;
};
type Period = {
  id: string;
  fiscal_year_id: string;
  period_no: number;
  starts_on: string;
  ends_on: string;
  status: string;
  version: number;
};
type Data = {
  entities: { id: string; legal_name: string; base_currency: string }[];
  entity: string | null;
  accounts: Account[];
  ledgers: Ledger[];
  years: {
    id: string;
    fiscal_year: number;
    starts_on: string;
    ends_on: string;
    status: string;
  }[];
  periods: Period[];
  journals: Journal[];
  hasMore: boolean;
  journal: Journal | null;
  lines: Line[];
  history: {
    id: string;
    action: string;
    occurred_at: string;
    reason: string;
  }[];
  reversal: { id: string; journal_number: string }[];
  authorization: {
    create: boolean;
    edit: boolean;
    post: boolean;
    setup: boolean;
  };
};
const field =
  "mt-1 w-full rounded border border-neutral-600 bg-[#17191d] px-3 py-2 text-sm text-white";
const button = "rounded px-3 py-2 text-sm font-semibold disabled:opacity-40";
async function request(path: string, body?: Record<string, unknown>) {
  const r = await authenticatedFetch(
    path,
    body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : { cache: "no-store" },
  );
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || "Accounting request failed.");
  return j;
}
export function LedgerWorkspace({ role = "treasurer" }: { role?: string }) {
  const params = useSearchParams(),
    deep = params.get("record");
  const [data, setData] = useState<Data | null>(null),
    [entity, setEntity] = useState(params.get("entity") || ""),
    [selected, setSelected] = useState<string | null>(deep),
    [mode, setMode] = useState<"journals" | "periods" | "reports">(
      params.get("period") ? "periods" : "journals",
    ),
    [selectedPeriod, setSelectedPeriod] = useState<string | null>(
      params.get("period"),
    ),
    [creating, setCreating] = useState(false),
    [setup, setSetup] = useState(false),
    [page, setPage] = useState(0),
    [sort, setSort] = useState("journal_date"),
    [direction, setDirection] = useState("desc"),
    [search, setSearch] = useState(""),
    [query, setQuery] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const version = useRef(0);
  const load = useCallback(async () => {
    const v = ++version.current;
    setLoading(true);
    try {
      const q = new URLSearchParams({
        role,
        page: String(page),
        sort,
        direction,
        search: query,
      });
      if (entity) q.set("entity", entity);
      if (selected) q.set("id", selected);
      const j = await request(`/api/admin-ledger?${q}`);
      if (v === version.current) {
        setData(j);
        setError("");
      }
    } catch (e) {
      if (v === version.current)
        setError(e instanceof Error ? e.message : "Ledger unavailable.");
    } finally {
      if (v === version.current) setLoading(false);
    }
  }, [role, entity, selected, page, sort, direction, query]);
  useEffect(() => {
    void load();
    return () => {
      version.current++;
    };
  }, [load]);
  useEffect(() => {
    setSelected(deep);
  }, [deep]);
  if (!data)
    return (
      <div className="p-6 text-neutral-300">
        <p>{error || "Loading accounting records…"}</p>
        {error && (
          <button
            className={`${button} mt-3 bg-blue-700`}
            onClick={() => void load()}
          >
            Retry
          </button>
        )}
      </div>
    );
  return (
    <section className="p-6 text-white">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">General ledger</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Journals, fiscal periods and posted financial statements.
          </p>
        </div>
        <div className="flex gap-2">
          {data.authorization.setup && (
            <button
              className={`${button} bg-blue-700`}
              onClick={() => setSetup(true)}
            >
              Accounting setup
            </button>
          )}
          {data.authorization.create && (
            <button
              disabled={!data.ledgers.length || !data.accounts.length}
              className={`${button} bg-[#FA4616]`}
              onClick={() => setCreating(true)}
            >
              New journal
            </button>
          )}
        </div>
      </header>
      {data.entities.length > 1 && (
        <label className="mt-4 block text-sm">
          Legal entity
          <select
            className={field}
            value={data.entity || ""}
            onChange={(e) => {
              setEntity(e.target.value);
              setSelected(null);
              setPage(0);
            }}
          >
            {data.entities.map((e) => (
              <option key={e.id} value={e.id}>
                {e.legal_name}
              </option>
            ))}
          </select>
        </label>
      )}
      {error && (
        <p
          role="alert"
          className="mt-4 rounded border border-red-700 bg-red-950/50 p-3 text-red-200"
        >
          {error}{" "}
          <button className="underline" onClick={() => void load()}>
            Retry
          </button>
        </p>
      )}
      {!data.entity ? (
        <p className="mt-6 text-neutral-300">
          Create the organization&apos;s legal entity in Billing → Finance setup
          first.
        </p>
      ) : (
        <>
          <nav aria-label="Accounting sections" className="my-5 flex gap-2">
            {(
              [
                ["journals", "Journals"],
                ["periods", "Fiscal periods"],
                ["reports", "Financial statements"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setMode(k)}
                className={`${button} ${mode === k ? "bg-blue-700" : "border border-neutral-600"}`}
              >
                {label}
              </button>
            ))}
          </nav>
          {mode === "journals" && (
            <>
              <form
                className="mb-4 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  setPage(0);
                  setQuery(search);
                }}
              >
                <input
                  aria-label="Search journal number or description"
                  placeholder="Search journals"
                  className={`${field} mt-0 max-w-md`}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <button className={`${button} bg-blue-700`}>Search</button>
              </form>
              <div
                className="overflow-x-auto rounded border border-neutral-700"
                aria-busy={loading}
              >
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#17191d]">
                    <tr>
                      {[
                        ["journal_number", "Journal"],
                        ["journal_date", "Date"],
                        ["description", "Description"],
                        ["status", "Status"],
                      ].map(([k, label]) => (
                        <th
                          className="p-3"
                          key={k}
                          aria-sort={
                            sort === k
                              ? direction === "asc"
                                ? "ascending"
                                : "descending"
                              : "none"
                          }
                        >
                          <button
                            onClick={() => {
                              setPage(0);
                              setSort(k);
                              setDirection(
                                sort === k && direction === "asc"
                                  ? "desc"
                                  : "asc",
                              );
                            }}
                          >
                            {label}{" "}
                            {sort === k
                              ? direction === "asc"
                                ? "↑"
                                : "↓"
                              : "↕"}
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.journals.map((j) => (
                      <tr
                        key={j.id}
                        className="border-t border-neutral-700 hover:bg-white/5"
                      >
                        <td className="p-3">
                          <button
                            onClick={() => setSelected(j.id)}
                            className="font-semibold text-blue-300 underline"
                          >
                            {j.journal_number}
                          </button>
                        </td>
                        <td className="p-3">{j.journal_date}</td>
                        <td className="p-3">{j.description}</td>
                        <td className="p-3">
                          <span
                            className={
                              j.status === "posted"
                                ? "text-green-300"
                                : j.status === "cancelled"
                                  ? "text-red-300"
                                  : "text-amber-300"
                            }
                          >
                            {j.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!data.journals.length && (
                  <p className="p-5 text-neutral-400">
                    {query
                      ? "No journals match this search."
                      : "No journals have been recorded."}
                  </p>
                )}
              </div>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-sm text-neutral-400">
                  Page {page + 1} · 25 records per page
                </span>
                <div className="flex gap-2">
                  <button
                    className={`${button} border border-neutral-600`}
                    disabled={loading || !page}
                    onClick={() => setPage(page - 1)}
                  >
                    Previous
                  </button>
                  <button
                    className={`${button} border border-neutral-600`}
                    disabled={loading || !data.hasMore}
                    onClick={() => setPage(page + 1)}
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
          {mode === "periods" && (
            <div className="space-y-4">
              {data.years.map((y) => (
                <section
                  key={y.id}
                  className="rounded border border-neutral-700 p-4"
                >
                  <h2 className="font-bold">
                    Fiscal year {y.fiscal_year} · {y.starts_on} – {y.ends_on}
                  </h2>
                  <table className="mt-3 w-full text-left text-sm">
                    <thead>
                      <tr>
                        <th className="p-2">Period</th>
                        <th>Start</th>
                        <th>End</th>
                        <th>Posting status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.periods
                        .filter((p) => p.fiscal_year_id === y.id)
                        .map((p) => (
                          <tr
                            key={p.id}
                            className="border-t border-neutral-700"
                          >
                            <td className="p-2">
                              <button
                                className="text-blue-300 underline"
                                onClick={() => setSelectedPeriod(p.id)}
                              >
                                {p.period_no}
                              </button>
                            </td>
                            <td>{p.starts_on}</td>
                            <td>{p.ends_on}</td>
                            <td
                              className={
                                p.status === "open"
                                  ? "text-green-300"
                                  : "text-amber-300"
                              }
                            >
                              {p.status}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </section>
              ))}
              {!data.years.length && (
                <p className="text-neutral-400">
                  No fiscal year configured. Organization Admin can create one
                  in Accounting setup.
                </p>
              )}
            </div>
          )}
          {mode === "reports" && (
            <Statements
              role={role}
              entity={data.entity}
              ledgers={data.ledgers}
            />
          )}
        </>
      )}
      {selectedPeriod && data.periods.some((p) => p.id === selectedPeriod) && (
        <PeriodDrawer
          key={selectedPeriod}
          period={data.periods.find((p) => p.id === selectedPeriod)!}
          role={role}
          entity={data.entity!}
          canDecide={data.authorization.post}
          onClose={() => setSelectedPeriod(null)}
          onSaved={load}
        />
      )}
      {setup && (
        <Setup
          data={data}
          role={role}
          onClose={() => setSetup(false)}
          onSaved={load}
        />
      )}
      {(creating || (selected && data.journal?.id === selected)) && (
        <JournalDrawer
          key={creating ? "new" : selected}
          data={data}
          role={role}
          creating={creating}
          onClose={() => {
            setSelected(null);
            setCreating(false);
          }}
          onSaved={async (id) => {
            setCreating(false);
            if (id !== selected) setSelected(id);
            else await load();
          }}
        />
      )}
    </section>
  );
}
function JournalDrawer({
  data,
  role,
  creating,
  onClose,
  onSaved,
}: {
  data: Data;
  role: string;
  creating: boolean;
  onClose: () => void;
  onSaved: (id: string) => Promise<void>;
}) {
  const j = creating ? null : data.journal!;
  const [id] = useState(() => crypto.randomUUID()),
    [draft, setDraft] = useState({
      ledger_id: j?.ledger_id || data.ledgers[0]?.id || "",
      journal_number: j?.journal_number || "",
      journal_date: j?.journal_date || "",
      description: j?.description || "",
    }),
    [lines, setLines] = useState<Line[]>(
      creating
        ? [
            { account_id: "", debit: "0", credit: "0", description: "" },
            { account_id: "", debit: "0", credit: "0", description: "" },
          ]
        : data.lines.map((l) => ({
            ...l,
            debit: String(l.debit),
            credit: String(l.credit),
          })),
    ),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [reversing, setReversing] = useState(false),
    [reversal, setReversal] = useState({
      reversal_id: crypto.randomUUID(),
      journal_number: "",
      journal_date: "",
    });
  useEffect(() => {
    if (j) {
      setDraft({
        ledger_id: j.ledger_id,
        journal_number: j.journal_number,
        journal_date: j.journal_date,
        description: j.description,
      });
      setLines(
        data.lines.map((l) => ({
          ...l,
          debit: String(l.debit),
          credit: String(l.credit),
        })),
      );
    }
  }, [j?.version]);
  const editable =
    (creating || j?.status === "draft") &&
    (creating ? data.authorization.create : data.authorization.edit);
  const dirty =
    creating ||
    JSON.stringify(draft) !==
      JSON.stringify({
        ledger_id: j?.ledger_id,
        journal_number: j?.journal_number,
        journal_date: j?.journal_date,
        description: j?.description,
      }) ||
    JSON.stringify(lines) !==
      JSON.stringify(
        data.lines.map((l) => ({
          ...l,
          debit: String(l.debit),
          credit: String(l.credit),
        })),
      );
  let debit = BigInt(0),
    credit = BigInt(0),
    valid = true;
  try {
    for (const l of lines) {
      debit += cents(l.debit);
      credit += cents(l.credit);
    }
  } catch {
    valid = false;
  }
  const act = async (operation: string) => {
    setBusy(true);
    setError("");
    try {
      const values =
        operation === "reverse"
          ? reversal
          : { ...draft, legal_entity_id: data.entity, lines };
      const result = await request("/api/admin-ledger", {
        role,
        id: j?.id || id,
        operation,
        expectedVersion: j?.version || 0,
        values,
        reason,
      });
      await onSaved(result.row.id);
      setReason("");
      setReversing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Journal save failed.");
    } finally {
      setBusy(false);
    }
  };
  const change = (index: number, key: keyof Line, value: string) =>
    setLines(lines.map((l, i) => (i === index ? { ...l, [key]: value } : l)));
  return (
    <AdminDrawerShell
      title={creating ? "New journal" : j!.journal_number}
      onClose={onClose}
      busy={busy}
    >
      <p className="mb-4 text-sm text-neutral-300">
        {creating ? "Draft" : j!.status} ·{" "}
        {data.ledgers.find((l) => l.id === draft.ledger_id)?.currency}{" "}
        {j?.reversal_of ? "· Reversal journal" : ""}
      </p>
      {error && (
        <p role="alert" className="mb-4 rounded bg-red-950 p-3 text-red-200">
          {error}
        </p>
      )}
      <fieldset
        disabled={!editable || busy}
        className="grid gap-4 sm:grid-cols-2"
      >
        <label>
          Ledger
          <select
            disabled={!creating || busy}
            className={field}
            value={draft.ledger_id}
            onChange={(e) => setDraft({ ...draft, ledger_id: e.target.value })}
          >
            {data.ledgers.map((l) => (
              <option key={l.id} value={l.id}>
                {l.code} · {l.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Journal number
          <input
            className={field}
            value={draft.journal_number}
            onChange={(e) =>
              setDraft({ ...draft, journal_number: e.target.value })
            }
          />
        </label>
        <label>
          Journal date
          <input
            type="date"
            className={field}
            value={draft.journal_date}
            onChange={(e) =>
              setDraft({ ...draft, journal_date: e.target.value })
            }
          />
        </label>
        <label>
          Description
          <input
            className={field}
            value={draft.description}
            onChange={(e) =>
              setDraft({ ...draft, description: e.target.value })
            }
          />
        </label>
      </fieldset>
      <h3 className="mt-6 font-bold">Journal lines</h3>
      <p className="my-2 text-sm text-neutral-400">
        Each line has one debit or credit. Posting requires equal totals.
      </p>
      <div className="space-y-3">
        {lines.map((l, i) => (
          <fieldset
            key={i}
            disabled={!editable || busy}
            className="grid gap-2 rounded border border-neutral-600 p-3 sm:grid-cols-4"
          >
            <label className="sm:col-span-2 text-xs">
              Account
              <select
                className={field}
                value={l.account_id}
                onChange={(e) => change(i, "account_id", e.target.value)}
              >
                <option value="">Select account</option>
                {data.accounts
                  .filter((a) => a.active || a.id === l.account_id)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.account_code} · {a.account_name}
                      {a.active ? "" : " (inactive)"}
                    </option>
                  ))}
              </select>
            </label>
            <label className="text-xs">
              Debit
              <input
                inputMode="decimal"
                className={field}
                value={l.debit}
                onChange={(e) => change(i, "debit", e.target.value)}
              />
            </label>
            <label className="text-xs">
              Credit
              <input
                inputMode="decimal"
                className={field}
                value={l.credit}
                onChange={(e) => change(i, "credit", e.target.value)}
              />
            </label>
            <label className="sm:col-span-3 text-xs">
              Line description
              <input
                className={field}
                value={l.description || ""}
                onChange={(e) => change(i, "description", e.target.value)}
              />
            </label>
            {editable && (
              <button
                className={`${button} mt-4 border border-red-700 text-red-300`}
                disabled={lines.length <= 2}
                onClick={() => setLines(lines.filter((_, n) => n !== i))}
              >
                Remove line
              </button>
            )}
          </fieldset>
        ))}
      </div>
      {editable && (
        <button
          className={`${button} mt-3 bg-blue-700`}
          disabled={busy || lines.length >= 500}
          onClick={() =>
            setLines([
              ...lines,
              { account_id: "", debit: "0", credit: "0", description: "" },
            ])
          }
        >
          Add line
        </button>
      )}
      <div
        className={`my-4 rounded border p-3 text-sm ${valid && debit === credit && debit > BigInt(0) ? "border-green-700 text-green-300" : "border-amber-700 text-amber-300"}`}
      >
        {valid
          ? `Debit ${decimal(debit)} · Credit ${decimal(credit)} · Difference ${decimal(debit - credit)}`
          : "Enter amounts with no more than two decimal places."}
      </div>
      {(editable ||
        (data.authorization.post &&
          j?.status === "posted" &&
          !data.reversal.length)) && (
        <label className="block text-sm">
          Reason for this action
          <textarea
            className={field}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={busy}
          />
        </label>
      )}
      <div className="mt-4 flex flex-wrap gap-3">
        {editable && (
          <button
            className={`${button} bg-blue-700`}
            disabled={busy || reason.trim().length < 5 || !valid}
            onClick={() => void act(creating ? "create" : "edit")}
          >
            {creating ? "Save draft" : "Save changes"}
          </button>
        )}
        {!creating && j?.status === "draft" && data.authorization.post && (
          <>
            <button
              className={`${button} bg-green-700`}
              disabled={
                busy ||
                dirty ||
                reason.trim().length < 5 ||
                !valid ||
                debit !== credit ||
                debit <= BigInt(0)
              }
              onClick={() => void act("post")}
            >
              Post journal
            </button>
            <button
              className={`${button} bg-red-800`}
              disabled={busy || reason.trim().length < 5}
              onClick={() => void act("cancel")}
            >
              Cancel draft
            </button>
          </>
        )}
        {j?.status === "posted" &&
          !data.reversal.length &&
          data.authorization.post && (
            <button
              className={`${button} bg-amber-700`}
              disabled={busy}
              onClick={() => setReversing(!reversing)}
            >
              Reverse journal
            </button>
          )}
      </div>
      {!creating && j?.status === "draft" && dirty && (
        <p className="mt-2 text-sm text-amber-300">
          Save changes before posting.
        </p>
      )}
      {reversing && (
        <section className="mt-4 rounded border border-amber-700 p-4">
          <p className="text-sm text-neutral-300">
            Creates and posts equal opposite entries in an open period. The
            original remains in the ledger.
          </p>
          <label className="mt-3 block text-sm">
            Reversal number
            <input
              className={field}
              value={reversal.journal_number}
              onChange={(e) =>
                setReversal({ ...reversal, journal_number: e.target.value })
              }
            />
          </label>
          <label className="mt-3 block text-sm">
            Reversal date
            <input
              type="date"
              className={field}
              value={reversal.journal_date}
              onChange={(e) =>
                setReversal({ ...reversal, journal_date: e.target.value })
              }
            />
          </label>
          <button
            className={`${button} mt-4 bg-red-800`}
            disabled={
              busy ||
              reason.trim().length < 5 ||
              !reversal.journal_date ||
              !reversal.journal_number
            }
            onClick={() => void act("reverse")}
          >
            Post reversal
          </button>
        </section>
      )}
      {!!data.reversal?.length && !creating && (
        <p className="mt-4 text-amber-300">
          Reversed by {data.reversal[0].journal_number}.
        </p>
      )}
      {!creating && (
        <section className="mt-6 border-t border-neutral-600 pt-4">
          <h3 className="font-bold">Decision history</h3>
          {data.history.map((h) => (
            <article
              key={h.id}
              className="mt-3 rounded border border-neutral-700 p-3 text-sm"
            >
              <p>
                {h.action.replace("ledger.", "")} ·{" "}
                {new Date(h.occurred_at).toLocaleString()}
              </p>
              <p className="mt-1 text-neutral-300">{h.reason}</p>
            </article>
          ))}
        </section>
      )}
    </AdminDrawerShell>
  );
}
function Setup({
  data,
  role,
  onClose,
  onSaved,
}: {
  data: Data;
  role: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [operation, setOperation] = useState("ledger"),
    [values, setValues] = useState<Record<string, string>>({
      accounting_basis: "accrual",
      account_type: "expense",
    }),
    [reason, setReason] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await request(
        operation === "account" ? "/api/admin-budgets" : "/api/admin-ledger",
        operation === "account"
          ? {
              role,
              operation: "create_account",
              values: { ...values, legal_entity_id: data.entity },
              reason,
            }
          : { role, operation, entity: data.entity, values, reason },
      );
      await onSaved();
      setNotice("Saved.");
      setReason("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Setup failed.");
    } finally {
      setBusy(false);
    }
  };
  const fields =
    operation === "ledger"
      ? [
          ["code", "Ledger code", "text"],
          ["name", "Ledger name", "text"],
        ]
      : operation === "account"
        ? [
            ["account_code", "Account code", "text"],
            ["account_name", "Account name", "text"],
          ]
        : [
            ["fiscal_year", "Fiscal year label", "number"],
            ["starts_on", "Starts on", "date"],
            ["ends_on", "Ends on", "date"],
          ];
  return (
    <AdminDrawerShell title="Accounting setup" onClose={onClose} busy={busy}>
      <p className="text-sm text-neutral-300">
        {data.entities.find((e) => e.id === data.entity)?.legal_name} ·{" "}
        {data.entities.find((e) => e.id === data.entity)?.base_currency}
      </p>
      <label className="mt-4 block">
        Create
        <select
          className={field}
          value={operation}
          onChange={(e) => {
            setOperation(e.target.value);
            setNotice("");
          }}
        >
          <option value="ledger">Ledger</option>
          <option value="fiscal_year">Fiscal year and monthly periods</option>
          <option value="account">Ledger account</option>
        </select>
      </label>
      {operation === "fiscal_year" && (
        <p className="mt-3 text-sm text-neutral-400">
          Creates calendar-month posting periods within the selected dates,
          including partial first or last months.
        </p>
      )}
      {fields.map(([key, label, type]) => (
        <label key={key} className="mt-4 block text-sm">
          {label}
          <input
            className={field}
            type={type}
            value={values[key] || ""}
            onChange={(e) => setValues({ ...values, [key]: e.target.value })}
          />
        </label>
      ))}
      {operation === "ledger" && (
        <label className="mt-4 block">
          Accounting basis
          <select
            className={field}
            value={values.accounting_basis}
            onChange={(e) =>
              setValues({ ...values, accounting_basis: e.target.value })
            }
          >
            <option value="accrual">Accrual</option>
            <option value="cash">Cash</option>
          </select>
        </label>
      )}
      {operation === "account" && (
        <label className="mt-4 block">
          Account type
          <select
            className={field}
            value={values.account_type}
            onChange={(e) =>
              setValues({ ...values, account_type: e.target.value })
            }
          >
            {["asset", "liability", "equity", "revenue", "expense"].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="mt-4 block">
        Reason
        <textarea
          className={field}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </label>
      {error && (
        <p role="alert" className="mt-3 text-red-300">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="mt-3 text-green-300">
          {notice}
        </p>
      )}
      <button
        className={`${button} mt-4 bg-green-700`}
        disabled={busy || !data.entity || reason.trim().length < 5}
        onClick={() => void save()}
      >
        Create
      </button>
    </AdminDrawerShell>
  );
}
function PeriodDrawer({
  period,
  role,
  entity,
  canDecide,
  onClose,
  onSaved,
}: {
  period: Period;
  role: string;
  entity: string;
  canDecide: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [reason, setReason] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [history, setHistory] = useState<
      { id: string; action: string; reason: string; occurred_at: string }[]
    >([]);
  useEffect(() => {
    let alive = true;
    request(
      "/api/admin-ledger?" +
        new URLSearchParams({
          role,
          entity,
          mode: "period_history",
          period: period.id,
        }),
    )
      .then((j) => {
        if (alive) setHistory(j.history);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [period.id, period.version, role, entity]);
  const act = async (status: string) => {
    setBusy(true);
    setError("");
    try {
      await request("/api/admin-ledger", {
        role,
        operation: "period",
        id: period.id,
        expectedVersion: period.version,
        values: { status },
        reason,
      });
      await onSaved();
      setReason("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Period action failed.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <AdminDrawerShell
      title={`Fiscal period ${period.period_no}`}
      onClose={onClose}
      busy={busy}
    >
      <p>
        {period.starts_on} – {period.ends_on} · <strong>{period.status}</strong>
      </p>
      <p className="mt-4 text-sm text-neutral-300">
        Submitting stops new postings and sends an approval task to Organization
        Admin. Resolve all draft journals and outstanding payment reconciliation
        runs before submitting. Record the reconciliation and statement review
        performed in your decision notes.
      </p>
      {error && (
        <p role="alert" className="mt-4 text-red-300">
          {error}
        </p>
      )}
      {canDecide && (
        <>
          <label className="mt-5 block text-sm">
            Decision notes
            <textarea
              className={field}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <div className="mt-4 flex gap-3">
            {period.status === "open" && (
              <button
                className={`${button} bg-blue-700`}
                disabled={busy || reason.trim().length < 5}
                onClick={() => void act("review")}
              >
                Submit for close
              </button>
            )}
            {role === "org_admin" && period.status === "review" && (
              <button
                className={`${button} bg-green-700`}
                disabled={busy || reason.trim().length < 5}
                onClick={() => void act("closed")}
              >
                Approve closure
              </button>
            )}
            {role === "org_admin" && period.status !== "open" && (
              <button
                className={`${button} bg-amber-700`}
                disabled={busy || reason.trim().length < 5}
                onClick={() => void act("open")}
              >
                {period.status === "review"
                  ? "Return to open"
                  : "Reopen period"}
              </button>
            )}
          </div>
        </>
      )}
      <h3 className="mt-6 font-bold">Decision history</h3>
      {history.map((h) => (
        <article
          key={h.id}
          className="mt-3 rounded border border-neutral-600 p-3 text-sm"
        >
          <p>
            {h.action.replace("ledger.period_", "")} ·{" "}
            {new Date(h.occurred_at).toLocaleString()}
          </p>
          <p className="mt-1 text-neutral-300">{h.reason}</p>
        </article>
      ))}
    </AdminDrawerShell>
  );
}
type Report = {
  ledger: Ledger;
  from: string;
  to: string;
  accounts: (Account & {
    opening: string;
    debit: string;
    credit: string;
    closing: string;
  })[];
};
function Statements({
  role,
  entity,
  ledgers,
}: {
  role: string;
  entity: string;
  ledgers: Ledger[];
}) {
  const [ledger, setLedger] = useState(ledgers[0]?.id || ""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [report, setReport] = useState<Report | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [view, setView] = useState("trial");
  const load = async () => {
    setBusy(true);
    setError("");
    try {
      setReport(
        await request(
          "/api/admin-ledger?" +
            new URLSearchParams({
              role,
              entity,
              mode: "report",
              ledger,
              from,
              to,
            }),
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Report failed.");
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    setReport(null);
    setLedger(ledgers[0]?.id || "");
  }, [entity, ledgers]);
  let rows: (string | number)[][] = [],
    headers: string[] = [],
    net = BigInt(0);
  if (report) {
    if (view === "trial") {
      headers = [
        "Account",
        "Name",
        "Opening debit / (credit)",
        "Period debits",
        "Period credits",
        "Closing debit / (credit)",
      ];
      rows = report.accounts.map((a) => [
        a.account_code,
        a.account_name,
        a.opening,
        a.debit,
        a.credit,
        a.closing,
      ]);
      rows.push([
        "",
        "Totals",
        decimal(
          report.accounts.reduce((n, a) => n + cents(a.opening), BigInt(0)),
        ),
        decimal(
          report.accounts.reduce((n, a) => n + cents(a.debit), BigInt(0)),
        ),
        decimal(
          report.accounts.reduce((n, a) => n + cents(a.credit), BigInt(0)),
        ),
        decimal(
          report.accounts.reduce((n, a) => n + cents(a.closing), BigInt(0)),
        ),
      ]);
    } else if (view === "income") {
      headers = ["Account", "Name", "Type", "Amount"];
      rows = report.accounts
        .filter((a) => ["revenue", "expense"].includes(a.account_type))
        .map((a) => {
          const signed = cents(a.credit) - cents(a.debit);
          net += signed;
          return [
            a.account_code,
            a.account_name,
            a.account_type,
            decimal(a.account_type === "revenue" ? signed : -signed),
          ];
        });
      rows.push(["", "Net income / (loss)", "", decimal(net)]);
    } else {
      headers = ["Account", "Name", "Type", "Balance"];
      rows = report.accounts
        .filter((a) =>
          ["asset", "liability", "equity"].includes(a.account_type),
        )
        .map((a) => [
          a.account_code,
          a.account_name,
          a.account_type,
          decimal(
            (a.account_type === "asset" ? BigInt(1) : -BigInt(1)) *
              cents(a.closing),
          ),
        ]);
      const earnings = report.accounts
        .filter((a) => ["revenue", "expense"].includes(a.account_type))
        .reduce((n, a) => n - cents(a.closing), BigInt(0));
      rows.push([
        "",
        "Unclosed earnings / (loss)",
        "equity",
        decimal(earnings),
      ]);
      const assets = report.accounts
          .filter((a) => a.account_type === "asset")
          .reduce((n, a) => n + cents(a.closing), BigInt(0)),
        liabilitiesEquity = report.accounts
          .filter((a) => ["liability", "equity"].includes(a.account_type))
          .reduce((n, a) => n - cents(a.closing), earnings);
      rows.push(
        ["", "Total assets", "", decimal(assets)],
        ["", "Total liabilities and equity", "", decimal(liabilitiesEquity)],
        ["", "Balance difference", "", decimal(assets - liabilitiesEquity)],
      );
    }
  }
  const download = () => {
    if (!report) return;
    const blob = new Blob(
        [
          ledgerCsv([
            ["Report", view],
            ["Ledger", report.ledger.name],
            ["Currency", report.ledger.currency],
            ["From", report.from],
            ["To", report.to],
            headers,
            ...rows,
          ]),
        ],
        { type: "text/csv;charset=utf-8" },
      ),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = `${view}-${report.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <section>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void load();
        }}
        className="grid items-end gap-3 sm:grid-cols-4"
      >
        <label className="text-sm">
          Ledger
          <select
            className={field}
            value={ledger}
            onChange={(e) => setLedger(e.target.value)}
          >
            {ledgers.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          From
          <input
            className={field}
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="text-sm">
          Through
          <input
            className={field}
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <button
          className={`${button} bg-blue-700`}
          disabled={busy || !ledger || !from || !to}
        >
          Run report
        </button>
      </form>
      {error && (
        <p role="alert" className="mt-3 text-red-300">
          {error}
        </p>
      )}
      {report && (
        <>
          <div className="my-4 flex flex-wrap items-center gap-3">
            <select
              aria-label="Financial statement"
              className={`${field} mt-0 max-w-xs`}
              value={view}
              onChange={(e) => setView(e.target.value)}
            >
              <option value="trial">Trial balance</option>
              <option value="income">Income statement</option>
              <option value="balance">Balance sheet</option>
            </select>
            <button className={`${button} bg-green-700`} onClick={download}>
              Export CSV
            </button>
            <span className="text-sm text-neutral-400">
              {report.ledger.name} · {report.ledger.currency} · {report.from} –{" "}
              {report.to}
            </span>
          </div>
          <p className="mb-3 text-sm text-neutral-400">
            Posted ledger entries only.{" "}
            {view === "balance"
              ? "Balances through the ending date; unclosed earnings are shown separately."
              : "Draft and cancelled entries are excluded."}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  {headers.map((h) => (
                    <th className="p-3" key={h}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-t border-neutral-700">
                    {row.map((cell, k) => (
                      <td
                        className={`p-3 ${k >= 2 ? "tabular-nums" : ""}`}
                        key={k}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
export default LedgerWorkspace;

export function TaskJournalDrawer({
  role,
  id,
  entity,
  onClose,
  onSaved,
}: {
  role: string;
  id: string;
  entity: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [data, setData] = useState<Data | null>(null),
    [error, setError] = useState("");
  const generation = useRef(0);
  const load = useCallback(async () => {
    const n = ++generation.current;
    const result = await request(
      `/api/admin-ledger?${new URLSearchParams({ role, id, entity })}`,
    );
    if (n === generation.current) {
      setData(result);
      setError("");
    }
  }, [role, id, entity]);
  useEffect(() => {
    let active = true;
    void load().catch((e) => {
      if (active) setError(e.message);
    });
    const generationRef = generation;
    return () => {
      active = false;
      generationRef.current++;
    };
  }, [load]);
  if (!data)
    return (
      <AdminDrawerShell title="Review journal" onClose={onClose}>
        <p role={error ? "alert" : "status"}>{error || "Loading journal…"}</p>
        {error && (
          <button onClick={() => void load().catch((e) => setError(e.message))}>
            Retry
          </button>
        )}
      </AdminDrawerShell>
    );
  return (
    <JournalDrawer
      key={`${id}:${data.journal?.version}`}
      role={role}
      data={data}
      creating={false}
      onClose={onClose}
      onSaved={async () => {
        await load();
        await onSaved();
      }}
    />
  );
}
