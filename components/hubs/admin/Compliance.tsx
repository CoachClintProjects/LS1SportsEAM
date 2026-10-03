"use client";
import { useEffect, useMemo, useState, useRef } from "react";
import { authenticatedFetch } from "@/lib/client/authenticatedFetch";
type Domain =
  | "dataQualityIssues"
  | "duplicateCandidates"
  | "credentials"
  | "backgroundChecks"
  | "safeSport"
  | "waivers"
  | "waiverAcceptances";
export function Compliance({ role = "org_admin" }: { role?: string }) {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [domain, setDomain] = useState<Domain>("dataQualityIssues"),
    [q, setQ] = useState(""),
    [selected, setSelected] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [reason, setReason] = useState(""),
    [edits, setEdits] = useState<Record<string, string>>({});
  const loadSequence = useRef(0);
  const load = async () => {
    const sequence = ++loadSequence.current;
    try {
      const r = await authenticatedFetch(
        `/api/admin-command?role=${encodeURIComponent(role)}`,
        { cache: "no-store" },
      );
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Compliance controls unavailable.");
      if (sequence === loadSequence.current) {
        setData(j.controls);
        setError("");
      }
    } catch (e) {
      if (sequence === loadSequence.current)
        setError(
          e instanceof Error ? e.message : "Compliance controls unavailable.",
        );
    }
  };
  const revokeWaiver = async () => {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      const r = await authenticatedFetch("/api/admin-command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "revoke-waiver-acceptance",
          role,
          id: selected.id,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Waiver remediation failed.");
      setSelected(null);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const update = async (changes: any) => {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      const r = await authenticatedFetch("/api/admin-command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update-compliance-record",
          role,
          domain,
          id: selected.id,
          changes,
          reason,
          expectedVersion: selected.version,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Compliance update failed.");
      setSelected(null);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    setData(null);
    setSelected(null);
    void load();
    return () => {
      loadSequence.current++;
    };
  }, [role]);
  const rows = useMemo(
    () =>
      (data?.[domain] || []).filter((r: any) =>
        JSON.stringify(r).toLowerCase().includes(q.toLowerCase()),
      ),
    [data, domain, q],
  );
  if (!data)
    return <State text={error || "Loading canonical compliance controls…"} />;
  const tabs: [Domain, string][] = [
    ["dataQualityIssues", "Data quality"],
    ["duplicateCandidates", "Duplicates"],
    ["credentials", "Credentials"],
    ["backgroundChecks", "Background checks"],
    ["safeSport", "Safe Sport"],
    ["waivers", "Waivers"],
    ["waiverAcceptances", "Waiver acceptances"],
  ];
  return (
    <main className="p-5 text-white lg:p-7">
      <div className="text-[9px] font-black uppercase tracking-[.22em] text-[#FA4616]">
        {role.replaceAll("_", " ")} · Compliance
      </div>
      <h1 className="mt-1 text-3xl font-black">Compliance control queue</h1>
      <p className="mt-2 text-sm text-neutral-400">
        Live controls and exceptions from the authorized organization scope.
        Compliance is a function, not a role.
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        {tabs.map(([k, n]) => (
          <button
            key={k}
            onClick={() => setDomain(k)}
            className={
              domain === k
                ? "rounded-lg bg-[#FA4616] px-3 py-2 text-xs font-black text-black"
                : "rounded-lg border border-neutral-700 px-3 py-2 text-xs"
            }
          >
            {n} · {(data[k] || []).length}
          </button>
        ))}
      </div>
      {error && (
        <p
          role="alert"
          className="mt-4 rounded border border-red-700 bg-red-950 p-3 text-red-200"
        >
          {error}
        </p>
      )}
      <section className="mt-4 overflow-hidden rounded-2xl border border-neutral-800 bg-[#090b0b]">
        <div className="border-b border-neutral-800 p-4">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter live control records"
            className="w-full max-w-sm rounded-lg border border-neutral-700 bg-black px-3 py-2 text-sm"
          />
        </div>
        <div className="divide-y divide-neutral-800">
          {rows.map((r: any) => (
            <button
              key={r.id}
              onClick={() => {
                setSelected(r);
                setReason("");
                setEdits({});
                setError("");
              }}
              className="grid w-full grid-cols-[1fr_auto] gap-4 p-4 text-left hover:bg-white/[.03]"
            >
              <span>
                <b>
                  {r.name ||
                    r.credential_type ||
                    r.check_type ||
                    r.certification_type ||
                    r.entity_type ||
                    r.code ||
                    r.id}
                </b>
                <span className="mt-1 block text-xs text-neutral-500">
                  {r.severity ||
                    r.verification_status ||
                    r.result_classification ||
                    r.required_for ||
                    ""}
                </span>
              </span>
              <span className="text-xs uppercase text-neutral-400">
                {r.status || "recorded"}
              </span>
            </button>
          ))}
        </div>
        {!rows.length && (
          <div className="p-8 text-sm text-neutral-500">
            No canonical records exist for this control domain.
          </div>
        )}
      </section>
      {selected && (
        <div
          className="fixed inset-0 z-[100] bg-black/70"
          onClick={() => setSelected(null)}
        >
          <aside
            onClick={(e) => e.stopPropagation()}
            className="ml-auto h-full w-full max-w-2xl overflow-y-auto border-l border-neutral-700 bg-[#080909] p-6"
          >
            <button
              onClick={() => setSelected(null)}
              className="float-right text-neutral-400"
            >
              Close
            </button>
            <div className="text-[9px] uppercase tracking-[.2em] text-[#FA4616]">
              Compliance record
            </div>
            <div role="alert" className="mt-4 text-red-300">
              {error}
              {error && (
                <button
                  className="ml-3 underline"
                  disabled={busy}
                  onClick={() => {
                    setSelected(null);
                    void load();
                  }}
                >
                  Reload records
                </button>
              )}
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {Object.entries(selected).map(([k, v]) => (
                <div key={k} className="border-b border-neutral-800 pb-2">
                  <div className="text-[9px] uppercase text-neutral-600">
                    {k.replaceAll("_", " ")}
                  </div>
                  <div className="break-words text-sm">
                    {typeof v === "object"
                      ? JSON.stringify(v)
                      : String(v ?? "—")}
                  </div>
                </div>
              ))}
            </div>
            {domain === "waiverAcceptances" && !selected.revoked_at && (
              <div className="mt-6 border-t border-neutral-800 pt-4">
                <button
                  disabled={busy}
                  onClick={revokeWaiver}
                  className="rounded border border-neutral-600 px-3 py-2 text-xs font-bold"
                >
                  Revoke acceptance
                </button>
              </div>
            )}
            {(
              ["credentials", "backgroundChecks", "safeSport"] as string[]
            ).includes(domain) && (
              <div className="mt-6 border-t border-neutral-800 pt-4">
                <label className="block text-sm">
                  Decision reason
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="mt-2 block w-full rounded border border-neutral-700 bg-black p-2"
                  />
                </label>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {(domain === "credentials"
                    ? ["issuer", "credential_number", "issued_on", "expires_on"]
                    : domain === "backgroundChecks"
                      ? [
                          "provider",
                          "reference_number",
                          "completed_at",
                          "expires_on",
                          "result_classification",
                        ]
                      : [
                          "certificate_id",
                          "completed_on",
                          "expires_on",
                          "source",
                        ]
                  ).map((field) => (
                    <label key={field} className="text-xs text-neutral-300">
                      {field.replaceAll("_", " ")}
                      <input
                        type={field.endsWith("_on") ? "date" : "text"}
                        value={edits[field] ?? selected[field] ?? ""}
                        onChange={(e) =>
                          setEdits({ ...edits, [field]: e.target.value })
                        }
                        className="mt-1 block w-full rounded border border-neutral-700 bg-black p-2"
                      />
                    </label>
                  ))}
                </div>
                <button
                  disabled={
                    busy ||
                    reason.trim().length < 5 ||
                    !Object.keys(edits).length
                  }
                  onClick={() => update(edits)}
                  className="mt-3 rounded bg-blue-600 px-3 py-2 text-sm font-bold disabled:opacity-40"
                >
                  Save evidence details
                </button>
                <div className="mt-5 text-xs font-black uppercase text-neutral-500">
                  Lifecycle actions
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    disabled={busy || reason.trim().length < 5}
                    onClick={() => update({ status: "active" })}
                    className="rounded bg-green-700 px-3 py-2 text-xs font-bold disabled:opacity-40"
                  >
                    Mark active
                  </button>
                  <button
                    disabled={busy || reason.trim().length < 5}
                    onClick={() => update({ status: "expired" })}
                    className="rounded bg-red-700 px-3 py-2 text-xs font-bold disabled:opacity-40"
                  >
                    Mark expired
                  </button>
                  {domain === "credentials" && (
                    <button
                      disabled={busy || reason.trim().length < 5}
                      onClick={() =>
                        update({
                          verification_status: "verified",
                          verified_at: new Date().toISOString(),
                        })
                      }
                      className="rounded bg-[#FA4616] px-3 py-2 text-xs font-black text-black"
                    >
                      Verify credential
                    </button>
                  )}
                  {domain === "safeSport" && (
                    <button
                      disabled={busy || reason.trim().length < 5}
                      onClick={() =>
                        update({
                          status: "active",
                          verified_at: new Date().toISOString(),
                        })
                      }
                      className="rounded bg-[#FA4616] px-3 py-2 text-xs font-black text-black"
                    >
                      Verify Safe Sport
                    </button>
                  )}
                  {domain === "backgroundChecks" && (
                    <button
                      disabled={busy || reason.trim().length < 5}
                      onClick={() =>
                        update({
                          status: "completed",
                          completed_at: new Date().toISOString(),
                        })
                      }
                      className="rounded bg-[#FA4616] px-3 py-2 text-xs font-black text-black"
                    >
                      Complete check
                    </button>
                  )}
                </div>
              </div>
            )}
          </aside>
        </div>
      )}
    </main>
  );
}
function State({ text }: { text: string }) {
  return (
    <div className="p-8 text-white">
      <h1 className="text-2xl font-black">Compliance</h1>
      <p className="mt-2 text-neutral-500">{text}</p>
    </div>
  );
}
export default Compliance;
