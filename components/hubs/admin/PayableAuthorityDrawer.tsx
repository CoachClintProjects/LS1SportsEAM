"use client";
import { useEffect, useState } from "react";
import { authenticatedFetch } from "@/lib/client/authenticatedFetch";
import { AdminDrawerShell } from "./AdminDrawerShell";
type Policy = {
  legal_entity_id: string;
  threshold_text: string;
  version: number;
};
type Data = {
  entities: { id: string; legal_name: string; base_currency: string }[];
  policies: Policy[];
  canEdit: boolean;
  history: {
    id: string;
    entity_id: string;
    reason: string;
    occurred_at: string;
    after_data: { executive_threshold: string; version: number };
  }[];
};
const input =
  "mt-1 w-full rounded border border-neutral-600 bg-[#17191d] px-3 py-2 text-white";
export default function PayableAuthorityDrawer({
  role,
  onClose,
}: {
  role: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<Data | null>(null),
    [entity, setEntity] = useState(""),
    [threshold, setThreshold] = useState(""),
    [version, setVersion] = useState(0),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(""),
    [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    void authenticatedFetch(
      `/api/admin-payable-authority?role=${encodeURIComponent(role)}`,
      { cache: "no-store" },
    )
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        if (active) {
          setData(j);
          setError("");
          setEntity("");
          setThreshold("");
          setVersion(0);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [role, reload]);
  function select(id: string) {
    setEntity(id);
    const p = data?.policies.find((x) => x.legal_entity_id === id);
    setThreshold(p?.threshold_text || "");
    setVersion(p?.version || 0);
    setReason("");
    setSaved("");
    setError("");
  }
  async function save() {
    setBusy(true);
    setError("");
    setSaved("");
    try {
      const r = await authenticatedFetch("/api/admin-payable-authority", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          entityId: entity,
          expectedVersion: version,
          threshold,
          reason,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setVersion(j.row.version);
      setSaved(
        "Spending authority saved. It applies when a bill is next submitted.",
      );
      const response = await authenticatedFetch(
        `/api/admin-payable-authority?role=${encodeURIComponent(role)}`,
        { cache: "no-store" },
      );
      const refreshed = await response.json();
      if (!response.ok)
        throw new Error(
          refreshed.error ||
            "Saved, but history could not be refreshed. Reopen this drawer.",
        );
      setData(refreshed);
      setReason("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save authority.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <AdminDrawerShell title="Spending authority" onClose={onClose} busy={busy}>
      <p className="mb-5 text-neutral-300">
        Bills at or above the threshold require Organization Admin approval.
        Below it, Treasurer may approve. Without a policy, every bill requires
        Organization Admin approval.
      </p>
      <p className="mb-5 text-sm text-neutral-400">
        Changes apply to future submissions, including bills returned to draft
        and resubmitted. Existing submissions retain their recorded authority
        and policy version.
      </p>
      {error && (
        <div className="mb-4">
          <p role="alert" className="text-red-300">
            {error}
          </p>
          <button
            disabled={busy}
            className="mt-2 rounded bg-blue-700 px-3 py-2"
            onClick={() => setReload(reload + 1)}
          >
            Reload saved policy
          </button>
        </div>
      )}
      {saved && (
        <p role="status" className="mb-4 text-green-300">
          {saved}
        </p>
      )}
      {!data && !error && <p>Loading spending authority…</p>}
      {data && (
        <>
          <label className="block">
            Legal entity
            <select
              className={input}
              value={entity}
              disabled={busy}
              onChange={(e) => select(e.target.value)}
            >
              <option value="">Select legal entity</option>
              {data.entities.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.legal_name} · {e.base_currency}
                </option>
              ))}
            </select>
          </label>
          {!data.entities.length && (
            <p className="mt-4 text-amber-300">
              Create a legal entity in Finance setup before configuring spending
              authority.
            </p>
          )}
          {entity && (
            <>
              <label className="mt-5 block">
                Executive approval threshold (
                {data.entities.find((e) => e.id === entity)?.base_currency})
                <input
                  className={input}
                  inputMode="decimal"
                  disabled={!data.canEdit || busy}
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                />
              </label>
              <p className="mt-2 text-sm text-neutral-400">
                Zero requires executive approval for every bill.{" "}
                {version
                  ? `Current policy version: ${version}.`
                  : "No policy configured."}
              </p>
              {data.canEdit && (
                <>
                  <label className="mt-5 block">
                    Reason for change
                    <textarea
                      className={input}
                      disabled={busy}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </label>
                  <button
                    className="mt-4 rounded bg-blue-700 px-4 py-2 font-semibold disabled:opacity-40"
                    disabled={
                      busy ||
                      reason.trim().length < 5 ||
                      !/^\d{1,12}(\.\d{1,2})?$/.test(threshold)
                    }
                    onClick={() => void save()}
                  >
                    {busy ? "Saving…" : "Save spending authority"}
                  </button>
                </>
              )}
              <h3 className="mt-6 font-bold">Decision history</h3>
              {data.history
                .filter((h) => h.entity_id === entity)
                .map((h) => (
                  <article
                    key={h.id}
                    className="mt-3 rounded border border-neutral-700 p-3"
                  >
                    <p>
                      Version {h.after_data.version} · Threshold{" "}
                      {String(h.after_data.executive_threshold)}
                    </p>
                    <p className="mt-1 text-sm text-neutral-300">{h.reason}</p>
                    <time className="text-xs text-neutral-400">
                      {new Date(h.occurred_at).toLocaleString()}
                    </time>
                  </article>
                ))}
              {!data.history.some((h) => h.entity_id === entity) && (
                <p className="mt-2 text-neutral-400">
                  No policy decisions recorded.
                </p>
              )}
            </>
          )}
        </>
      )}
    </AdminDrawerShell>
  );
}
