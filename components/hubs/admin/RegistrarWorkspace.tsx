"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { authenticatedFetch } from "@/lib/client/authenticatedFetch";
import { currentIdentityEvidence } from "@/lib/registrarPolicy";
import { AdminDrawerShell } from "./AdminDrawerShell";
import {
  ComplianceEvidenceIntake,
  type EvidenceDomain,
} from "./ComplianceEvidenceIntake";
const PersonRecordDrawer = dynamic(() => import("./PersonRecordDrawer"));
const Compliance = dynamic(() => import("./Compliance"));
type Row = Record<string, any>;
type Feed = {
  people: Row[];
  athletes: Row[];
  documents: Row[];
  registrations: Row[];
  memberships: Row[];
  exceptions: Row[];
  teams: Row[];
  teamMemberships: Row[];
  governingBodies: Row[];
  backgroundChecks: Row[];
  safeSport: Row[];
  identityNeedsReview: string[];
  truncated: boolean;
  generatedAt: string;
};
type Selection = {
  kind:
    | "identity"
    | "registration"
    | "membership"
    | "exception"
    | "transfer"
    | "credential";
  personId: string;
  row: Row;
  domain?: EvidenceDomain;
};
const titles: Record<string, string> = {
  "rg-identity": "Verify Birth Certs",
  "rg-league": "Governing Body Sync",
  "rg-compliance": "Coach Background Checks",
  "rg-transfers": "Swimmer Team Transfers",
  "rg-telemetry": "Data Integrity Telemetry",
};
const control =
  "rounded border border-[#30363D] bg-[#0A0C10] px-3 py-2 text-sm disabled:opacity-40";
