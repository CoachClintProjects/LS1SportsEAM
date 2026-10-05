"use client";
import { useEffect, useMemo, useState, useRef } from "react";
import { authenticatedFetch } from "@/lib/client/authenticatedFetch";
import {
  ComplianceEvidenceIntake,
  type EvidenceDomain,
} from "./ComplianceEvidenceIntake";
import { useSearchParams } from "next/navigation";
import PersonRecordDrawer from "./PersonRecordDrawer";
type Domain =
  | "dataQualityIssues"
  | "duplicateCandidates"
  | "credentials"
  | "backgroundChecks"
  | "safeSport"
  | "waivers"
  | "waiverAcceptances";
export function Compliance({ role = "org_admin" }: { role?: string }) {
  const searchParams = useSearchParams();
  const [page, setPage] = useState(0),
    [sort, setSort] = useState("person"),
    [direction, setDirection] = useState("asc");
  const openedRecord = useRef<string | null>(null);
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [domain, setDomain] = useState<Domain>(() =>
      ["credentials", "backgroundChecks", "safeSport"].includes(
        searchParams.get("domain") || "",
      )
        ? (searchParams.get("domain") as Domain)
        : "credentials",
    ),
    [q, setQ] = useState(""),
    [selected, setSelected] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [reason, setReason] = useState(""),
    [edits, setEdits] = useState<Record<string, string>>({});
  const [intake, setIntake] = useState<EvidenceDomain | null>(null),
    [documentPerson, setDocumentPerson] = useState<string | null>(null),
    [details, setDetails] = useState<any>(null);
  const loadSequence = useRef(0);
  const load = async () => {
    const sequence = ++loadSequence.current;
    try {
      const evidence = [
        "credentials",
        "backgroundChecks",
        "safeSport",
      ].includes(domain);
      const r = await authenticatedFetch(
        evidence
          ? `/api/admin-compliance?${new URLSearchParams({ role, mode: "list", domain, page: String(page), sort, direction, q })}`
          : `/api/admin-command?role=${encodeURIComponent(role)}`,
        { cache: "no-store" },
      );
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Compliance controls unavailable.");
      if (sequence === loadSequence.current) {
        setData(
          evidence
            ? {
                [domain]: j.rows,
                total: j.total,
                hasMore: j.hasMore,
                authorization: j.authorization,
              }
            : j.controls,
        );
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
          changes: Object.fromEntries(
            Object.entries(changes).map(([k, v]) => [k, v === "" ? null : v]),
          ),
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
    setSelected(null);
    const timer = setTimeout(() => void load(), q ? 200 : 0);
    return () => {
      clearTimeout(timer);
      loadSequence.current++;
    };
  }, [role, domain, page, sort, direction, q]);
  useEffect(() => {
    let current = true;
    setDetails(null);
    if (
      selected &&
      ["credentials", "backgroundChecks", "safeSport"].includes(domain)
    ) {
      void authenticatedFetch(
        `/api/admin-compliance?role=${encodeURIComponent(role)}&personId=${selected.person_id}&domain=${domain}&id=${selected.id}`,
        { cache: "no-store" },
      )
        .then(async (r) => {
          const j = await r.json();
          if (!r.ok) throw Error(j.error);
          if (current) setDetails(j);
        })
        .catch((e) => {
          if (current) setError(e.message);
        });
    }
    return () => {
      current = false;
    };
  }, [selected, role, domain, documentPerson]);
  useEffect(() => {
    const id = searchParams.get("record"),
      kind = searchParams.get("domain"),
      person = searchParams.get("person");
    if (
      !data ||
      !id ||
      openedRecord.current === id ||
      !kind ||
      !["credentials", "backgroundChecks", "safeSport"].includes(kind)
    )
      return;
    if (domain !== kind) {
      setDomain(kind as Domain);
      return;
    }
    const row = data[kind]?.find((r: any) => r.id === id);
    openedRecord.current = id;
    const open = (r: any) => {
      setSelected(r);
      setReason("");
      setEdits({});
    };
    if (row) {
      open(row);
      return;
    }
    if (!person) {
      setError("Evidence person is missing from this link.");
      return;
    }
    let current = true;
    void authenticatedFetch(
      `/api/admin-compliance?${new URLSearchParams({ role, domain: kind, id, personId: person })}`,
      { cache: "no-store" },
    )
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw Error(j.error);
        if (current) open(j.record);
      })
      .catch((e) => {
        if (current) setError(e.message);
      });
    return () => {
      current = false;
    };
  }, [data, searchParams, domain, role]);
  const rows = useMemo(
    () =>
      (data?.[domain] || []).filter(
        (r: any) =>
          ["credentials", "backgroundChecks", "safeSport"].includes(domain) ||
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
      {["org_admin", "registrar"].includes(role) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {(
            ["credentials", "backgroundChecks", "safeSport"] as EvidenceDomain[]
          ).map((d) => (
            <button
              key={d}
              onClick={() => setIntake(d)}
              className="rounded bg-[#FA4616] px-3 py-2 text-sm font-bold text-black"
            >
              Add{" "}
              {d === "credentials"
                ? "credential"
                : d === "backgroundChecks"
                  ? "background check"
                  : "SafeSport certificate"}
            </button>
          ))}
        </div>
      )}
      <p className="mt-2 text-sm text-neutral-400">
        Live controls and exceptions from the authorized organization scope.
        Compliance is a function, not a role.
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        {tabs.map(([k, n]) => (
          <button
            key={k}
            onClick={() => {
              setDomain(k);
              setPage(0);
              setQ("");
            }}
            className={
              domain === k
                ? "rounded-lg bg-[#FA4616] px-3 py-2 text-xs font-black text-black"
                : "rounded-lg border border-neutral-700 px-3 py-2 text-xs"
            }
          >
            {n}
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
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
            placeholder="Filter live control records"
            className="w-full max-w-sm rounded-lg border border-neutral-700 bg-black px-3 py-2 text-sm"
          />
        </div>
        {["credentials", "backgroundChecks", "safeSport"].includes(domain) && (
          <div className="flex gap-4 border-b border-neutral-700 px-4 py-2 text-sm">
            {[
              ["person", "Person"],
              ["status", "Status"],
              ["expires_on", "Expiry"],
            ].map(([key, label]) => (
              <button
                key={key}
                onClick={() => {
                  setPage(0);
                  setSort(key);
                  setDirection(
                    sort === key && direction === "asc" ? "desc" : "asc",
                  );
                }}
              >
                {label} {sort === key ? (direction === "asc" ? "↑" : "↓") : "↕"}
              </button>
            ))}
          </div>
        )}
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
                  {r.person_label && (
                    <span className="mb-1 block">{r.person_label}</span>
                  )}
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
        {["credentials", "backgroundChecks", "safeSport"].includes(domain) && (
          <div className="flex items-center justify-between border-t border-neutral-700 p-4 text-sm">
            <span>
              Page {page + 1} · {data.total ?? 0} records
            </span>
            <div className="flex gap-2">
              <button
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
                className="rounded border border-neutral-600 px-3 py-1 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={!data.hasMore}
                onClick={() => setPage(page + 1)}
                className="rounded border border-neutral-600 px-3 py-1 disabled:opacity-40"
              >
                Next
              </button>
            </div>
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
            {details && (
              <section className="mt-5 rounded border border-neutral-700 p-3">
                <h3 className="font-bold">
                  {details.person?.preferred_name || details.person?.first_name}{" "}
                  {details.person?.last_name}
                </h3>
                <button
                  disabled={busy}
                  onClick={() => setDocumentPerson(selected.person_id)}
                  className="mt-2 rounded bg-blue-600 px-3 py-2 text-sm font-bold"
                >
                  Upload or review documents
                </button>
                <label className="mt-3 block text-sm">
                  Supporting document
                  <select
                    value={edits.document_id ?? selected.document_id ?? ""}
                    onChange={(e) =>
                      setEdits({ ...edits, document_id: e.target.value })
                    }
                    className="mt-1 block w-full rounded border border-neutral-600 bg-black p-2"
                  >
                    <option value="">Select supporting evidence</option>
                    {details.documents.map((d: any) => (
                      <option key={d.id} value={d.id}>
                        {d.title} · {d.verification_status}
                      </option>
                    ))}
                  </select>
                </label>
              </section>
            )}
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
            {details && (
              <section className="mt-6 border-t border-neutral-700 pt-4">
                <h3 className="font-bold">Decision history</h3>
                {details.history.map((h: any) => (
                  <div
                    key={h.id}
                    className="mt-3 border-b border-neutral-800 pb-2 text-sm"
                  >
                    <b>{h.action.replaceAll("_", " ")}</b>
                    <p>{h.reason}</p>
                    <time className="text-xs text-neutral-400">
                      {new Date(h.occurred_at).toLocaleString()}
                    </time>
                  </div>
                ))}
                {!details.history.length && (
                  <p className="text-sm text-neutral-400">
                    No recorded decisions.
                  </p>
                )}
              </section>
            )}
          </aside>
        </div>
      )}
      {intake && (
        <ComplianceEvidenceIntake
          role={role}
          domain={intake}
          onClose={() => setIntake(null)}
          onSaved={() => {
            setDomain(intake);
            setIntake(null);
            void load();
          }}
        />
      )}
      {documentPerson && (
        <PersonRecordDrawer
          personId={documentPerson}
          role={role}
          initialTab="Documents"
          onClose={() => setDocumentPerson(null)}
        />
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
