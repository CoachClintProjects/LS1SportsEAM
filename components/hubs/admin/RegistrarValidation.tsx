"use client";
import { AdminDrawerShell } from "./AdminDrawerShell";
import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
const PersonRecordDrawer = dynamic(() => import("./PersonRecordDrawer"));
import { authenticatedFetch } from "@/lib/client/authenticatedFetch";
type Domain = "registrations" | "memberships" | "teamMemberships" | "athletes";
export function RegistrarValidation({ role = "registrar" }: { role?: string }) {
  const [personId, setPersonId] = useState<string | null>(null);
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [domain, setDomain] = useState<Domain>("registrations"),
    [q, setQ] = useState(""),
    [selected, setSelected] = useState<any>(null),
    [creating, setCreating] = useState(false),
    [form, setForm] = useState<any>({
      organizationId: "",
      athleteId: "",
      seasonId: "",
      programId: "",
    }),
    [busy, setBusy] = useState(false);
  const act = async (body: any) => {
    setBusy(true);
    setError("");
    try {
      const r = await authenticatedFetch("/api/admin-command", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...body, role }),
        }),
        j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setSelected(null);
      const x = await authenticatedFetch(
          `/api/admin-command?role=${encodeURIComponent(role)}&section=registrar`,
          { cache: "no-store" },
        ),
        y = await x.json();
      if (!x.ok)
        throw new Error(y.error || "Could not refresh registration records.");
      setData(y);
      return true;
    } catch (e: any) {
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    authenticatedFetch(
      `/api/admin-command?role=${encodeURIComponent(role)}&section=registrar`,
      {
        cache: "no-store",
      },
    )
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        setData(j);
      })
      .catch((e) => setError(e.message));
  }, [role]);
  const rows = useMemo(
    () =>
      (data?.registrar?.[domain] || []).filter((x: any) =>
        JSON.stringify(x).toLowerCase().includes(q.toLowerCase()),
      ),
    [data, domain, q],
  );
  if (!data) return <State text={error || "Loading registration records…"} />;
  const tabs: [Domain, string][] = [
    ["registrations", "Registration queue"],
    ["memberships", "Membership"],
    ["teamMemberships", "Roster memberships"],
    ["athletes", "Athlete records"],
  ];
  return (
    <main className="p-5 text-white lg:p-7">
      {personId && (
        <PersonRecordDrawer
          personId={personId}
          role={role}
          initialTab="Registration"
          onClose={() => setPersonId(null)}
          onSaved={() => {
            authenticatedFetch(
              `/api/admin-command?role=${encodeURIComponent(role)}&section=registrar`,
              { cache: "no-store" },
            )
              .then(async (r) => {
                const j = await r.json();
                if (!r.ok) throw new Error(j.error);
                setData(j);
              })
              .catch((e) => setError(e.message));
          }}
        />
      )}
      <div className="text-[9px] font-black uppercase tracking-[.22em] text-[#FA4616]">
        {role.replaceAll("_", " ")} · Registrar
      </div>
      <div className="mt-1 flex items-center justify-between gap-3">
        <h1 className="text-3xl font-black">
          Registration & eligibility records
        </h1>
        {data.authorization?.createRegistration && (
          <button
            onClick={() => {
              setForm({
                organizationId:
                  data.controls?.organizations?.length === 1
                    ? data.controls.organizations[0].id
                    : "",
                athleteId: "",
                seasonId: "",
                programId: "",
              });
              setError("");
              setCreating(true);
            }}
            className="rounded bg-[#FA4616] px-3 py-2 text-xs font-black text-black"
          >
            + Registration
          </button>
        )}
      </div>
      <p className="mt-2 text-sm text-neutral-400">
        Canonical registration, membership and roster records. No fabricated
        eligibility or approval state.
      </p>
      {error && <p className="mt-3 text-red-300">{error}</p>}
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
            {n} · {(data.registrar?.[k] || []).length}
          </button>
        ))}
      </div>
      <section className="mt-4 overflow-hidden rounded-2xl border border-neutral-800 bg-[#090b0b]">
        <div className="border-b border-neutral-800 p-4">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Find a record"
            className="w-full max-w-sm rounded-lg border border-neutral-700 bg-black px-3 py-2 text-sm"
          />
        </div>
        <div className="divide-y divide-neutral-800">
          {rows.map((r: any) => (
            <button
              key={r.id}
              onClick={() => setSelected(r)}
              className="grid w-full grid-cols-[1fr_auto] gap-4 p-4 text-left hover:bg-white/[.03]"
            >
              <span>
                <b>
                  {r.person
                    ? [
                        r.person.preferred_name || r.person.first_name,
                        r.person.last_name,
                      ]
                        .filter(Boolean)
                        .join(" ")
                    : r.membership_number ||
                      r.athlete_number ||
                      "Person not linked"}
                </b>
                <span className="mt-1 block text-xs text-neutral-500">
                  {[
                    r.program,
                    r.season,
                    r.team,
                    r.membership_type,
                    r.athlete_number,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
              <span className="text-xs uppercase text-neutral-400">
                {r.status || r.athlete_status || "recorded"}
              </span>
            </button>
          ))}
        </div>
        {!rows.length && (
          <div className="p-8 text-sm text-neutral-500">
            No canonical records exist in this domain.
          </div>
        )}
      </section>
      {creating && (
        <AdminDrawerShell
          title="Create registration"
          busy={busy}
          onClose={() => setCreating(false)}
        >
          <fieldset disabled={busy}>
            {error && (
              <p
                role="alert"
                className="mb-4 rounded border border-red-700 p-3 text-red-300"
              >
                {error}
              </p>
            )}

            {error && (
              <p role="alert" className="mt-3 text-red-300">
                {error}
              </p>
            )}
            {data.controls?.organizations?.length !== 1 && (
              <select
                value={form.organizationId}
                onChange={(e) =>
                  setForm({
                    ...form,
                    organizationId: e.target.value,
                    seasonId: "",
                    programId: "",
                  })
                }
                className="mt-4 w-full rounded border border-neutral-700 bg-black px-3 py-2"
              >
                <option value="">Organization</option>
                {(data.controls?.organizations || []).map((o: any) => (
                  <option key={o.id} value={o.id}>
                    {o.name || o.code}
                  </option>
                ))}
              </select>
            )}
            <select
              value={form.athleteId}
              onChange={(e) => setForm({ ...form, athleteId: e.target.value })}
              className="mt-3 w-full rounded border border-neutral-700 bg-black px-3 py-2"
            >
              <option value="">Athlete</option>
              {(data.registrar?.athletes || []).map((a: any) => (
                <option key={a.id} value={a.id}>
                  {a.person
                    ? [
                        a.person.preferred_name || a.person.first_name,
                        a.person.last_name,
                      ]
                        .filter(Boolean)
                        .join(" ")
                    : a.athlete_number || "Unnamed athlete"}
                </option>
              ))}
            </select>
            <select
              value={form.seasonId}
              onChange={(e) => setForm({ ...form, seasonId: e.target.value })}
              className="mt-3 w-full rounded border border-neutral-700 bg-black px-3 py-2"
            >
              <option value="">Select season</option>
              {(data.controls?.seasons || [])
                .filter((x: any) => x.organization_id === form.organizationId)
                .map((x: any) => (
                  <option key={x.id} value={x.id}>
                    {x.name || x.code}
                  </option>
                ))}
            </select>
            <select
              value={form.programId}
              onChange={(e) => setForm({ ...form, programId: e.target.value })}
              className="mt-3 w-full rounded border border-neutral-700 bg-black px-3 py-2"
            >
              <option value="">Select program</option>
              {(data.controls?.programs || [])
                .filter((x: any) => x.organization_id === form.organizationId)
                .map((x: any) => (
                  <option key={x.id} value={x.id}>
                    {x.name || x.code}
                  </option>
                ))}
            </select>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setCreating(false)}>Cancel</button>
              <button
                disabled={
                  busy ||
                  !form.organizationId ||
                  !form.athleteId ||
                  !form.seasonId ||
                  !form.programId
                }
                onClick={async () => {
                  if (await act({ action: "create-registration", ...form }))
                    setCreating(false);
                }}
                className="rounded bg-[#FA4616] px-3 py-2 text-xs font-black text-black"
              >
                Create registration
              </button>
            </div>
          </fieldset>
        </AdminDrawerShell>
      )}{" "}
      {selected && (
        <Drawer
          canDecide={Boolean(data.authorization?.decideRegistration)}
          canUpdateMembership={Boolean(data.authorization?.updateMembership)}
          openPerson={() => {
            setPersonId(selected.person_id);
            setSelected(null);
          }}
          key={selected.id}
          error={error}
          row={selected}
          domain={domain}
          busy={busy}
          act={act}
          close={() => setSelected(null)}
        />
      )}
    </main>
  );
}
function Drawer({
  canDecide,
  canUpdateMembership,
  openPerson,
  error,
  row,
  domain,
  busy,
  act,
  close,
}: {
  canDecide: boolean;
  canUpdateMembership: boolean;
  openPerson: () => void;
  error: string;
  row: any;
  domain: Domain;
  busy: boolean;
  act: (b: any) => void;
  close: () => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <AdminDrawerShell
      title={"Registration and eligibility"}
      busy={busy}
      onClose={close}
      recordStatus={row.status}
    >
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="min-w-0">
          <h3 className="font-semibold">Record details</h3>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {Object.entries(row).map(([k, v]) => (
              <div key={k} className="border-b border-neutral-800 pb-2">
                <div className="text-[9px] uppercase text-neutral-600">
                  {k.replaceAll("_", " ")}
                </div>
                <div className="break-words text-sm">
                  {typeof v === "object" ? JSON.stringify(v) : String(v ?? "—")}
                </div>
              </div>
            ))}
          </div>
        </section>
        <fieldset disabled={busy} className="min-w-0">
          <legend className="font-semibold">Actions</legend>
          {error && (
            <p role="alert" className="mt-4 text-red-300">
              {error}
            </p>
          )}
          {domain === "registrations" && canDecide && (
            <div className="mt-6 flex flex-wrap gap-2 border-t border-neutral-800 pt-4">
              <label className="w-full text-sm">
                Decision reason
                <textarea
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="mt-1 w-full rounded border border-neutral-600 bg-black p-2"
                />
              </label>
              <button
                disabled={
                  busy ||
                  !reason.trim() ||
                  !["submitted", "pending", "under_review"].includes(row.status)
                }
                onClick={() =>
                  act({
                    action: "update-registration-status",
                    id: row.id,
                    status: "approved",
                    expectedStatus: row.status,
                    reason,
                  })
                }
                className="rounded bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-40"
              >
                Approve
              </button>
              <button
                disabled={
                  busy ||
                  !reason.trim() ||
                  !["submitted", "pending", "under_review"].includes(row.status)
                }
                onClick={() =>
                  act({
                    action: "update-registration-status",
                    id: row.id,
                    status: "rejected",
                    expectedStatus: row.status,
                    reason,
                  })
                }
                className="rounded bg-red-800 px-3 py-2 text-xs font-bold text-white disabled:opacity-40"
              >
                Reject
              </button>
            </div>
          )}
          {domain === "teamMemberships" && canUpdateMembership && (
            <div className="mt-6 flex gap-2 border-t border-neutral-800 pt-4">
              <button
                disabled={busy}
                onClick={() =>
                  act({
                    action: "update-team-membership",
                    id: row.id,
                    changes: {
                      status: row.status === "active" ? "inactive" : "active",
                    },
                  })
                }
                className="rounded bg-[#FA4616] px-3 py-2 text-xs font-black text-black"
              >
                {row.status === "active" ? "Deactivate" : "Reactivate"}{" "}
                membership
              </button>
            </div>
          )}
        </fieldset>
        <section className="min-w-0">
          <h3 className="font-semibold">Linked records</h3>
          {row.person_id && (
            <button
              onClick={openPerson}
              className="mt-5 rounded bg-blue-700 px-3 py-2 text-sm text-white"
            >
              Open athlete record & evidence
            </button>
          )}
          {!row.person_id && (
            <p className="mt-4 text-sm text-slate-300">
              No person is linked to this record.
            </p>
          )}
        </section>
      </div>
    </AdminDrawerShell>
  );
}
function State({ text }: { text: string }) {
  return (
    <div className="p-8 text-white">
      <h1 className="text-2xl font-black">Registrar</h1>
      <p className="mt-2 text-neutral-500">{text}</p>
    </div>
  );
}
export default RegistrarValidation;
