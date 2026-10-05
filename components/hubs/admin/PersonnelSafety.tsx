"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { authenticatedFetch } from "@/lib/client/authenticatedFetch";
import { AdminDrawerShell } from "./AdminDrawerShell";
const PersonRecordDrawer = dynamic(() => import("./PersonRecordDrawer"));
type Policy = {
  status: string;
  version: number;
  role_codes: string[];
  require_background: boolean;
  require_safesport: boolean;
  validity_months: number;
  clear_background_results: string[];
  override_max_days: number;
};
type Clearance = {
  person_id: string;
  person_name: string;
  role_code: string;
  role_name: string;
  blocked: boolean;
  reasons: string[];
  override_id: string | null;
  override_expires_at: string | null;
};
type Override = {
  id: string;
  person_id: string;
  role_code: string;
  policy_version: number;
  expires_at: string;
  reason: string;
  status: string;
  created_at: string;
};
type Snapshot = {
  policy: Policy | null;
  roles: { code: string; name: string }[];
  roster: Clearance[];
  overrides: Override[];
  history: {
    id: string;
    action: string;
    reason: string;
    occurred_at: string;
  }[];
  authorization: { edit: boolean; decide: boolean };
};
const input =
  "mt-1 block w-full rounded border border-neutral-600 bg-[#17191d] px-3 py-2 text-sm text-white";