const card = "rounded-xl border border-[#30363D] bg-[#161B22] p-4";
async function get(url: string) {
  const r = await authenticatedFetch(url, { cache: "no-store" });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || "Records unavailable.");
  return j;
}
export function RegistrarWorkspace() {
  const params = useSearchParams(),
    view = params.get("view") || "rg-home";
  const [data, setData] = useState<Feed | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [search, setSearch] = useState(""),
    [selected, setSelected] = useState<Selection | null>(null),
    [record, setRecord] = useState<{ id: string; tab: string } | null>(null),
    [notice, setNotice] = useState(""),
    [intake, setIntake] = useState<{
      domain: EvidenceDomain;
      person: Row;
    } | null>(null),
    [page, setPage] = useState(0);
  const generation = useRef(0);
  const load = useCallback(async () => {
    const seq = ++generation.current;
    setLoading(true);
    try {
      const j = await get("/api/admin-registrar");
      if (seq === generation.current) {
        setData(j);
        setError("");
      }
    } catch (e) {
      if (seq === generation.current) {
        setData(null);
        setError(e instanceof Error ? e.message : "Unable to load records.");
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
    setSearch("");
    setPage(0);
  }, [view]);
  const name = (id: string) => {
    const p = data?.people.find((x) => x.id === id);
    return p
      ? [p.preferred_name || p.first_name, p.last_name]
          .filter(Boolean)
          .join(" ")
      : "Person not available";
  };
  if (!data)
    return (
      <main className="min-h-screen bg-[#0A0C10] p-6 text-white">
        <h1 className="text-2xl font-bold">Roster Gatekeeper</h1>
        <p role={error ? "alert" : "status"} className="my-4">
          {error || "Loading Registrar records…"}
        </p>
        <button
          className={control}
          disabled={loading}
          onClick={() => void load()}
        >
          Retry
        </button>
      </main>
    );
  const today = new Date().toISOString().slice(0, 10);
  const credentials: (Row & { domain: EvidenceDomain })[] = [
    ...data.backgroundChecks.map((r) => ({
      ...r,
      domain: "backgroundChecks" as const,
    })),
    ...data.safeSport.map((r) => ({ ...r, domain: "safeSport" as const })),
  ];
  const expired = credentials.filter(
    (r) => r.status === "expired" || (r.expires_on && r.expires_on < today),
  );
  const pending = data.registrations.filter((r) =>
    ["submitted", "pending", "under_review"].includes(r.status),
  );
  const exceptions = data.exceptions.filter(
    (r) =>
      !["approved", "rejected", "cancelled", "closed", "completed"].includes(
        r.status,
      ),
  );
  const missingIds = data.memberships.filter(
    (r) =>
      r.status === "active" && (!r.membership_number || !r.governing_body_id),
  );
  const identityRows = data.athletes.map((a) => ({
    kind: "identity" as const,
    personId: a.person_id,
    row: a,
  }));
  const personForRegistration = (r: Row) =>
    data.athletes.find((a) => a.id === r.athlete_id)?.person_id;
  const exceptionSelection = (r: Row): Selection => ({
    kind: "exception",
    personId: data.memberships.find((m) => m.id === r.membership_id)?.person_id,
    row: r,
  });
  const alerts: Selection[] = [
    ...identityRows.filter((r) =>
      data.identityNeedsReview.includes(r.personId),
    ),
    ...expired.map((r) => ({
      kind: "credential" as const,
      personId: r.person_id,
      row: r,
      domain: r.domain,
    })),
    ...pending.map((r) => ({
      kind: "registration" as const,
      personId: personForRegistration(r),
      row: r,
    })),
    ...missingIds.map((r) => ({
      kind: "membership" as const,
      personId: r.person_id,
      row: r,
    })),
    ...exceptions.map(exceptionSelection),
  ];
  const allRows: Selection[] =
    view === "rg-identity"
      ? identityRows
      : view === "rg-league"
        ? data.memberships.map((r) => ({
            kind: "membership",
            personId: r.person_id,
            row: r,
          }))
        : view === "rg-transfers"
          ? data.athletes.map((r) => ({
              kind: "transfer",
              personId: r.person_id,
              row: r,
            }))
          : alerts;
  const filtered = allRows.filter((r) =>
    `${name(r.personId)} ${r.row.athlete_number || ""} ${r.kind} ${r.row.membership_number || ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 25)),
    safePage = Math.min(page, pages - 1);
  const subtitle = (s: Selection) =>
    s.kind === "identity"
      ? data.identityNeedsReview.includes(s.personId)
        ? "🔴 Identity evidence needs review"
        : "🟢 Current verified identity evidence"
      : s.kind === "credential"
        ? `🔴 ${s.row.check_type || s.row.certification_type} · ${s.row.status} · expires ${s.row.expires_on || "not recorded"}`
        : s.kind === "membership"
          ? `🟡 Regional membership · ${s.row.membership_number || "ID missing"} · ${s.row.status}`
          : s.kind === "exception"
            ? `🟡 Membership exception · ${s.row.exception_type} · ${s.row.status}`
            : s.kind === "transfer"
              ? "Review current team memberships"
              : `🟡 Registration · ${s.row.status}`;
  return (
    <main className="min-h-screen bg-[#0A0C10] p-5 text-white lg:p-7">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-slate-400">
            Roster Gatekeeper · Registrar
          </p>
          <h1 className="mt-2 text-3xl font-bold">
            {titles[view] || "Today's Tasks"}
          </h1>
        </div>
        <button
          disabled={loading}
          className={control}
          onClick={() => void load()}
        >
          {loading ? "Refreshing…" : "Refresh records"}
        </button>
      </header>
      <p className="mt-3 text-sm text-slate-300">
        Review identity evidence, registration blockers and staff credentials
        for your club.
      </p>
      {notice && (
        <p
          role="status"
          className="mt-4 rounded border border-emerald-800 p-3 text-emerald-200"
        >
          {notice}
        </p>
      )}
      {data.truncated && (
        <p role="alert" className="mt-4 text-amber-200">
          This view reached a record limit. Counts reflect loaded records and
          cannot certify the entire club.
        </p>
      )}
      <div className="my-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          [data.identityNeedsReview.length, "Identity evidence needs review"],
          [expired.length, "Expired credential records"],
          [pending.length, "Registrations awaiting review"],
          [missingIds.length, "Membership IDs need attention"],
        ].map(([count, label]) => (
          <div key={String(label)} className={card}>
            <b className="text-2xl">{count}</b>
            <p className="mt-1 text-sm text-slate-300">{label}</p>
          </div>
        ))}
      </div>
      {view === "rg-compliance" ? (
        <Compliance role="registrar" />
      ) : (
        <>
          {view === "rg-league" && (
            <p className={`${card} mb-4 text-amber-200`}>
              Regional IDs below are recorded memberships. ID synchronization
              and dependent meet clearance are not connected to an existing
              approved update workflow. They remain unavailable in this release.
            </p>
          )}
          {view === "rg-transfers" && (
            <section className={`${card} mb-4`}>
              <h2 className="font-bold">Current team headcounts</h2>
              <div className="mt-3 flex flex-wrap gap-3">
                {data.teams.map((t) => (
                  <span className={control} key={t.id}>
                    {t.name}: {t.headcount}
                  </span>
                ))}
              </div>
              <p className="mt-3 text-amber-200">
                Club releases and squad migrations require one controlled
                transfer transaction. That transaction is unavailable; current
                memberships remain visible for review.
              </p>
            </section>
          )}
          {view === "rg-telemetry" && (
            <section className={`${card} mb-4`}>
              <h2 className="font-bold">Evidence coverage</h2>
              <p className="mt-2">
                {data.athletes.length} athlete records · {data.documents.length}{" "}
                identity documents · {exceptions.length} open membership
                exceptions.
              </p>
              <p className="mt-2 text-sm text-slate-300">
                Verified identity evidence does not certify every registration
                requirement or competition entry. Expired records remain visible
                even when a newer credential exists. Final staff clearance is
                decided by the executive review workflow.
              </p>
            </section>
          )}
          <section className={card}>
            <label className="block text-sm">
              Find a person or record
              <input
                className={`${control} ml-3`}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
              />
            </label>
            <p className="mt-3 text-xs text-slate-400">
              Select a review box to open its resolution drawer. Only saved
              evidence can resolve an alert.
            </p>
            <div className="mt-4 divide-y divide-[#30363D]">
              {filtered.slice(safePage * 25, safePage * 25 + 25).map((s) => (
                <div
                  key={`${s.kind}:${s.row.id}`}
                  className="flex items-center gap-3 py-4"
                >
                  <input
                    type="checkbox"
                    aria-label={`Review ${name(s.personId)} ${s.kind}`}
                    checked={
                      selected?.row.id === s.row.id && selected?.kind === s.kind
                    }
                    onChange={() => setSelected(s)}
                  />
                  <button
                    className="flex-1 text-left"
                    onClick={() => setSelected(s)}
                  >
                    <b>{name(s.personId)}</b>
                    <p className="mt-1 text-sm text-slate-300">{subtitle(s)}</p>
                  </button>
                </div>
              ))}
            </div>
            {!filtered.length && (
              <p className="py-6 text-slate-300">
                No records match this view. This does not certify overall
                eligibility.
              </p>
            )}
            <div className="mt-4 flex items-center gap-4">
              <button
                className={control}
                disabled={!safePage}
                onClick={() => setPage(safePage - 1)}
              >
                Previous
              </button>
              <span className="text-sm">
                Page {safePage + 1} of {pages}
              </span>
              <button
                className={control}
                disabled={safePage + 1 >= pages}
                onClick={() => setPage(safePage + 1)}
              >
                Next
              </button>
            </div>
          </section>
        </>
      )}
      <p className="mt-4 text-xs text-slate-400">
        Refreshed {new Date(data.generatedAt).toLocaleString()}
      </p>
      {selected && (
        <RegistrarDrawer
          key={`${selected.kind}:${selected.row.id}`}
          selection={selected}
          data={data}
          name={name(selected.personId)}
          close={() => setSelected(null)}
          saved={async () => {
            setNotice("Document decision saved with its audit timestamp.");
            await load();
          }}
          openRecord={(tab) => {
            setRecord({ id: selected.personId, tab });
            setSelected(null);
          }}
          forward={() => {
            const p = data.people.find((p) => p.id === selected.personId);
            if (p) {
              setIntake({ domain: selected.domain || "safeSport", person: p });
              setSelected(null);
            }
          }}
        />
      )}
      {record && (
        <PersonRecordDrawer
          personId={record.id}
          role="registrar"
          initialTab={record.tab as "Registration"}
          onClose={() => {
            setRecord(null);
            void load();
          }}
          onSaved={() => void load()}
        />
      )}
      {intake && (
        <ComplianceEvidenceIntake
          role="registrar"
          domain={intake.domain}
          initialPerson={
            intake.person as {
              id: string;
              first_name: string;
              last_name: string;
            }
          }
          onClose={() => setIntake(null)}
          onSaved={() => {
            setIntake(null);
            setNotice(
              "Evidence saved pending executive approval. The Organization Administrator review queue has been updated.",
            );
            void load();
          }}
        />
      )}
    </main>
  );
}
function RegistrarDrawer({
  selection: s,
  data,
  name,
  close,
  saved,
  openRecord,
  forward,
}: {
  selection: Selection;
  data: Feed;
  name: string;
  close: () => void;
  saved: () => Promise<void>;
  openRecord: (tab: string) => void;
  forward: () => void;
}) {
  const docs = data.documents.filter((d) => d.owner_person_id === s.personId);
  const [docId, setDocId] = useState(docs[0]?.id || ""),
    [reference, setReference] = useState(""),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [history, setHistory] = useState<Row[]>([]),
    [historyError, setHistoryError] = useState("");
  const saving = useRef(false),
    doc = docs.find((d) => d.id === docId);
  const historyLoad = useCallback(async () => {
    try {
      const j = await get(
        `/api/admin-registrar?personId=${encodeURIComponent(s.personId)}`,
      );
      setHistory(j.history);
      setHistoryError("");
    } catch (e) {
      setHistoryError(e instanceof Error ? e.message : "History unavailable.");
    }
  }, [s.personId]);
  useEffect(() => {
    void historyLoad();
  }, [historyLoad]);
  async function review(status: string) {
    if (!doc || saving.current) return;
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      const r = await authenticatedFetch("/api/admin-record-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "registrar",
          personId: s.personId,
          id: doc.id,
          expectedVersion: doc.current_version,
          expectedStatus: doc.verification_status,
          status,
          reason: `Proof-of-age review reference: ${reference.trim()}. ${reason.trim()}`,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      await saved();
      await historyLoad();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Review failed.");
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  async function openDocument() {
    if (!doc) return;
    setBusy(true);
    setError("");
    const popup = window.open("about:blank", "_blank");
    if (popup) popup.opener = null;
    try {
      const j = await get(
        `/api/admin-record-document?${new URLSearchParams({ role: "registrar", personId: s.personId, id: doc.id })}`,
      );
      if (popup) popup.location.replace(j.url);
      else
        throw new Error(
          "Allow pop-ups to inspect the document, then try again.",
        );
    } catch (e) {
      popup?.close();
      setError(e instanceof Error ? e.message : "Document unavailable.");
    } finally {
      setBusy(false);
    }
  }
  const memberships = data.teamMemberships.filter(
    (m) => m.athlete_id === s.row.id,
  );
  return (
    <AdminDrawerShell
      title={`${name} · ${s.kind === "identity" ? "Proof-of-age review" : s.kind === "credential" ? "Credential review" : s.kind === "transfer" ? "Team memberships" : "Registration reconciliation"}`}
      busy={busy}
      onClose={close}
    >
      {error && (
        <p role="alert" className="mb-4 text-red-300">
          {error}
        </p>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="min-w-0">
          <h3 className="font-bold">Properties</h3>
          <p className="mt-3">{name}</p>
          {s.kind === "identity" && (
            <>
              <p className="mt-2 text-sm">
                Recorded birth date:{" "}
                {data.people.find((p) => p.id === s.personId)?.birth_date ||
                  "Missing"}
              </p>
              <label className="mt-4 block text-sm">
                Identity document
                <select
                  className={`${control} mt-2 w-full`}
                  value={docId}
                  onChange={(e) => setDocId(e.target.value)}
                  disabled={busy}
                >
                  <option value="">Choose evidence</option>
                  {docs.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title} · {d.verification_status}
                    </option>
                  ))}
                </select>
              </label>
              <button
                disabled={!doc || busy}
                className={`${control} mt-3`}
                onClick={() => void openDocument()}
              >
                Inspect stored document
              </button>
              {doc && (
                <p className="mt-3 text-sm">
                  {currentIdentityEvidence(
                    doc as { verification_status: string },
                  )
                    ? "🟢 Current verified identity evidence"
                    : "🟡 Evidence requires review"}
                </p>
              )}
            </>
          )}
          {s.kind === "membership" && (
            <>
              <p className="mt-3">
                Regional League ID: {s.row.membership_number || "Missing"}
              </p>
              <p className="mt-3">
                Governing body:{" "}
                {data.governingBodies.find(
                  (b) => b.id === s.row.governing_body_id,
                )?.name || "Not recorded"}
              </p>
            </>
          )}
          {s.kind === "credential" && (
            <>
              <p className="mt-3">
                {s.row.check_type || s.row.certification_type}
              </p>
              <p>Status: {s.row.status}</p>
              <p>Expires: {s.row.expires_on || "Not recorded"}</p>
            </>
          )}
          {s.kind === "transfer" &&
            memberships.map((m) => (
              <p className="mt-3" key={m.id}>
                {data.teams.find((t) => t.id === m.team_id)?.name ||
                  "Unknown team"}{" "}
                · {m.status}
                <br />
                {m.starts_on || "No start date"} — {m.ends_on || "Open ended"}
              </p>
            ))}
          {s.kind === "registration" && (
            <p className="mt-3">Registration status: {s.row.status}</p>
          )}
          {s.kind === "exception" && (
            <p className="mt-3">
              {s.row.exception_type} · {s.row.reason_category} · {s.row.status}
            </p>
          )}
        </section>
        <fieldset disabled={busy} className="min-w-0">
          <legend className="font-bold">Actions</legend>
          {s.kind === "identity" ? (
            <>
              <label className="mt-3 block text-sm">
                Document verification reference
                <input
                  className={`${control} mt-1 w-full`}
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  maxLength={200}
                />
              </label>
              <label className="mt-3 block text-sm">
                Review reason
                <textarea
                  className={`${control} mt-1 w-full`}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={2000}
                />
              </label>
              <button
                disabled={!doc || !reference.trim() || reason.trim().length < 5}
                onClick={() => void review("verified")}
                className={`${control} mt-4 bg-emerald-900`}
              >
                VALIDATE PROOF-OF-AGE
              </button>
              <button
                disabled={!doc || !reference.trim() || reason.trim().length < 5}
                className={`${control} mt-3`}
                onClick={() => void review("rejected")}
              >
                Reject evidence
              </button>
              <p className="mt-3 text-sm text-slate-300">
                Inspect the evidence first. Verification saves the document
                decision. Review applicable registration requirements
                separately.
              </p>
              <button
                className={`${control} mt-3`}
                onClick={() => openRecord("Registration")}
              >
                Review requirements / upload evidence
              </button>
            </>
          ) : s.kind === "credential" ? (
            <>
              <p className="mt-3 text-sm">
                Submit new or renewed evidence for executive approval. Existing
                expired evidence remains in the history.
              </p>
              <button className={`${control} mt-4`} onClick={forward}>
                Review and forward compliance
              </button>
              <button
                className={`${control} mt-3`}
                onClick={() => openRecord("Documents")}
              >
                Inspect / upload documents
              </button>
            </>
          ) : s.kind === "membership" ? (
            <p role="status" className="mt-3 text-amber-200">
              Sync Regional League ID is unavailable: no approved update
              workflow connects membership identifiers to competition
              eligibility.
            </p>
          ) : s.kind === "transfer" ? (
            <p role="status" className="mt-3 text-amber-200">
              Transfer execution is unavailable. A club release or squad
              migration must update memberships together and preserve its
              approval and audit trail.
            </p>
          ) : (
            <>
              <p className="mt-3 text-sm">
                Review saved requirements and supporting documents. Membership
                exceptions require the authorized administrator’s decision.
              </p>
              <button
                className={`${control} mt-3`}
                onClick={() => openRecord("Registration")}
              >
                Open registration & evidence
              </button>
            </>
          )}
        </fieldset>
        <section className="min-w-0">
          <h3 className="font-bold">Document review timeline</h3>
          {historyError && (
            <p role="alert" className="mt-3 text-amber-200">
              {historyError}
            </p>
          )}
          {history.map((h) => (
            <div
              className="mt-3 border-b border-[#30363D] pb-3 text-sm"
              key={h.id}
            >
              <p>{h.reason}</p>
              <p>
                {h.after_data?.status} · version {h.after_data?.version}
              </p>
              <time className="text-xs text-slate-400">
                {new Date(h.occurred_at).toLocaleString()}
              </time>
            </div>
          ))}
          {!history.length && !historyError && (
            <p className="mt-3 text-sm text-slate-300">
              No document review decisions recorded.
            </p>
          )}
        </section>
      </div>
    </AdminDrawerShell>
  );
}
export default RegistrarWorkspace;
