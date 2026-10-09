"use client";
import { AdminDrawerShell } from "./AdminDrawerShell";
import PersonRecordDrawer from "./PersonRecordDrawer";
import { useCallback, useEffect, useMemo, useState } from "react";
import { authenticatedFetch } from "@/lib/client/authenticatedFetch";
export function TeamManager({ role = "team_manager" }: { role?: string }) {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [q, setQ] = useState(""),
    [page, setPage] = useState(1),
    [sort, setSort] = useState({ key: "name", direction: 1 }),
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
        `/api/admin-command?role=${encodeURIComponent(role)}&section=roster`,
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
    setPage(1);
    load(controller.signal).catch((e) => {
      if (e.name !== "AbortError") setError(e.message);
    });
    return () => controller.abort();
  }, [load]);
  const athletes = useMemo(() => data?.registrar?.athletes || [], [data]);
  const memberships = useMemo(
    () => data?.registrar?.teamMemberships || [],
    [data],
  );
  const rows = useMemo(() => {
    const value = (a: any) =>
      sort.key === "name"
        ? [
            a.person?.preferred_name || a.person?.first_name,
            a.person?.last_name,
          ]
            .filter(Boolean)
            .join(" ") ||
          a.athlete_number ||
          ""
        : sort.key === "memberships"
          ? memberships.filter(
              (m: any) => m.athlete_id === a.id && m.status === "active",
            ).length
          : sort.key === "status"
            ? a.athlete_status || a.status || ""
            : a.privacy_level || "";
    return athletes
      .filter((a: any) =>
        JSON.stringify(a).toLowerCase().includes(q.toLowerCase()),
      )
      .sort((a: any, b: any) => {
        const left = value(a),
          right = value(b);
        return (
          sort.direction *
          (typeof left === "number" && typeof right === "number"
            ? left - right
            : String(left).localeCompare(String(right), undefined, {
                numeric: true,
                sensitivity: "base",
              }))
        );
      });
  }, [athletes, q, sort, memberships]);
  const pages = Math.max(1, Math.ceil(rows.length / 25)),
    currentPage = Math.min(page, pages);
  if (!data)
    return <State text={error || "Loading authorized roster records…"} />;
  return (
    <main className="p-5 text-white lg:p-7">
      <div className="text-[9px] font-black uppercase tracking-[.22em] text-[#FA4616]">
        {role.replaceAll("_", " ")} · Roster
      </div>
      <div className="mt-1 flex items-center justify-between gap-3">
        <h1 className="text-3xl font-black">Roster</h1>
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
      </div>
      <p className="mt-2 text-sm text-neutral-400">
        Canonical athlete onboarding, lifecycle and team-membership operations
        in the authorized scope.
      </p>
      {error && <p className="mt-3 text-red-300">{error}</p>}
      <section className="mt-5 overflow-hidden rounded-2xl border border-neutral-800 bg-[#090b0b]">
        <div className="flex items-center justify-between gap-3 border-b border-neutral-800 p-4">
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Filter athletes"
            className="w-full max-w-sm rounded-lg border border-neutral-700 bg-black px-3 py-2 text-sm"
          />
          <span className="text-xs text-neutral-500">
            {memberships.length} roster memberships
          </span>
        </div>
        <table className="w-full text-sm">
          <thead className="text-left text-neutral-500">
            <tr>
              {[
                ["name", "Athlete"],
                ["status", "Status"],
                ["privacy", "Privacy"],
                ["memberships", "Active squads"],
              ].map(([key, label]) => (
                <th
                  key={key}
                  className="p-4"
                  aria-sort={
                    sort.key === key
                      ? sort.direction === 1
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                >
                  <button
                    onClick={() => {
                      setSort({
                        key,
                        direction: sort.key === key ? -sort.direction : 1,
                      });
                      setPage(1);
                    }}
                  >
                    {label}{" "}
                    {sort.key === key
                      ? sort.direction === 1
                        ? "↑"
                        : "↓"
                      : "↕"}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows
              .slice((currentPage - 1) * 25, currentPage * 25)
              .map((a: any) => {
                const m = memberships.filter(
                  (x: any) => x.athlete_id === a.id && x.status === "active",
                );
                return (
                  <tr
                    key={a.id}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelected(a);
                      }
                    }}
                    onClick={() => setSelected({ ...a, __memberships: m })}
                    className="cursor-pointer border-t border-neutral-800 hover:bg-white/[.03]"
                  >
                    <td className="p-4 font-bold">
                      {a.person
                        ? [
                            a.person.preferred_name || a.person.first_name,
                            a.person.last_name,
                          ]
                            .filter(Boolean)
                            .join(" ")
                        : a.athlete_number}
                      <div className="mt-1 text-xs font-normal text-neutral-500">
                        {a.athlete_number}
                      </div>
                    </td>
                    <td>{a.athlete_status || a.status || "—"}</td>
                    <td>{a.privacy_level || "—"}</td>
                    <td>{m.length}</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
        {!rows.length && (
          <div className="p-8 text-sm text-neutral-500">
            No canonical athletes exist in the authorized roster scope.
          </div>
        )}
        <nav
          aria-label="Roster pagination"
          className="flex items-center justify-between border-t border-neutral-700 p-4 text-sm"
        >
          <span>
            {rows.length ? (currentPage - 1) * 25 + 1 : 0}–
            {Math.min(currentPage * 25, rows.length)} of {rows.length}
          </span>
          <div className="flex items-center gap-3">
            <button
              disabled={currentPage === 1}
              onClick={() => setPage(currentPage - 1)}
              className="rounded border border-neutral-600 px-3 py-1 disabled:opacity-40"
            >
              Previous
            </button>
            <span>
              Page {currentPage} of {pages}
            </span>
            <button
              disabled={currentPage === pages}
              onClick={() => setPage(currentPage + 1)}
              className="rounded border border-neutral-600 px-3 py-1 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </nav>
      </section>
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
                Onboard
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
