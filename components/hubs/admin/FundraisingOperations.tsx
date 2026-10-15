"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { authenticatedFetch } from "@/lib/client/authenticatedFetch";
import { AdminDrawerShell } from "./AdminDrawerShell";
import {
  campaignTypes,
  commitmentTypes,
  leadNotes,
} from "@/lib/fundraisingPolicy";
const Triage = dynamic(() => import("../superuser/TriageTaskHub"));
type Row = Record<string, any>;
const button =
  "rounded border border-[#30363D] bg-[#161B22] px-3 py-2 text-sm disabled:opacity-40";
const input =
  "mt-1 w-full rounded border border-[#30363D] bg-[#0A0C10] p-2 text-white";
const card = "rounded-xl border border-[#30363D] bg-[#161B22] p-4";
const titles: Record<string, string> = {
  "fr-home": "Today’s Tasks",
  "fr-sponsors": "Sponsor Relationships",
  "fr-grants": "Government Grant Packs",
  "fr-drives": "Grassroots Team Drives",
  "fr-receipts": "Donor Tax Receipts",
  "fr-performance": "Revenue Performance",
};
const label = (v: string) => v.replaceAll("_", " "),
  date = (v: unknown) =>
    v ? new Date(String(v)).toLocaleString() : "Not recorded";
