"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { authenticatedFetch } from "@/lib/client/authenticatedFetch";
import { reports, type Account } from "@/lib/overwatch/reports";
type Data = {
  generatedAt: string;
  personnel: {
    total: number;
    clear: number;
    rate: number | null;
    expired_safesport: number;
    expired_background_checks: number;
    missing_or_unverified: number;
  };
  integrity: {
    athletes: number;
    birth_unverified: number | null;
    pending_governing_ids: number;
  };
  ledger: string | null;
  ledgers: { id: string; name: string; currency: string }[];
  accounts: { id: string; account_name: string }[];
  from: string;
  to: string;
  report: null | { accounts: Account[] };
  postedJournals: number | null;
  invalidJournals: number | null;
  cash: string | null;
  reserve: string | null;
  liquiditySetup: null | { bank_account: string; reserve_account: string };
  canSetup: boolean;
};
export function OverwatchTelemetry() {
  const [data, setData] = useState<Data | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [refreshing, setRefreshing] = useState(false),
    [ledger, setLedger] = useState(""),
    [from, setFrom] = useState(new Date().getFullYear() + "-01-01"),
    [to, setTo] = useState(new Date().toISOString().slice(0, 10)),
    [bank, setBank] = useState(""),
    [reserve, setReserve] = useState(""),
    [notice, setNotice] = useState("");
  const sequence = useRef(0),
    action = useRef(false);
  const params = useCallback(
    () => new URLSearchParams({ from, to, ...(ledger ? { ledger } : {}) }),
    [from, to, ledger],
  );
  const load = useCallback(async () => {
    const seq = ++sequence.current;
    setRefreshing(true);
    try {
      const r = await authenticatedFetch("/api/admin-overwatch?" + params());
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      if (seq === sequence.current) {
        setData(j);
        setError("");
        setBank((v) => v || j.liquiditySetup?.bank_account || "");
        setReserve((v) => v || j.liquiditySetup?.reserve_account || "");
      }
    } catch (e) {
      if (seq === sequence.current)
        setError(e instanceof Error ? e.message : "Unable to refresh.");
    } finally {
      if (seq === sequence.current) setRefreshing(false);
    }
  }, [params]);
  useEffect(() => {
    void load();
    const timer = setInterval(() => {
      if (!document.hidden && !action.current) void load();
    }, 60000);
    return () => {
      ++sequence.current;
      clearInterval(timer);
    };
  }, [load]);
  async function download(kind: string) {
    if (action.current) return;
    action.current = true;
    setBusy(true);
    setNotice("");
    try {
      const p = params();
      p.set("export", kind);
      const r = await authenticatedFetch("/api/admin-overwatch?" + p);
      if (!r.ok) throw new Error((await r.json()).error);
      const blob = await r.blob(),
        url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download =
        r.headers
          .get("Content-Disposition")
          ?.match(/filename="([^"]+)"/)?.[1] || `ls1-${kind}-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice("Records downloaded. Export recorded in activity history.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed.");
    } finally {
      action.current = false;
      setBusy(false);
    }
  }
  async function save() {
    if (action.current) return;
    action.current = true;
    setBusy(true);
    try {
      const r = await authenticatedFetch("/api/admin-overwatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ledger: data?.ledger, bank, reserve }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      await load();
      setNotice("Reporting accounts saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      action.current = false;
      setBusy(false);
    }
  }
  const style =
    "rounded border border-neutral-600 bg-[#0D1117] px-3 py-2 text-sm text-white";
  const currency = data?.ledgers.find((l) => l.id === data.ledger)?.currency;
  const amount = (v: string | null) =>
    v === null
      ? "Not configured"
      : `${currency || ""} ${v.split(".")[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${(v.split(".")[1] || "").padEnd(2, "0")}`;
  let summary: ReturnType<typeof reports> | null = null,
    reportError = "";
  try {
    if (data?.report) summary = reports(data.report.accounts);
  } catch (e) {
    reportError = e instanceof Error ? e.message : "Report unavailable";
  }
  const rate = data?.personnel.rate,
    signal =
      rate == null
        ? "🟡 NEEDS ATTENTION"
        : rate >= 95
          ? "🟢 GOOD TO GO"
          : rate >= 85
            ? "🟡 NEEDS ATTENTION"
            : "🔴 CRITICAL STOP",
    color =
      rate != null && rate >= 95
        ? "bg-emerald-500"
        : rate != null && rate >= 85
          ? "bg-amber-400"
          : "bg-red-500";
  return (
    <section
      className="space-y-4 border-b border-neutral-700 bg-[#0D1117] p-5 text-white"
      aria-label="Club oversight"
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Club oversight</h2>
          <p className="text-xs text-neutral-400">
            {data
              ? "Updated " + new Date(data.generatedAt).toLocaleString()
              : "Loading live club records…"}
          </p>
        </div>
        <button className={style} disabled={busy} onClick={() => void load()}>
          Refresh records
        </button>
      </header>
      {error && (
        <p role="alert" className="rounded bg-red-950 p-3 text-red-200">
          🔴 CRITICAL STOP — {error}{" "}
          {data ? "Last successful snapshot remains below." : ""}
        </p>
      )}
      {notice && (
        <p role="status" className="text-emerald-300">
          {notice}
        </p>
      )}
      {data && (
        <>
          <div className="grid gap-3 lg:grid-cols-3">
            <article className="rounded border border-neutral-700 bg-[#161B22] p-4">
              <h3 className="font-semibold">Personnel clearance</h3>
              <p className="my-2 text-3xl font-bold">
                {rate == null ? "No active personnel" : `${rate}%`}
              </p>
              <p className="text-sm">{signal}</p>
              <div
                role="meter"
                aria-label="Verified personnel clearance"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={rate ?? undefined}
                className="my-3 h-2 overflow-hidden rounded bg-neutral-700"
              >
                <div
                  className={"h-full " + color}
                  style={{ width: `${rate ?? 0}%` }}
                />
              </div>
              <p className="text-xs">
                {data.personnel.clear} of {data.personnel.total} active
                personnel have both verified clearances.
              </p>
              <p className="mt-2 text-xs text-neutral-300">
                Expired SafeSport: {data.personnel.expired_safesport} · Expired
                background checks: {data.personnel.expired_background_checks}
              </p>
            </article>
            <article className="rounded border border-neutral-700 bg-[#161B22] p-4">
              <h3 className="font-semibold">Club funds</h3>
              <p className="mt-3 text-xs text-neutral-400">
                Available bank funds
              </p>
              <p className="text-2xl font-bold">{amount(data.cash)}</p>
              <p className="mt-3 text-xs text-neutral-400">Reserved funds</p>
              <p className="text-2xl font-bold">{amount(data.reserve)}</p>
              <p className="mt-2 text-xs text-neutral-400">
                Posted balances as of {data.to}. Bank and reserve accounts are
                reported separately.
              </p>
            </article>
            <article className="rounded border border-neutral-700 bg-[#161B22] p-4">
              <h3 className="font-semibold">Records needing attention</h3>
              <p className="mt-3 text-2xl font-bold">
                {data.integrity.birth_unverified ?? "Not configured"}{" "}
                <span className="text-sm font-normal">
                  birth certificates unverified or missing
                </span>
              </p>
              <p className="mt-3 text-2xl font-bold">
                {data.integrity.pending_governing_ids}{" "}
                <span className="text-sm font-normal">
                  athletes with a pending ID
                </span>
              </p>
              <p className="mt-2 text-xs text-neutral-400">
                {data.integrity.athletes} active club athletes checked.
                Categories may overlap.
              </p>
            </article>
          </div>
          <div className="flex flex-wrap gap-3">
            <label className="text-xs">
              Club ledger
              <select
                className={"ml-2 " + style}
                value={ledger || data.ledger || ""}
                onChange={(e) => {
                  setBank("");
                  setReserve("");
                  setLedger(e.target.value);
                }}
                disabled={busy}
              >
                <option value="">Choose…</option>
                {data.ledgers.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} · {l.currency}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs">
              From{" "}
              <input
                className={style}
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                disabled={busy}
              />
            </label>
            <label className="text-xs">
              To{" "}
              <input
                className={style}
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                disabled={busy}
              />
            </label>
          </div>
          {data.canSetup && data.ledger && (
            <details>
              <summary className="cursor-pointer text-sm text-blue-300">
                Choose bank and reserve reporting accounts
              </summary>
              <div className="mt-3 flex flex-wrap gap-3">
                {[
                  ["Bank account", bank, setBank],
                  ["Reserve account", reserve, setReserve],
                ].map(([label, value, set]) => (
                  <label key={String(label)} className="text-sm">
                    {String(label)}
                    <select
                      className={"ml-2 " + style}
                      value={String(value)}
                      disabled={busy}
                      onChange={(e) =>
                        (set as (v: string) => void)(e.target.value)
                      }
                    >
                      <option value="">Choose…</option>
                      {data.accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.account_name}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
                <button
                  className={style}
                  disabled={busy || !bank || !reserve || bank === reserve}
                  onClick={() => void save()}
                >
                  Save accounts
                </button>
              </div>
            </details>
          )}
          <details className="rounded border border-neutral-700 p-4">
            <summary className="cursor-pointer font-semibold">
              Master Bookkeeping Ledger Overview
            </summary>
            {!data.ledger ? (
              <p className="mt-3">
                Set up a club ledger to generate financial reports.
              </p>
            ) : data.invalidJournals ? (
              <p className="mt-3 text-red-300">
                🔴 CRITICAL STOP — {data.invalidJournals} unbalanced posted
                journals. Reports and financial exports are held.
              </p>
            ) : reportError ? (
              <p role="alert">{reportError}</p>
            ) : data.postedJournals === 0 ? (
              <p className="mt-3">
                0 ACTIVE TRANSACTIONS LOGGED [GENERAL LEDGER BALANCED AND CLEAN]
              </p>
            ) : (
              summary && (
                <>
                  <div className="my-4 grid gap-4 lg:grid-cols-3">
                    {[
                      [
                        "Income statement",
                        [
                          ["Income", summary.income],
                          ["Expenses", summary.expense],
                          ["Net income", summary.netIncome],
                        ],
                      ],
                      [
                        "Balance sheet",
                        [
                          ["Assets", summary.assets],
                          ["Liabilities", summary.liabilities],
                          ["Club equity", summary.equity],
                          ["Unclosed earnings", summary.earnings],
                          ["Difference", summary.balanceDifference],
                        ],
                      ],
                      [
                        "Trial balance",
                        [
                          ["Debits", summary.trialDebit],
                          ["Credits", summary.trialCredit],
                          ["Difference", summary.trialDifference],
                        ],
                      ],
                    ].map(([title, rows]) => (
                      <section key={String(title)}>
                        <h4 className="font-semibold">{String(title)}</h4>
                        {(rows as string[][]).map(([label, v]) => (
                          <p
                            className="flex justify-between gap-4 text-sm"
                            key={label}
                          >
                            <span>{label}</span>
                            <span>{amount(v)}</span>
                          </p>
                        ))}
                      </section>
                    ))}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr>
                          {[
                            "Account",
                            "Opening",
                            "Debits",
                            "Credits",
                            "Closing",
                          ].map((h) => (
                            <th className="p-2 text-left" key={h}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {data.report?.accounts.map((a) => (
                          <tr
                            className="border-t border-neutral-700"
                            key={a.id}
                          >
                            <td className="p-2">
                              {a.account_code} · {a.account_name}
                            </td>
                            {[a.opening, a.debit, a.credit, a.closing].map(
                              (v, i) => (
                                <td className="p-2" key={i}>
                                  {amount(v)}
                                </td>
                              ),
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )
            )}
          </details>
          <div>
            <h3 className="mb-2 text-sm font-semibold">
              Download Certified Records
            </h3>
            <p className="mb-2 text-xs text-neutral-400">
              Timestamped copies of saved records; clearance verification is
              included for each person.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                className={style}
                disabled={busy || refreshing || !!error}
                onClick={() => void download("personnel")}
              >
                📥 DOWNLOAD EXPORT: PERSONNEL RECS
              </button>
              <button
                className={style}
                disabled={
                  busy ||
                  refreshing ||
                  !!error ||
                  !data.ledger ||
                  !!data.invalidJournals ||
                  !!reportError
                }
                onClick={() => void download("finance")}
              >
                📥 DOWNLOAD EXPORT: FINANCIAL LEDGER
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
