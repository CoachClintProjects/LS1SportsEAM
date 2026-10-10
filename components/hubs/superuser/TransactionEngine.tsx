"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { authenticatedFetch } from "@/lib/client/authenticatedFetch";
import { AdminDrawerShell } from "../admin/AdminDrawerShell";
type Row = Record<string, any>;
export function TransactionEngine({
  role = "org_admin",
  personId,
  onClose,
  onSaved,
}: {
  role?: string;
  personId?: string;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [data, setData] = useState<Row | null>(null),
    [mode, setMode] = useState(personId ? "transfer" : "deposit"),
    [values, setValues] = useState<Row>({}),
    [reason, setReason] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [quote, setQuote] = useState<Row | null>(null);
  const saving = useRef(false),
    retry = useRef<{ key: string; id: string } | null>(null);
  const load = useCallback(async () => {
    const r = await authenticatedFetch(
      `/api/admin-cross-engine?role=${encodeURIComponent(role)}${personId ? `&personId=${personId}` : ""}`,
    );
    const j = await r.json();
    if (!r.ok) throw new Error(j.error);
    setData(j);
  }, [role, personId]);
  useEffect(() => {
    let active = true;
    load().catch((e) => {
      if (active) setError(e.message);
    });
    return () => {
      active = false;
    };
  }, [load]);
  const change = (key: string, value: unknown) => {
    setValues((v) => ({ ...v, [key]: value }));
    setQuote(null);
    setError("");
    setNotice("");
  };
  async function run(operation: string) {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const v = {
        ...values,
        ...(operation === "transfer" ? { quote } : {}),
        ...(data?.athleteId ? { athlete_id: data.athleteId } : {}),
      };
      const key = JSON.stringify({ operation, values: v, reason });
      if (retry.current?.key !== key)
        retry.current = { key, id: crypto.randomUUID() };
      const r = await authenticatedFetch("/api/admin-cross-engine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          operation,
          values: v,
          reason,
          requestId: retry.current.id,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      if (operation === "preview_transfer") {
        setQuote(j.row);
      } else {
        setQuote(null);
        setValues({});
        setNotice("🟢 GOOD TO GO — saved.");
        onSaved?.();
        await load().catch(() =>
          setNotice("Saved. Close and reopen to refresh the records."),
        );
      }
      retry.current = null;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save.");
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  const input =
    "mt-1 w-full rounded border border-neutral-600 bg-[#0D1117] p-2 text-white";
  const select = (
    key: string,
    label: string,
    rows: Row[],
    name: (r: Row) => string = (r) => r.name,
    allowEmpty = true,
  ) => (
    <label className="block text-sm" key={key}>
      {label}
      <select
        className={input}
        value={values[key] || ""}
        onChange={(e) => change(key, e.target.value)}
      >
        <option value="">
          {allowEmpty ? "Choose…" : "Withdraw from program"}
        </option>
        {rows.map((r) => (
          <option key={r.id} value={r.id}>
            {name(r)}
          </option>
        ))}
      </select>
    </label>
  );
  const number = (key: string, label: string, step = "0.01") => (
    <label className="block text-sm">
      {label}
      <input
        className={input}
        type="number"
        min="0"
        step={step}
        value={values[key] ?? ""}
        onChange={(e) => change(key, e.target.value)}
      />
    </label>
  );
  const text = (key: string, label: string) => (
    <label className="block text-sm">
      {label}
      <input
        className={input}
        value={values[key] || ""}
        onChange={(e) => change(key, e.target.value)}
      />
    </label>
  );
  const groupName = (r: Row) => r.name || r.id;
  const accountOptions = (kind: string) =>
    data?.accounts.filter(
      (a: Row) =>
        a.account_type.toLowerCase() === kind &&
        (!values.ledger_id ||
          a.legal_entity_id ===
            data.ledgers.find((l: Row) => l.id === values.ledger_id)
              ?.legal_entity_id),
    ) || [];
  const membershipGroups =
    data?.groups.filter((g: Row) =>
      data.memberships.some(
        (m: Row) => m.group_id === g.id && m.athlete_id === data.athleteId,
      ),
    ) || [];
  const cap = data?.squadSettings.find(
    (s: Row) => s.config_key === values.destination_id,
  )?.config_value.hard_cap;
  const count =
    data?.memberships.filter((m: Row) => m.group_id === values.destination_id)
      .length || 0;
  const full = !!values.destination_id && cap !== undefined && count >= cap;
  return (
    <AdminDrawerShell
      title="Club balance & squad changes"
      busy={busy}
      onClose={onClose}
    >
      <div className="space-y-4">
        {error && (
          <div
            role="alert"
            className="rounded border border-red-500 bg-red-950 p-4"
          >
            🔴 CRITICAL STOP — {error}
          </div>
        )}
        {notice && (
          <p role="status" className="text-emerald-300">
            {notice}
          </p>
        )}
        {!data ? (
          <p>Loading club records…</p>
        ) : (
          <fieldset disabled={busy} className="space-y-4 disabled:opacity-60">
            <label className="block">
              Action
              <select
                className={input}
                value={mode}
                onChange={(e) => {
                  setMode(e.target.value);
                  setValues({});
                  setQuote(null);
                  setError("");
                }}
              >
                {(role === "org_admin"
                  ? [
                      ["transfer", "Move squad / withdraw"],
                      ["cover_fee", "Club covers entry fee"],
                      ["cash", "Record deck cash"],
                      ["deposit", "Confirm bank deposit"],
                      ["approve_credit", "Review credit"],
                      ["deactivate", "Deactivate & Rollback"],
                      ["reverse_fee", "Reverse club-covered fee"],
                      ["settings", "Club posting setup"],
                      ["squad_settings", "Squad roster limit"],
                    ]
                  : [
                      ["deposit", "Confirm bank deposit"],
                      ["approve_credit", "Review credit"],
                    ]
                ).map(([v, l]) => (
                  <option value={v} key={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            {!data.settings &&
              !["settings", "squad_settings"].includes(mode) && (
                <p className="text-amber-300">
                  🟡 NEEDS ATTENTION — club posting accounts have not been set
                  up.
                </p>
              )}
            {mode === "transfer" && (
              <>
                {!data.athleteId ? (
                  <p>
                    Open an athlete’s roster drawer and choose Club balance &
                    squad changes.
                  </p>
                ) : (
                  <>
                    {select("source_id", "Current squad", membershipGroups)}
                    {select(
                      "destination_id",
                      "Destination squad (blank means withdrawal)",
                      data.groups.filter(
                        (g: Row) =>
                          g.id !== values.source_id && g.status === "active",
                      ),
                      groupName,
                      false,
                    )}
                    {values.destination_id && (
                      <p
                        className={
                          full
                            ? "rounded bg-red-950 p-3 text-red-200"
                            : "text-neutral-300"
                        }
                      >
                        Roster: {count} / {cap ?? "limit not set"}
                        {full &&
                          " [DENY: ERR-881: ROSTER CAPACITY OVERRUN - DESTINATION GROUP LOCKED]"}
                      </p>
                    )}
                    <label className="flex gap-2">
                      <input
                        type="checkbox"
                        checked={!!values.president_override}
                        onChange={(e) =>
                          change("president_override", e.target.checked)
                        }
                      />
                      President Override
                    </label>
                    {select(
                      "invoice_id",
                      "Athlete’s issued squad-fee invoice",
                      data.invoices,
                      (r) =>
                        `${r.invoice_number} · ${r.currency} ${r.balance_due}`,
                    )}
                    {select(
                      "source_line_id",
                      "Original squad fee",
                      data.lines.filter(
                        (l: Row) =>
                          l.invoice_id === values.invoice_id &&
                          l.entity_id === values.source_id,
                      ),
                      (r) =>
                        `${r.description} · ${r.line_total} + tax ${r.tax_amount}`,
                    )}
                    {values.destination_id &&
                      select(
                        "destination_line_id",
                        "Destination full-season fee evidence",
                        data.lines.filter(
                          (l: Row) => l.entity_id === values.destination_id,
                        ),
                        (r) =>
                          `${r.description} · ${r.line_total} + tax ${r.tax_amount}`,
                      )}
                    <button
                      type="button"
                      className="rounded bg-blue-700 px-4 py-2"
                      disabled={
                        reason.trim().length < 5 ||
                        (full && !values.president_override)
                      }
                      onClick={() => run("preview_transfer")}
                    >
                      Recalculate Club Balance
                    </button>
                    {quote && (
                      <section className="rounded border border-neutral-600 p-4">
                        <p>
                          {quote.remainingDays} days remaining of{" "}
                          {quote.totalDays}
                        </p>
                        <p>
                          Subtotal: {quote.subtotal} · Tax: {quote.tax_total}
                        </p>
                        <p>
                          {quote.balance_due < 0
                            ? "Credit awaiting Treasurer approval"
                            : "Additional amount due"}
                          : {quote.currency} {Math.abs(quote.balance_due)}
                        </p>
                        {quote.refundCutoff && (
                          <p>
                            [POLICY ENFORCED: REFUND CUT-OFF CEILING REACHED]
                          </p>
                        )}
                      </section>
                    )}
                  </>
                )}
              </>
            )}
            {mode === "settings" && (
              <>
                {select(
                  "ledger_id",
                  "Club ledger",
                  data.ledgers,
                  (r) => `${r.name} (${r.currency})`,
                )}
                {[
                  ["bank_account", "Bank account", "asset"],
                  ["held_account", "Undeposited deck cash account", "asset"],
                  ["receivable_account", "Amounts owed by families", "asset"],
                  ["income_account", "Program fee income", "revenue"],
                  ["tax_account", "Tax owed", "liability"],
                ].map(([k, l, t]) =>
                  select(k, l, accountOptions(t), (r) => r.account_name),
                )}
              </>
            )}
            {mode === "squad_settings" && (
              <>
                {select("group_id", "Squad", data.groups)}
                {number("hard_cap", "Maximum roster size", "1")}
              </>
            )}
            {mode === "cash" && (
              <>
                {select("team_id", "Squad holding the cash", data.teams)}
                {select(
                  "invoice_id",
                  "Family invoice",
                  data.invoices.filter((r: Row) => r.balance_due > 0),
                  (r) =>
                    `${r.invoice_number} · ${r.customers.display_name} · ${r.currency} ${r.balance_due}`,
                )}
                {number("amount", "Cash received")}
                <p className="text-sm text-neutral-400">
                  Only the amount received is applied. A partially paid invoice
                  stays unpaid for the remainder.
                </p>
              </>
            )}
            {mode === "deposit" && (
              <>
                {select(
                  "holding_id",
                  "Undeposited receipt",
                  data.holdings,
                  (r) =>
                    `${data.teams.find((t: Row) => t.id === r.payload.team_id)?.name || "Squad"} · ${r.payload.currency} ${r.payload.amount} · ${r.id.slice(0, 8)}`,
                )}
                {text("bank_reference", "Actual bank deposit reference")}
                <p className="text-sm text-neutral-400">
                  Confirm a deposit already made. This records the bank posting;
                  it does not transfer money.
                </p>
              </>
            )}
            {mode === "cover_fee" && (
              <>
                {select(
                  "fee_id",
                  "Assessed meet entry fee",
                  data.fees,
                  (r) =>
                    `${r.competitions.name} · ${r.currency_code} ${r.total_amount}`,
                )}
                {select(
                  "vendor_id",
                  "Meet host’s vendor account",
                  data.vendors,
                )}
                {select(
                  "expense_account",
                  "Squad operating expense",
                  accountOptions("expense"),
                  (r) => r.account_name,
                )}
                {select(
                  "payable_account",
                  "Amounts owed to meet hosts",
                  accountOptions("liability"),
                  (r) => r.account_name,
                )}
                <p>
                  Club coverage clears this fee only. Other eligibility or
                  unpaid-fee restrictions remain in effect.
                </p>
              </>
            )}
            {mode === "approve_credit" && (
              <>
                {select(
                  "credit_id",
                  "Credit awaiting review",
                  data.tasks
                    .filter((t: Row) => t.metadata.credit_id)
                    .map((t: Row) => ({ ...t, id: t.metadata.credit_id })),
                  (r) => r.title + " · " + r.id.slice(0, 8),
                )}
                {data.tasks.find(
                  (t: Row) => t.metadata.credit_id === values.credit_id,
                )?.metadata.needs_fee_review && (
                  <>
                    {number("subtotal", "Verified fee amount to credit")}
                    {number("tax_total", "Verified tax amount to credit")}
                  </>
                )}
              </>
            )}
            {mode === "reverse_fee" &&
              select(
                "task_id",
                "Club-covered fee to reverse",
                data.tasks.filter((t: Row) => t.metadata.vendor_bill_id),
                (r) => r.title + " · " + r.metadata.vendor_bill_id.slice(0, 8),
              )}
            {mode === "deactivate" && (
              <>
                <p className="rounded bg-red-950 p-3">
                  [DENY: ERR-409: REFERENTIAL RECONCILIATION INTEGRITY BLOCK]
                </p>
                <label>
                  Record type
                  <select
                    className={input}
                    value={values.entity || ""}
                    onChange={(e) => setValues({ entity: e.target.value })}
                  >
                    <option value="">Choose…</option>
                    <option value="group">Squad</option>
                    <option value="program">Program</option>
                  </select>
                </label>
                {select(
                  "id",
                  "Record to suspend",
                  values.entity === "program" ? data.programs : data.groups,
                )}
                <p>
                  Suspends memberships, drafts credits for linked unpaid fees
                  and creates an urgent notice task. Nothing is deleted or sent.
                </p>
              </>
            )}
            <label className="block">
              Reason
              <textarea
                className={input}
                maxLength={4000}
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  setQuote(null);
                }}
              />
            </label>
            <button
              className="rounded bg-emerald-700 px-5 py-3 font-semibold disabled:opacity-40"
              disabled={
                reason.trim().length < 5 ||
                (mode === "transfer" &&
                  (!quote ||
                    !data.athleteId ||
                    (full && !values.president_override)))
              }
              onClick={() => run(mode)}
            >
              {busy
                ? "Saving…"
                : mode === "cover_fee"
                  ? "CLUB COVERS ENTRY FEE"
                  : mode === "deposit"
                    ? "CONFIRM BANK DEPOSIT"
                    : mode === "reverse_fee"
                      ? "REVERSE TRANSACTION"
                      : mode === "deactivate"
                        ? "Deactivate & Rollback"
                        : mode === "approve_credit"
                          ? "Approve credit"
                          : "Save decision"}
            </button>
          </fieldset>
        )}
      </div>
    </AdminDrawerShell>
  );
}