const button = "rounded px-3 py-2 text-sm font-semibold disabled:opacity-40";
export function PersonnelSafety({
  onChanged,
}: { onChanged?: () => void } = {}) {
  const [data, setData] = useState<Snapshot | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [configure, setConfigure] = useState(false),
    [selected, setSelected] = useState<Clearance | null>(null);
  const sequence = useRef(0);
  const load = useCallback(async () => {
    const version = ++sequence.current;
    setLoading(true);
    setError("");
    try {
      const r = await authenticatedFetch("/api/admin-safety?role=org_admin", {
        cache: "no-store",
      });
      const j = await r.json();
      if (!r.ok) throw Error(j.error);
      if (version === sequence.current) setData(j);
    } catch (e) {
      if (version === sequence.current)
        setError(
          e instanceof Error ? e.message : "Personnel safety unavailable.",
        );
    } finally {
      if (version === sequence.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
    return () => {
      sequence.current++;
    };
  }, [load]);
  const save = async (payload: Record<string, unknown>) => {
    const r = await authenticatedFetch("/api/admin-safety", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role: "org_admin",
        expectedVersion: data?.policy?.version || 0,
        ...payload,
      }),
    });
    const j = await r.json();
    if (!r.ok) throw Error(j.error || "Safety decision failed.");
    await load();
    onChanged?.();
  };
  return (
    <section className="mt-6 rounded-xl border border-neutral-700 bg-[#17191d] p-5 text-white">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Personnel safety</h2>
          <p className="mt-1 text-sm text-neutral-300">
            {data?.policy
              ? `Policy ${data.policy.status} · maximum evidence age ${data.policy.validity_months} months`
              : "No personnel clearance policy has been configured."}
          </p>
        </div>
        <button
          disabled={!data || loading}
          onClick={() => setConfigure(true)}
          className={`${button} bg-blue-700`}
        >
          {data?.policy ? "Policy & decisions" : "Configure policy"}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-red-300">
          {error}
          <button onClick={() => void load()} className="ml-3 underline">
            Retry
          </button>
        </p>
      )}
      {loading && (
        <p role="status" className="mt-3 text-sm text-neutral-400">
          Loading current clearances…
        </p>
      )}
      {data && !loading && (
        <>
          <p className="mt-3 text-sm text-neutral-400">
            {data.roster.filter((r) => r.blocked).length} require review ·{" "}
            {data.roster.filter((r) => r.override_id).length} temporary
            overrides · {data.roster.length} affected role assignments
          </p>
          <div className="mt-3 divide-y divide-neutral-700">
            {data.roster.map((r) => (
              <button
                key={`${r.person_id}:${r.role_code}`}
                onClick={() => setSelected(r)}
                className="flex w-full items-center justify-between gap-4 py-3 text-left hover:bg-white/5"
              >
                <span>
                  <strong>{r.person_name}</strong>
                  <span className="block text-sm text-neutral-400">
                    {r.role_name}
                  </span>
                </span>
                <span
                  className={
                    r.blocked
                      ? "text-red-300"
                      : r.override_id
                        ? "text-amber-300"
                        : "text-green-300"
                  }
                >
                  {r.blocked
                    ? "Review required"
                    : r.override_id
                      ? "Temporary override"
                      : "Clearance current"}
                </span>
              </button>
            ))}
          </div>
          {!data.roster.length && (
            <p className="mt-3 text-sm text-neutral-400">
              {data.policy?.status === "active"
                ? "No active personnel assignments match this policy."
                : "Clearance enforcement begins when an authorized administrator activates a saved policy."}
            </p>
          )}
        </>
      )}
      {data && configure && (
        <PolicyDrawer
          data={data}
          onClose={() => setConfigure(false)}
          onSave={save}
        />
      )}{" "}
      {data && selected && (
        <ClearanceDrawer
          key={`${selected.person_id}:${selected.role_code}`}
          row={
            data.roster.find(
              (r) =>
                r.person_id === selected.person_id &&
                r.role_code === selected.role_code,
            ) || selected
          }
          data={data}
          onClose={() => setSelected(null)}
          onSave={save}
        />
      )}
    </section>
  );
}
function PolicyDrawer({
  data,
  onClose,
  onSave,
}: {
  data: Snapshot;
  onClose: () => void;
  onSave: (v: Record<string, unknown>) => Promise<void>;
}) {
  const [value, setValue] = useState<Policy>(
      () =>
        data.policy || {
          status: "draft",
          version: 0,
          role_codes: [],
          require_background: true,
          require_safesport: true,
          validity_months: 12,
          clear_background_results: ["clear", "passed"],
          override_max_days: 7,
        },
    ),
    [reason, setReason] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(value) !== JSON.stringify(data.policy);
  const readOnly = data.policy?.status === "active" || !data.authorization.edit;
  async function act(operation: string) {
    setBusy(true);
    setError("");
    try {
      await onSave({ operation, values: value, reason });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Policy decision failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <AdminDrawerShell
      title="Personnel clearance policy"
      busy={busy}
      onClose={onClose}
    >
      {error && (
        <p role="alert" className="mb-4 text-red-300">
          {error}
        </p>
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div>
          <fieldset disabled={busy || readOnly} className="space-y-4">
            <legend className="mb-3 font-semibold">Requirements</legend>
            <label className="block text-sm">
              <input
                type="checkbox"
                checked={value.require_background}
                onChange={(e) =>
                  setValue({ ...value, require_background: e.target.checked })
                }
              />{" "}
              Require background clearance
            </label>
            <label className="block text-sm">
              <input
                type="checkbox"
                checked={value.require_safesport}
                onChange={(e) =>
                  setValue({ ...value, require_safesport: e.target.checked })
                }
              />{" "}
              Require SafeSport certificate
            </label>
            <label className="block text-sm">
              Maximum evidence age (months)
              <input
                type="number"
                min="1"
                max="60"
                value={value.validity_months}
                onChange={(e) =>
                  setValue({
                    ...value,
                    validity_months: Number(e.target.value),
                  })
                }
                className={input}
              />
            </label>
            <label className="block text-sm">
              Accepted background result classifications (comma separated)
              <input
                value={value.clear_background_results.join(", ")}
                onChange={(e) =>
                  setValue({
                    ...value,
                    clear_background_results: e.target.value
                      .split(",")
                      .map((v) => v.trim().toLowerCase()),
                  })
                }
                className={input}
              />
            </label>
            <label className="block text-sm">
              Maximum temporary override (days)
              <input
                type="number"
                min="1"
                max="90"
                value={value.override_max_days}
                onChange={(e) =>
                  setValue({
                    ...value,
                    override_max_days: Number(e.target.value),
                  })
                }
                className={input}
              />
            </label>
            <div>
              <p className="mb-2 text-sm font-semibold">
                Affected personnel roles
              </p>
              {data.roles.map((r) => (
                <label key={r.code} className="mb-2 block text-sm">
                  <input
                    type="checkbox"
                    checked={value.role_codes.includes(r.code)}
                    onChange={(e) =>
                      setValue({
                        ...value,
                        role_codes: e.target.checked
                          ? [...value.role_codes, r.code]
                          : value.role_codes.filter((c) => c !== r.code),
                      })
                    }
                  />{" "}
                  {r.name}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
        <div>
          <h3 className="font-semibold">Decision</h3>
          <p className="mt-2 text-sm text-neutral-300">
            Activation checks the selected staff roles on every authorized
            request. Missing or expired evidence removes the affected role
            authority until current evidence is verified or an executive records
            a temporary override. Organization Administrator recovery authority
            remains available.
          </p>
          {data.policy?.status === "active" && (
            <p className="mt-3 text-sm text-amber-300">
              Pause the active policy before changing requirements. Pausing
              suspends its enforcement. Policy changes invalidate prior
              overrides.
            </p>
          )}
          <label className="mt-4 block text-sm">
            Decision reason
            <textarea
              minLength={5}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className={input}
            />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            {!readOnly && (
              <button
                disabled={
                  busy || reason.trim().length < 5 || !value.role_codes.length
                }
                onClick={() => void act("save")}
                className={`${button} bg-blue-700`}
              >
                Save draft
              </button>
            )}
            {data.authorization.decide &&
              data.policy?.status !== "active" &&
              data.policy && (
                <button
                  disabled={busy || dirty || reason.trim().length < 5}
                  onClick={() => void act("activate")}
                  className={`${button} bg-green-700`}
                >
                  Activate saved policy
                </button>
              )}
            {data.authorization.decide && data.policy?.status === "active" && (
              <button
                disabled={busy || reason.trim().length < 5}
                onClick={() => void act("pause")}
                className={`${button} bg-amber-700`}
              >
                Pause enforcement
              </button>
            )}
          </div>
          <h3 className="mt-6 font-semibold">Policy history</h3>
          {data.history.map((h) => (
            <div
              key={h.id}
              className="mt-3 border-b border-neutral-600 pb-3 text-sm"
            >
              <strong>{h.action.replace("safety_policy.", "")}</strong>
              <p>{h.reason}</p>
              <time className="text-neutral-400">
                {new Date(h.occurred_at).toLocaleString()}
              </time>
            </div>
          ))}
          {!data.history.length && (
            <p className="mt-2 text-sm text-neutral-400">
              No recorded policy decisions.
            </p>
          )}
        </div>
      </div>
    </AdminDrawerShell>
  );
}
function ClearanceDrawer({
  row,
  data,
  onClose,
  onSave,
}: {
  row: Clearance;
  data: Snapshot;
  onClose: () => void;
  onSave: (v: Record<string, unknown>) => Promise<void>;
}) {
  const [reason, setReason] = useState(""),
    [expiry, setExpiry] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [documents, setDocuments] = useState(false);
  const [id, setId] = useState(() => crypto.randomUUID());
  const [overrides, setOverrides] = useState<Override[]>([]);
  useEffect(() => {
    let alive = true;
    const q = new URLSearchParams({
      role: "org_admin",
      mode: "overrides",
      person: row.person_id,
      code: row.role_code,
    });
    if (row.override_id) q.set("active", row.override_id);
    authenticatedFetch(`/api/admin-safety?${q}`, { cache: "no-store" })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        if (alive) setOverrides(j.overrides);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [row.person_id, row.role_code, row.override_id, data]);
  async function act(operation: string, overrideId = id) {
    setBusy(true);
    setError("");
    try {
      await onSave({
        operation,
        id: overrideId,
        personId: row.person_id,
        roleCode: row.role_code,
        expiresAt:
          operation === "grant" ? new Date(expiry).toISOString() : null,
        reason,
      });
      setReason("");
      setId(crypto.randomUUID());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Override decision failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <AdminDrawerShell
        title={`${row.person_name} · ${row.role_name}`}
        busy={busy}
        onClose={onClose}
      >
        {error && (
          <p role="alert" className="mb-4 text-red-300">
            {error}
          </p>
        )}
        <div className="grid gap-6 lg:grid-cols-2">
          <section>
            <h3 className="font-semibold">Current clearance</h3>
            <p
              className={`mt-2 ${row.blocked ? "text-red-300" : "text-green-300"}`}
            >
              {row.blocked
                ? "Affected role authority suspended"
                : row.override_id
                  ? "Temporary executive override applies"
                  : "Required clearance is current"}
            </p>
            {row.reasons.map((r) => (
              <p key={r} className="mt-2 text-sm text-neutral-300">
                {r}
              </p>
            ))}
            {row.override_expires_at && (
              <p className="mt-2 text-sm text-amber-300">
                Override ends{" "}
                {new Date(row.override_expires_at).toLocaleString()}
              </p>
            )}
            <button
              onClick={() => setDocuments(true)}
              className={`${button} mt-4 bg-blue-700`}
            >
              Open person & evidence
            </button>
            <p className="mt-3 text-sm text-neutral-400">
              Upload and verify supporting documents, then record the clearance
              decision in Compliance. Changes are checked on the next authorized
              request.
            </p>
          </section>
          <section>
            <h3 className="font-semibold">Executive exception</h3>
            <p className="mt-2 text-sm text-neutral-300">
              Overrides are limited to this person, role and policy version. The
              policy permits up to {data.policy?.override_max_days} days.
            </p>
            <label className="mt-3 block text-sm">
              Decision reason
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className={input}
              />
            </label>
            <label className="mt-3 block text-sm">
              Override expires
              <input
                type="datetime-local"
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
                className={input}
              />
            </label>
            <button
              disabled={
                busy ||
                !data.authorization.decide ||
                !row.blocked ||
                !expiry ||
                reason.trim().length < 5
              }
              onClick={() => void act("grant")}
              className={`${button} mt-3 bg-orange-600`}
            >
              Grant temporary override
            </button>
            <h3 className="mt-6 font-semibold">Override history</h3>
            {overrides.map((o) => (
              <div
                key={o.id}
                className="mt-3 border-b border-neutral-700 pb-3 text-sm"
              >
                <p>{o.reason}</p>
                <p className="text-neutral-400">
                  {o.status === "revoked"
                    ? "Revoked"
                    : o.policy_version !== data.policy?.version
                      ? "Previous policy"
                      : Date.parse(o.expires_at) <= Date.now()
                        ? "Expired"
                        : "Active"}{" "}
                  · until {new Date(o.expires_at).toLocaleString()}
                </p>
                {o.status === "active" && (
                  <button
                    disabled={
                      busy ||
                      !data.authorization.decide ||
                      reason.trim().length < 5
                    }
                    onClick={() => void act("revoke", o.id)}
                    className={`${button} mt-2 bg-red-800`}
                  >
                    Revoke override
                  </button>
                )}
              </div>
            ))}
            {!overrides.length && (
              <p className="mt-2 text-sm text-neutral-400">
                No recorded overrides.
              </p>
            )}
          </section>
        </div>
      </AdminDrawerShell>
      {documents && (
        <PersonRecordDrawer
          personId={row.person_id}
          role="org_admin"
          initialTab="Documents"
          onClose={() => setDocuments(false)}
        />
      )}
    </>
  );
}
