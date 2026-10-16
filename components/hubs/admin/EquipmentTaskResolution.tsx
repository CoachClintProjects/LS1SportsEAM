"use client";
import { useRef, useState } from "react";
import { authenticatedFetch } from "@/lib/client/authenticatedFetch";
import type { TriageTask } from "@/lib/triage/types";
export function EquipmentTaskResolution({
  task,
  role,
  onSaved,
  onBusy,
}: {
  task: TriageTask;
  role: string;
  onSaved: () => Promise<void>;
  onBusy: (v: boolean) => void;
}) {
  const [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const saving = useRef(false),
    request = useRef(""),
    prior = useRef("");
  const action =
    task.resolutionKind === "equipment_hold"
      ? "release_hold"
      : task.resolutionKind === "equipment_shutdown"
        ? "reopen"
        : null;
  const permitted =
    action === "release_hold"
      ? ["treasurer", "org_admin"].includes(role)
      : role === "org_admin";
  const evidence = (task.evidence || {}) as Record<string, unknown>;
  if (!action || ["completed", "closed"].includes(task.status)) return null;
  if (!permitted)
    return (
      <p>
        This equipment action requires{" "}
        {action === "reopen" ? "Organization Admin" : "Treasurer"} authority.
      </p>
    );
  async function save() {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    onBusy(true);
    setError("");
    try {
      if (reason.trim().length < 10)
        throw new Error(
          "Record at least 10 characters of resolution evidence.",
        );
      if (prior.current !== reason) {
        request.current = crypto.randomUUID();
        prior.current = reason;
      }
      const r = await authenticatedFetch("/api/admin-equipment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            authority: action === "reopen" ? "org_admin" : "treasurer",
            request_id: request.current,
            reason,
            values: {
              id: action === "reopen" ? evidence.closure_id : task.id,
              ...(action === "release_hold" ? { revision: task.revision } : {}),
            },
          }),
        }),
        j = await r.json();
      if (!r.ok) throw new Error(j.error);
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Equipment resolution failed.");
    } finally {
      saving.current = false;
      setBusy(false);
      onBusy(false);
    }
  }
  return (
    <section className="space-y-3">
      <p>
        {action === "release_hold"
          ? `Delivery: expected ${evidence.expected}, received ${evidence.delivered}, damaged ${evidence.damaged}. Resolve the vendor discrepancy before releasing payment.`
          : "Confirm that the facility is safe before authorizing reopening."}
      </p>
      <label>
        Resolution evidence
        <textarea
          className="w-full rounded border border-[#30363D] bg-[#0A0C10] p-2 text-white"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={2000}
        />
      </label>
      {error && <p role="alert">{error}</p>}
      <button
        className="rounded bg-orange-900 p-2 text-white"
        disabled={busy || reason.trim().length < 10}
        onClick={save}
      >
        {busy
          ? "Saving…"
          : action === "reopen"
            ? "Authorize reopening"
            : "Resolve vendor payment hold"}
      </button>
    </section>
  );
}
