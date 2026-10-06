"use client";
import { useEffect, useState } from "react";
import { authenticatedFetch } from "@/lib/client/authenticatedFetch";
import { AdminDrawerShell } from "./AdminDrawerShell";
import { ledgerCsv, cents } from "@/lib/client/ledgerAmounts";
type Data = {
  controls: {
    ledger_id: string;
    ledger_name: string;
    currency: string;
    account_code: string;
    account_name: string;
    payable_balance: string;
    ledger_balance: string;
    variance: string;
  }[];
  unposted_bill_count: number;
  unlinked_payment_count: number;
};
export default function PayableReconciliationDrawer({
  role,
  entities,
  onClose,
}: {
  role: string;
  entities: { id: string; legal_name: string }[];
  onClose: () => void;
}) {
  const [entity, setEntity] = useState(
      entities.length === 1 ? entities[0].id : "",
    ),
    [data, setData] = useState<Data | null>(null),
    [error, setError] = useState(""),
    [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    setData(null);
    setError("");
    if (entity)
      void authenticatedFetch(
        `/api/admin-payables?${new URLSearchParams({ role, entity, mode: "reconciliation" })}`,
        { cache: "no-store" },
      )
        .then(async (r) => {
          const j = await r.json();
          if (!r.ok) throw new Error(j.error);
          if (active) setData(j);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    return () => {
      active = false;
    };
  }, [role, entity, reload]);
  function download() {
    if (!data) return;
    const csv = ledgerCsv([
      [
        "Ledger",
        "Currency",
        "Account code",
        "Account",
        "Payable balance",
        "Ledger balance",
        "Variance",
      ],
      ...data.controls.map((r) => [
        r.ledger_name,
        r.currency,
        r.account_code,
        r.account_name,
        r.payable_balance,
        r.ledger_balance,
        r.variance,
      ]),
    ]);
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "payable-ledger-reconciliation.csv";
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <AdminDrawerShell
      title="Payables and ledger reconciliation"
      onClose={onClose}
    >
      <p className="mb-4 text-neutral-300">
        Compare current outstanding posted bills with their liability control
        accounts. Ledger balances include all posted journals and posting dates,
        including manual adjustments.
      </p>
      <label>
        Legal entity
        <select
          className="mt-1 w-full rounded border border-neutral-600 bg-[#17191d] px-3 py-2"
          value={entity}
          onChange={(e) => setEntity(e.target.value)}
        >
          <option value="">Select legal entity</option>
          {entities.map((e) => (
            <option key={e.id} value={e.id}>
              {e.legal_name}
            </option>
          ))}
        </select>
      </label>
      <button
        className="my-4 rounded bg-blue-700 px-4 py-2"
        onClick={() => setReload(reload + 1)}
      >
        Refresh balances
      </button>
      {error && (
        <p role="alert" className="text-red-300">
          {error}
        </p>
      )}
      {entity && !data && !error && <p>Loading ledger reconciliation…</p>}
      {data && (
        <>
          <p className="mb-3 text-amber-200">
            Non-draft bills without ledger postings: {data.unposted_bill_count}{" "}
            · Recorded payments without ledger links:{" "}
            {data.unlinked_payment_count}
          </p>
          {data.controls.length ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr>
                      {[
                        "Ledger / account",
                        "Currency",
                        "Payables",
                        "Ledger",
                        "Variance",
                      ].map((h) => (
                        <th key={h} className="p-3">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.controls.map((r) => (
                      <tr
                        key={`${r.ledger_id}:${r.account_code}`}
                        className="border-t border-neutral-700"
                      >
                        <td className="p-3">
                          {r.ledger_name}
                          <br />
                          {r.account_code} · {r.account_name}
                        </td>
                        <td className="p-3">{r.currency}</td>
                        <td className="p-3">{r.payable_balance}</td>
                        <td className="p-3">{r.ledger_balance}</td>
                        <td
                          className={`p-3 ${cents(r.variance) !== BigInt(0) ? "text-red-300" : "text-green-300"}`}
                        >
                          {r.variance}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                className="mt-4 rounded bg-blue-700 px-4 py-2"
                onClick={download}
              >
                Export CSV
              </button>
            </>
          ) : (
            <p className="text-neutral-400">
              No vendor bills have been posted to a control account. There is no
              reconciliation result to certify yet.
            </p>
          )}
        </>
      )}
    </AdminDrawerShell>
  );
}
