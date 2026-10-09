"use client";
import { AdminDrawerShell } from "./AdminDrawerShell";
import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { authenticatedFetch } from "@/lib/client/authenticatedFetch";
type Row = Record<string, any>;
type Payload = {
  invoices: Row[];
  invoiceLines: Row[];
  payments: Row[];
  paymentAllocations: Row[];
  credits: Row[];
  vendorBills: Row[];
  metrics: any;
  authorization: any;
  generatedAt: string;
  financeContext?: {
    paymentMethods: Row[];
    customers: Row[];
    legalEntities: Row[];
    billingAccounts: Row[];
    organizations: Row[];
    people: Row[];
    currency: string | null;
  };
  orgAdmin?: any;
  error?: string;
};
const money = (v: any, currency?: string) =>
  currency
    ? new Intl.NumberFormat(undefined, { style: "currency", currency }).format(
        Number(v || 0),
      )
    : Number(v || 0).toLocaleString();
function BillingWorkspace({ role = "org_admin" }: { role?: string }) {
  const [data, setData] = useState<Payload | null>(null),
    [error, setError] = useState(""),
    [query, setQuery] = useState(""),
    [tab, setTab] = useState<"receivables" | "payables">("receivables"),
    [selected, setSelected] = useState<Row | null>(null),
    [creating, setCreating] = useState(false),
    [setup, setSetup] = useState(false),
    [busy, setBusy] = useState(false);
  const currency = String(
    (data as any)?.financeContext?.currency ||
      data?.invoices?.[0]?.currency ||
      data?.vendorBills?.[0]?.currency ||
      "",
  ).trim();
  const act = async (body: any) => {
    setBusy(true);
    setError("");
    try {
      const r = await authenticatedFetch("/api/admin-command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, role }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Financial operation failed.");
      setSelected(null);
      setCreating(false);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const load = useCallback(async () => {
    setError("");
    const r = await authenticatedFetch(
      `/api/admin-command?role=${encodeURIComponent(role)}`,
      { cache: "no-store" },
    );
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "Finance data unavailable.");
    setData(j);
  }, [role]);
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);
  const rows = useMemo(
    () =>
      (
        (tab === "receivables" ? data?.invoices : data?.vendorBills) || []
      ).filter((r: Row) =>
        JSON.stringify(r).toLowerCase().includes(query.toLowerCase()),
      ),
    [data, tab, query],
  );
  if (tab === "payables")
    return (
      <>
        <button
          className="m-5 rounded bg-blue-700 px-3 py-2 text-sm text-white"
          onClick={() => setTab("receivables")}
        >
          Back to billing
        </button>
        <PayablesWorkspace role={role} />
      </>
    );
  if (!data) return <State text={error || "Loading club financial records…"} />;
  return (
    <main className="p-5 text-white lg:p-7">
      <header className="border-b border-neutral-800 pb-5">
        <div className="text-[9px] font-black uppercase tracking-[.22em] text-[#FA4616]">
          {role === "treasurer" ? "Treasurer" : "Organization Administrator"} ·
          Finance
        </div>
        <h1 className="mt-1 text-3xl font-black">Fees and spending</h1>
        <p className="mt-2 text-sm text-neutral-400">
          Manage fees owed to the club, supplier bills and payments.
        </p>
      </header>
      {error && (
        <div className="mt-4 border border-red-900 p-3 text-red-300">
          {error}
        </div>
      )}
      {!data.invoices?.length && !data.vendorBills?.length && (
        <p className="mt-5 rounded-lg border border-blue-800 bg-blue-950/30 p-4 text-sm text-blue-100">
          No financial records yet. Start with Finance setup, then enter the
          club’s invoices and supplier bills. Figures shown are recorded
          balances, not an assessment of the club’s finances.
        </p>
      )}
      <section className="mt-5 flex flex-wrap gap-2">
        <button
          onClick={() => setSetup(true)}
          className="rounded-lg border border-neutral-600 px-4 py-2 text-xs font-black"
        >
          Finance setup
        </button>
        <button
          disabled={
            !data.financeContext?.legalEntities?.length ||
            !data.financeContext?.customers?.length
          }
          onClick={() => setCreating(true)}
          className="rounded-lg bg-[#FA4616] px-4 py-2 text-xs font-black text-white"
        >
          + Issue invoice
        </button>
        <button
          onClick={() => setTab("receivables")}
          className={
            tab === "receivables"
              ? "rounded-lg bg-[#FA4616] px-4 py-2 text-xs font-black text-black"
              : "rounded-lg border border-neutral-700 px-4 py-2 text-xs"
          }
        >
          Fees owed to the club ·{" "}
          {data.invoices.length
            ? money(data.metrics?.arBalance, currency)
            : "No records"}
        </button>
        <button
          onClick={() => setTab("payables")}
          className="rounded-lg border border-neutral-700 px-4 py-2 text-xs"
        >
          Supplier bills ·{" "}
          {data.vendorBills.length
            ? money(data.metrics?.apBalance, currency)
            : "No records"}
        </button>
        <span className="px-3 py-2 text-xs text-neutral-500">
          {data.metrics?.pastDue || 0} overdue invoices
        </span>
      </section>
      <section className="mt-4 overflow-hidden rounded-2xl border border-neutral-800 bg-[#090b0b]">
        <div className="border-b border-neutral-800 p-4">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search financial records"
            className="w-full max-w-sm rounded-lg border border-neutral-700 bg-black px-3 py-2 text-sm"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-neutral-500">
              <tr>
                <th className="p-4">Record</th>
                <th>Date</th>
                <th>Due</th>
                <th>Aging</th>
                <th>Total</th>
                <th>Balance</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => setSelected(r)}
                  className="cursor-pointer border-t border-neutral-800 hover:bg-white/[.03]"
                >
                  <td className="p-4 font-bold">
                    {r.customers?.display_name ||
                      r.invoice_number ||
                      r.bill_number ||
                      r.id}
                    <span className="block text-xs font-normal text-neutral-500">
                      {r.invoice_number || r.bill_number || ""}
                    </span>
                  </td>
                  <td>{r.invoice_date || r.bill_date || "—"}</td>
                  <td>{r.due_date || "—"}</td>
                  <td>
                    {r.due_date && Number(r.balance_due) > 0
                      ? (() => {
                          const d = Math.floor(
                            (Date.now() - new Date(r.due_date).getTime()) /
                              86400000,
                          );
                          return d <= 0
                            ? "Current"
                            : d <= 30
                              ? "1–30"
                              : d <= 60
                                ? "31–60"
                                : d <= 90
                                  ? "61–90"
                                  : "90+";
                        })()
                      : "—"}
                  </td>
                  <td>
                    {money(r.total, String(r.currency || currency).trim())}
                  </td>
                  <td>
                    {money(
                      r.balance_due,
                      String(r.currency || currency).trim(),
                    )}
                  </td>
                  <td>{r.status || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && (
          <div className="p-8 text-sm text-neutral-500">
            No {tab} records yet. Use the actions above to add your club’s
            records.
          </div>
        )}
      </section>
      {setup && (
        <FinanceSetup
          error={error}
          data={data}
          busy={busy}
          onClose={() => setSetup(false)}
          onSave={(v) => act(v)}
        />
      )}{" "}
      {creating && (
        <InvoiceModal
          error={error}
          legalEntities={data.financeContext?.legalEntities || []}
          people={(data.financeContext?.customers || [])
            .map((x: any) => x.people)
            .filter(Boolean)}
          busy={busy}
          onClose={() => setCreating(false)}
          onSave={(v) => act({ action: "create-invoice", ...v })}
        />
      )}{" "}
      {selected && (
        <Drawer
          error={error}
          paymentMethods={data.financeContext?.paymentMethods || []}
          row={selected}
          lines={(data.invoiceLines || []).filter(
            (x) => x.invoice_id === selected.id,
          )}
          payments={(data.payments || []).filter(
            (x) => x.invoice_id === selected.id,
          )}
          allocations={(data.paymentAllocations || []).filter(
            (x) => x.invoice_id === selected.id,
          )}
          credits={(data.credits || []).filter(
            (x) => x.invoice_id === selected.id,
          )}
          onClose={() => setSelected(null)}
          onPayment={(amount, method, idempotencyKey) =>
            act({
              action: "record-payment",
              invoiceId: selected.id,
              amount,
              method,
              idempotencyKey,
            })
          }
          onCredit={(amount, reason) =>
            act({
              action: "issue-invoice-credit",
              invoiceId: selected.id,
              amount,
              reason,
            })
          }
          onVoid={(reason) =>
            act({ action: "void-invoice", invoiceId: selected.id, reason })
          }
          busy={busy}
        />
      )}
    </main>
  );
}
function Drawer({
  paymentMethods,
  row,
  lines,
  payments,
  allocations,
  credits,
  onClose,
  onPayment,
  onCredit,
  onVoid,
  busy,
  error,
}: {
  paymentMethods: Row[];
  row: Row;
  lines: Row[];
  payments: Row[];
  allocations: Row[];
  credits: Row[];
  onClose: () => void;
  onPayment: (a: number, m: string, k: string) => void;
  onCredit: (a: number, r: string) => void;
  onVoid: (r: string) => void;
  busy: boolean;
  error: string;
}) {
  const [a, setA] = useState(""),
    [m, setM] = useState(""),
    [credit, setCredit] = useState(""),
    [reason, setReason] = useState(""),
    [key] = useState(() => crypto.randomUUID());
  return (
    <AdminDrawerShell
      title={row.invoice_number || row.bill_number || "Financial record"}
      busy={busy}
      onClose={onClose}
      recordStatus={row.status}
    >
      {error && (
        <p role="alert" className="mb-4 text-red-300">
          {error}
        </p>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="min-w-0">
          <h3 className="font-semibold">Record details</h3>
          <div className="mt-6 grid gap-3">
            {Object.entries(row).map(([k, v]) => (
              <div key={k} className="border-b border-neutral-800 pb-2">
                <div className="text-[9px] uppercase text-neutral-600">
                  {k.replaceAll("_", " ")}
                </div>
                <div className="mt-1 break-words text-sm">
                  {String(v ?? "—")}
                </div>
              </div>
            ))}
          </div>
        </section>
        <fieldset disabled={busy} className="min-w-0">
          <legend className="font-semibold">Actions</legend>
          {row.due_date && Number(row.balance_due) > 0 && (
            <div className="mt-4 text-xs font-bold text-amber-300">
              {Math.max(
                0,
                Math.floor(
                  (Date.now() - new Date(row.due_date).getTime()) / 86400000,
                ),
              )}{" "}
              days overdue
            </div>
          )}
          {row.balance_due > 0 && row.status !== "void" && (
            <div className="mt-6 border-t border-neutral-800 pt-4">
              <h3 className="font-black">Record payment</h3>
              <div className="mt-2 grid gap-2">
                <input
                  value={a}
                  onChange={(e) => setA(e.target.value)}
                  type="number"
                  placeholder="Amount"
                  className="min-w-0 w-full rounded border border-neutral-700 bg-black px-3 py-2"
                />
                <select
                  value={m}
                  onChange={(e) => setM(e.target.value)}
                  className="min-w-0 w-full rounded border border-neutral-700 bg-black px-3 py-2"
                >
                  <option value="">Payment method</option>
                  {paymentMethods
                    .filter((x) => x.status === "active")
                    .map((x) => (
                      <option key={x.id} value={x.code}>
                        {x.name}
                      </option>
                    ))}
                </select>
                <button
                  disabled={busy || !a || !m}
                  onClick={() => onPayment(Number(a), m, key)}
                  className="rounded bg-[#FA4616] px-3 py-2 font-black text-black"
                >
                  Post payment
                </button>
              </div>
              <div className="mt-4 grid gap-2">
                <input
                  value={credit}
                  onChange={(e) => setCredit(e.target.value)}
                  type="number"
                  placeholder="Credit amount"
                  className="min-w-0 w-full rounded border border-neutral-700 bg-black px-3 py-2"
                />
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Required reason"
                  className="min-w-0 w-full rounded border border-neutral-700 bg-black px-3 py-2"
                />
                <button
                  disabled={busy || !credit || !reason}
                  onClick={() => onCredit(Number(credit), reason)}
                  className="rounded border border-neutral-600 px-3 py-2 text-xs font-black"
                >
                  Issue credit
                </button>
              </div>
              <button
                disabled={busy || !reason}
                onClick={() => onVoid(reason)}
                className="mt-3 rounded border border-red-900 px-3 py-2 text-xs font-black text-red-300"
              >
                Void invoice
              </button>
            </div>
          )}
        </fieldset>
        <section className="min-w-0">
          <h3 className="font-semibold">Linked records</h3>
          {lines.length > 0 && (
            <section className="mt-6 border-t border-neutral-800 pt-4">
              <h3 className="font-black">Invoice lines</h3>
              {lines.map((x) => (
                <div key={x.id} className="mt-2 flex justify-between text-sm">
                  <span>{x.description}</span>
                  <span>{money(x.line_total, row.currency)}</span>
                </div>
              ))}
            </section>
          )}
          {payments.length > 0 && (
            <section className="mt-6 border-t border-neutral-800 pt-4">
              <h3 className="font-black">Payment history</h3>
              {payments.map((x) => (
                <div key={x.id} className="mt-2 grid grid-cols-4 gap-2 text-sm">
                  <span>{x.payment_date}</span>
                  <span>{x.method}</span>
                  <span>{money(x.amount, x.currency)}</span>
                  <span>{x.status}</span>
                </div>
              ))}
              <div className="mt-3 text-xs text-neutral-500">
                {allocations.length} payment allocation record
                {allocations.length === 1 ? "" : "s"}
              </div>
            </section>
          )}
          {credits.length > 0 && (
            <section className="mt-6 border-t border-neutral-800 pt-4">
              <h3 className="font-black">Credits</h3>
              {credits.map((x) => (
                <div key={x.id} className="mt-2 flex justify-between text-sm">
                  <span>{x.reason}</span>
                  <span>
                    {money(x.amount, row.currency)} · {x.status}
                  </span>
                </div>
              ))}
            </section>
          )}
          {!lines.length && !payments.length && !credits.length && (
            <p className="mt-4 text-sm text-slate-300">
              No invoice lines, payments or credits recorded.
            </p>
          )}
        </section>
      </div>
    </AdminDrawerShell>
  );
}
function InvoiceModal({
  legalEntities,
  people,
  busy,
  error,
  onClose,
  onSave,
}: {
  legalEntities: any[];
  people: any[];
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (v: any) => void;
}) {
  const [v, setV] = useState<any>({});
  return (
    <AdminDrawerShell title="Issue invoice" busy={busy} onClose={onClose}>
      <fieldset disabled={busy}>
        {error && (
          <p
            role="alert"
            className="mb-4 rounded border border-red-700 p-3 text-red-300"
          >
            {error}
          </p>
        )}

        <label className="mt-3 block text-xs text-neutral-400">
          Legal entity
          <select
            value={v.legalEntityId || ""}
            onChange={(e) => setV({ ...v, legalEntityId: e.target.value })}
            className="mt-1 w-full rounded border border-neutral-700 bg-black px-3 py-2"
          >
            <option value="">Select legal entity</option>
            {legalEntities.map((x: any) => (
              <option key={x.id} value={x.id}>
                {x.legal_name} · {x.base_currency}
              </option>
            ))}
          </select>
        </label>
        <label className="mt-3 block text-xs text-neutral-400">
          Person
          <select
            value={v.personId || ""}
            onChange={(e) => setV({ ...v, personId: e.target.value })}
            className="mt-1 w-full rounded border border-neutral-700 bg-black px-3 py-2"
          >
            <option value="">Select person</option>
            {people.map((p: any) => (
              <option key={p.id} value={p.id}>
                {[p.preferred_name || p.first_name, p.last_name]
                  .filter(Boolean)
                  .join(" ") || p.email}
              </option>
            ))}
          </select>
        </label>
        {[
          ["description", "Fee / purpose"],
          ["amount", "Amount"],
          ["dueDate", "Due date"],
        ].map(([k, n]) => (
          <label key={k} className="mt-3 block text-xs text-neutral-400">
            {n}
            <input
              type={
                k === "amount" ? "number" : k === "dueDate" ? "date" : "text"
              }
              value={v[k] || ""}
              onChange={(e) => setV({ ...v, [k]: e.target.value })}
              className="mt-1 w-full rounded border border-neutral-700 bg-black px-3 py-2 text-white"
            />
          </label>
        ))}
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose}>Cancel</button>
          <button
            disabled={
              busy ||
              !v.legalEntityId ||
              !v.personId ||
              !v.description ||
              !v.amount
            }
            onClick={() => onSave(v)}
            className="rounded bg-[#FA4616] px-4 py-2 font-black text-black"
          >
            Issue
          </button>
        </div>
      </fieldset>
    </AdminDrawerShell>
  );
}
function FinanceSetup({
  data,
  busy,
  error,
  onClose,
  onSave,
}: {
  data: Payload;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (v: any) => void;
}) {
  const [v, setV] = useState<any>({});
  const ctx = data.financeContext;
  return (
    <AdminDrawerShell title="Club billing setup" busy={busy} onClose={onClose}>
      <fieldset disabled={busy}>
        {error && (
          <p
            role="alert"
            className="mb-4 rounded border border-red-700 p-3 text-red-300"
          >
            {error}
          </p>
        )}

        <p className="mt-1 text-xs text-neutral-500">
          Enter the club’s billing details, country and currency to begin.
        </p>
        {!ctx?.legalEntities?.length && (
          <section className="mt-5 border-t border-neutral-800 pt-4">
            <b>Legal entity</b>
            <select
              value={v.organizationId || ""}
              onChange={(e) => setV({ ...v, organizationId: e.target.value })}
              className="mt-2 w-full rounded border border-neutral-700 bg-black px-3 py-2"
            >
              <option value="">Select organization</option>
              {(data.financeContext?.organizations || []).map((o: any) => (
                <option key={o.id} value={o.id}>
                  {o.name || o.code}
                </option>
              ))}
            </select>
            {[
              ["legalName", "Legal name"],
              ["countryCode", "Country code"],
              ["baseCurrency", "Currency code"],
            ].map(([k, n]) => (
              <input
                key={k}
                placeholder={n}
                value={v[k] || ""}
                onChange={(e) => setV({ ...v, [k]: e.target.value })}
                className="mt-2 w-full rounded border border-neutral-700 bg-black px-3 py-2 text-sm"
              />
            ))}
            <button
              disabled={busy}
              onClick={() => onSave({ action: "create-legal-entity", ...v })}
              className="mt-3 rounded bg-[#FA4616] px-3 py-2 text-xs font-black text-black"
            >
              Create legal entity
            </button>
          </section>
        )}
        <section className="mt-5 border-t border-neutral-800 pt-4">
          <b>Customer account</b>
          <select
            value={v.personId || ""}
            onChange={(e) => setV({ ...v, personId: e.target.value })}
            className="mt-2 w-full rounded border border-neutral-700 bg-black px-3 py-2"
          >
            <option value="">Select person</option>
            {(data.financeContext?.people || []).map((p: any) => (
              <option key={p.id} value={p.id}>
                {[p.preferred_name || p.first_name, p.last_name]
                  .filter(Boolean)
                  .join(" ")}
              </option>
            ))}
          </select>
          <select
            value={v.organizationId || ""}
            onChange={(e) => setV({ ...v, organizationId: e.target.value })}
            className="mt-2 w-full rounded border border-neutral-700 bg-black px-3 py-2"
          >
            <option value="">Select organization</option>
            {(data.financeContext?.organizations || []).map((o: any) => (
              <option key={o.id} value={o.id}>
                {o.name || o.code}
              </option>
            ))}
          </select>
          {[
            ["customerCode", "Customer code"],
            ["displayName", "Display name"],
          ].map(([k, n]) => (
            <input
              key={k}
              placeholder={n}
              value={v[k] || ""}
              onChange={(e) => setV({ ...v, [k]: e.target.value })}
              className="mt-2 w-full rounded border border-neutral-700 bg-black px-3 py-2 text-sm"
            />
          ))}
          <button
            disabled={busy || !v.personId}
            onClick={() => onSave({ action: "create-customer", ...v })}
            className="mt-3 rounded border border-neutral-600 px-3 py-2 text-xs font-black"
          >
            Create customer
          </button>
        </section>
        <section className="mt-5 border-t border-neutral-800 pt-4">
          <b>Payment method</b>
          <select
            value={v.organizationId || ""}
            onChange={(e) => setV({ ...v, organizationId: e.target.value })}
            className="mt-2 w-full rounded border border-neutral-700 bg-black px-3 py-2"
          >
            <option value="">Select organization</option>
            {(ctx?.organizations || []).map((o: any) => (
              <option key={o.id} value={o.id}>
                {o.name || o.code}
              </option>
            ))}
          </select>
          {[
            ["paymentMethodCode", "Code"],
            ["paymentMethodName", "Name"],
            ["paymentMethodType", "Method type"],
          ].map(([k, n]) => (
            <input
              key={k}
              placeholder={n}
              value={v[k] || ""}
              onChange={(e) => setV({ ...v, [k]: e.target.value })}
              className="mt-2 w-full rounded border border-neutral-700 bg-black px-3 py-2 text-sm"
            />
          ))}
          <button
            disabled={
              busy ||
              !v.organizationId ||
              !v.paymentMethodCode ||
              !v.paymentMethodName ||
              !v.paymentMethodType
            }
            onClick={() =>
              onSave({
                action: "create-payment-method",
                organizationId: v.organizationId,
                code: v.paymentMethodCode,
                name: v.paymentMethodName,
                methodType: v.paymentMethodType,
              })
            }
            className="mt-3 rounded border border-neutral-600 px-3 py-2 text-xs font-black"
          >
            Create payment method
          </button>
        </section>
        {!!ctx?.customers?.length && (
          <section className="mt-5 border-t border-neutral-800 pt-4">
            <b>Billing account</b>
            <select
              value={v.customerId || ""}
              onChange={(e) => setV({ ...v, customerId: e.target.value })}
              className="mt-2 w-full rounded border border-neutral-700 bg-black px-3 py-2"
            >
              <option value="">Select customer</option>
              {ctx.customers.map((x: any) => (
                <option key={x.id} value={x.id}>
                  {x.display_name}
                </option>
              ))}
            </select>
            <input
              placeholder="Currency code"
              value={v.currency || ""}
              onChange={(e) => setV({ ...v, currency: e.target.value })}
              className="mt-2 w-full rounded border border-neutral-700 bg-black px-3 py-2"
            />
            <input
              type="number"
              placeholder="Payment terms days"
              value={v.paymentTermsDays ?? ""}
              onChange={(e) => setV({ ...v, paymentTermsDays: e.target.value })}
              className="mt-2 w-full rounded border border-neutral-700 bg-black px-3 py-2"
            />
            <button
              disabled={busy || !v.customerId}
              onClick={() => onSave({ action: "create-billing-account", ...v })}
              className="mt-3 rounded border border-neutral-600 px-3 py-2 text-xs font-black"
            >
              Create billing account
            </button>
          </section>
        )}
      </fieldset>
    </AdminDrawerShell>
  );
}
const PayablesWorkspace = dynamic(() => import("./PayablesWorkspace"));
const LedgerWorkspace = dynamic(() => import("./LedgerWorkspace"), {
  loading: () => <div className="p-6 text-neutral-300">Loading ledger…</div>,
});
export function FinanceAccounting({ role = "org_admin" }: { role?: string }) {
  const params = useSearchParams(),
    [mode, setMode] = useState(
      ["ledger", "payables"].includes(params.get("accounting") || "")
        ? params.get("accounting")!
        : "billing",
    );
  useEffect(() => {
    setMode(
      ["ledger", "payables"].includes(params.get("accounting") || "")
        ? params.get("accounting")!
        : "billing",
    );
  }, [params]);
  return (
    <>
      <nav
        aria-label="Financial workspaces"
        className="flex gap-3 border-b border-neutral-700 p-4 text-white"
      >
        <button
          onClick={() => setMode("billing")}
          className={`rounded px-4 py-2 ${mode === "billing" ? "bg-blue-700" : "border border-neutral-600"}`}
        >
          Billing
        </button>
        {["org_admin", "treasurer"].includes(role) && (
          <button
            onClick={() => setMode("payables")}
            className={`rounded px-4 py-2 ${mode === "payables" ? "bg-blue-700" : "border border-neutral-600"}`}
          >
            Pay bills & vendors
          </button>
        )}
        {["org_admin", "treasurer"].includes(role) && (
          <button
            onClick={() => setMode("ledger")}
            className={`rounded px-4 py-2 ${mode === "ledger" ? "bg-blue-700" : "border border-neutral-600"}`}
          >
            General ledger
          </button>
        )}
      </nav>
      {mode === "payables" && ["org_admin", "treasurer"].includes(role) ? (
        <PayablesWorkspace role={role} />
      ) : mode === "ledger" && ["org_admin", "treasurer"].includes(role) ? (
        <LedgerWorkspace role={role} />
      ) : (
        <BillingWorkspace role={role} />
      )}
    </>
  );
}
function State({ text }: { text: string }) {
  return (
    <div className="p-8 text-white">
      <h1 className="text-2xl font-black">Fees and spending</h1>
      <p className="mt-2 text-neutral-500">{text}</p>
    </div>
  );
}
export default FinanceAccounting;
