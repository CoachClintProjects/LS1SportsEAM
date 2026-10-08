"use client";
import { useEffect, useRef, useState } from "react";
import { authenticatedFetch } from "@/lib/client/authenticatedFetch";
import { AdminDrawerShell } from "./AdminDrawerShell";
type Competition = { id: string; name: string; organization_id: string };
type Entity = {
  id: string;
  legal_name: string;
  organization_id: string;
  base_currency: string;
};
type Official = {
  id: string;
  role_code: string;
  status: string;
  people: { first_name: string; last_name: string } | null;
};
export default function CashboxAuthorizationDrawer({
  role,
  onClose,
  onSaved,
}: {
  role: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [competitions, setCompetitions] = useState<Competition[]>([]),
    [entities, setEntities] = useState<Entity[]>([]),
    [officials, setOfficials] = useState<Official[]>([]);
  const [competition, setCompetition] = useState(""),
    [entity, setEntity] = useState(""),
    [amounts, setAmounts] = useState<Record<string, string>>({}),
    [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const saving = useRef(false);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setOfficials([]);
    setAmounts({});
    setError("");
    void authenticatedFetch(
      `/api/admin-triage?${new URLSearchParams({ role, mode: "cashbox_options", competition })}`,
      { cache: "no-store" },
    )
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        if (active) {
          setCompetitions(j.competitions);
          setEntities(j.entities);
          setOfficials(j.officials);
        }
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
  }, [role, competition]);
  const club = competitions.find((c) => c.id === competition)?.organization_id;
  const currency = entities.find((e) => e.id === entity)?.base_currency;
  const total = Object.values(amounts).reduce(
    (sum, n) => sum + (Number(n) || 0),
    0,
  );
  const submit = async () => {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      const allocations = officials
        .filter((o) => Number(amounts[o.id]) > 0)
        .map((o) => ({ assignment_id: o.id, amount: amounts[o.id] }));
      const r = await authenticatedFetch("/api/admin-triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          action: "authorize_cashbox",
          values: {
            competition_id: competition,
            legal_entity_id: entity,
            allocations,
          },
          note: reason,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      await onSaved();
      onClose();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to authorize cash box.",
      );
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };
  return (
    <AdminDrawerShell
      title="Authorize official cash box"
      busy={busy}
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="ls1-triage triage-drawer"
      >
        {error && (
          <p className="triage-error" role="alert">
            {error}
          </p>
        )}
        <div className="triage-columns">
          <section>
            <h3>Competition and club</h3>
            <label>
              Competition
              <select
                required
                value={competition}
                onChange={(e) => {
                  setCompetition(e.target.value);
                  setEntity("");
                }}
                disabled={busy}
              >
                <option value="">Select competition</option>
                {competitions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Legal entity
              <select
                required
                value={entity}
                onChange={(e) => setEntity(e.target.value)}
                disabled={busy}
              >
                <option value="">Select entity</option>
                {entities
                  .filter((e) => e.organization_id === club)
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.legal_name} · {e.base_currency}
                    </option>
                  ))}
              </select>
            </label>
          </section>
          <section>
            <h3>Official payouts</h3>
            {loading && (
              <p role="status">Loading current official assignments…</p>
            )}
            {!loading && !officials.length && (
              <p>
                No current official assignments are recorded for this
                competition.
              </p>
            )}
            {officials.map((o) => (
              <label key={o.id}>
                {o.people
                  ? `${o.people.first_name} ${o.people.last_name}`
                  : "Assigned official"}{" "}
                · {o.role_code.replaceAll("_", " ")}
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  max="99999999"
                  value={amounts[o.id] || ""}
                  disabled={busy}
                  onChange={(e) =>
                    setAmounts({ ...amounts, [o.id]: e.target.value })
                  }
                />
              </label>
            ))}
          </section>
          <section>
            <h3>Authorize</h3>
            <p>
              Total: {total.toFixed(2)} {currency || ""}
            </p>
            <label>
              Authorization reason
              <textarea
                required
                minLength={10}
                maxLength={4000}
                value={reason}
                disabled={busy}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <p>
              A different authorized person must count and prepare the cash.
              This does not post or pay funds.
            </p>
            <button
              type="submit"
              disabled={
                busy ||
                loading ||
                !competition ||
                !entity ||
                total <= 0 ||
                reason.trim().length < 10
              }
            >
              Authorize and send to Treasurer
            </button>
          </section>
        </div>
      </form>
    </AdminDrawerShell>
  );
}
