"use client";
import { useEffect, useState, useRef } from "react";
import { authenticatedFetch } from "@/lib/client/authenticatedFetch";
import { AdminDrawerShell } from "./AdminDrawerShell";
export function AdminCompetitionOperations({
  role = "org_admin",
}: {
  role?: string;
}) {
  const saving = useRef(false);
  const [loading, setLoading] = useState(true);
  const [audit, setAudit] = useState<any[]>([]);
  const [data, setData] = useState<any[]>([]),
    [deadlines, setDeadlines] = useState<any[]>([]),
    [deadline, setDeadline] = useState(false),
    [event, setEvent] = useState(false),
    [events, setEvents] = useState<any[]>([]),
    [organizations, setOrganizations] = useState<any[]>([]),
    [facilities, setFacilities] = useState<any[]>([]),
    [sites, setSites] = useState<any[]>([]),
    [teams, setTeams] = useState<any[]>([]),
    [entries, setEntries] = useState<any[]>([]),
    [entry, setEntry] = useState(false),
    [athletes, setAthletes] = useState<any[]>([]),
    [error, setError] = useState(""),
    [selected, setSelected] = useState<any>(null),
    [draft, setDraft] = useState<any>({}),
    [creating, setCreating] = useState(false),
    [busy, setBusy] = useState(false);
  const load = () =>
    authenticatedFetch(`/api/admin-command?role=${encodeURIComponent(role)}`, {
      cache: "no-store",
    })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        setData(j.controls?.competitions || []);
        setAudit(j.orgAdmin?.audit || []);
        setDeadlines(j.controls?.deadlines || []);
        setEvents(j.controls?.competitionEvents || []);
        setOrganizations(j.controls?.organizations || []);
        setFacilities(j.enterprise?.facilities || []);
        setSites(j.enterprise?.sites || []);
        setTeams(j.controls?.teams || []);
        setEntries(j.controls?.competitionEntries || []);
        setAthletes(j.athletes || []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  useEffect(() => {
    load();
  }, [role]);
  const act = async (body: any) => {
    if (saving.current) return false;
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      const r = await authenticatedFetch("/api/admin-command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, role }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Operation failed");
      setCreating(false);
      setSelected(null);
      await load();
      return true;
    } catch (e: any) {
      setError(e.message);
      return false;
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };
  return (
    <main className="p-5 text-white lg:p-7">
      <div className="text-[9px] font-black uppercase tracking-[.22em] text-[#FA4616]">
        {role.replaceAll("_", " ")} · Live records
      </div>
      <div className="flex items-center justify-between">
        <h1 className="mt-1 text-3xl font-black">
          Admin Competition Operations
        </h1>
        <div className="flex gap-2">
          <button
            onClick={() => setEvent(true)}
            className="rounded-lg border border-neutral-600 px-4 py-2 text-xs font-black"
          >
            + Event
          </button>
          <button
            onClick={() => setEntry(true)}
            className="rounded-lg border border-neutral-600 px-4 py-2 text-xs font-black"
          >
            + Entry
          </button>
          <button
            onClick={() => setDeadline(true)}
            className="rounded-lg border border-neutral-600 px-4 py-2 text-xs font-black"
          >
            + Deadline
          </button>
          <button
            onClick={() => setCreating(true)}
            className="rounded-lg bg-[#FA4616] px-4 py-2 text-xs font-black text-black"
          >
            + Competition
          </button>
        </div>
      </div>
      {error && <p className="mt-4 text-red-300">{error}</p>}
      <section className="mt-5 overflow-hidden rounded-2xl border border-neutral-800 bg-[#090b0b]">
        <div className="divide-y divide-neutral-800">
          {data.map((r: any) => (
            <button
              key={r.id}
              onClick={() => {
                setSelected(r);
                setDraft({ ...r });
              }}
              className="grid w-full grid-cols-[1fr_auto] gap-4 p-4 text-left hover:bg-white/[.03]"
            >
              <span className="font-bold">{r.name || r.id}</span>
              <span className="text-xs uppercase text-neutral-500">
                {r.status || r.competition_type || ""}
              </span>
            </button>
          ))}
        </div>
        {loading && (
          <p role="status" className="p-6 text-blue-300">
            Loading competitions…
          </p>
        )}
        {!loading && !data.length && !error && (
          <div className="p-8 text-sm text-neutral-500">
            No competitions exist. Create the first competition to begin
            operations.
          </div>
        )}
      </section>
      {event && (
        <EventModal
          competitions={data}
          busy={busy}
          error={error}
          onClose={() => setEvent(false)}
          onSave={(v) =>
            act({ action: "create-competition-event", ...v }).then(
              (saved) => saved && setEvent(false),
            )
          }
        />
      )}{" "}
      {entry && (
        <EntryModal
          events={events}
          athletes={athletes}
          teams={teams}
          busy={busy}
          error={error}
          onClose={() => setEntry(false)}
          onSave={(v) =>
            act({ action: "create-competition-entry", ...v }).then(
              (saved) => saved && setEntry(false),
            )
          }
        />
      )}
      <section className="mt-4 rounded-2xl border border-neutral-800 bg-[#090b0b] p-4">
        <div className="text-xs font-black uppercase text-neutral-500">
          Entries
        </div>
        {entries.map((e: any) => (
          <div
            key={e.id}
            className="mt-2 flex items-center justify-between rounded border border-neutral-800 p-3 text-sm"
          >
            <span>
              <b>
                {athletes.find((a: any) => a.id === e.athlete_id)?.people
                  ?.preferred_name ||
                  athletes.find((a: any) => a.id === e.athlete_id)?.people
                    ?.first_name ||
                  e.athlete_id}
              </b>
              <span className="block text-xs text-neutral-500">
                {events.find((x: any) => x.id === e.competition_event_id)
                  ?.name || e.competition_event_id}{" "}
                · eligibility {e.eligibility_status || "pending"}
              </span>
            </span>
            <button
              disabled={busy}
              onClick={() =>
                act({
                  action: "update-competition-entry",
                  id: e.id,
                  changes: {
                    scratch_status:
                      e.scratch_status === "scratched" ? "active" : "scratched",
                  },
                })
              }
              className="rounded border border-neutral-600 px-3 py-2 text-xs"
            >
              {e.scratch_status === "scratched" ? "Restore" : "Scratch"}
            </button>
          </div>
        ))}
        {!entries.length && (
          <div className="mt-2 text-sm text-neutral-500">
            No competition entries recorded.
          </div>
        )}
      </section>
      {deadline && (
        <DeadlineModal
          competitions={data}
          busy={busy}
          error={error}
          onClose={() => setDeadline(false)}
          onSave={(v) =>
            act({ action: "create-competition-deadline", ...v }).then(
              (saved) => saved && setDeadline(false),
            )
          }
        />
      )}
      <section className="mt-4 rounded-2xl border border-neutral-800 bg-[#090b0b] p-4">
        <div className="text-xs font-black uppercase text-neutral-500">
          Deadlines
        </div>
        {deadlines.map((d: any) => (
          <button
            key={d.id}
            onClick={() =>
              act({
                action: "update-competition-deadline",
                id: d.id,
                changes: {
                  status: d.status === "completed" ? "open" : "completed",
                },
              })
            }
            className="mt-2 flex w-full justify-between rounded border border-neutral-800 p-3 text-left text-sm hover:bg-white/[.03]"
          >
            <span>
              <b>{d.name}</b>
              <span className="block text-xs text-neutral-500">
                {new Date(d.due_at).toLocaleString()}
              </span>
            </span>
            <span className="text-xs uppercase text-neutral-400">
              {d.status}
            </span>
          </button>
        ))}
        {!deadlines.length && (
          <div className="mt-2 text-sm text-neutral-500">
            No competition deadlines recorded.
          </div>
        )}
      </section>
      {creating && (
        <CompetitionModal
          organizations={organizations}
          busy={busy}
          error={error}
          onClose={() => setCreating(false)}
          onSave={(v) => act({ action: "create-competition", ...v })}
        />
      )}{" "}
      {selected && (
        <AdminDrawerShell
          title={selected.name || "Competition"}
          recordStatus={selected.status}
          busy={busy}
          onClose={() => setSelected(null)}
        >
          {error && (
            <p role="alert" className="mb-4 text-red-300">
              {error}
            </p>
          )}
          <div className="grid gap-6 lg:grid-cols-3">
            <fieldset disabled={busy} className="min-w-0">
              <legend className="font-semibold">Competition details</legend>
              <div className="mt-4 grid gap-3">
                {[
                  ["name", "Name"],
                  ["competition_type", "Type"],
                  ["starts_at", "Starts"],
                  ["ends_at", "Ends"],
                  ["timezone", "Timezone"],
                  ["city", "City"],
                  ["region", "Region"],
                  ["country_code", "Country"],
                ].map(([k, n]) => (
                  <label key={k} className="text-xs text-neutral-400">
                    {n}
                    <input
                      value={draft[k] || ""}
                      onChange={(e) =>
                        setDraft({ ...draft, [k]: e.target.value })
                      }
                      className="mt-1 w-full rounded border border-neutral-700 bg-black px-3 py-2 text-sm text-white"
                    />
                  </label>
                ))}
              </div>
              <label className="mt-3 block text-xs text-neutral-400">
                Venue facility
                <select
                  value={draft.venue_facility_id || ""}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      venue_facility_id: e.target.value || null,
                    })
                  }
                  className="mt-1 w-full rounded border border-neutral-700 bg-black px-3 py-2"
                >
                  <option value="">No facility</option>
                  {facilities
                    .filter((f: any) =>
                      sites.some(
                        (s: any) =>
                          s.id === f.site_id &&
                          s.organization_id === selected.organization_id,
                      ),
                    )
                    .map((f: any) => (
                      <option key={f.id} value={f.id}>
                        {f.name || f.code}
                      </option>
                    ))}
                </select>
              </label>
            </fieldset>
            <section className="min-w-0">
              <h3 className="font-semibold">Actions and activity</h3>
              <button
                disabled={busy}
                onClick={() =>
                  act({
                    action: "update-competition",
                    id: selected.id,
                    changes: {
                      name: draft.name,
                      competition_type: draft.competition_type,
                      starts_at: draft.starts_at,
                      ends_at: draft.ends_at,
                      timezone: draft.timezone,
                      city: draft.city,
                      region: draft.region,
                      country_code: draft.country_code,
                      venue_facility_id: draft.venue_facility_id || null,
                    },
                  })
                }
                className="mt-5 mr-2 rounded bg-[#FA4616] px-3 py-2 text-xs font-black text-black"
              >
                Save competition
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  act({
                    action: "update-competition",
                    id: selected.id,
                    changes: {
                      status:
                        selected.status === "cancelled"
                          ? "planned"
                          : "cancelled",
                    },
                  })
                }
                className="mt-5 rounded border border-neutral-600 px-3 py-2 text-xs font-bold"
              >
                {selected.status === "cancelled"
                  ? "Reopen"
                  : "Cancel competition"}
              </button>
              <div className="mt-5 space-y-3">
                {audit
                  .filter((row) => row.entity_id === selected.id)
                  .map((row) => (
                    <article
                      key={row.id}
                      className="rounded border border-[#30363D] p-3 text-sm"
                    >
                      <p>
                        {row.reason || String(row.action).replaceAll("_", " ")}
                      </p>
                      <time className="text-slate-300">
                        {new Date(row.occurred_at).toLocaleString()}
                      </time>
                    </article>
                  ))}
                {!audit.some((row) => row.entity_id === selected.id) && (
                  <p className="text-sm text-slate-300">
                    No activity is available for this competition in your
                    current view.
                  </p>
                )}
              </div>
            </section>
            <section className="min-w-0 space-y-4">
              <h3 className="font-semibold">Linked records</h3>
              <p className="text-sm">
                Club:{" "}
                {organizations.find(
                  (row) => row.id === selected.organization_id,
                )?.name || selected.organization_id}
              </p>
              <p className="text-sm">
                Venue:{" "}
                {facilities.find((row) => row.id === selected.venue_facility_id)
                  ?.name || "Not assigned"}
              </p>
              <h4 className="font-semibold">Events</h4>
              {events
                .filter((row) => row.competition_id === selected.id)
                .map((row) => (
                  <div
                    key={row.id}
                    className="rounded border border-[#30363D] p-3 text-sm"
                  >
                    {row.name || row.code}
                  </div>
                ))}
              {!events.some((row) => row.competition_id === selected.id) && (
                <p className="text-sm text-slate-300">No events recorded.</p>
              )}
              <h4 className="font-semibold">Deadlines</h4>
              {deadlines
                .filter((row) => row.competition_id === selected.id)
                .map((row) => (
                  <div
                    key={row.id}
                    className="rounded border border-[#30363D] p-3 text-sm"
                  >
                    {row.name}
                    <p>
                      {new Date(row.due_at).toLocaleString()} · {row.status}
                    </p>
                  </div>
                ))}
              {!deadlines.some((row) => row.competition_id === selected.id) && (
                <p className="text-sm text-slate-300">No deadlines recorded.</p>
              )}
            </section>
          </div>
        </AdminDrawerShell>
      )}
    </main>
  );
}
function CompetitionModal({
  organizations,
  busy,
  error,
  onClose,
  onSave,
}: {
  organizations: any[];
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (v: any) => void;
}) {
  const [v, setV] = useState<any>({
    organizationId: organizations.length === 1 ? organizations[0].id : "",
  });
  return (
    <AdminDrawerShell title="Add competition" busy={busy} onClose={onClose}>
      {error && (
        <p role="alert" className="mb-4 text-red-300">
          {error}
        </p>
      )}
      <fieldset disabled={busy}>
        <h2 className="text-xl font-black">Create competition</h2>
        <select
          value={v.organizationId || ""}
          onChange={(e) => setV({ ...v, organizationId: e.target.value })}
          className="mt-3 w-full rounded border border-neutral-700 bg-black px-3 py-2"
        >
          <option value="">Select organization</option>
          {organizations.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name || x.code}
            </option>
          ))}
        </select>
        {[
          ["name", "Name"],
          ["startsAt", "Starts"],
          ["endsAt", "Ends"],
          ["city", "City"],
          ["region", "Region"],
        ].map(([k, n]) => (
          <label key={k} className="mt-3 block text-xs text-neutral-400">
            {n}
            <input
              type={
                k === "startsAt" || k === "endsAt" ? "datetime-local" : "text"
              }
              value={v[k] || ""}
              onChange={(e) => setV({ ...v, [k]: e.target.value })}
              className="mt-1 w-full rounded border border-neutral-700 bg-black px-3 py-2 text-white"
            />
          </label>
        ))}
        <div className="mt-5 flex justify-end gap-3">
          <button onClick={onClose}>Cancel</button>
          <button
            disabled={busy || !v.organizationId || !v.name}
            onClick={() => onSave(v)}
            className="rounded bg-[#FA4616] px-4 py-2 font-black text-black"
          >
            Create
          </button>
        </div>
      </fieldset>
    </AdminDrawerShell>
  );
}
function DeadlineModal({
  competitions,
  busy,
  error,
  onClose,
  onSave,
}: {
  competitions: any[];
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (v: any) => void;
}) {
  const [v, setV] = useState<any>({
    competitionId: "",
    deadlineType: "",
    name: "",
    dueAt: "",
  });
  return (
    <AdminDrawerShell
      title="Add competition deadline"
      busy={busy}
      onClose={onClose}
    >
      {error && (
        <p role="alert" className="mb-4 text-red-300">
          {error}
        </p>
      )}
      <fieldset disabled={busy}>
        <h2 className="text-xl font-black">Competition deadline</h2>
        <label className="mt-4 block text-xs text-neutral-400">
          Competition
          <select
            value={v.competitionId}
            onChange={(e) => setV({ ...v, competitionId: e.target.value })}
            className="mt-1 w-full rounded border border-neutral-700 bg-black px-3 py-2"
          >
            <option value="">Select competition</option>
            {competitions.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
        {[
          ["deadlineType", "Type"],
          ["name", "Name"],
          ["dueAt", "Due"],
        ].map(([k, n]) => (
          <label key={k} className="mt-3 block text-xs text-neutral-400">
            {n}
            <input
              type={k === "dueAt" ? "datetime-local" : "text"}
              value={v[k] || ""}
              onChange={(e) => setV({ ...v, [k]: e.target.value })}
              className="mt-1 w-full rounded border border-neutral-700 bg-black px-3 py-2"
            />
          </label>
        ))}
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose}>Cancel</button>
          <button
            disabled={busy || !v.competitionId || !v.name || !v.dueAt}
            onClick={() => onSave(v)}
            className="rounded bg-[#FA4616] px-4 py-2 font-black text-black"
          >
            Create deadline
          </button>
        </div>
      </fieldset>
    </AdminDrawerShell>
  );
}
function EventModal({
  competitions,
  busy,
  error,
  onClose,
  onSave,
}: {
  competitions: any[];
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (v: any) => void;
}) {
  const [v, setV] = useState<any>({
    competitionId: "",
    code: "",
    name: "",
    sequenceNo: 0,
  });
  return (
    <AdminDrawerShell
      title="Add competition event"
      busy={busy}
      onClose={onClose}
    >
      {error && (
        <p role="alert" className="mb-4 text-red-300">
          {error}
        </p>
      )}
      <fieldset disabled={busy}>
        <h2 className="text-xl font-black">Competition event</h2>
        <select
          value={v.competitionId}
          onChange={(e) => setV({ ...v, competitionId: e.target.value })}
          className="mt-4 w-full rounded border border-neutral-700 bg-black px-3 py-2"
        >
          <option value="">Select competition</option>
          {competitions.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </select>
        {[
          ["code", "Code"],
          ["name", "Name"],
          ["sequenceNo", "Sequence"],
        ].map(([k, n]) => (
          <label key={k} className="mt-3 block text-xs text-neutral-400">
            {n}
            <input
              type={k === "sequenceNo" ? "number" : "text"}
              value={v[k] ?? ""}
              onChange={(e) =>
                setV({
                  ...v,
                  [k]:
                    k === "sequenceNo"
                      ? Number(e.target.value)
                      : e.target.value,
                })
              }
              className="mt-1 w-full rounded border border-neutral-700 bg-black px-3 py-2"
            />
          </label>
        ))}
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose}>Cancel</button>
          <button
            disabled={busy || !v.competitionId || !v.code || !v.name}
            onClick={() => onSave(v)}
            className="rounded bg-[#FA4616] px-4 py-2 font-black text-black"
          >
            Create event
          </button>
        </div>
      </fieldset>
    </AdminDrawerShell>
  );
}
function EntryModal({
  events,
  athletes,
  teams,
  busy,
  error,
  onClose,
  onSave,
}: {
  events: any[];
  athletes: any[];
  teams: any[];
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (v: any) => void;
}) {
  const [v, setV] = useState<any>({
    competitionEventId: "",
    athleteId: "",
    teamId: "",
  });
  return (
    <AdminDrawerShell title="Enter athlete" busy={busy} onClose={onClose}>
      {error && (
        <p role="alert" className="mb-4 text-red-300">
          {error}
        </p>
      )}
      <fieldset disabled={busy}>
        <h2 className="text-xl font-black">Enter athlete</h2>
        <label className="mt-4 block text-xs text-neutral-400">
          Event
          <select
            value={v.competitionEventId}
            onChange={(e) => setV({ ...v, competitionEventId: e.target.value })}
            className="mt-1 w-full rounded border border-neutral-700 bg-black px-3 py-2"
          >
            <option value="">Select event</option>
            {events.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name || x.code}
              </option>
            ))}
          </select>
        </label>
        <label className="mt-3 block text-xs text-neutral-400">
          Athlete
          <select
            value={v.athleteId}
            onChange={(e) => setV({ ...v, athleteId: e.target.value })}
            className="mt-1 w-full rounded border border-neutral-700 bg-black px-3 py-2"
          >
            <option value="">Select athlete</option>
            {athletes.map((a) => (
              <option key={a.id} value={a.id}>
                {[
                  a.people?.preferred_name || a.people?.first_name,
                  a.people?.last_name,
                ]
                  .filter(Boolean)
                  .join(" ") ||
                  a.athlete_number ||
                  a.id}
              </option>
            ))}
          </select>
        </label>
        <label className="mt-3 block text-xs text-neutral-400">
          Team (optional)
          <select
            value={v.teamId}
            onChange={(e) => setV({ ...v, teamId: e.target.value })}
            className="mt-1 w-full rounded border border-neutral-700 bg-black px-3 py-2"
          >
            <option value="">No team</option>
            {teams
              .filter((t) => t.status === "active")
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name || t.code}
                </option>
              ))}
          </select>
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose}>Cancel</button>
          <button
            disabled={busy || !v.competitionEventId || !v.athleteId}
            onClick={() => onSave(v)}
            className="rounded bg-[#FA4616] px-4 py-2 font-black text-black"
          >
            Enter athlete
          </button>
        </div>
      </fieldset>
    </AdminDrawerShell>
  );
}
export default AdminCompetitionOperations;
