"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { authenticatedFetch } from "@/lib/client/authenticatedFetch";
import { cents, ledgerCsv } from "@/lib/client/ledgerAmounts";
const Billing = dynamic(() =>
  import("./FinanceAccounting").then((m) => m.BillingWorkspace),
);
const Payables = dynamic(() => import("./PayablesWorkspace"));
const Ledger = dynamic(() => import("./LedgerWorkspace"));
const Budgets = dynamic(() => import("./BudgetWorkspace"));
const Triage = dynamic(() => import("../superuser/TriageTaskHub"));
const Transactions = dynamic(() =>
  import("../superuser/TransactionEngine").then((m) => m.TransactionEngine),
);
const BillDrawer = dynamic(() =>
  import("./PayablesWorkspace").then((m) => m.TaskBillDrawer),
);
const JournalDrawer = dynamic(() =>
  import("./LedgerWorkspace").then((m) => m.TaskJournalDrawer),
);
type Row = Record<string, any>;
const button =
  "rounded border border-[#30363D] bg-[#161B22] px-3 py-2 text-sm disabled:opacity-40";
const card = "rounded-xl border border-[#30363D] bg-[#161B22] p-4";
const titles: Record<string, string> = {
  "tr-revenue": "Portal Fee Revenue",
  "tr-payables": "Pay Bills & Vendors",
  "tr-cash": "Referee Cash Boxes",
  "tr-tax": "Tax & Non-Profit Logs",
  "tr-statements": "Trial Balances & Statements",
};
function download(name: string, rows: (string | number)[][]) {
  const url = URL.createObjectURL(
    new Blob([ledgerCsv(rows)], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function TreasurerWorkspace() {
  const params = useSearchParams(),
    view = params.get("view") || "tr-home";
  const [data, setData] = useState<Row | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [entity, setEntity] = useState(""),
    [ledger, setLedger] = useState(""),
    [budget, setBudget] = useState(""),
    [from, setFrom] = useState(new Date().getFullYear() + "-01-01"),
    [to, setTo] = useState(new Date().toISOString().slice(0, 10)),
    [section, setSection] = useState("journals"),
    [deposit, setDeposit] = useState(false),
    [bill, setBill] = useState<string | null>(null),
    [journal, setJournal] = useState<string | null>(null),
    [revision, setRevision] = useState(0);
  const generation = useRef(0);
  const load = useCallback(async () => {
    const seq = ++generation.current;
    setLoading(true);
    setError("");
    try {
      const q = new URLSearchParams({ entity, ledger, from, to, budget });
      const r = await authenticatedFetch(`/api/admin-treasurer?${q}`, {
        cache: "no-store",
      });
      const j = await r.json();
      if (!r.ok) throw Error(j.error);
      if (seq === generation.current) setData(j);
    } catch (e) {
      if (seq === generation.current) {
        setData(null);
        setError(
          e instanceof Error ? e.message : "Financial records unavailable.",
        );
      }
    } finally {
      if (seq === generation.current) setLoading(false);
    }
  }, [entity, ledger, from, to, budget]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    setSection("journals");
    setBill(null);
    setJournal(null);
  }, [view]);
  useEffect(() => {
    const refresh = () => {
      void load();
    };
    window.addEventListener("ls1:finance-saved", refresh);
    return () => window.removeEventListener("ls1:finance-saved", refresh);
  }, [load]);
  const refreshed = async () => {
    await load();
    setRevision((v) => v + 1);
  };
  const currency = data?.report?.ledger.currency || "";
  const pendingBills = (data?.bills || []).filter((b: Row) =>
    ["submitted", "pending", "under_review", "approved"].includes(b.status),
  );
  return (
    <main className="min-h-screen bg-[#0A0C10] p-5 text-white lg:p-7">
      <header className="flex flex-wrap justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-slate-400">
            Money Manager · Treasurer
          </p>
          <h1 className="mt-2 text-3xl font-bold">
            {titles[view] || "Today's Tasks / What Needs Attention"}
          </h1>
        </div>
        <button
          className={button}
          disabled={loading}
          onClick={() => void refreshed()}
        >
          {loading ? "Refreshing…" : "Refresh financial records"}
        </button>
      </header>
      <div className="my-5 flex flex-wrap gap-4">
        <label className="text-sm">
          Legal entity
          <select
            className={`${button} ml-2`}
            value={entity || data?.entity || ""}
            onChange={(e) => {
              setEntity(e.target.value);
              setLedger("");
              setBudget("");
            }}
          >
            <option value="">Select entity</option>
            {data?.entities.map((e: Row) => (
              <option key={e.id} value={e.id}>
                {e.legal_name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Ledger
          <select
            className={`${button} ml-2`}
            value={ledger || data?.ledger || ""}
            onChange={(e) => setLedger(e.target.value)}
          >
            <option value="">Select ledger</option>
            {data?.ledgers.map((l: Row) => (
              <option key={l.id} value={l.id}>
                {l.name} · {l.currency}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          From
          <input
            className={`${button} ml-2`}
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="text-sm">
          To
          <input
            className={`${button} ml-2`}
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
      </div>
      {error && (
        <p
          role="alert"
          className="my-4 rounded border border-red-800 p-3 text-red-200"
        >
          {error}
        </p>
      )}
      {data && (
        <>
          <div className="mb-5 grid gap-4 md:grid-cols-3">
            <div className={card}>
              <h2>Cash balance</h2>
              <p className="mt-2 text-xl font-bold">
                {data.cash === null
                  ? "Account mapping required"
                  : `${data.cash} ${currency}`}
              </p>
              <p className="mt-2 text-xs text-slate-400">
                Posted bank-account balance at {data.to}.
              </p>
            </div>
            <div className={card}>
              <h2>Pending payables</h2>
              {Object.entries(data.payableByCurrency).map(([c, v]) => (
                <p className="mt-2 text-xl font-bold" key={c}>
                  {String(v)} {c}
                </p>
              ))}
              {!Object.keys(data.payableByCurrency).length && (
                <p className="mt-2">No payable balances recorded.</p>
              )}
              <p className="mt-2 text-xs text-slate-400">
                Current outstanding bills, separated by currency.
              </p>
            </div>
            <div className={card}>
              <h2>Reserve liquidity</h2>
              <p className="mt-2 text-xl font-bold">
                {data.reserve === null
                  ? "Account mapping required"
                  : `${data.reserve} ${currency}`}
              </p>
              <p className="mt-2 text-xs text-slate-400">
                Posted reserve-account balance, not a forecast.
              </p>
            </div>
          </div>
          {!data.ledger && (
            <div className={`${card} mb-4`}>
              <h2 className="font-bold">Accounting setup is required</h2>
              <p className="mt-2 text-sm text-slate-300">
                The Organization Administrator must configure the club ledger,
                accounts and fiscal year before journals can be posted. No
                balance has been assumed.
              </p>
            </div>
          )}
        </>
      )}
      {view === "tr-revenue" ? (
        <Billing key={revision} role="treasurer" />
      ) : view === "tr-payables" ? (
        <Payables key={revision} role="treasurer" />
      ) : view === "tr-cash" ? (
        <>
          <section className={card}>
            <h2 className="font-bold">Deck cash custody</h2>
            <p className="my-3 text-sm">
              {data?.holdings.length ?? "…"} receipts await bank-deposit
              confirmation. Only confirm money already deposited, using the
              actual bank reference.
            </p>
            <button
              className={`${button} bg-emerald-900`}
              onClick={() => setDeposit(true)}
            >
              Record an actual bank deposit
            </button>
          </section>
          <Triage key={revision} role="treasurer" />
        </>
      ) : view === "tr-tax" ? (
        <section className={card}>
          <h2 className="text-xl font-bold">Recorded invoice taxes</h2>
          <p className="my-3 text-sm text-slate-300">
            Invoice tax amounts for {from} through {to}. This register does not
            certify tax treatment, non-profit status or a filed return. Voided
            and cancelled invoices are excluded.
          </p>
          <button
            className={button}
            disabled={!data?.invoices.length}
            onClick={() =>
              download(`invoice-tax-register-${to}.csv`, [
                [
                  "Invoice",
                  "Date",
                  "Currency",
                  "Subtotal",
                  "Tax",
                  "Total",
                  "Status",
                ],
                ...data!.invoices
                  .filter((i: Row) => !["void", "cancelled"].includes(i.status))
                  .map((i: Row) => [
                    i.invoice_number,
                    i.invoice_date,
                    i.currency,
                    i.subtotal,
                    i.tax_total,
                    i.total,
                    i.status,
                  ]),
              ])
            }
          >
            Download tax register CSV
          </button>
          {!data?.invoices.length && (
            <p className="mt-4">
              No invoices in this date range. Enter the club’s actual
              transactions in Portal Fee Revenue.
            </p>
          )}
          <div className="mt-4 max-h-96 overflow-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  {["Invoice", "Date", "Currency", "Tax", "Status"].map((h) => (
                    <th key={h} className="p-2">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data?.invoices.map((i: Row) => (
                  <tr key={i.id}>
                    <td className="p-2">{i.invoice_number}</td>
                    <td>{i.invoice_date}</td>
                    <td>{i.currency}</td>
                    <td>{i.tax_total}</td>
                    <td>{i.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : view === "tr-statements" ? (
        <>
          <nav
            className="mb-4 flex flex-wrap gap-2"
            aria-label="Treasurer accounting tools"
          >
            {[
              ["journals", "Journals & statements"],
              ["budgets", "Budgets & actual spending"],
              ["bank", "Bank reconciliation"],
            ].map(([id, title]) => (
              <button
                className={`${button} ${section === id ? "bg-blue-800" : ""}`}
                key={id}
                onClick={() => setSection(id)}
              >
                {title}
              </button>
            ))}
          </nav>
          {section === "journals" ? (
            <Ledger key={revision} role="treasurer" />
          ) : section === "budgets" ? (
            <>
              <section className={`${card} mb-5`}>
                <h2 className="font-bold">Actual spending versus budget</h2>
                <label className="mt-3 block">
                  Budget
                  <select
                    className={`${button} ml-3`}
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                  >
                    <option value="">Select a recorded budget</option>
                    {data?.budgets.map((b: Row) => (
                      <option key={b.id} value={b.id}>
                        {b.name} · {b.currency} · {b.status}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="my-3 text-sm text-slate-300">
                  Actuals use posted journals in each budget line’s dates, in
                  the selected ledger. Amounts in different currencies are never
                  combined.
                </p>
                {data?.variance.map((r: Row) => {
                  const planned = cents(r.budget_amount),
                    actual = cents(r.actual),
                    percent =
                      planned > BigInt(0)
                        ? Number((actual * BigInt(10000)) / planned) / 100
                        : null;
                  return (
                    <div key={r.id} className="mt-4">
                      <p className="font-semibold">{r.account_name}</p>
                      <p className="text-sm">
                        {r.period_start} – {r.period_end} · Planned{" "}
                        {r.budget_amount} · Actual {r.actual} · Variance{" "}
                        {r.variance} {currency}
                      </p>
                      <div className="my-2 h-3 rounded bg-slate-700">
                        <div
                          className={`h-3 rounded ${percent !== null && percent > 100 ? "bg-red-500" : "bg-emerald-500"}`}
                          style={{
                            width: `${Math.max(0, Math.min(100, percent ?? 0))}%`,
                          }}
                        />
                      </div>
                      <p className="text-xs">
                        {percent === null
                          ? "No percentage: planned amount is zero."
                          : `${percent.toFixed(2)}% of plan`}
                      </p>
                    </div>
                  );
                })}
                {budget && !data?.variance.length && (
                  <p>No budget lines available.</p>
                )}
              </section>
              <Budgets role="treasurer" />
            </>
          ) : (
            <section className={card}>
              <h2 className="font-bold">Bank statement reconciliation</h2>
              <p className="my-3 text-amber-200">
                Stored bank transactions are shown below. An automatic bank feed
                and an audited matching transaction are not configured. No
                matches or zero variances are fabricated.
              </p>
              <div className="grid gap-5 lg:grid-cols-2">
                <section>
                  <h3 className="font-bold">Bank statement items</h3>
                  {!data?.bankTransactions.length && (
                    <p className="mt-3 text-sm">
                      No bank statement items in this date range.
                    </p>
                  )}
                  {data?.bankTransactions.map((r: Row) => (
                    <div
                      className="mt-3 border-b border-[#30363D] pb-3 text-sm"
                      key={r.id}
                    >
                      <p>
                        {r.transaction_date} · {r.description}
                      </p>
                      <p>
                        {r.amount}{" "}
                        {
                          data.bankAccounts.find(
                            (b: Row) => b.id === r.bank_account_id,
                          )?.currency
                        }{" "}
                        · {r.reconciliation_status}
                      </p>
                    </div>
                  ))}
                </section>
                <section>
                  <h3 className="font-bold">Posted account movements</h3>
                  {!data?.report && (
                    <p className="mt-3 text-sm">Select a configured ledger.</p>
                  )}
                  {data?.report?.accounts.map((a: Row) => (
                    <p className="mt-3 text-sm" key={a.id}>
                      {a.account_code} {a.account_name}
                      <br />
                      Debit {a.debit} · Credit {a.credit} {currency}
                    </p>
                  ))}
                </section>
              </div>
            </section>
          )}
        </>
      ) : (
        <>
          <Triage key={revision} role="treasurer" />
          <section className={`${card} mt-5`}>
            <h2 className="font-bold">Bills and journal reviews</h2>
            {pendingBills.map((b: Row) => (
              <button
                key={b.id}
                onClick={() => setBill(b.id)}
                className="mt-3 block w-full border-b border-[#30363D] py-3 text-left"
              >
                <span aria-hidden>☐ </span>
                {b.bill_number} · {b.balance_due} {b.currency} · {b.status}
                {b.approval_required_role === "org_admin"
                  ? " · Executive sign-off required"
                  : ""}
              </button>
            ))}
            {data?.journals.map((j: Row) => (
              <button
                className="mt-3 block w-full border-b border-[#30363D] py-3 text-left"
                key={j.id}
                onClick={() => setJournal(j.id)}
              >
                <span aria-hidden>☐ </span>
                {j.journal_number} · {j.status}
              </button>
            ))}
            {!pendingBills.length && !data?.journals.length && (
              <p className="mt-3 text-sm">
                No bill or journal reviews are recorded.
              </p>
            )}
          </section>
        </>
      )}
      {deposit && (
        <Transactions
          role="treasurer"
          onClose={() => {
            setDeposit(false);
            void refreshed();
          }}
          onSaved={() => void refreshed()}
        />
      )}
      {bill && (
        <BillDrawer
          role="treasurer"
          id={bill}
          onClose={() => setBill(null)}
          onSaved={refreshed}
        />
      )}
      {journal && data?.entity && (
        <JournalDrawer
          role="treasurer"
          id={journal}
          entity={data.entity}
          onClose={() => setJournal(null)}
          onSaved={refreshed}
        />
      )}
    </main>
  );
}
