"use client";
import { useState } from "react";
type Account = {
  id: string;
  account_code: string;
  account_name: string;
  account_type: string;
};
export default function PayableLedgerActions({
  bill,
  lines,
  ledgers,
  accounts,
  payments,
  busy,
  canDecide,
  canAct,
  canApprove,
  onAction,
}: {
  bill: {
    id: string;
    status: string;
    bill_date: string;
    tax_total: string;
    journal_id: string | null;
  };
  lines: { line_no?: number; description: string; account_id?: string }[];
  ledgers: { id: string; name: string; currency: string }[];
  accounts: Account[];
  payments: {
    id: string;
    reference: string;
    status: string;
    journal_id: string | null;
  }[];
  busy: boolean;
  canDecide: boolean;
  canAct: boolean;
  canApprove: boolean;
  onAction: (
    operation: string,
    values: Record<string, unknown>,
  ) => Promise<void>;
}) {
  const [values, setValues] = useState({
      ledger_id: "",
      payable_account_id: "",
      tax_account_id: "",
      journal_number: "",
      journal_date: "",
    }),
    [allocations, setAllocations] = useState<Record<number, string>>({}),
    [journalId, setJournalId] = useState(() => crypto.randomUUID()),
    [paymentId, setPaymentId] = useState("");
  const input =
    "mt-1 w-full rounded border border-neutral-600 bg-[#17191d] px-3 py-2 text-sm text-white";
  const choose = (
    key: keyof typeof values,
    label: string,
    options: { id: string; label: string }[],
  ) => (
    <label key={key}>
      {label}
      <select
        className={input}
        value={values[key]}
        onChange={(e) => setValues({ ...values, [key]: e.target.value })}
      >
        <option value="">Select account</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
  const accountOptions = (types: string[]) =>
    accounts
      .filter((a) => types.includes(a.account_type.toLowerCase()))
      .map((a) => ({
        id: a.id,
        label: `${a.account_code} · ${a.account_name}`,
      }));
  const posting = !bill.journal_id && bill.status === "approved";
  const reversals = payments.filter(
    (p) => p.status === "posted" && p.journal_id,
  );
  const cancellable =
    !!bill.journal_id &&
    bill.status === "approved" &&
    canApprove &&
    !reversals.length;
  async function act(operation: string) {
    await onAction(operation, {
      ...values,
      journal_id: journalId,
      payment_id: paymentId,
      allocations: lines.map((l, i) => ({
        line_no: l.line_no ?? i + 1,
        account_id: allocations[l.line_no ?? i + 1],
      })),
    });
  }
  // Retain stable IDs across failed requests; remount on the bill's saved version.
  return (
    <section className="mt-6 border-t border-neutral-600 pt-4">
      <h3 className="font-bold">General ledger</h3>
      {bill.journal_id && (
        <p className="mt-2 text-green-300">
          This bill has a linked ledger posting. Its journal and reversals
          remain in the accounting history.
        </p>
      )}
      {!bill.journal_id && (
        <p className="mt-2 text-amber-300">
          Approve and post this bill before recording payment. Use an accrual
          ledger and the accounts appropriate to the purchase.
        </p>
      )}
      {canDecide && (posting || cancellable || reversals.length > 0) && (
        <fieldset disabled={busy} className="mt-4 grid gap-4 sm:grid-cols-2">
          {posting && (
            <>
              <label>
                Accrual ledger
                <select
                  className={input}
                  value={values.ledger_id}
                  onChange={(e) =>
                    setValues({ ...values, ledger_id: e.target.value })
                  }
                >
                  <option value="">Select ledger</option>
                  {ledgers.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} · {l.currency}
                    </option>
                  ))}
                </select>
              </label>
              {choose(
                "payable_account_id",
                "Accounts payable control",
                accountOptions(["liability"]),
              )}
              {Number(bill.tax_total) > 0 &&
                choose(
                  "tax_account_id",
                  "Tax asset or tax expense",
                  accountOptions(["asset", "expense"]),
                )}
              {lines.map((l, i) => (
                <label key={l.line_no ?? i + 1} className="sm:col-span-2">
                  Line {l.line_no ?? i + 1}: {l.description}
                  <select
                    className={input}
                    value={allocations[l.line_no ?? i + 1] || ""}
                    onChange={(e) =>
                      setAllocations({
                        ...allocations,
                        [l.line_no ?? i + 1]: e.target.value,
                      })
                    }
                  >
                    <option value="">Select expense or asset account</option>
                    {accountOptions(["asset", "expense"]).map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              {!ledgers.length && (
                <p className="text-amber-300 sm:col-span-2">
                  Set up an accrual ledger and open fiscal period under General
                  ledger.
                </p>
              )}
            </>
          )}
          <label>
            {posting ? "Posting" : "Reversal"} journal number
            <input
              className={input}
              value={values.journal_number}
              onChange={(e) =>
                setValues({ ...values, journal_number: e.target.value })
              }
            />
          </label>
          <label>
            {posting ? "Posting" : "Reversal"} date
            <input
              className={input}
              type="date"
              value={values.journal_date}
              onChange={(e) =>
                setValues({ ...values, journal_date: e.target.value })
              }
            />
          </label>
          {posting && (
            <button
              className="rounded bg-green-700 px-4 py-2 font-semibold disabled:opacity-40"
              disabled={
                !canAct ||
                !values.ledger_id ||
                !values.payable_account_id ||
                !values.journal_number ||
                !values.journal_date ||
                lines.some((l, i) => !allocations[l.line_no ?? i + 1]) ||
                (Number(bill.tax_total) > 0 && !values.tax_account_id)
              }
              onClick={() => void act("post_ledger")}
            >
              Post bill to ledger
            </button>
          )}
          {cancellable && (
            <button
              className="rounded bg-red-800 px-4 py-2 font-semibold disabled:opacity-40"
              disabled={
                !canAct || !values.journal_date || !values.journal_number
              }
              onClick={() => void act("cancel")}
            >
              Cancel bill and reverse posting
            </button>
          )}
          {reversals.length > 0 && (
            <>
              <label>
                Payment to reverse
                <select
                  className={input}
                  value={paymentId}
                  onChange={(e) => {
                    setPaymentId(e.target.value);
                    setJournalId(crypto.randomUUID());
                  }}
                >
                  <option value="">Select recorded payment</option>
                  {reversals.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.reference}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="rounded bg-red-800 px-4 py-2 font-semibold disabled:opacity-40"
                disabled={
                  !canAct ||
                  !paymentId ||
                  !values.journal_date ||
                  !values.journal_number
                }
                onClick={() => void act("reverse_payment")}
              >
                Reverse payment and ledger entry
              </button>
              <p className="text-sm text-neutral-400 sm:col-span-2">
                A reversal corrects the recorded accounting transaction. It does
                not recall money from a bank.
              </p>
            </>
          )}
        </fieldset>
      )}
    </section>
  );
}
