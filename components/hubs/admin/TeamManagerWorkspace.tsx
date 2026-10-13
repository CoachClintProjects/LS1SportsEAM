"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { authenticatedFetch } from "@/lib/client/authenticatedFetch";
import { AdminDrawerShell } from "./AdminDrawerShell";
const TriageTaskHub = dynamic(() => import("../superuser/TriageTaskHub"));
type Row = Record<string, any>;
type Feed = {
  squad: Row;
  athletes: Row[];
  registrations: Row[];
  responses: Row[];
  participants: Row[];
  practices: Row[];
  holdings: Row[];
  customers: Row[];
  invoices: Row[];
  postingConfigured: boolean;
  canCash: boolean;
  generatedAt: string;
  truncated: boolean;
};
const titles: Record<string, string> = {
  "tm-roster": "Swimmer Roster",
  "tm-meets": "Meet Invitations Hub",
  "tm-travel": "Team Travel & Hotels",
  "tm-fees": "Collect Team Fees",
  "tm-practice": "Practice Timelines",
};
const control =
  "rounded border border-[#30363D] bg-[#0A0C10] px-3 py-2 text-sm disabled:opacity-40";
const name = (a: Row) =>
  [a.people?.preferred_name || a.people?.first_name, a.people?.last_name]
    .filter(Boolean)
    .join(" ") ||
  a.athlete_number ||
  a.id;
