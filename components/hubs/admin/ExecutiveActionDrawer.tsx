"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { authenticatedFetch } from "@/lib/client/authenticatedFetch";
import { AdminDrawerShell } from "./AdminDrawerShell";
type Row = Record<string, any>;
const actions = [
  ["waiver", "Override waiver clearance", "bg-amber-600"],
  ["cash", "Record cash payment", "bg-emerald-700"],
  ["cover_entry_fee", "Club covers entry fee", "bg-blue-700"],
  ["release_escrow", "Release escrow funding", "bg-orange-700"],
  ["reverse", "Reverse transaction", "bg-red-700"],
];
const input =
  "mt-1 block w-full rounded border border-[#30363D] bg-[#0A0C10] px-3 py-2 text-sm text-white";
export function ExecutiveActionDrawer({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [kind, setKind] = useState("waiver"),
    [page, setPage] = useState(0),
    [entity, setEntity] = useState("");
  const [data, setData] = useState<Row | null>(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [record, setRecord] = useState(""),
    [reason, setReason] = useState(""),
    [values, setValues] = useState<Row>({
      date: new Date().toISOString().slice(0, 10),
    });
  const request = useRef(""),
    version = useRef(0),
    saving = useRef(false);
  const load = useCallback(async () => {
    const current = ++version.current;
    setLoading(true);
    setError("");
    try {
      const r = await authenticatedFetch(
        `/api/admin-executive-actions?${new URLSearchParams({ kind, role: "org_admin", page: String(page), ...(entity ? { entity } : {}) })}`,
        { cache: "no-store" },
      );
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      if (current === version.current) setData(j);
    } catch (e) {
      if (current === version.current)
        setError(
          e instanceof Error ? e.message : "Unable to load club records.",
        );
    } finally {
      if (current === version.current) setLoading(false);
    }
  }, [kind, page, entity]);
  useEffect(() => {
    setData(null);
    setRecord("");
    void load();
    return () => {
      version.current++;
    };
  }, [load]);
  function reset(next: string) {
    setKind(next);
    setPage(0);
    setRecord("");
    setValues({ date: new Date().toISOString().slice(0, 10) });
    setReason("");
    setNotice("");
    request.current = "";
  }
  function field(name: string, value: string) {
    setValues((old) => ({ ...old, [name]: value }));
    request.current = "";
  }
  const selected = data?.rows?.find((row: Row) => row.id === record);
  const ledger = data?.ledgers?.find((row: Row) => row.id === values.ledger_id);
  const label = (row: Row) =>
    kind === "waiver"
      ? `${row.person?.first_name || ""} ${row.person?.last_name || ""} · ${row.waivers?.name || "Waiver"} · ${row.status}`
      : kind === "cash"
        ? `${row.invoice_number} · ${row.customers?.display_name || ""} · ${row.currency} ${row.balance_due}`
        : kind === "cover_entry_fee"
          ? `${row.competitions?.name} · ${row.fee_type} · ${row.currency_code} ${row.total_amount}`
          : `${row.payload?.title} · ${row.payload?.journal?.journal_number}`;
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    if (!request.current) request.current = crypto.randomUUID();
    try {
      const r = await authenticatedFetch("/api/admin-executive-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          role: "org_admin",
          requestId: request.current,
          id: record,
          reason,
          operation: selected?.status === "waived" ? "restore" : "waive",
          expectedUpdatedAt: selected?.updated_at,
          amount: values.amount,
          method: values.method,
          values: {
            ...values,
            fee_id: kind === "cover_entry_fee" ? record : undefined,
            decision_id: kind === "reverse" ? record : undefined,
            version: selected?.payload?.journal?.version,
          },
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "The decision could not be saved.");
      setNotice(
        kind === "waiver"
          ? "Waiver requirement updated. No signature was created."
          : kind === "cash"
            ? "Cash received has been recorded against the invoice."
            : "Decision and accounting entries saved.",
      );
      request.current = "";
      setRecord("");
      setReason("");
      await load();
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  return (
    <AdminDrawerShell title="Club decisions" onClose={onClose} busy={busy}>
      <div className="mb-5 flex flex-wrap gap-2">
        {actions.map(([id, title, color]) => (
          <button
            key={id}
            disabled={busy}
            aria-pressed={kind === id}
            onClick={() => reset(id)}
            className={`rounded px-3 py-2 text-sm font-semibold text-white ${color} ${kind === id ? "ring-2 ring-white" : "opacity-80"} disabled:opacity-40`}
          >
            {title}
          </button>
        ))}
      </div>
      <ol
        aria-label="Decision progress"
        className="mb-6 grid grid-cols-4 gap-2"
      >
        {["Intake", "Checked", "Approved", "Live"].map((step, index) => (
          <li
            key={step}
            className={`rounded border px-2 py-2 text-center text-sm ${notice && index === 3 ? "border-emerald-400 bg-emerald-900" : !notice && index === (busy ? 2 : (selected || kind === "release_escrow") && reason.trim().length >= 5 ? 1 : 0) ? "border-blue-400 bg-blue-950" : "border-[#30363D] text-slate-400"}`}
          >
            {step}
          </li>
        ))}
      </ol>
      <p className="mb-5 text-sm text-slate-300">
        {kind === "waiver"
          ? "Record a club-approved exception to a waiver requirement, or restore the requirement. This does not sign a waiver for anyone."
          : kind === "release_escrow"
            ? "Record an actual, approved release from funds held. Select the matching funds-held and bank accounts. This records the payment; it does not send money."
            : kind === "cover_entry_fee"
              ? "Record that the club owes this entry fee, with matching expense and liability entries. This does not mark the organiser as paid."
              : kind === "reverse"
                ? "Reverse a previous club fee or funds-release decision. The original record remains in the history."
                : "Record cash already received. Select the invoice and your configured cash method."}
      </p>
      {error && (
        <p
          role="alert"
          className="mb-4 rounded border border-red-500 bg-red-950 p-3 text-sm text-red-100"
        >
          {error}
          <button
            disabled={busy}
            onClick={() => void load()}
            className="ml-3 underline"
          >
            Reload records
          </button>
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="mb-4 rounded bg-emerald-950 p-3 text-emerald-200"
        >
          {notice}
        </p>
      )}
      {loading ? (
        <p role="status" className="text-blue-300">
          Loading current club records…
        </p>
      ) : (
        data && (
          <form
            onSubmit={submit}
            className="grid gap-5 lg:grid-cols-[1fr_1.2fr_1fr]"
          >
            <section className="space-y-4">
              <h3 className="font-semibold">Record details</h3>
              {kind !== "waiver" && (
                <label className="block text-sm">
                  Club billing details
                  <select
                    disabled={busy}
                    value={entity || data.entities?.[0]?.id || ""}
                    onChange={(e) => {
                      setEntity(e.target.value);
                      setValues({ date: values.date });
                      request.current = "";
                    }}
                    className={input}
                  >
                    <option value="">Select</option>
                    {data.entities?.map((row: Row) => (
                      <option key={row.id} value={row.id}>
                        {row.legal_name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {kind !== "release_escrow" && (
                <>
                  <label className="block text-sm">
                    {kind === "waiver"
                      ? "Waiver requirement"
                      : kind === "cash"
                        ? "Invoice"
                        : kind === "cover_entry_fee"
                          ? "Entry fee"
                          : "Previous decision"}
                    <select
                      required
                      disabled={busy}
                      value={record}
                      onChange={(e) => {
                        setRecord(e.target.value);
                        request.current = "";
                      }}
                      className={input}
                    >
                      <option value="">Select a record</option>
                      {data.rows.map((row: Row) => (
                        <option key={row.id} value={row.id}>
                          {label(row)}
                        </option>
                      ))}
                    </select>
                  </label>
                  {!data.rows.length && (
                    <p className="text-sm text-amber-200">
                      No matching records on this page.
                    </p>
                  )}
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <button
                      type="button"
                      disabled={busy || page === 0}
                      onClick={() => setPage((n) => n - 1)}
                      className="rounded border border-[#30363D] p-2 disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <span>Page {page + 1}</span>
                    <button
                      type="button"
                      disabled={busy || !data.hasMore}
                      onClick={() => setPage((n) => n + 1)}
                      className="rounded border border-[#30363D] p-2 disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </>
              )}
              {["cover_entry_fee", "release_escrow"].includes(kind) && (
                <>
                  <label className="block text-sm">
                    Club account book
                    <select
                      required
                      disabled={busy}
                      value={values.ledger_id || ""}
                      onChange={(e) => field("ledger_id", e.target.value)}
                      className={input}
                    >
                      <option value="">Select</option>
                      {data.ledgers.map((row: Row) => (
                        <option key={row.id} value={row.id}>
                          {row.name} · {row.currency}
                        </option>
                      ))}
                    </select>
                  </label>
                  {[
                    [
                      "debit_account",
                      kind === "cover_entry_fee"
                        ? "Club expense account"
                        : "Funds-held account",
                      kind === "cover_entry_fee" ? "expense" : "liability",
                    ],
                    [
                      "credit_account",
                      kind === "cover_entry_fee"
                        ? "Amount-owed account"
                        : "Paying bank account",
                      kind === "cover_entry_fee" ? "liability" : "asset",
                    ],
                  ].map(([name, title, type]) => (
                    <label key={name} className="block text-sm">
                      {title}
                      <select
                        required
                        disabled={busy}
                        value={values[name] || ""}
                        onChange={(e) => field(name, e.target.value)}
                        className={input}
                      >
                        <option value="">Select</option>
                        {data.accounts
                          .filter(
                            (row: Row) =>
                              row.account_type.toLowerCase() === type,
                          )
                          .map((row: Row) => (
                            <option key={row.id} value={row.id}>
                              {row.account_code} · {row.account_name}
                            </option>
                          ))}
                      </select>
                    </label>
                  ))}
                  {!data.ledgers.length && (
                    <p className="text-sm text-amber-200">
                      Set up the club’s account book and financial year in Fees
                      and spending before posting.
                    </p>
                  )}
                </>
              )}
              {kind === "cash" && (
                <label className="block text-sm">
                  Cash method
                  <select
                    required
                    disabled={busy}
                    value={values.method || ""}
                    onChange={(e) => field("method", e.target.value)}
                    className={input}
                  >
                    <option value="">Select</option>
                    {data.methods.map((row: Row) => (
                      <option key={row.code} value={row.code}>
                        {row.name}
                      </option>
                    ))}
                  </select>
                  {!data.methods.length && (
                    <span className="mt-2 block text-amber-200">
                      Add a cash payment method in Finance setup first.
                    </span>
                  )}
                </label>
              )}
              {["cash", "release_escrow"].includes(kind) && (
                <label className="block text-sm">
                  Amount
                  <input
                    required
                    disabled={busy}
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={values.amount || ""}
                    onChange={(e) => field("amount", e.target.value)}
                    className={input}
                  />
                </label>
              )}
              {kind === "release_escrow" && (
                <label className="block text-sm">
                  Payment reference
                  <input
                    required
                    disabled={busy}
                    value={values.payment_reference || ""}
                    onChange={(e) => field("payment_reference", e.target.value)}
                    className={input}
                  />
                </label>
              )}
              {!["waiver", "cash"].includes(kind) && (
                <label className="block text-sm">
                  Posting date
                  <input
                    required
                    disabled={busy}
                    type="date"
                    value={values.date}
                    onChange={(e) => field("date", e.target.value)}
                    className={input}
                  />
                </label>
              )}
            </section>
            <section>
              <h3 className="font-semibold">Decision and activity</h3>
              <label className="mt-4 block text-sm">
                Reason
                <textarea
                  required
                  minLength={5}
                  disabled={busy}
                  rows={4}
                  value={reason}
                  onChange={(e) => {
                    setReason(e.target.value);
                    request.current = "";
                  }}
                  className={input}
                />
              </label>
              <button
                disabled={
                  busy ||
                  !data.canWrite ||
                  (kind !== "release_escrow" && !selected)
                }
                className={`mt-4 w-full rounded px-4 py-3 font-semibold text-white ${actions.find((a) => a[0] === kind)?.[2]} disabled:opacity-40`}
              >
                {busy
                  ? "Saving…"
                  : kind === "waiver" && selected?.status === "waived"
                    ? "Restore waiver requirement"
                    : actions.find((a) => a[0] === kind)?.[1]}
              </button>
              {!data.canWrite && (
                <p className="mt-2 text-sm text-amber-200">
                  Your account can view these records but cannot record a
                  decision.
                </p>
              )}
              <h4 className="mt-6 font-semibold">Recent club decisions</h4>
              <div className="mt-3 space-y-3">
                {data.history.map((row: Row) => (
                  <article
                    key={row.id}
                    className="rounded border border-[#30363D] p-3 text-sm"
                  >
                    <p>
                      {row.action.replaceAll("_", " ").replaceAll(".", " · ")}
                    </p>
                    <p className="mt-1 text-slate-300">{row.reason}</p>
                    <time className="mt-1 block text-xs text-slate-400">
                      {new Date(row.occurred_at).toLocaleString()}
                    </time>
                  </article>
                ))}
                {!data.history.length && (
                  <p className="text-sm text-slate-300">
                    No decisions recorded yet.
                  </p>
                )}
              </div>
            </section>
            <section>
              <h3 className="font-semibold">Linked information</h3>
              <dl className="mt-4 space-y-4 text-sm">
                {selected && (
                  <>
                    <dt className="text-slate-400">Selected record</dt>
                    <dd>{label(selected)}</dd>
                    <dt className="text-slate-400">Current status</dt>
                    <dd>{selected.status}</dd>
                  </>
                )}
                {ledger && (
                  <>
                    <dt className="text-slate-400">Account book</dt>
                    <dd>
                      {ledger.name} · {ledger.currency}
                    </dd>
                  </>
                )}
                {selected?.payload?.journal && (
                  <>
                    <dt className="text-slate-400">Original posting</dt>
                    <dd>
                      {selected.payload.journal.journal_number} ·{" "}
                      {selected.payload.journal.journal_date}
                    </dd>
                  </>
                )}
              </dl>
              <p className="mt-6 text-sm text-slate-300">
                Your signed-in account and club determine access. Changes retain
                their original record and decision history.
              </p>
            </section>
          </form>
        )
      )}
    </AdminDrawerShell>
  );
}