function Table({
  title,
  rows,
  columns,
}: {
  title: string;
  rows: Row[];
  columns: [string, (r: Row) => React.ReactNode][];
}) {
  const [page, setPage] = useState(0),
    last = Math.max(0, Math.ceil(rows.length / 25) - 1),
    current = Math.min(page, last);
  return (
    <section className="space-y-3">
      <h3 className="font-semibold">
        {title} · {rows.length}
      </h3>
      {!rows.length ? (
        <p className="text-sm text-slate-400">No saved records.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  {columns.map(([name]) => (
                    <th className="border-b border-[#30363D] p-2" key={name}>
                      {name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(current * 25, current * 25 + 25).map((row) => (
                  <tr key={row.id}>
                    {columns.map(([name, render]) => (
                      <td
                        className="border-b border-[#30363D] p-2 align-top"
                        key={name}
                      >
                        {render(row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-3">
            <button
              className={button}
              disabled={!current}
              onClick={() => setPage(current - 1)}
            >
              Previous
            </button>
            <span>
              {current + 1} / {last + 1}
            </span>
            <button
              className={button}
              disabled={current === last}
              onClick={() => setPage(current + 1)}
            >
              Next
            </button>
          </div>
        </>
      )}
    </section>
  );
}
export function FundraisingOperations() {
  const params = useSearchParams(),
    view = params.get("view") || "fr-home";
  const [data, setData] = useState<Row | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [loading, setLoading] = useState(false),
    [busy, setBusy] = useState(false),
    [mode, setMode] = useState(""),
    [draft, setDraft] = useState<Row>({}),
    [reason, setReason] = useState(""),
    [history, setHistory] = useState<Row[]>([]),
    [leadNext, setLeadNext] = useState(false);
  const generation = useRef(0),
    historyGeneration = useRef(0),
    saving = useRef(false);
  const load = useCallback(async () => {
    const seq = ++generation.current;
    setLoading(true);
    try {
      const r = await authenticatedFetch("/api/admin-fundraising", {
          cache: "no-store",
        }),
        j = await r.json();
      if (!r.ok) throw Error(j.error);
      if (seq === generation.current) {
        setData(j);
        setError("");
      }
    } catch (e) {
      if (seq === generation.current) {
        setData(null);
        setError(e instanceof Error ? e.message : "Fundraising unavailable.");
      }
    } finally {
      if (seq === generation.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 30000);
    return () => {
      clearInterval(timer);
      generation.current++;
    };
  }, [load]);
  useEffect(() => {
    setMode("");
    setReason("");
    historyGeneration.current++;
  }, [view]);
  const campaigns: Row[] = data?.campaigns || [],
    leads: Row[] = data?.leads || [],
    campaign = campaigns.find((c) => c.id === draft.campaign_id),
    committed = leads.filter(
      (l) =>
        l.commitment_type === "sponsorship" &&
        ["committed", "received"].includes(l.status),
    );
  const newCampaign = (next = false) => {
    historyGeneration.current++;
    setMode("campaign");
    setLeadNext(next);
    setReason("");
    setHistory([]);
    setDraft({
      id: crypto.randomUUID(),
      code: "",
      name: "",
      campaign_type:
        view === "fr-grants"
          ? "grant"
          : view === "fr-drives"
            ? "team_drive"
            : "sponsorship",
      currency: "",
      goal_amount: "",
      starts_on: "",
      ends_on: "",
    });
  };
  const newLead = (campaignId?: string) => {
    if (!campaigns.length && !campaignId) {
      newCampaign(true);
      return;
    }
    historyGeneration.current++;
    setMode("lead");
    setReason("");
    setHistory([]);
    setLeadNext(false);
    setDraft({
      id: crypto.randomUUID(),
      campaign_id:
        campaignId || (campaigns.length === 1 ? campaigns[0].id : ""),
      counterparty_name: "",
      commitment_type:
        view === "fr-grants"
          ? "grant"
          : view === "fr-drives"
            ? "donation"
            : "sponsorship",
      amount: "",
      purpose: "",
      obligations: "",
      details: "",
      status: "prospect",
    });
  };
  const openLead = (row: Row) => {
    setMode("record");
    setDraft({ ...row, ...leadNotes(row.notes) });
    setReason("");
    setHistory([]);
    const seq = ++historyGeneration.current;
    void authenticatedFetch(
      "/api/admin-fundraising?id=" + encodeURIComponent(row.id),
      { cache: "no-store" },
    )
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw Error(j.error);
        if (seq === historyGeneration.current) setHistory(j.history || []);
      })
      .catch((e) => {
        if (seq === historyGeneration.current) setError(e.message);
      });
  };
  async function save(action: string) {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const r = await authenticatedFetch("/api/admin-fundraising", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...draft, action, reason }),
        }),
        j = await r.json();
      if (!r.ok) throw Error(j.error);
      setNotice(j.warning || j.message);
      await load();
      if (action === "create_campaign") {
        if (leadNext) newLead(j.row.id);
        else setMode("");
      } else openLead(j.row);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  const visibleCampaigns = campaigns.filter((c) =>
      view === "fr-grants"
        ? c.campaign_type === "grant"
        : view === "fr-drives"
          ? ["team_drive", "restricted_gift"].includes(c.campaign_type)
          : true,
    ),
    visibleIds = new Set(visibleCampaigns.map((c) => c.id));
  const original = leads.find((l) => l.id === draft.id);
  const savedNotes = leadNotes(original?.notes || null);
  const unsaved =
    mode === "record" &&
    !!original &&
    (["counterparty_name", "commitment_type", "amount"].some(
      (k) => String(draft[k]) !== String(original[k]),
    ) ||
      ["purpose", "obligations", "details"].some(
        (k) => draft[k] !== savedNotes[k as keyof typeof savedNotes],
      ));
  const editable =
    mode === "lead" ||
    (mode === "record" && draft.status === "prospect" && !draft.received_on);
  return (
    <main className="min-h-full space-y-5 bg-[#0A0C10] p-5 text-white">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-400">
            Fundraising Chief (Capital Developer)
          </p>
          <h1 className="text-2xl font-bold">
            {titles[view] || titles["fr-home"]}
          </h1>
        </div>
        <button
          className={button}
          disabled={loading || busy}
          onClick={() => void load()}
        >
          {loading ? "🔵 Refreshing" : "Refresh"}
        </button>
      </header>
      {error && (
        <p role="alert" className="text-red-300">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-amber-200">
          {notice}
        </p>
      )}
      {data && (
        <>
          {!committed.length && (
            <section className={card}>
              <h2 className="font-bold">
                0 ACTIVE PARTNERSHIPS COMMITTED [REVENUE MATRIX REQUIRING LEAD
                INTAKE]
              </h2>
              <p className="my-3 text-sm text-slate-300">
                Start with a campaign and a real prospective partner. A lead or
                pledge does not record received money.
              </p>
              <button
                className={button}
                disabled={!data.canCreate}
                onClick={() => newLead()}
              >
                + PROVISION NEW CORPORATE PARTNERSHIP LEAD
              </button>
            </section>
          )}
          <div className="flex flex-wrap gap-3">
            <button
              className={button}
              disabled={!data.canCreate}
              onClick={() => newCampaign()}
            >
              Create campaign
            </button>
            {committed.length > 0 && (
              <button
                className={button}
                disabled={!data.canCreate}
                onClick={() => newLead()}
              >
                + PROVISION NEW CORPORATE PARTNERSHIP LEAD
              </button>
            )}
          </div>
          <p className="text-xs text-slate-400">
            Updated {date(data.generatedAt)}. Tracking currencies are kept
            separate. Campaign goals and pledges do not post to the ledger.
          </p>
          {view === "fr-home" && <Triage role="fundraising_coordinator" />}
          {view === "fr-performance" && (
            <section className={card}>
              <Table
                title="Recorded tracking totals by currency"
                rows={data.totals.map((r: Row) => ({ ...r, id: r.currency }))}
                columns={[
                  ["Currency", (r) => r.currency],
                  ["Prospects", (r) => r.prospects],
                  ["Unreceived pledges", (r) => r.pledged],
                  ["Previously marked received", (r) => r.recordedReceived],
                ]}
              />
              <p className="mt-3 text-sm text-amber-200">
                Previously marked received amounts are tracking records, not
                verified bank receipts. Collection velocity, donor retention and
                grant conversion are unavailable without reliable payment and
                donor history.
              </p>
            </section>
          )}
          {view === "fr-grants" && (
            <section className={card}>
              <h2 className="font-semibold">Grant preparation</h2>
              <p className="my-3 text-sm">
                Save grant campaigns and prospective funders below. Campaign
                dates are planning dates; a certified grant application and
                governance-vault linking workflow is not configured.
              </p>
              <button className={button} disabled>
                LINK GOVERNANCE VAULT — unavailable
              </button>
            </section>
          )}
          {view === "fr-drives" && (
            <section className={card}>
              <h2 className="font-semibold">
                Purpose-restricted gifts & matching
              </h2>
              <p className="my-3 text-sm">
                Record the donor’s intended purpose on each lead. These notes do
                not reserve ledger funds. Matching thresholds and approval
                transactions are not configured.
              </p>
              <button className={button} disabled>
                FORWARD MATCHING MILESTONE — unavailable
              </button>
            </section>
          )}
          {view === "fr-receipts" && (
            <section className={card}>
              <h2 className="font-semibold">
                Tax receipts and donation reconciliation are unavailable
              </h2>
              <p className="my-3 text-sm">
                Verified issuer details, gift eligibility, benefits valuation,
                receipt numbering and donation-to-ledger reconciliation are not
                configured. Saved pledges cannot issue an official tax receipt.
              </p>
              <div className="flex flex-wrap gap-2">
                <button className={button} disabled>
                  Generate tax receipt
                </button>
                <button className={button} disabled>
                  Reconcile philanthropic inbound
                </button>
              </div>
            </section>
          )}
          <section className={card}>
            <Table
              title="Campaigns"
              rows={visibleCampaigns}
              columns={[
                [
                  "Campaign",
                  (c) => (
                    <button
                      className="text-left text-sky-300 underline"
                      onClick={() => {
                        historyGeneration.current++;
                        setMode("campaign_view");
                        setDraft(c);
                        setHistory([]);
                      }}
                    >
                      {c.name}
                    </button>
                  ),
                ],
                ["Type", (c) => label(c.campaign_type)],
                [
                  "Plan dates",
                  (c) =>
                    `${c.starts_on || "Not set"} — ${c.ends_on || "Not set"}`,
                ],
                ["Goal", (c) => `${c.currency} ${c.goal_amount ?? "Not set"}`],
                ["Status", (c) => c.status],
              ]}
            />
          </section>
          <section className={card}>
            <Table
              title="Partners, donors & grant leads"
              rows={leads.filter((l) => visibleIds.has(l.campaign_id))}
              columns={[
                [
                  "Name",
                  (l) => (
                    <button
                      className="text-left text-sky-300 underline"
                      onClick={() => openLead(l)}
                    >
                      {l.counterparty_name}
                    </button>
                  ),
                ],
                ["Type", (l) => label(l.commitment_type)],
                [
                  "Tracked amount",
                  (l) =>
                    `${campaigns.find((c) => c.id === l.campaign_id)?.currency || ""} ${l.amount}`,
                ],
                ["Status", (l) => l.status],
              ]}
            />
          </section>
        </>
      )}
      {mode && (
        <AdminDrawerShell
          title={
            mode === "campaign"
              ? "Create fundraising campaign"
              : mode === "campaign_view"
                ? draft.name
                : draft.counterparty_name || "New corporate partnership lead"
          }
          busy={busy}
          recordStatus={draft.status}
          onClose={() => {
            setMode("");
            historyGeneration.current++;
          }}
        >
          {mode === "campaign" ? (
            <form
              className="grid gap-5 lg:grid-cols-3"
              onSubmit={(e) => {
                e.preventDefault();
                void save("create_campaign");
              }}
            >
              <aside>
                <h3 className="font-semibold">Campaign setup</h3>
                <p className="mt-3 text-sm text-slate-300">
                  {leadNext
                    ? "First, save a campaign to group this partnership. The lead form opens next."
                    : "Choose a name, type and tracking currency."}{" "}
                  This does not open a bank account or reserve funds.
                </p>
              </aside>
              <fieldset disabled={busy} className="space-y-3">
                {[
                  ["name", "Campaign name"],
                  ["code", "Campaign code"],
                ].map(([key, title]) => (
                  <label className="block" key={key}>
                    {title}
                    <input
                      required
                      className={input}
                      value={draft[key]}
                      maxLength={key === "code" ? 60 : 200}
                      onChange={(e) =>
                        setDraft({ ...draft, [key]: e.target.value })
                      }
                    />
                  </label>
                ))}
                <label className="block">
                  Campaign type
                  <select
                    className={input}
                    value={draft.campaign_type}
                    onChange={(e) =>
                      setDraft({ ...draft, campaign_type: e.target.value })
                    }
                  >
                    {campaignTypes.map((t) => (
                      <option key={t} value={t}>
                        {label(t)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  Tracking currency
                  <select
                    required
                    className={input}
                    value={draft.currency}
                    onChange={(e) =>
                      setDraft({ ...draft, currency: e.target.value })
                    }
                  >
                    <option value="">Select currency</option>
                    {["CAD", "USD", "EUR", "GBP", "AUD", "NZD"].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  Goal amount (optional)
                  <input
                    className={input}
                    inputMode="decimal"
                    value={draft.goal_amount}
                    onChange={(e) =>
                      setDraft({ ...draft, goal_amount: e.target.value })
                    }
                  />
                </label>
                {[
                  ["starts_on", "Planned start"],
                  ["ends_on", "Planned end"],
                ].map(([key, title]) => (
                  <label className="block" key={key}>
                    {title}
                    <input
                      className={input}
                      type="date"
                      value={draft[key]}
                      onChange={(e) =>
                        setDraft({ ...draft, [key]: e.target.value })
                      }
                    />
                  </label>
                ))}
                <label className="block">
                  Reason
                  <textarea
                    className={input}
                    required
                    minLength={10}
                    maxLength={2000}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </label>
                {error && (
                  <p role="alert" className="text-red-300">
                    {error}
                  </p>
                )}
                <button className={button} disabled={busy || !data?.canCreate}>
                  Save campaign
                </button>
              </fieldset>
              <aside>
                <h3 className="font-semibold">Records retained</h3>
                <p className="mt-3 text-sm">
                  Destructive deletion is blocked. Financial reversals require a
                  controlled Treasurer transaction.
                </p>
              </aside>
            </form>
          ) : mode === "campaign_view" ? (
            <div className="grid gap-5 lg:grid-cols-3">
              <aside>
                <h3 className="font-semibold">Campaign properties</h3>
                <p>
                  {draft.code} · {label(draft.campaign_type)}
                </p>
                <p>
                  {draft.starts_on || "Start not set"} —{" "}
                  {draft.ends_on || "End not set"}
                </p>
                <p>
                  Goal: {draft.currency} {draft.goal_amount ?? "Not set"}
                </p>
              </aside>
              <section>
                <button
                  className={button}
                  disabled={!data?.canCreate}
                  onClick={() => newLead(draft.id)}
                >
                  Add partner or donor lead
                </button>
                <div className="mt-4">
                  <Table
                    title="Linked leads"
                    rows={leads.filter((l) => l.campaign_id === draft.id)}
                    columns={[
                      [
                        "Partner",
                        (l) => (
                          <button
                            className="text-sky-300 underline"
                            onClick={() => openLead(l)}
                          >
                            {l.counterparty_name}
                          </button>
                        ),
                      ],
                      ["Amount", (l) => l.amount],
                      ["Status", (l) => l.status],
                    ]}
                  />
                </div>
              </section>
              <aside>
                <p className="text-sm text-amber-200">
                  Campaign changes and voids require a controlled amendment or
                  financial reversal workflow, which is not available here.
                </p>
                <button className={button + " mt-3 text-red-300"} disabled>
                  VOID CAMPAIGN ROW — reversal unavailable
                </button>
              </aside>
            </div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-[1fr_2fr_1fr]">
              <fieldset className="space-y-3" disabled={busy || !editable}>
                <legend className="font-semibold">Partner details</legend>
                <label className="block">
                  Campaign
                  <select
                    className={input}
                    disabled={mode === "record"}
                    value={draft.campaign_id || ""}
                    onChange={(e) =>
                      setDraft({ ...draft, campaign_id: e.target.value })
                    }
                  >
                    <option value="">Select campaign</option>
                    {campaigns.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} · {c.currency}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  Partner or donor name
                  <input
                    className={input}
                    maxLength={200}
                    value={draft.counterparty_name || ""}
                    onChange={(e) =>
                      setDraft({ ...draft, counterparty_name: e.target.value })
                    }
                  />
                </label>
                <label className="block">
                  Lead type
                  <select
                    className={input}
                    value={draft.commitment_type}
                    onChange={(e) =>
                      setDraft({ ...draft, commitment_type: e.target.value })
                    }
                  >
                    {commitmentTypes.map((t) => (
                      <option key={t} value={t}>
                        {label(t)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  Potential / pledged amount (
                  {campaign?.currency || "choose campaign"})
                  <input
                    className={input}
                    inputMode="decimal"
                    value={draft.amount}
                    onChange={(e) =>
                      setDraft({ ...draft, amount: e.target.value })
                    }
                  />
                </label>
                <p className="text-xs text-slate-400">
                  Zero means no amount recorded. A positive pledge is required
                  to mark committed.
                </p>
              </fieldset>
              <section className="space-y-4">
                {[
                  ["purpose", "Donor’s specified purpose", 2000],
                  ["obligations", "What the club owes the sponsor", 4000],
                  ["details", "Notes and contract references", 4000],
                ].map(([key, title, max]) => (
                  <label className="block" key={String(key)}>
                    {title}
                    <textarea
                      className={input}
                      maxLength={Number(max)}
                      disabled={busy || !editable}
                      value={draft[String(key)] || ""}
                      onChange={(e) =>
                        setDraft({ ...draft, [String(key)]: e.target.value })
                      }
                    />
                  </label>
                ))}
                <label className="block">
                  Reason for this action
                  <textarea
                    className={input}
                    minLength={10}
                    maxLength={2000}
                    disabled={busy}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </label>
                {error && (
                  <p role="alert" className="text-red-300">
                    {error}
                  </p>
                )}
                {notice && (
                  <p role="status" className="text-amber-200">
                    {notice}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {editable && (
                    <button
                      className={button}
                      disabled={
                        busy ||
                        reason.trim().length < 10 ||
                        !(mode === "lead" ? data?.canCreate : data?.canUpdate)
                      }
                      onClick={() =>
                        void save(mode === "lead" ? "create_lead" : "save_lead")
                      }
                    >
                      Save lead
                    </button>
                  )}
                  {mode === "record" && draft.status === "prospect" && (
                    <button
                      className={button}
                      disabled={
                        busy ||
                        unsaved ||
                        reason.trim().length < 10 ||
                        !data?.canUpdate
                      }
                      onClick={() => void save("commit")}
                    >
                      Mark saved pledge committed
                    </button>
                  )}
                  {mode === "record" &&
                    draft.status === "committed" &&
                    draft.commitment_type === "sponsorship" && (
                      <button
                        className={button}
                        disabled={
                          busy || reason.trim().length < 10 || !data?.canHandoff
                        }
                        onClick={() => void save("asset_handoff")}
                      >
                        Send sponsor asset task to Communications
                      </button>
                    )}
                </div>
                <p className="text-xs text-slate-400">
                  Mark committed uses the saved pledge values. Save edits first.
                  Committed pledges are locked; these actions do not record
                  payments.
                </p>
              </section>
              <aside className="space-y-4">
                <h3 className="font-semibold">History & handoff</h3>
                <p className="text-sm">
                  Committed: {draft.committed_on || "Not recorded"}
                  <br />
                  Previously marked received:{" "}
                  {draft.received_on || "Not recorded"}
                </p>
                {data?.handoffs
                  .filter((t: Row) => t.metadata?.commitment_id === draft.id)
                  .map((t: Row) => (
                    <p
                      key={t.id}
                      className="rounded border border-[#30363D] p-3 text-sm"
                    >
                      {t.title}
                      <br />
                      Communications · {t.status}
                    </p>
                  ))}
                <Table
                  title="Recorded activity"
                  rows={history}
                  columns={[
                    ["Action", (h) => h.action],
                    ["Reason", (h) => h.reason],
                    ["When", (h) => date(h.occurred_at)],
                  ]}
                />
                <p className="text-sm text-amber-200">
                  Purpose notes identify restrictions but do not create reserved
                  balances. Tax receipts, matching approval and journal
                  reversals remain unavailable.
                </p>
              </aside>
            </div>
          )}
        </AdminDrawerShell>
      )}
    </main>
  );
}
export default FundraisingOperations;
