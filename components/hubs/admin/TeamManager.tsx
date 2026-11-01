"use client";
import { AdminDrawerShell } from "./AdminDrawerShell";
import RosterImport from "./RosterImport";
import RosterGrid from "./RosterGrid";
import PersonRecordDrawer from "./PersonRecordDrawer";
import { useCallback, useEffect, useState } from "react";
import { authenticatedFetch } from "@/lib/client/authenticatedFetch";
export function TeamManager({ role = "team_manager" }: { role?: string }) {
  const [importing, setImporting] = useState(false);
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [selected, setSelected] = useState<any>(null),
    [creating, setCreating] = useState(false),
    [form, setForm] = useState<any>({
      organizationId: "",
      teamId: "",
      firstName: "",
      lastName: "",
      birthDate: "",
      email: "",
      privacyLevel: "",
      membershipType: "",
    }),
    [busy, setBusy] = useState(false);
  const load = useCallback(
    async (signal?: AbortSignal) => {
      const r = await authenticatedFetch(
        `/api/admin-roster?role=${encodeURIComponent(role)}`,
        { cache: "no-store", signal },
      );
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setData(j);
    },
    [role],
  );
  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setSelected(null);
    setCreating(false);
    setError("");
    load(controller.signal).catch((e) => {
      if (e.name !== "AbortError") setError(e.message);
    });
    return () => controller.abort();
  }, [load]);
  if (!data)
    return <State text={error || "Loading authorized roster records…"} />;
  return (
    <main className="p-5 text-white lg:p-7">
      <div className="text-[9px] font-black uppercase tracking-[.22em] text-[#FA4616]">
        {role.replaceAll("_", " ")} · Roster
      </div>
      <div className="mt-1 flex items-center justify-between gap-3">
        <h1 className="text-3xl font-black">Roster</h1>
        <div className="flex gap-2">
          {data.authorization?.import && (
            <button
              className="rounded bg-blue-700 px-3 py-2 text-sm"
              onClick={() => setImporting(true)}
            >
              Import CSV
            </button>
          )}
          {data.authorization?.onboard && (
            <button
              disabled={!data.authorization?.onboard}
              onClick={() => {
                setForm({
                  ...form,
                  organizationId:
                    data.controls.organizations.length === 1
                      ? data.controls.organizations[0].id
                      : "",
                });
                setCreating(true);
              }}
              className="rounded bg-[#FA4616] px-3 py-2 text-xs font-black text-black"
            >
              + Athlete
            </button>
          )}
        </div>
      </div>
      <p className="mt-2 text-sm text-neutral-400">
        Manage athletes, family contacts and squads. Choose the columns you
        need, then open an athlete to make changes.
      </p>
      {error && <p className="mt-3 text-red-300">{error}</p>}
      <RosterGrid data={data} role={role} onOpen={setSelected} />
      {importing && (
        <RosterImport
          role={role}
          data={data}
          onClose={() => setImporting(false)}
          onSaved={load}
        />
      )}
      {creating && (
        <AdminDrawerShell
          title="Add athlete"
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

            {data.controls.organizations.length > 1 && (
              <select
                value={form.organizationId}
                onChange={(e) =>
                  setForm({
                    ...form,
                    organizationId: e.target.value,
                    teamId: "",
                  })
                }
                className="mt-4 w-full rounded border border-neutral-700 bg-black px-3 py-2"
              >
                <option value="">Organization</option>
                {(data.controls?.organizations || [])
                  .filter((o: any) => o.status !== "archived")
                  .map((o: any) => (
                    <option key={o.id} value={o.id}>
                      {o.name || o.code}
                    </option>
                  ))}
              </select>
            )}
            {error && (
              <p role="alert" className="mt-3 text-red-300">
                {error}
              </p>
            )}
            <select
              value={form.teamId}
              onChange={(e) => setForm({ ...form, teamId: e.target.value })}
              className="mt-3 w-full rounded border border-neutral-700 bg-black px-3 py-2"
            >
              <option value="">Team</option>
              {(data.controls?.teams || [])
                .filter(
                  (t: any) =>
                    !form.organizationId ||
                    t.organization_id === form.organizationId,
                )
                .map((t: any) => (
                  <option key={t.id} value={t.id}>
                    {t.name || t.code}
                  </option>
                ))}
            </select>
            {[
              ["firstName", "First name"],
              ["lastName", "Last name"],
              ["birthDate", "Birth date"],
              ["email", "Email"],
              ["privacyLevel", "Privacy level"],
              ["membershipType", "Membership type"],
            ].map(([k, n]) => (
              <input
                key={k}
                type={
                  k === "birthDate" ? "date" : k === "email" ? "email" : "text"
                }
                value={form[k]}
                onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                placeholder={n}
                className="mt-3 w-full rounded border border-neutral-700 bg-black px-3 py-2"
              />
            ))}
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setCreating(false)}>Cancel</button>
              <button
                disabled={
                  busy ||
                  !form.organizationId ||
                  !form.teamId ||
                  !form.firstName ||
                  !form.lastName ||
                  !form.birthDate ||
                  !form.privacyLevel ||
                  !form.membershipType
                }
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    const r = await authenticatedFetch("/api/admin-command", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          action: "onboard-athlete",
                          role,
                          ...form,
                        }),
                      }),
                      j = await r.json();
                    if (!r.ok) throw new Error(j.error);
                    await load();
                    setCreating(false);
                  } catch (e: any) {
                    setError(e.message);
                  } finally {
                    setBusy(false);
                  }
                }}
                className="rounded bg-[#FA4616] px-3 py-2 text-xs font-black text-black"
              >
                Save athlete
              </button>
            </div>
          </fieldset>
        </AdminDrawerShell>
      )}{" "}
      {selected && (
        <PersonRecordDrawer
          personId={selected.person_id}
          role={role}
          onClose={() => setSelected(null)}
          onSaved={() => {
            load().catch((e) => setError(e.message));
          }}
        />
      )}
    </main>
  );
}
function State({ text }: { text: string }) {
  return (
    <div className="p-8 text-white">
      <h1 className="text-2xl font-black">Roster</h1>
      <p className="mt-2 text-neutral-500">{text}</p>
    </div>
  );
}
export default TeamManager;
