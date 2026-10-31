"use client";
import { useEffect, useState } from "react";
import { AdminDrawerShell } from "./AdminDrawerShell";
const columns = [
  ["name", "Athlete"],
  ["athlete_number", "Athlete number"],
  ["squads", "Squad / team"],
  ["status", "Athlete status"],
  ["registration", "Registration"],
  ["birth_date", "Date of birth"],
  ["age", "Age today"],
  ["email", "Athlete email"],
  ["phone", "Athlete phone"],
  ["guardian", "Parent / guardian"],
  ["guardian_email", "Parent email"],
  ["guardian_phone", "Parent phone"],
  ["privacy", "Privacy setting"],
];
const defaults = [
  "name",
  "squads",
  "status",
  "registration",
  "guardian",
  "guardian_phone",
];
type View = {
  columns: string[];
  status: string;
  team: string;
  sort: { key: string; direction: number };
};
const standard: View = {
  columns: defaults,
  status: "",
  team: "",
  sort: { key: "name", direction: 1 },
};
export default function RosterGrid({
  data,
  role,
  onOpen,
}: {
  data: any;
  role: string;
  onOpen: (athlete: any) => void;
}) {
  const [view, setView] = useState<View>(standard),
    [query, setQuery] = useState(""),
    [page, setPage] = useState(1),
    [editing, setEditing] = useState(false),
    [draft, setDraft] = useState(defaults),
    [saved, setSaved] = useState<Record<string, View>>({}),
    [viewName, setViewName] = useState(""),
    [notice, setNotice] = useState("");
  const key = `ls1-roster-v1:${data.viewerId || "unknown"}:${role}:${(
    data.controls?.organizations || []
  )
    .map((o: any) => o.id)
    .sort()
    .join(",")}`;
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(key) || "{}");
      const clean = (v: any): View => ({
        ...standard,
        ...v,
        columns: [
          "name",
          ...Array.from(
            new Set<string>(
              (v.columns || defaults).filter(
                (k: string) => k !== "name" && columns.some((c) => c[0] === k),
              ),
            ),
          ),
        ],
      });
      setView(stored.current ? clean(stored.current) : standard);
      setSaved(
        Object.fromEntries(
          Object.entries(stored.views || {}).map(([n, v]) => [n, clean(v)]),
        ),
      );
    } catch {
      setView(standard);
      setSaved({});
    }
  }, [key]);
  function persist(next: View, views = saved) {
    setView(next);
    setPage(1);
    try {
      localStorage.setItem(key, JSON.stringify({ current: next, views }));
      setNotice("View saved on this browser.");
    } catch {
      setNotice(
        "View applied. Browser storage is unavailable; it will not persist.",
      );
    }
  }
  const memberships = data.registrar?.teamMemberships || [],
    teams = data.controls?.teams || [],
    registrations = data.registrar?.registrations || [];
  const prepared = (data.registrar?.athletes || []).map((a: any) => {
    const p = a.person || {},
      today = new Date(),
      birth = p.birth_date ? new Date(`${p.birth_date}T12:00:00`) : null;
    const active = memberships.filter(
      (m: any) =>
        m.athlete_id === a.id &&
        m.status === "active" &&
        (!m.starts_on || m.starts_on <= today.toISOString().slice(0, 10)) &&
        (!m.ends_on || m.ends_on >= today.toISOString().slice(0, 10)),
    );
    const gs = a.guardians || [];
    return {
      ...a,
      name:
        [p.preferred_name || p.first_name, p.last_name]
          .filter(Boolean)
          .join(" ") ||
        a.athlete_number ||
        "Unnamed athlete",
      squads: active
        .map(
          (m: any) =>
            teams.find((t: any) => t.id === m.team_id)?.name ||
            m.team ||
            "Unnamed team",
        )
        .join(", "),
      teamIds: active.map((m: any) => m.team_id),
      status: a.athlete_status || a.status || "",
      registration: registrations
        .filter((r: any) => r.athlete_id === a.id)
        .map((r: any) =>
          [r.program, r.season, r.status].filter(Boolean).join(" · "),
        )
        .join("; "),
      birth_date: p.birth_date || "",
      age: birth
        ? today.getFullYear() -
          birth.getFullYear() -
          (today.getMonth() < birth.getMonth() ||
          (today.getMonth() === birth.getMonth() &&
            today.getDate() < birth.getDate())
            ? 1
            : 0)
        : "",
      email: p.email || "",
      phone: p.phone || "",
      guardian: gs
        .map((g: any) => [g.first_name, g.last_name].filter(Boolean).join(" "))
        .join("; "),
      guardian_email: gs
        .map((g: any) => g.email)
        .filter(Boolean)
        .join("; "),
      guardian_phone: gs
        .map((g: any) => g.phone)
        .filter(Boolean)
        .join("; "),
      privacy: a.privacy_level || "",
    };
  });
  const rows = prepared
    .filter(
      (a: any) =>
        (!view.status || String(a.status).toLowerCase() === view.status) &&
        (!view.team ||
          (view.team === "unassigned"
            ? !a.teamIds.length
            : a.teamIds.includes(view.team))) &&
        columns.some(([k]) =>
          String(a[k] ?? "")
            .toLowerCase()
            .includes(query.toLowerCase()),
        ),
    )
    .sort(
      (a: any, b: any) =>
        view.sort.direction *
        String(a[view.sort.key] ?? "").localeCompare(
          String(b[view.sort.key] ?? ""),
          undefined,
          { numeric: true, sensitivity: "base" },
        ),
    );
  const pages = Math.max(1, Math.ceil(rows.length / 25)),
    current = Math.min(page, pages),
    visible = view.columns
      .map((k) => columns.find((c) => c[0] === k)!)
      .filter(Boolean);
  return (
    <section className="mt-5 rounded-xl border border-neutral-700 bg-[#0A0C10]">
      <div className="flex flex-wrap items-end gap-3 border-b border-neutral-700 p-4">
        <label className="text-xs text-neutral-300">
          Search roster
          <input
            aria-label="Search roster"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Name, squad, contact…"
            className="mt-1 block rounded border border-neutral-600 bg-[#161B22] p-2 text-sm"
          />
        </label>
        <label className="text-xs text-neutral-300">
          Squad / team
          <select
            value={view.team}
            onChange={(e) => persist({ ...view, team: e.target.value })}
            className="mt-1 block rounded border border-neutral-600 bg-[#161B22] p-2 text-sm"
          >
            <option value="">All squads</option>
            <option value="unassigned">No active squad</option>
            {teams.map((t: any) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-neutral-300">
          Athlete status
          <select
            value={view.status}
            onChange={(e) => persist({ ...view, status: e.target.value })}
            className="mt-1 block rounded border border-neutral-600 bg-[#161B22] p-2 text-sm"
          >
            <option value="">All statuses</option>
            {Array.from(
              new Set<string>(
                prepared.map((a: any) => String(a.status).toLowerCase()),
              ),
            )
              .filter(Boolean)
              .sort()
              .map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
          </select>
        </label>
        <button
          onClick={() => {
            setDraft(view.columns);
            setEditing(true);
          }}
          className="rounded bg-blue-700 px-4 py-2 text-sm"
        >
          Choose columns ({visible.length})
        </button>
        <button
          onClick={() => {
            persist(standard);
            setQuery("");
          }}
          className="rounded border border-neutral-600 px-3 py-2 text-sm"
        >
          Reset view
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-3 p-4 text-sm">
        <label>
          Saved views{" "}
          <select
            aria-label="Load saved roster view"
            defaultValue=""
            onChange={(e) => {
              if (saved[e.target.value]) persist(saved[e.target.value]);
              e.target.value = "";
            }}
            className="ml-2 rounded border border-neutral-600 bg-[#161B22] p-2"
          >
            <option value="">Choose a view</option>
            {Object.keys(saved).map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <input
          aria-label="New view name"
          placeholder="Name this view"
          maxLength={60}
          value={viewName}
          onChange={(e) => setViewName(e.target.value)}
          className="rounded border border-neutral-600 bg-[#161B22] p-2"
        />
        <button
          disabled={!viewName.trim()}
          onClick={() => {
            const views = { ...saved, [viewName.trim()]: view };
            setSaved(views);
            persist(view, views);
            setViewName("");
          }}
          className="text-blue-300 disabled:opacity-40"
        >
          Save view
        </button>
        <span className="text-neutral-400">
          {rows.length} athletes · 25 per page
        </span>
      </div>
      {notice && (
        <p role="status" className="px-4 pb-3 text-xs text-neutral-400">
          {notice}
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#161B22]">
            <tr>
              {visible.map(([k, l]) => (
                <th
                  key={k}
                  className="whitespace-nowrap p-3"
                  aria-sort={
                    view.sort.key === k
                      ? view.sort.direction === 1
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                >
                  <button
                    onClick={() =>
                      persist({
                        ...view,
                        sort: {
                          key: k,
                          direction:
                            view.sort.key === k ? -view.sort.direction : 1,
                        },
                      })
                    }
                  >
                    {l}{" "}
                    {view.sort.key === k
                      ? view.sort.direction === 1
                        ? "↑"
                        : "↓"
                      : "↕"}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice((current - 1) * 25, current * 25).map((a: any) => (
              <tr
                key={a.id}
                className="border-t border-neutral-700 hover:bg-white/5"
              >
                {visible.map(([k]) => (
                  <td key={k} className="max-w-sm p-3">
                    {k === "name" ? (
                      <button
                        onClick={() => onOpen(a)}
                        className="text-left font-semibold text-blue-300 hover:underline"
                      >
                        {a.name}
                      </button>
                    ) : (
                      String(a[k] ?? "") || (
                        <span className="text-neutral-500">Not recorded</span>
                      )
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && (
        <p className="p-6 text-neutral-400">
          No athletes match this view. Clear the search or reset the filters.
        </p>
      )}
      <nav
        aria-label="Roster pagination"
        className="flex justify-between border-t border-neutral-700 p-4 text-sm"
      >
        <span>
          {rows.length ? (current - 1) * 25 + 1 : 0}–
          {Math.min(current * 25, rows.length)} of {rows.length}
        </span>
        <div className="flex gap-4">
          <button
            disabled={current === 1}
            onClick={() => setPage(current - 1)}
            className="disabled:opacity-40"
          >
            Previous
          </button>
          <span>
            Page {current} of {pages}
          </span>
          <button
            disabled={current === pages}
            onClick={() => setPage(current + 1)}
            className="disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </nav>
      {editing && (
        <AdminDrawerShell
          title="Choose roster columns"
          onClose={() => setEditing(false)}
        >
          <p className="mb-4 text-sm text-neutral-400">
            Select the information you need and move columns into your preferred
            order. Athlete stays first.
          </p>
          {[
            ...draft,
            ...columns.map((c) => c[0]).filter((k) => !draft.includes(k)),
          ].map((k) => {
            const i = draft.indexOf(k);
            return (
              <div
                key={k}
                className="flex items-center justify-between border-b border-neutral-700 py-3"
              >
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={i >= 0}
                    disabled={k === "name"}
                    onChange={(e) =>
                      setDraft(
                        e.target.checked
                          ? [...draft, k]
                          : draft.filter((x) => x !== k),
                      )
                    }
                  />
                  {columns.find((c) => c[0] === k)?.[1]}
                </label>
                {i >= 0 && k !== "name" && (
                  <div className="flex gap-3">
                    {[-1, 1].map((dir) => (
                      <button
                        key={dir}
                        aria-label={`Move ${columns.find((c) => c[0] === k)?.[1]} ${dir < 0 ? "left" : "right"}`}
                        disabled={i + dir < 1 || i + dir >= draft.length}
                        onClick={() => {
                          const next = [...draft];
                          [next[i], next[i + dir]] = [next[i + dir], next[i]];
                          setDraft(next);
                        }}
                        className="rounded border border-neutral-600 px-3 py-1 disabled:opacity-30"
                      >
                        {dir < 0 ? "↑" : "↓"}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          <div className="mt-5 flex gap-3">
            <button
              onClick={() => {
                persist({ ...view, columns: draft });
                setEditing(false);
              }}
              className="rounded bg-blue-700 px-4 py-2"
            >
              Apply columns
            </button>
            <button onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </AdminDrawerShell>
      )}
    </section>
  );
}
