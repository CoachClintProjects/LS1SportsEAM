"use client";
import { useEffect, useRef, useState } from "react";
import { authenticatedFetch } from "@/lib/client/authenticatedFetch";
import { closedTask, type TriageTask } from "@/lib/triage/types";

type Contract = {
  id: string;
  title: string;
  current_version: number;
  expires_on: string;
  status: string;
  counterparty_name: string;
};
type Bill = {
  id: string;
  bill_number: string;
  total: number;
  currency: string;
  status: string;
};
type Evidence = {
  id: string;
  version: number;
  person_id: string;
  document_id: string | null;
  certificate_id: string | null;
  completed_on: string | null;
  expires_on: string | null;
  source: string | null;
  status: string;
};
type ConsentPolicy = {
  version: number;
  enabled: boolean;
  team_manager_allowed: boolean;
  policy_reference: string;
};
type Document = { id: string; title: string; verification_status: string };
async function request(path: string, body?: unknown) {
  const r = await authenticatedFetch(
    path,
    body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : { cache: "no-store" },
  );
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || "Unable to load or save this record.");
  return j;
}
export default function TriageResolutionPanel({
  task,
  role,
  team,
  onSaved,
  onBusy,
  onNotice,
  onPerson,
  onBill,
}: {
  task: TriageTask;
  role: string;
  team: string;
  onSaved: () => Promise<void>;
  onBusy: (busy: boolean) => void;
  onNotice: (message: string) => void;
  onPerson: (id: string) => void;
  onBill: (id: string) => void;
}) {
  const [contract, setContract] = useState<Contract | null>(null),
    [bills, setBills] = useState<Bill[]>([]),
    [evidence, setEvidence] = useState<Evidence | null>(null),
    [documents, setDocuments] = useState<Document[]>([]);
  const [policy, setPolicy] = useState<ConsentPolicy>({
      version: 0,
      enabled: false,
      team_manager_allowed: false,
      policy_reference: "",
    }),
    [consentDocument, setConsentDocument] = useState(""),
    [counted, setCounted] = useState("");
  const [terms, setTerms] = useState(""),
    [note, setNote] = useState(""),
    [bill, setBill] = useState(""),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [busy, setBusy] = useState(false);
  const alive = useRef(true),
    lock = useRef(false);
  const kind = task.resolutionKind;
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    if (!["lease", "fee_voucher", "safesport", "waiver"].includes(kind || ""))
      return;
    setLoading(true);
    setError("");
    const q = new URLSearchParams({
      role,
      team,
      id: task.id,
      source: task.source,
      domain: "1",
    });
    const path =
      kind === "safesport"
        ? `/api/admin-compliance?${new URLSearchParams({ role, personId: task.personId || "", id: task.entityId || "", domain: "safeSport" })}`
        : `/api/admin-triage?${q}`;
    void request(path)
      .then((j) => {
        if (!active) return;
        setContract(j.contract || null);
        setBills(j.bills || []);
        setEvidence(j.record || null);
        setDocuments(j.documents || []);
        if (j.policy) setPolicy(j.policy);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [
    kind,
    role,
    team,
    task.id,
    task.source,
    task.revision,
    task.personId,
    task.entityId,
  ]);
  const act = async (action: string, values: Record<string, unknown> = {}) => {
    if (lock.current) return;
    lock.current = true;
    onBusy(true);
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const j = await request("/api/admin-triage", {
        role,
        team: team || null,
        id: task.id,
        revision: task.revision,
        action,
        values,
        note,
      });
      if (alive.current) {
        setMessage(j.message || "Saved.");
        onNotice(j.message || "Saved.");
        setNote("");
        await onSaved();
      }
    } catch (e) {
      if (alive.current)
        setError(e instanceof Error ? e.message : "Unable to save.");
    } finally {
      lock.current = false;
      onBusy(false);
      if (alive.current) setBusy(false);
    }
  };
  const compliance = async (changes: Record<string, unknown>) => {
    if (!evidence || lock.current) return;
    lock.current = true;
    onBusy(true);
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await request("/api/admin-command", {
        role,
        action: "update-compliance-record",
        domain: "safeSport",
        id: evidence.id,
        expectedVersion: evidence.version,
        changes,
        reason: note,
      });
      if (alive.current) {
        setMessage("SafeSport record saved.");
        onNotice("SafeSport record saved.");
        await onSaved();
      }
    } catch (e) {
      if (alive.current)
        setError(e instanceof Error ? e.message : "Unable to save.");
    } finally {
      lock.current = false;
      onBusy(false);
      if (alive.current) setBusy(false);
    }
  };
  if (!kind) return null;
  return (
    <div className="triage-resolution">
      {loading && <p role="status">Loading the current source record…</p>}
      {error && (
        <p role="alert" className="triage-error">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {kind === "payable" && task.entityId && (
        <button onClick={() => onBill(task.entityId!)}>
          Open bill and payment controls →
        </button>
      )}
      {(["identity"].includes(kind) ||
        (kind === "waiver" && role !== "team_manager")) &&
        task.entityId && (
          <button onClick={() => onPerson(task.entityId!)}>
            Review registration and documents →
          </button>
        )}
      {kind === "waiver" && (
        <>
          <p>
            {policy.enabled
              ? "Club policy permits documented consent exceptions."
              : "No active club consent-exception policy is recorded."}
          </p>
          {role === "org_admin" && (
            <>
              <label>
                Governing club policy reference
                <textarea
                  value={policy.policy_reference}
                  onChange={(e) =>
                    setPolicy({ ...policy, policy_reference: e.target.value })
                  }
                />
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={policy.enabled}
                  onChange={(e) =>
                    setPolicy({ ...policy, enabled: e.target.checked })
                  }
                />
                Enable documented consent exceptions
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={policy.team_manager_allowed}
                  onChange={(e) =>
                    setPolicy({
                      ...policy,
                      team_manager_allowed: e.target.checked,
                    })
                  }
                />
                Allow assigned Team Managers under this policy
              </label>
            </>
          )}
          {policy.enabled && (
            <label>
              Verified waiver evidence
              <select
                value={consentDocument}
                onChange={(e) => setConsentDocument(e.target.value)}
              >
                <option value="">Select evidence</option>
                {documents.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title}
                  </option>
                ))}
              </select>
            </label>
          )}
          <p>
            Only current waiver evidence already verified by an authorized
            reviewer qualifies. Other eligibility checks remain in force.
          </p>
        </>
      )}
      {kind === "cashbox" && (
        <label>
          Cash physically counted
          <input
            type="number"
            min="0"
            step="0.01"
            value={counted}
            onChange={(e) => setCounted(e.target.value)}
          />
        </label>
      )}
      {kind === "lease" && contract && (
        <>
          <p>
            {contract.counterparty_name} · {contract.status} · Expires{" "}
            {contract.expires_on}
          </p>
          <label>
            Proposed renewal terms
            <textarea
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              minLength={10}
              maxLength={12000}
            />
          </label>
        </>
      )}
      {kind === "fee_voucher" && (
        <>
          <label>
            Matching vendor bill
            <select value={bill} onChange={(e) => setBill(e.target.value)}>
              <option value="">Select a bill</option>
              {bills.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.bill_number} · {b.total} {b.currency} · {b.status}
                </option>
              ))}
            </select>
          </label>
          <button onClick={() => onBill("")}>Create vendor bill →</button>
          {!loading && !bills.length && (
            <p>
              No club bill matches this voucher’s amount and currency. Create
              the verified bill in Accounts Payable, then refresh this task.
            </p>
          )}
          {bill && (
            <button onClick={() => onBill(bill)}>Review selected bill →</button>
          )}
        </>
      )}
      {kind === "safesport" && evidence && (
        <>
          <p>Current status: {evidence.status}</p>
          <button onClick={() => onPerson(evidence.person_id)}>
            Inspect supporting document →
          </button>
          <label>
            Supporting document
            <select
              value={evidence.document_id || ""}
              onChange={(e) =>
                setEvidence({ ...evidence, document_id: e.target.value })
              }
            >
              <option value="">Select verified evidence</option>
              {documents.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title} · {d.verification_status}
                </option>
              ))}
            </select>
          </label>
          <label>
            Certificate number
            <input
              value={evidence.certificate_id || ""}
              onChange={(e) =>
                setEvidence({ ...evidence, certificate_id: e.target.value })
              }
            />
          </label>
          <label>
            Completed on
            <input
              type="date"
              value={evidence.completed_on || ""}
              onChange={(e) =>
                setEvidence({ ...evidence, completed_on: e.target.value })
              }
            />
          </label>
          <label>
            Expires on
            <input
              type="date"
              value={evidence.expires_on || ""}
              onChange={(e) =>
                setEvidence({ ...evidence, expires_on: e.target.value })
              }
            />
          </label>
        </>
      )}
      {!closedTask(task.status) &&
        [
          "lease",
          "rsvp",
          "staffing",
          "fees",
          "fee_voucher",
          "safesport",
          "waiver",
          "cashbox",
        ].includes(kind) && (
          <>
            <label>
              {["rsvp", "staffing"].includes(kind)
                ? "Message to recipient"
                : "Review note"}
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                minLength={5}
                maxLength={4000}
              />
            </label>
            {["rsvp", "staffing"].includes(kind) && (
              <p>
                This records an LS1 notification. SMS and device push delivery
                are not configured.
              </p>
            )}
            {kind === "waiver" && role === "org_admin" && (
              <button
                disabled={
                  busy ||
                  loading ||
                  note.trim().length < 10 ||
                  policy.policy_reference.trim().length < 10
                }
                onClick={() => void act("set_consent_policy", policy)}
              >
                Save consent exception policy
              </button>
            )}
            {kind === "waiver" &&
              policy.enabled &&
              (role === "org_admin" || policy.team_manager_allowed) && (
                <button
                  disabled={
                    busy ||
                    loading ||
                    note.trim().length < 10 ||
                    !consentDocument
                  }
                  onClick={() =>
                    void act("consent_override", {
                      document_id: consentDocument,
                    })
                  }
                >
                  Record authorized deck consent exception
                </button>
              )}
            {kind === "cashbox" && (
              <button
                disabled={busy || note.trim().length < 10 || !counted}
                onClick={() =>
                  void act("prepare_cashbox", { counted_amount: counted })
                }
              >
                Confirm physical cash prepared
              </button>
            )}
            {kind === "cashbox" && role === "org_admin" && (
              <button
                disabled={busy || note.trim().length < 10}
                onClick={() => void act("cancel_cashbox")}
              >
                Cancel cash-box authorization
              </button>
            )}
            {kind === "lease" && (
              <button
                disabled={
                  busy ||
                  loading ||
                  note.trim().length < 5 ||
                  terms.trim().length < 10 ||
                  !contract
                }
                onClick={() =>
                  void act("lease_terms", {
                    terms,
                    version: contract?.current_version,
                  })
                }
              >
                Save proposed renewal terms
              </button>
            )}
            {kind === "rsvp" && (
              <button
                disabled={busy || note.trim().length < 5}
                onClick={() => void act("remind")}
              >
                Send LS1 reminder
              </button>
            )}
            {kind === "staffing" && (
              <button
                disabled={busy || note.trim().length < 5}
                onClick={() => void act("broadcast")}
              >
                Send parent volunteer request
              </button>
            )}
            {kind === "fees" && (
              <button
                disabled={busy || note.trim().length < 5}
                onClick={() => void act("verify_fees")}
              >
                Confirm reviewed fees and send to Treasurer
              </button>
            )}
            {kind === "fee_voucher" && (
              <button
                disabled={busy || loading || note.trim().length < 5 || !bill}
                onClick={() => void act("link_bill", { bill_id: bill })}
              >
                Link verified voucher to bill
              </button>
            )}
            {kind === "fee_voucher" && (
              <button
                disabled={busy || loading || note.trim().length < 5}
                onClick={() => void act("return_voucher")}
              >
                Return for Team Manager review
              </button>
            )}
            {kind === "safesport" && evidence && (
              <div className="triage-actions">
                <button
                  disabled={busy || loading || note.trim().length < 5}
                  onClick={() =>
                    void compliance({
                      document_id: evidence.document_id,
                      certificate_id: evidence.certificate_id,
                      completed_on: evidence.completed_on,
                      expires_on: evidence.expires_on,
                    })
                  }
                >
                  Save updated evidence
                </button>
                <button
                  disabled={busy || loading || note.trim().length < 5}
                  onClick={() =>
                    void compliance({
                      status: "active",
                      verified_at: new Date().toISOString(),
                    })
                  }
                >
                  Approve current verified certificate
                </button>
              </div>
            )}
          </>
        )}
    </div>
  );
}
