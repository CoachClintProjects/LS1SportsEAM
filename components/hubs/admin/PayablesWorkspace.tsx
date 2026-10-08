"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authenticatedFetch } from "@/lib/client/authenticatedFetch";
import { AdminDrawerShell } from "./AdminDrawerShell";
import PayableReconciliationDrawer from "./PayableReconciliationDrawer";
import PayableLedgerActions from "./PayableLedgerActions";
import PayableAuthorityDrawer from "./PayableAuthorityDrawer";
import { TaskJournalDrawer } from "./LedgerWorkspace";
type Bill = {
  id: string;
  legal_entity_id: string;
  vendor_id: string;
  bill_number: string;
  bill_date: string;
  due_date: string;
  currency: string;
  tax_total: string;
  total: string;
  balance_due: string;
  status: string;
  version: number;
  approval_required_role: string;
  approval_policy_version: number | null;
  approved_at: string | null;
  journal_id: string | null;
  vendors: { name: string };
};
type Line = {
  line_no?: number;
  account_id?: string;
  description: string;
  quantity: string;
  unit_price: string;
  line_total?: string;
};
type Data = {
  entities: { id: string; legal_name: string; base_currency: string }[];
  vendors: { id: string; name: string; status: string }[];
  methods: { id: string; code: string; name: string }[];
  ledgers: { id: string; name: string; currency: string }[];
  accounts: {
    id: string;
    account_code: string;
    account_name: string;
    account_type: string;
  }[];
  rows: Bill[];
  hasMore: boolean;
  bill: Bill | null;
  lines: Line[];
  payments: {
    id: string;
    payment_date: string;
    amount: string;
    reference: string;
    method: string;
    status: string;
    journal_id: string | null;
  }[];
  history: {
    id: string;
    action: string;
    reason: string;
    occurred_at: string;
  }[];
  authorization: {
    create: boolean;
    edit: boolean;
    decide: boolean;
    approve: boolean;
  };
};
const input =
    "mt-1 w-full rounded border border-neutral-600 bg-[#17191d] px-3 py-2 text-sm text-white",
  button = "rounded px-3 py-2 text-sm font-semibold disabled:opacity-40";
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
    ),
    j = await r.json();
  if (!r.ok) throw new Error(j.error || "Payables request failed.");
  return j;
}
export default function PayablesWorkspace({
  role = "treasurer",
}: {
  role?: string;
}) {
  const params = useSearchParams(),
    [data, setData] = useState<Data | null>(null),
    [selected, setSelected] = useState<string | null>(params.get("bill")),
    [creating, setCreating] = useState(false),
    [authorityOpen, setAuthorityOpen] = useState(false),
    [reconciliationOpen, setReconciliationOpen] = useState(false),
    [error, setError] = useState(""),
    [page, setPage] = useState(0),
    [sort, setSort] = useState("bill_date"),
    [direction, setDirection] = useState("desc"),
    [search, setSearch] = useState(""),
    [query, setQuery] = useState(""),
    [loading, setLoading] = useState(true),
    seq = useRef(0);
  const load = useCallback(async () => {
    const v = ++seq.current;
    setLoading(true);
    try {
      const q = new URLSearchParams({
        role,
        page: String(page),
        sort,
        direction,
        search: query,
      });
      if (selected) q.set("id", selected);
      const j = await request(`/api/admin-payables?${q}`);
      if (v === seq.current) {
        setData(j);
        setError("");
      }
    } catch (e) {
      if (v === seq.current)
        setError(e instanceof Error ? e.message : "Payables unavailable.");
    } finally {
      if (v === seq.current) setLoading(false);
    }
  }, [role, page, sort, direction, query, selected]);
  useEffect(() => {
    void load();
    return () => {
      // Invalidate outstanding requests after navigation or unmount.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      seq.current++;
    };
  }, [load]);
  if (!data)
    return (
      <div className="p-6 text-neutral-300">
        {error || "Loading vendor bills…"}
        {error && (
          <button
            className={`${button} ml-3 bg-blue-700`}
            onClick={() => void load()}
          >
            Retry
          </button>
        )}
      </div>
    );
  return (
    <section className="p-6 text-white">
      <header className="flex flex-wrap justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Accounts payable</h1>
          <p className="mt-2 text-sm text-neutral-400">
            Vendor bills, executive approval and recorded payments.
          </p>
        </div>
        {data.authorization.create && (
          <button
            disabled={!data.entities.length || !data.vendors.length}
            className={`${button} bg-[#FA4616]`}
            onClick={() => setCreating(true)}
          >
            New vendor bill
          </button>
        )}
      </header>
      <button
        className={`${button} mt-4 bg-blue-700`}
        onClick={() => setAuthorityOpen(true)}
      >
        Spending authority
      </button>
      <button
        className={`${button} mt-4 ml-3 bg-blue-700`}
        onClick={() => setReconciliationOpen(true)}
      >
        Reconcile payable ledger
      </button>
      {reconciliationOpen && (
        <PayableReconciliationDrawer
          role={role}
          entities={data.entities}
          onClose={() => setReconciliationOpen(false)}
        />
      )}
      {authorityOpen && (
        <PayableAuthorityDrawer
          role={role}
          onClose={() => setAuthorityOpen(false)}
        />
      )}
      {error && (
        <p role="alert" className="mt-4 text-red-300">
          {error}
        </p>
      )}
      {!data.entities.length && (
        <p className="mt-4 text-amber-300">
          Create a legal entity in Billing → Finance setup.
        </p>
      )}
      {!data.vendors.length && (
        <p className="mt-4 text-amber-300">
          Add the supplier in Vendors before entering a bill.
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setPage(0);
          setQuery(search);
        }}
        className="my-4 flex gap-2"
      >
        <input
          aria-label="Search bill number"
          placeholder="Search bill number"
          className={`${input} mt-0 max-w-md`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className={`${button} bg-blue-700`}>Search</button>
      </form>
      <div className="overflow-x-auto rounded border border-neutral-700">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              {[
                ["bill_number", "Bill"],
                ["bill_date", "Date"],
                ["due_date", "Due"],
                ["total", "Total"],
                ["balance_due", "Balance"],
                ["status", "Status"],
              ].map(([key, label]) => (
                <th
                  key={key}
                  className="p-3"
                  aria-sort={
                    sort === key
                      ? direction === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                >
                  <button
                    onClick={() => {
                      setPage(0);
                      setSort(key);
                      setDirection(
                        sort === key && direction === "asc" ? "desc" : "asc",
                      );
                    }}
                  >
                    {label}{" "}
                    {sort === key ? (direction === "asc" ? "↑" : "↓") : "↕"}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((b) => (
              <tr key={b.id} className="border-t border-neutral-700">
                <td className="p-3">
                  <button
                    className="text-blue-300 underline"
                    onClick={() => setSelected(b.id)}
                  >
                    {b.bill_number}
                  </button>
                  <p className="mt-1 text-xs text-neutral-400">
                    {b.vendors?.name}
                  </p>
                </td>
                <td className="p-3">{b.bill_date}</td>
                <td className="p-3">{b.due_date}</td>
                <td className="p-3">
                  {b.currency} {b.total}
                </td>
                <td className="p-3">
                  {b.currency} {b.balance_due}
                </td>
                <td className="p-3">{b.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!data.rows.length && (
          <p className="p-5 text-neutral-400">
            No vendor bills{" "}
            {query ? "match this search." : "have been recorded."}
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
            disabled={!page || loading}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </button>
          <button
            className={`${button} border border-neutral-600`}
            disabled={!data.hasMore || loading}
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>
        </div>
      </div>
      {(creating || (selected && data.bill?.id === selected)) && (
        <BillDrawer
          key={creating ? "new" : `${selected}:${data.bill?.version}`}
          role={role}
          data={data}
          creating={creating}
          onClose={() => {
            setSelected(null);
            setCreating(false);
          }}
          onSaved={async (id) => {
            setCreating(false);
            if (selected === id) await load();
            else setSelected(id);
          }}
        />
      )}
    </section>
  );
}
function BillDrawer({
  onJournal,
  role,
  data,
  creating,
  onClose,
  onSaved,
}: {
  role: string;
  data: Data;
  creating: boolean;
  onClose: () => void;
  onSaved: (id: string) => Promise<void>;
  onJournal?: (id: string, entity: string) => void;
}) {
  const router = useRouter(),
    currentParams = useSearchParams();
  const openJournal = (journalId: string) => {
    if (onJournal) {
      onJournal(journalId, data.bill!.legal_entity_id);
      return;
    }
    const q = new URLSearchParams(currentParams.toString());
    q.set("accounting", "ledger");
    q.set("record", journalId);
    q.set("entity", data.bill!.legal_entity_id);
    q.delete("bill");
    router.push(`?${q.toString()}`);
  };
  const b = creating ? null : data.bill!,
    [id] = useState(() => crypto.randomUUID()),
    [values, setValues] = useState({
      legal_entity_id: b?.legal_entity_id || data.entities[0]?.id || "",
      vendor_id: b?.vendor_id || "",
      bill_number: b?.bill_number || "",
      bill_date: b?.bill_date || "",
      due_date: b?.due_date || "",
      tax_total: String(b?.tax_total || "0"),
    }),
    [lines, setLines] = useState<Line[]>(
      creating
        ? [{ description: "", quantity: "1", unit_price: "0" }]
        : data.lines.map((l) => ({
            ...l,
            quantity: String(l.quantity),
            unit_price: String(l.unit_price),
          })),
    ),
    [reason, setReason] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [payment, setPayment] = useState({
      payment_id: crypto.randomUUID(),
      journal_id: crypto.randomUUID(),
      journal_number: "",
      cash_account_id: "",
      amount: "",
      method: "",
      reference: "",
      payment_date: "",
    });
  const edit =
    (creating || b?.status === "draft") &&
    (creating ? data.authorization.create : data.authorization.edit);
  const dirty =
    creating ||
    JSON.stringify(values) !==
      JSON.stringify({
        legal_entity_id: b?.legal_entity_id,
        vendor_id: b?.vendor_id,
        bill_number: b?.bill_number,
        bill_date: b?.bill_date,
        due_date: b?.due_date,
        tax_total: String(b?.tax_total),
      }) ||
    JSON.stringify(lines) !==
      JSON.stringify(
        data.lines.map((l) => ({
          ...l,
          quantity: String(l.quantity),
          unit_price: String(l.unit_price),
        })),
      );
  const act = async (operation: string, extra?: Record<string, unknown>) => {
    setBusy(true);
    setError("");
    try {
      const j = await request("/api/admin-payables", {
        role,
        id: b?.id || id,
        operation,
        expectedVersion: b?.version || 0,
        values:
          extra || (operation === "payment" ? payment : { ...values, lines }),
        reason,
      });
      await onSaved(j.row.id);
      setReason("");
      if (operation === "payment")
        setPayment({
          payment_id: crypto.randomUUID(),
          journal_id: crypto.randomUUID(),
          journal_number: "",
          cash_account_id: "",
          amount: "",
          method: "",
          reference: "",
          payment_date: "",
        });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bill action failed.");
    } finally {
      setBusy(false);
    }
  };
  const disabled = busy || reason.trim().length < 5;
  return (
    <AdminDrawerShell
      title={creating ? "New vendor bill" : b!.bill_number}
      onClose={onClose}
      busy={busy}
    >
      {error && (
        <p role="alert" className="mb-4 text-red-300">
          {error}
        </p>
      )}
      <p className="mb-4 text-neutral-300">
        {creating ? "Draft" : b!.status}
        {b ? ` · ${b.currency} ${b.balance_due} outstanding` : ""}
      </p>
      {b && b.status !== "draft" && (
        <p className="mb-4 text-sm text-amber-200">
          Required approval:{" "}
          {b.approval_required_role === "treasurer"
            ? "Treasurer or Organization Admin"
            : "Organization Admin"}{" "}
          ·{" "}
          {b.approval_policy_version
            ? `Policy version ${b.approval_policy_version}`
            : "Executive approval default"}
          {b.approved_at
            ? ` · Approved ${new Date(b.approved_at).toLocaleString()}`
            : ""}
        </p>
      )}
      <fieldset disabled={!edit || busy} className="grid gap-4 sm:grid-cols-2">
        <label>
          Legal entity
          <select
            disabled={!creating || busy}
            className={input}
            value={values.legal_entity_id}
            onChange={(e) =>
              setValues({ ...values, legal_entity_id: e.target.value })
            }
          >
            {data.entities.map((e) => (
              <option key={e.id} value={e.id}>
                {e.legal_name} · {e.base_currency}
              </option>
            ))}
          </select>
        </label>
        <label>
          Vendor
          <select
            className={input}
            value={values.vendor_id}
            onChange={(e) =>
              setValues({ ...values, vendor_id: e.target.value })
            }
          >
            <option value="">Select vendor</option>
            {data.vendors
              .filter(
                (v) =>
                  String(v.status || " ").toLowerCase() === "active" ||
                  v.id === values.vendor_id,
              )
              .map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
          </select>
        </label>
        {[
          ["bill_number", "Bill number", "text"],
          ["bill_date", "Bill date", "date"],
          ["due_date", "Due date", "date"],
          ["tax_total", "Total tax", "text"],
        ].map(([key, label, type]) => (
          <label key={key}>
            {label}
            <input
              className={input}
              type={type}
              value={values[key as keyof typeof values]}
              onChange={(e) => setValues({ ...values, [key]: e.target.value })}
            />
          </label>
        ))}
      </fieldset>
      <h3 className="mt-6 font-bold">Bill lines</h3>
      {lines.map((l, i) => (
        <fieldset
          key={i}
          disabled={!edit || busy}
          className="mt-3 grid gap-3 rounded border border-neutral-700 p-3 sm:grid-cols-4"
        >
          <label className="sm:col-span-2 text-sm">
            Description
            <input
              className={input}
              value={l.description}
              onChange={(e) =>
                setLines(
                  lines.map((r, n) =>
                    n === i ? { ...r, description: e.target.value } : r,
                  ),
                )
              }
            />
          </label>
          <label className="text-sm">
            Quantity
            <input
              className={input}
              inputMode="decimal"
              value={l.quantity}
              onChange={(e) =>
                setLines(
                  lines.map((r, n) =>
                    n === i ? { ...r, quantity: e.target.value } : r,
                  ),
                )
              }
            />
          </label>
          <label className="text-sm">
            Unit price
            <input
              className={input}
              inputMode="decimal"
              value={l.unit_price}
              onChange={(e) =>
                setLines(
                  lines.map((r, n) =>
                    n === i ? { ...r, unit_price: e.target.value } : r,
                  ),
                )
              }
            />
          </label>
          {edit && (
            <button
              className={`${button} border border-red-700 text-red-300`}
              disabled={lines.length <= 1}
              onClick={() => setLines(lines.filter((_, n) => n !== i))}
            >
              Remove line
            </button>
          )}
        </fieldset>
      ))}
      {edit && (
        <button
          className={`${button} mt-3 bg-blue-700`}
          disabled={busy || lines.length >= 250}
          onClick={() =>
            setLines([
              ...lines,
              { description: "", quantity: "1", unit_price: "0" },
            ])
          }
        >
          Add line
        </button>
      )}
      {(edit || data.authorization.decide) && (
        <label className="mt-5 block">
          Action reason
          <textarea
            className={input}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
      )}
      <div className="mt-4 flex flex-wrap gap-3">
        {edit && (
          <button
            className={`${button} bg-blue-700`}
            disabled={disabled}
            onClick={() => void act(creating ? "create" : "edit")}
          >
            Save draft
          </button>
        )}
        {!creating && data.authorization.decide && (
          <>
            {b?.status === "draft" && (
              <button
                className={`${button} bg-green-700`}
                disabled={disabled || dirty}
                onClick={() => void act("submit")}
              >
                Submit for approval
              </button>
            )}
            {b?.status === "submitted" && data.authorization.approve && (
              <button
                className={`${button} bg-green-700`}
                disabled={disabled}
                onClick={() => void act("approve")}
              >
                Approve bill
              </button>
            )}
            {!b?.journal_id &&
              (b?.status === "submitted" ||
                (b?.status === "approved" && data.authorization.approve)) && (
                <button
                  className={`${button} bg-blue-700`}
                  disabled={disabled}
                  onClick={() => void act("return")}
                >
                  Return to draft
                </button>
              )}
            {!b?.journal_id &&
              (b?.status === "draft" ||
                b?.status === "submitted" ||
                (b?.status === "approved" && data.authorization.approve)) && (
                <button
                  className={`${button} bg-red-800`}
                  disabled={disabled}
                  onClick={() => void act("cancel")}
                >
                  Cancel bill
                </button>
              )}
          </>
        )}
      </div>
      {!creating && edit && dirty && (
        <p className="mt-2 text-sm text-amber-300">
          Save changes before submitting.
        </p>
      )}
      {b?.journal_id && (
        <button
          className={`${button} mt-4 bg-blue-700`}
          onClick={() => openJournal(b.journal_id!)}
        >
          Open bill journal
        </button>
      )}
      {b && (
        <PayableLedgerActions
          key={`${b.id}:${b.version}`}
          bill={b}
          lines={data.lines}
          accounts={data.accounts}
          ledgers={data.ledgers}
          payments={data.payments}
          busy={busy}
          canAct={!disabled}
          canDecide={data.authorization.decide}
          canApprove={data.authorization.approve}
          onAction={act}
        />
      )}
      {b &&
        data.payments
          .filter((p) => p.journal_id)
          .map((p) => (
            <button
              key={p.id}
              className={`${button} mt-3 mr-3 bg-blue-700`}
              onClick={() => openJournal(p.journal_id!)}
            >
              Payment journal · {p.reference} · {p.status}
            </button>
          ))}
      {b &&
        b.journal_id &&
        ["approved", "partially_paid"].includes(b.status) &&
        data.authorization.decide && (
          <section className="mt-6 border-t border-neutral-600 pt-4">
            <h3 className="font-bold">Record vendor payment</h3>
            <p className="mt-2 text-sm text-neutral-400">
              Record a payment already made. This action does not transfer
              money.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {[
                ["amount", "Amount", "text"],
                ["payment_date", "Payment date", "date"],
                ["reference", "Bank or cheque reference", "text"],
                ["journal_number", "Payment journal number", "text"],
              ].map(([key, label, type]) => (
                <label key={key} className="text-sm">
                  {label}
                  <input
                    className={input}
                    type={type}
                    value={payment[key as keyof typeof payment]}
                    onChange={(e) =>
                      setPayment({ ...payment, [key]: e.target.value })
                    }
                  />
                </label>
              ))}
              <label className="text-sm">
                Bank or cash ledger account
                <select
                  className={input}
                  value={payment.cash_account_id}
                  onChange={(e) =>
                    setPayment({ ...payment, cash_account_id: e.target.value })
                  }
                >
                  <option value="">Select asset account</option>
                  {data.accounts
                    .filter((a) => a.account_type.toLowerCase() === "asset")
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.account_code} · {a.account_name}
                      </option>
                    ))}
                </select>
              </label>
              <label className="text-sm">
                Payment method
                <select
                  className={input}
                  value={payment.method}
                  onChange={(e) =>
                    setPayment({ ...payment, method: e.target.value })
                  }
                >
                  <option value="">Select method</option>
                  {data.methods.map((m) => (
                    <option key={m.id} value={m.code}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button
              className={`${button} mt-4 bg-green-700`}
              disabled={
                disabled ||
                !payment.amount ||
                !payment.cash_account_id ||
                !payment.journal_number ||
                !payment.reference ||
                !payment.method ||
                !payment.payment_date
              }
              onClick={() => void act("payment")}
            >
              Record payment
            </button>
          </section>
        )}
      {!creating && (
        <>
          <h3 className="mt-6 font-bold">Payments</h3>
          {data.payments.map((p) => (
            <p key={p.id} className="mt-2 text-sm">
              {p.payment_date} · {b?.currency} {p.amount} · {p.method} ·{" "}
              {p.reference}
            </p>
          ))}
          {!data.payments.length && (
            <p className="mt-2 text-sm text-neutral-400">
              No recorded payments.
            </p>
          )}
          <h3 className="mt-6 font-bold">Decision history</h3>
          {data.history.map((h) => (
            <article
              key={h.id}
              className="mt-3 border-b border-neutral-700 pb-3 text-sm"
            >
              <p>
                {h.action.replace("vendor_bill.", "")} ·{" "}
                {new Date(h.occurred_at).toLocaleString()}
              </p>
              <p className="mt-1 text-neutral-300">{h.reason}</p>
            </article>
          ))}
        </>
      )}
    </AdminDrawerShell>
  );
}

/** Opens an existing payable from a task without changing the canvas route. */
export function TaskBillDrawer({
  role,
  id,
  onClose,
  onSaved,
}: {
  role: string;
  id: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [recordId, setRecordId] = useState(id);
  const [journal, setJournal] = useState<{ id: string; entity: string } | null>(
    null,
  );
  const [data, setData] = useState<Data | null>(null),
    [error, setError] = useState("");
  const generation = useRef(0);
  const load = useCallback(async () => {
    const version = ++generation.current;
    const result = await request(
      `/api/admin-payables?${new URLSearchParams({ role, id: recordId })}`,
    );
    if (version === generation.current) {
      setData(result);
      setError("");
    }
  }, [role, recordId]);
  useEffect(() => {
    let active = true;
    const generationRef = generation;
    void load().catch((e) => {
      if (active) setError(e.message);
    });
    return () => {
      active = false;
      generationRef.current++;
    };
  }, [load]);
  if (!data)
    return (
      <AdminDrawerShell title="Review payable" onClose={onClose}>
        <p role={error ? "alert" : "status"}>
          {error || "Loading bill and payment controls…"}
        </p>
        {error && (
          <button onClick={() => void load().catch((e) => setError(e.message))}>
            Retry
          </button>
        )}
      </AdminDrawerShell>
    );
  if (journal)
    return (
      <TaskJournalDrawer
        role={role}
        id={journal.id}
        entity={journal.entity}
        onClose={() => setJournal(null)}
        onSaved={onSaved}
      />
    );
  return (
    <BillDrawer
      key={`${recordId}:${data.bill?.version}`}
      role={role}
      onJournal={(id, entity) => setJournal({ id, entity })}
      data={data}
      creating={!recordId}
      onClose={onClose}
      onSaved={async (savedId) => {
        if (recordId !== savedId) {
          setData(null);
          setRecordId(savedId);
        } else await load();
        await onSaved();
      }}
    />
  );
}