export function TeamManagerWorkspace() {
  const params = useSearchParams(),
    view = params.get("view") || "home";
  const [data, setData] = useState<Feed | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [search, setSearch] = useState(""),
    [selected, setSelected] = useState<Row | null>(null),
    [dispatch, setDispatch] = useState(false),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [amount, setAmount] = useState(""),
    [reason, setReason] = useState("");
  const [page, setPage] = useState(1);
  const generation = useRef(0),
    saving = useRef(false),
    requestId = useRef("");
  const load = useCallback(async () => {
    const seq = ++generation.current;
    setLoading(true);
    try {
      const r = await authenticatedFetch("/api/admin-team-manager", {
        cache: "no-store",
      });
      const j = await r.json();
      if (seq !== generation.current) return;
      if (!r.ok) throw new Error(j.error || "Squad unavailable.");
      setData(j);
      setError("");
    } catch (e) {
      if (seq === generation.current) {
        setData(null);
        setError(e instanceof Error ? e.message : "Unable to load squad.");
      }
    } finally {
      if (seq === generation.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
    return () => {
      generation.current++;
    };
  }, [load]);
  useEffect(() => {
    setSelected(null);
    setDispatch(false);
    setSearch("");
    setPage(1);
    setNotice("");
  }, [view]);
  async function cash() {
    if (!data || !selected || saving.current) return;
    saving.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const r = await authenticatedFetch("/api/admin-team-manager", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "cash",
          team: data.squad.id,
          invoiceId: selected.id,
          requestId: requestId.current,
          amount,
          reason,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Receipt failed.");
      setSelected(null);
      setNotice(
        "Cash receipt saved. The outstanding balance was reduced by the amount received and Treasurer has a reconciliation task.",
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Receipt failed.");
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  function open(row: Row) {
    setSelected(row);
    setAmount("");
    setReason("");
    setError("");
    setNotice("");
    requestId.current = crypto.randomUUID();
  }
  const athleteName = (id: string) => {
    const a = data?.athletes.find((a) => a.id === id);
    return a ? name(a) : "Assigned swimmer";
  };
  const rows: Row[] = !data
    ? []
    : view === "tm-roster"
      ? data.athletes.map((a) => ({
          ...a,
          label: name(a),
          detail: a.athlete_number,
          status: data.registrations.some(
            (r) =>
              r.athlete_id === a.id && r.status?.toLowerCase() === "blocked",
          )
            ? "BLOCKED"
            : a.athlete_status || "Unassessed",
        }))
      : view === "tm-meets"
        ? data.responses.map((r) => ({
            ...r,
            label: r.competitions?.name || "Competition",
            detail: athleteName(r.athlete_id),
            status: r.response_status || r.invitation_status,
          }))
        : view === "tm-travel"
          ? data.participants.map((r) => ({
              ...r,
              label: r.travel_plans?.name,
              detail: `${athleteName(r.athlete_id)} · ${r.travel_plans?.destination_city || "Destination not recorded"}`,
            }))
          : view === "tm-fees"
            ? data.invoices.map((r) => ({
                ...r,
                label: r.invoice_number,
                detail: `${r.balance_due} ${r.currency} outstanding · ${data.customers.find((c) => c.id === r.customer_id)?.display_name || "Squad account"}`,
              }))
            : view === "tm-practice"
              ? data.practices.map((r) => ({
                  ...r,
                  label: r.title,
                  detail: `${new Date(r.starts_at).toLocaleString()} · ${r.timezone || ""}`,
                }))
              : [];
  const filtered = rows.filter((r) =>
    `${r.label} ${r.detail} ${r.status}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 25)),
    currentPage = Math.min(page, pages);
  return (
    <main className="min-h-full bg-[#0A0C10] p-6 text-white">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-orange-300">
            Team Manager · Squad Logistics
          </p>
          <h1 className="mt-1 text-2xl font-bold">
            {titles[view] || "Today’s Tasks / What Needs Attention"}
          </h1>
          {data && (
            <p className="mt-2 text-sm text-neutral-300">
              {data.squad.name} · {data.squad.code}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className={control}
            disabled={loading || busy}
            onClick={() => void load()}
          >
            Refresh
          </button>
          <button
            className={control}
            disabled={!data || loading}
            onClick={() => setDispatch(true)}
          >
            + DISPATCH SQUAD MEET INVITATION
          </button>
        </div>
      </header>
      {loading && (
        <p role="status" className="my-4">
          Loading assigned squad…
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="my-4 rounded border border-red-700 bg-red-950 p-4"
        >
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="my-4 rounded border border-green-700 p-4">
          {notice}
        </p>
      )}
      {!loading && !data && (
        <p className="mt-4 text-sm text-neutral-300">
          Organization Admin must configure the requested active squad and the
          Team Manager assignment. No other club roster is substituted.
        </p>
      )}
      {data && (
        <>
          {data.truncated && (
            <p role="alert" className="my-4 text-amber-300">
              This view reached a record limit. Totals are incomplete; ask
              Organization Admin to review the full records before reconciling.
            </p>
          )}
          {view === "home" ? (
            <TriageTaskHub
              key={data.squad.id}
              role="team_manager"
              fixedTeam={data.squad.id}
            />
          ) : (
            <>
              <div className="my-5 flex flex-wrap items-center justify-between gap-3">
                <label className="text-sm">
                  Find a record{" "}
                  <input
                    className={control}
                    type="search"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                  />
                </label>
                <Link className={control} href="/admin?role=team_manager">
                  Open squad alerts and resolution actions →
                </Link>
              </div>
              {view === "tm-fees" && (
                <section className="mb-4 rounded border border-[#30363D] bg-[#161B22] p-4">
                  <h2 className="font-semibold">Undeposited deck cash</h2>
                  {data.holdings.length ? (
                    data.holdings.map((h) => (
                      <p key={h.id} className="mt-2 text-sm">
                        {h.payload.amount} {h.payload.currency} · Awaiting
                        Treasurer reconciliation
                      </p>
                    ))
                  ) : (
                    <p className="mt-2 text-sm text-neutral-300">
                      No open deck cash holdings are recorded.
                    </p>
                  )}
                  {!data.postingConfigured && (
                    <p className="mt-3 text-amber-300">
                      Cash recording requires the club’s posting accounts to be
                      configured by Organization Admin.
                    </p>
                  )}
                </section>
              )}
              {view === "tm-travel" && (
                <p className="mb-4 text-sm text-neutral-300">
                  Saved travel participation for this squad. Hotel bookings are
                  not represented in the current travel records.
                </p>
              )}
              <section className="overflow-x-auto rounded border border-[#30363D] bg-[#161B22]">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr>
                      <th className="p-4">Record</th>
                      <th className="p-4">Details</th>
                      <th className="p-4">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered
                      .slice((currentPage - 1) * 25, currentPage * 25)
                      .map((r) => (
                        <tr key={r.id} className="border-t border-[#30363D]">
                          <td className="p-4">
                            <button
                              className="text-left font-semibold text-blue-300 underline"
                              onClick={() => open(r)}
                            >
                              {r.label}
                            </button>
                          </td>
                          <td className="p-4">{r.detail}</td>
                          <td className="p-4">
                            {["blocked", "rejected", "cancelled"].includes(
                              String(r.status).toLowerCase(),
                            )
                              ? "🔴"
                              : [
                                    "paid",
                                    "accepted",
                                    "attending",
                                    "approved",
                                    "confirmed",
                                    "completed",
                                  ].includes(String(r.status).toLowerCase())
                                ? "🟢"
                                : "🟡"}{" "}
                            {r.status || "Needs review"}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                <nav
                  aria-label="Squad records pagination"
                  className="flex items-center justify-between border-t border-[#30363D] p-4"
                >
                  <button
                    className={control}
                    disabled={currentPage === 1}
                    onClick={() => setPage(currentPage - 1)}
                  >
                    Previous
                  </button>
                  <span>
                    Page {currentPage} of {pages} · {filtered.length} records
                  </span>
                  <button
                    className={control}
                    disabled={currentPage === pages}
                    onClick={() => setPage(currentPage + 1)}
                  >
                    Next
                  </button>
                </nav>
                {!filtered.length && (
                  <p className="p-6 text-neutral-300">
                    {search
                      ? "No records match this search."
                      : "No saved records in this assigned squad."}
                  </p>
                )}
              </section>
            </>
          )}
          <p className="mt-4 text-xs text-neutral-400">
            Updated {new Date(data.generatedAt).toLocaleString()}
          </p>
        </>
      )}
      {dispatch && (
        <AdminDrawerShell
          title="Dispatch squad meet invitation"
          onClose={() => setDispatch(false)}
        >
          <p role="alert" className="rounded border border-amber-700 p-4">
            Dispatch is unavailable: the existing service does not create meet
            invitations and parent invoices together. No invitations,
            registrations or $50 invoices have been created.
          </p>
          <p className="mt-4">
            Existing invitations and recipient reminders are available through
            the Meet Invitations Hub and squad alerts.
          </p>
        </AdminDrawerShell>
      )}
      {selected && data && (
        <AdminDrawerShell
          title={selected.label || "Squad record"}
          busy={busy}
          onClose={() => setSelected(null)}
          recordStatus={selected.status}
        >
          <div className="grid gap-6 lg:grid-cols-3">
            <section>
              <h3 className="font-bold">Record details</h3>
              <p className="mt-3">{selected.detail}</p>
              {view === "tm-travel" && (
                <>
                  <p className="mt-3">
                    Departure:{" "}
                    {selected.travel_plans?.starts_at
                      ? new Date(
                          selected.travel_plans.starts_at,
                        ).toLocaleString()
                      : "Not recorded"}
                  </p>
                  <p className="mt-3">
                    Guardian required:{" "}
                    {selected.guardian_required ? "Yes" : "No"}
                  </p>
                </>
              )}
              {view === "tm-practice" && (
                <p className="mt-3">
                  Ends:{" "}
                  {selected.ends_at
                    ? new Date(selected.ends_at).toLocaleString()
                    : "Not recorded"}
                </p>
              )}
            </section>
            <section>
              <h3 className="font-bold">Actions</h3>
              {view === "tm-fees" ? (
                <form
                  className="mt-4 space-y-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void cash();
                  }}
                >
                  <fieldset
                    disabled={
                      busy ||
                      !data.canCash ||
                      !data.postingConfigured ||
                      Number(selected.balance_due) <= 0
                    }
                    className="space-y-3"
                  >
                    <legend className="mb-3">Record Deck Cash Payment</legend>
                    <label className="block">
                      Physical cash received
                      <input
                        required
                        inputMode="decimal"
                        className={`${control} mt-1 w-full`}
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        pattern="[0-9]+(\.[0-9]{1,2})?"
                      />
                    </label>
                    <label className="block">
                      Receipt note
                      <textarea
                        required
                        minLength={5}
                        maxLength={4000}
                        className={`${control} mt-1 w-full`}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                      />
                    </label>
                    <button className={control} type="submit">
                      {busy ? "Saving receipt…" : "Save cash receipt"}
                    </button>
                  </fieldset>
                  <p className="text-sm text-neutral-300">
                    Checks require a separate configured receipt method; this
                    action records physical cash only. Partial payments leave
                    the remaining balance owed.
                  </p>
                </form>
              ) : (
                <>
                  <p className="mt-3 text-sm">
                    Resolve compliance exceptions, send pending-RSVP reminders,
                    and verify entry-fee vouchers from the matching squad alert.
                  </p>
                  <Link
                    className={`${control} mt-4 inline-block`}
                    href="/admin?role=team_manager"
                  >
                    Open resolution queue →
                  </Link>
                </>
              )}
            </section>
            <section>
              <h3 className="font-bold">Saved activity</h3>
              {view === "tm-roster" ? (
                data.registrations
                  .filter((r) => r.athlete_id === selected.id)
                  .map((r) => (
                    <p className="mt-3 text-sm" key={r.id}>
                      {r.status} ·{" "}
                      {r.submitted_at
                        ? new Date(r.submitted_at).toLocaleString()
                        : "Submission date not recorded"}
                    </p>
                  ))
              ) : (
                <p className="mt-3 text-sm">
                  {selected.last_reminded_at
                    ? `Last reminder: ${new Date(selected.last_reminded_at).toLocaleString()}`
                    : "Review the matching operational task for its audit history."}
                </p>
              )}
              <p className="mt-4 text-sm text-neutral-400">
                Consent exceptions require verified evidence and club policy.
                Fee vouchers retain the reviewed amounts and are rechecked
                before payment.
              </p>
            </section>
          </div>
          {error && (
            <p role="alert" className="mt-4 text-red-300">
              {error}
            </p>
          )}
        </AdminDrawerShell>
      )}
    </main>
  );
}
