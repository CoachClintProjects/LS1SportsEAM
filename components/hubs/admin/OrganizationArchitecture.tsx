"use client";
import { useEffect, useMemo, useState, useRef } from "react";
import { authenticatedFetch } from "@/lib/client/authenticatedFetch";
import "./admin-architecture.css";
import PersonRecordDrawer from "./PersonRecordDrawer";
import { AdminDrawerShell } from "./AdminDrawerShell";
import {
  Search,
  X,
  ShieldCheck,
  History,
  Users,
  Building2,
  Layers3,
  CalendarDays,
  Network,
  ChevronRight,
  ArrowUpDown,
} from "lucide-react";

type Snapshot = {
  organizations: any[];
  sites: any[];
  programs: any[];
  seasons: any[];
  teams: any[];
  people: any[];
  assignments: any[];
  roles: any[];
  audit: any[];
  authorization?: { edit: boolean; create: boolean; manageRoles: boolean };
};
type Domain = "people" | "sites" | "programs" | "seasons" | "teams";
const label = (p: any) =>
  [p.preferred_name || p.first_name, p.last_name].filter(Boolean).join(" ") ||
  p.email ||
  p.id;
const scopeLabel = (a: any) =>
  a.team_id
    ? "Team"
    : a.site_id
      ? "Site"
      : a.program_id
        ? "Program"
        : a.competition_id
          ? "Competition"
          : "Organization";

export function OrganizationArchitecture({
  role = "org_admin",
  initialDomain = "people",
}: {
  role?: string;
  initialDomain?: Domain;
}) {
  const [workspace, setWorkspace] = useState(
    initialDomain === "people" ? "club" : "structure",
  );
  const [notice, setNotice] = useState("");
  const [staffQuery, setStaffQuery] = useState("");
  const [revoke, setRevoke] = useState<any>(null);
  const denial = useRef<HTMLDialogElement>(null);
  const saving = useRef(false);
  const [data, setData] = useState<Snapshot | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(""),
    [domain, setDomain] = useState<Domain>(initialDomain),
    [query, setQuery] = useState(""),
    [selected, setSelected] = useState<any | null>(null),
    [creating, setCreating] = useState(false),
    [creatingOrg, setCreatingOrg] = useState(false);
  useEffect(() => {
    if (error.includes("ERR-701")) denial.current?.showModal();
  }, [error]);
  async function load() {
    setError("");
    const r = await authenticatedFetch(
      `/api/admin-command?role=${encodeURIComponent(role)}&section=organization`,
      { cache: "no-store" },
    );
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "Organization data unavailable.");
    setData(j.orgAdmin || null);
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [role]);
  const names = useMemo(
    () => new Map((data?.people || []).map((p: any) => [p.id, label(p)])),
    [data],
  );
  const roles = useMemo(
    () => new Map((data?.roles || []).map((r: any) => [r.id, r.name])),
    [data],
  );
  async function mutate(body: any) {
    if (saving.current) return false;
    saving.current = true;
    setBusy(body.action);
    setError("");
    try {
      const r = await authenticatedFetch("/api/admin-command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, role }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Action failed.");
      setNotice("Changes saved. The records below are up to date.");
      setRevoke(null);
      setSelected(null);
      setCreating(false);
      setCreatingOrg(false);
      try {
        await load();
      } catch {
        setError(
          "Saved, but the latest records could not be loaded. Refresh before making another change.",
        );
      }
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.");
      return false;
    } finally {
      saving.current = false;
      setBusy("");
    }
  }
  if (error && !data)
    return <State title="Organization Administration" text={error} />;
  if (!data)
    return (
      <State title="Organization Administration" text="Loading club records…" />
    );
  const org = data.organizations[0];
  const domainRows: any[] = (data as any)[domain] || [];
  const filtered = domainRows.filter((r: any) =>
    JSON.stringify(r).toLowerCase().includes(query.toLowerCase()),
  );
  const activeAssignments = data.assignments.filter(
    (a: any) => a.status === "active",
  );
  const entityForDomain: Record<Domain, string> = {
    people: "person",
    sites: "site",
    programs: "program",
    seasons: "season",
    teams: "team",
  };
  const tabs: [Domain, string, any][] = [
    ["people", "People records", Users],
    ["sites", "Training locations", Building2],
    ["programs", "Programs", Layers3],
    ["seasons", "Seasons", CalendarDays],
    ["teams", "Teams", Network],
  ];
  return (
    <main className="org-admin-architecture min-h-full p-5 lg:p-7">
      <dialog
        ref={denial}
        aria-label="Account protection"
        className="rounded-xl border-2 border-red-500 bg-[#161B22] p-6 text-white backdrop:bg-black/70"
      >
        <h2 className="text-xl font-bold text-red-300">
          Your administrator access is protected
        </h2>
        <p className="mt-3">DENY: ERR-701: SELF-TERMINATION FORBIDDEN</p>
        <p className="mt-3 text-sm">
          You cannot deactivate your own account or remove your own
          administrator access.
        </p>
        <button
          onClick={() => denial.current?.close()}
          className="mt-5 rounded bg-blue-700 px-4 py-2"
        >
          Return to club settings
        </button>
      </dialog>
      <header className="flex flex-wrap items-end justify-between gap-5 border-b border-neutral-800 pb-5">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[.24em] text-[#FA4616]">
            Organization Administrator · Club & staff settings
          </div>
          <h1 className="mt-1 text-3xl font-black">
            {org?.name || "Organization"}
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-neutral-400">
            Update club details, manage staff access and organize teams and
            seasons. Choose a section below to get started.
          </p>
        </div>
        <div className="text-sm text-neutral-400">
          {org?.code} · {org?.status}
        </div>
      </header>
      {error && (
        <div className="mt-4 rounded-xl border border-red-900 bg-red-950/30 p-3 text-sm text-red-300">
          {error}
        </div>
      )}
      {notice && (
        <p role="status" className="mt-4 text-emerald-300">
          {notice}
        </p>
      )}
      <nav
        aria-label="Club settings sections"
        className="mt-5 flex flex-wrap gap-2"
      >
        {[
          ["club", "Club details"],
          ["staff", "Staff & access"],
          ["structure", "Teams, seasons & locations"],
          ["history", "Activity history"],
        ].map(([key, title]) => (
          <button
            key={key}
            aria-pressed={workspace === key}
            onClick={() => {
              setWorkspace(key);
              if (key === "structure" && domain === "people")
                setDomain("teams");
              setSelected(null);
              setError("");
            }}
            className={`rounded-lg border px-4 py-3 text-sm font-semibold ${workspace === key ? "border-blue-500 bg-blue-900/30 text-white" : "border-neutral-700 text-neutral-300"}`}
          >
            {title}
          </button>
        ))}
      </nav>
      {workspace === "club" && (
        <ClubDetails
          key={org?.id}
          org={org}
          busy={!!busy}
          canEdit={!!data.authorization?.edit}
          onSave={(changes) =>
            mutate({
              action: "update-master-record",
              entity: "organization",
              id: org.id,
              changes,
              expected: {
                name: org.name,
                legal_name: org.legal_name,
                organization_type: org.organization_type,
              },
            })
          }
        />
      )}
      {workspace === "structure" && (
        <>
          <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {tabs
              .filter(([key]) => key !== "people")
              .map(([key, name, Icon]) => (
                <button
                  key={key}
                  onClick={() => {
                    setDomain(key);
                    setSelected(null);
                  }}
                  className={`rounded-xl border p-4 text-left transition ${domain === key ? "border-[#FA4616] bg-[#FA4616]/5" : "border-neutral-800 bg-[#090b0b] hover:border-neutral-600"}`}
                >
                  <div className="flex items-center justify-between">
                    <Icon className="h-4 w-4 text-[#FA4616]" />
                    <span className="text-2xl font-black">
                      {((data as any)[key] || []).length}
                    </span>
                  </div>
                  <div className="mt-3 text-xs font-bold">{name}</div>
                </button>
              ))}
          </section>
          <section className="mt-5 overflow-hidden rounded-2xl border border-neutral-800 bg-[#090b0b]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 p-4">
              <div>
                <h2 className="font-black">
                  {tabs.find((x) => x[0] === domain)?.[1]}
                </h2>
                <p className="text-xs text-neutral-500">
                  Select a record to view or edit
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  disabled={!data.authorization?.create}
                  onClick={() => setCreating(true)}
                  className="rounded-lg bg-[#FA4616] px-3 py-2 text-xs font-black text-black"
                >
                  + Add{" "}
                  {domain === "sites"
                    ? "location"
                    : domain === "people"
                      ? "person"
                      : domain.slice(0, -1)}
                </button>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-600" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Filter live records"
                    className="rounded-lg border border-neutral-700 bg-black py-2 pl-9 pr-3 text-sm"
                  />
                </div>
              </div>
            </div>
            {domain === "people" ? (
              <PeopleTable
                key={query}
                rows={filtered}
                assignments={data.assignments}
                roles={roles}
                onOpen={setSelected}
              />
            ) : (
              <ObjectTable rows={filtered} onOpen={setSelected} />
            )}
            {!filtered.length && (
              <div className="p-8 text-sm text-neutral-500">
                No records to show. Add a record to get started.
              </div>
            )}
          </section>
        </>
      )}
      {workspace === "staff" && (
        <>
          <section className="mt-5 rounded-2xl border border-neutral-800 bg-[#090b0b] p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="text-[9px] font-black uppercase tracking-[.18em] text-[#FA4616]">
                  Club access
                </div>
                <h2 className="mt-1 text-lg font-black">
                  Staff and permissions
                </h2>
                <p className="text-sm text-neutral-500">
                  Add a staff person, assign their responsibilities, or remove a
                  role. Removing a role retains the person and their history.
                </p>
              </div>
              <div className="text-sm text-neutral-400">
                {activeAssignments.length} active assignments
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <input
                aria-label="Search staff"
                placeholder="Search staff or role"
                value={staffQuery}
                onChange={(e) => setStaffQuery(e.target.value)}
                className="rounded border border-neutral-600 bg-black p-2"
              />
              <button
                disabled={!data.authorization?.create}
                onClick={() => {
                  setDomain("people");
                  setCreating(true);
                }}
                className="rounded bg-blue-700 px-4 py-2 disabled:opacity-40"
              >
                Add staff person
              </button>
            </div>
            <p className="mt-3 text-sm text-neutral-400">
              A staff person record is separate from a sign-in account.
              Assigning a role does not send an invitation or create a password.
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-neutral-500">
                  <tr>
                    <th className="py-2">Person</th>
                    <th>Role</th>
                    <th>Scope</th>
                    <th>Status</th>
                    <th>Started</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {data.assignments
                    .filter((a: any) =>
                      `${names.get(a.person_id) || ""} ${roles.get(a.role_definition_id) || ""}`
                        .toLowerCase()
                        .includes(staffQuery.toLowerCase()),
                    )
                    .map((a: any) => (
                      <tr key={a.id} className="border-t border-neutral-800">
                        <td className="py-3">
                          <button
                            onClick={() => {
                              setDomain("people");
                              setSelected(
                                data.people.find(
                                  (p: any) => p.id === a.person_id,
                                ),
                              );
                            }}
                            className="text-blue-300 hover:underline"
                          >
                            {names.get(a.person_id) || "Person unavailable"}
                          </button>
                        </td>
                        <td>
                          {roles.get(a.role_definition_id) ||
                            a.role_definition_id}
                        </td>
                        <td>
                          {a.team_id
                            ? data.teams.find((t) => t.id === a.team_id)
                                ?.name || "Team"
                            : a.site_id
                              ? data.sites.find((t) => t.id === a.site_id)
                                  ?.name || "Location"
                              : a.program_id
                                ? data.programs.find(
                                    (t) => t.id === a.program_id,
                                  )?.name || "Program"
                                : org?.name || scopeLabel(a)}
                        </td>
                        <td>{a.status}</td>
                        <td className="text-neutral-500">
                          {a.starts_at
                            ? new Date(a.starts_at).toLocaleDateString()
                            : "—"}
                        </td>
                        <td className="text-right">
                          {a.status === "active" &&
                            data.authorization?.manageRoles && (
                              <button
                                disabled={!!busy}
                                onClick={() => setRevoke(a)}
                                className="rounded-lg border border-neutral-700 px-3 py-1.5 hover:border-red-500 disabled:opacity-40"
                              >
                                Remove role
                              </button>
                            )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            {!data.assignments.length && (
              <p className="mt-4 text-sm text-neutral-400">
                No staff roles assigned. Choose a person and responsibility
                below.
              </p>
            )}
            {data.authorization?.manageRoles && (
              <Assign
                people={data.people}
                roles={data.roles}
                organizationId={org?.id}
                busy={!!busy}
                onAssign={(personId, roleDefinitionId) =>
                  mutate({
                    action: "assign-role",
                    personId,
                    roleDefinitionId,
                    organizationId: org.id,
                  })
                }
              />
            )}
          </section>
        </>
      )}
      {workspace === "history" && (
        <section className="mt-5 rounded-2xl border border-neutral-800 bg-[#090b0b] p-5">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-[#FA4616]" />
            <h2 className="font-black">Club activity history</h2>
          </div>
          <div className="mt-3 divide-y divide-neutral-800">
            {data.audit.slice(0, 30).map((a: any) => (
              <button
                key={a.id}
                onClick={() => setSelected({ ...a, __audit: true })}
                className="flex w-full justify-between gap-4 py-3 text-left text-sm hover:bg-white/[.02]"
              >
                <span>
                  <b>{a.action}</b> · {a.entity_type}
                </span>
                <span className="text-neutral-500">
                  {new Date(a.occurred_at).toLocaleString()}
                </span>
              </button>
            ))}
            {!data.audit.length && (
              <p className="py-4 text-sm text-neutral-500">
                No authorized audit events available.
              </p>
            )}
          </div>
        </section>
      )}
      {revoke && (
        <AdminDrawerShell
          title="Remove staff role"
          busy={!!busy}
          onClose={() => setRevoke(null)}
        >
          <p>
            Remove {roles.get(revoke.role_definition_id)} access from{" "}
            {names.get(revoke.person_id)}?
          </p>
          <p className="mt-3 text-sm text-neutral-400">
            Their other roles and person record remain. This change is recorded
            in club activity.
          </p>
          {error && (
            <p role="alert" className="mt-3 text-red-300">
              {error}
            </p>
          )}
          <div className="mt-5 flex gap-3">
            <button
              disabled={!!busy}
              onClick={() =>
                void mutate({ action: "revoke-role", id: revoke.id })
              }
              className="rounded bg-red-700 px-4 py-2"
            >
              Confirm removal
            </button>
            <button disabled={!!busy} onClick={() => setRevoke(null)}>
              Keep role
            </button>
          </div>
        </AdminDrawerShell>
      )}
      {creatingOrg && (
        <CreateOrganization
          parent={org}
          busy={!!busy}
          error={error}
          onClose={() => setCreatingOrg(false)}
          onCreate={(values) => {
            void mutate({
              action: "create-organization",
              parentOrganizationId: org.id,
              ...values,
            });
          }}
        />
      )}
      {creating && (
        <CreateRecord
          domain={domain}
          busy={!!busy}
          error={error}
          onClose={() => setCreating(false)}
          onCreate={(values) => {
            void mutate({
              action: "create-master-record",
              entity: entityForDomain[domain],
              values,
            });
          }}
        />
      )}
      {selected && domain === "people" && !selected.__audit ? (
        <PersonRecordDrawer
          personId={selected.id}
          role={role}
          onClose={() => setSelected(null)}
          onSaved={() => {
            load().catch((e) => setError(e.message));
          }}
        />
      ) : (
        selected && (
          <RecordDrawer
            record={selected}
            entity={entityForDomain[domain]}
            assignments={data.assignments.filter(
              (a) => a.person_id === selected.id,
            )}
            audit={data.audit.filter((a) => a.entity_id === selected.id)}
            roles={roles}
            busy={!!busy}
            error={error}
            onMutate={mutate}
            onClose={() => setSelected(null)}
          />
        )
      )}
    </main>
  );
}
function ClubDetails({
  org,
  busy,
  canEdit,
  onSave,
}: {
  org: any;
  busy: boolean;
  canEdit: boolean;
  onSave: (changes: any) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState({
    name: org?.name || "",
    legal_name: org?.legal_name || "",
    organization_type: org?.organization_type || "",
  });
  useEffect(
    () =>
      setDraft({
        name: org?.name || "",
        legal_name: org?.legal_name || "",
        organization_type: org?.organization_type || "",
      }),
    [org],
  );
  if (!org) return <p className="mt-5">No club record is available.</p>;
  return (
    <section className="mt-5 max-w-3xl rounded-xl border border-neutral-700 bg-[#0A0C10] p-5">
      <h2 className="text-xl font-semibold">Club details</h2>
      <p className="mt-2 text-sm text-neutral-400">
        The club name shown to your staff and the registered name used in club
        records. Manage training locations, programs and seasons in Teams,
        seasons & locations.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const changes = Object.fromEntries(
            Object.entries(draft).filter(([k, v]) => v !== (org[k] || "")),
          );
          if (Object.keys(changes).length) await onSave(changes);
        }}
        className="mt-5 space-y-4"
      >
        <fieldset disabled={busy || !canEdit} className="space-y-4">
          {[
            ["name", "Club display name"],
            ["legal_name", "Registered / legal name"],
            ["organization_type", "Club type"],
          ].map(([k, l]) => (
            <label key={k} className="block text-sm">
              {l}
              <input
                required={k === "name"}
                maxLength={200}
                value={draft[k as keyof typeof draft]}
                onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}
                className="mt-1 w-full rounded border border-neutral-600 bg-[#161B22] p-3"
              />
            </label>
          ))}
          <p className="text-sm text-neutral-400">
            Club code: {org.code} · Status: {org.status}
          </p>
          <button
            disabled={
              !Object.entries(draft).some(([k, v]) => v !== (org[k] || ""))
            }
            className="rounded bg-blue-700 px-4 py-2 disabled:opacity-40"
          >
            {busy ? "Saving…" : "Save club details"}
          </button>
        </fieldset>
      </form>
    </section>
  );
}
function CreateOrganization({
  parent,
  busy,
  error,
  onClose,
  onCreate,
}: {
  parent: any;
  busy: boolean;
  error: string;
  onClose: () => void;
  onCreate: (v: any) => void;
}) {
  const [v, setV] = useState<any>({});
  return (
    <AdminDrawerShell
      title={`Create child organization`}
      busy={busy}
      onClose={onClose}
    >
      {error && (
        <p
          role="alert"
          className="mb-4 rounded border border-red-700 p-3 text-red-300"
        >
          {error}
        </p>
      )}
      <fieldset disabled={busy}>
        <p className="mt-1 text-xs text-neutral-500">Parent: {parent?.name}</p>
        {[
          ["code", "Code"],
          ["name", "Name"],
          ["legalName", "Legal name"],
          ["organizationType", "Organization type"],
          ["status", "Status"],
        ].map(([k, n]) => (
          <label key={k} className="mt-3 block text-xs text-neutral-400">
            {n}
            <input
              value={v[k] || ""}
              onChange={(e) => setV({ ...v, [k]: e.target.value })}
              className="mt-1 w-full rounded border border-neutral-700 bg-black px-3 py-2"
            />
          </label>
        ))}
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose}>Cancel</button>
          <button
            disabled={busy || !v.code || !v.name}
            onClick={() => onCreate(v)}
            className="rounded bg-[#FA4616] px-4 py-2 font-black text-black"
          >
            Create
          </button>
        </div>
      </fieldset>
    </AdminDrawerShell>
  );
}
function PeopleTable({
  rows,
  assignments,
  roles,
  onOpen,
}: {
  rows: any[];
  assignments: any[];
  roles: Map<any, any>;
  onOpen: (r: any) => void;
}) {
  const [page, setPage] = useState(1),
    [sort, setSort] = useState({ key: "name", direction: 1 });
  const authority = (p: any) =>
    assignments
      .filter((x) => x.person_id === p.id && x.status === "active")
      .map((x) => roles.get(x.role_definition_id) || x.role_definition_id)
      .join(", ");
  const value = (p: any, key: string) =>
    key === "name"
      ? label(p)
      : key === "authority"
        ? authority(p)
        : String(p[key] || "");
  const sorted = [...rows].sort(
    (a, b) =>
      sort.direction *
      value(a, sort.key).localeCompare(value(b, sort.key), undefined, {
        numeric: true,
        sensitivity: "base",
      }),
  );
  const pages = Math.max(1, Math.ceil(sorted.length / 25)),
    current = Math.min(page, pages);
  const headers = [
    ["name", "Person"],
    ["email", "Email"],
    ["status", "Status"],
    ["authority", "Active authority"],
    ["privacy_classification", "Privacy"],
  ];
  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-neutral-400">
            <tr>
              {headers.map(([key, title]) => (
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
                    className="flex items-center gap-2"
                    onClick={() => {
                      setSort({
                        key,
                        direction: sort.key === key ? -sort.direction : 1,
                      });
                      setPage(1);
                    }}
                  >
                    {title}
                    <ArrowUpDown aria-hidden="true" className="h-3 w-3" />
                  </button>
                </th>
              ))}
              <th>
                <span className="sr-only">Open record</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.slice((current - 1) * 25, current * 25).map((p) => (
              <tr
                key={p.id}
                className="border-t border-neutral-800 hover:bg-white/[.025]"
              >
                <td className="p-4 font-bold">
                  <button
                    className="text-left text-orange-300 hover:underline"
                    onClick={() => onOpen(p)}
                  >
                    {label(p)}
                  </button>
                </td>
                <td>{p.email || "—"}</td>
                <td>{p.status || "—"}</td>
                <td>{authority(p) || "None"}</td>
                <td>{p.privacy_classification || "—"}</td>
                <td>
                  <button
                    aria-label={`Open ${label(p)}`}
                    onClick={() => onOpen(p)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <nav
        aria-label="People pagination"
        className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-800 p-4 text-sm"
      >
        <span>
          {sorted.length
            ? `${(current - 1) * 25 + 1}–${Math.min(current * 25, sorted.length)} of ${sorted.length}`
            : "0 records"}{" "}
          · 25 per page
        </span>
        <div className="flex items-center gap-3">
          <button
            disabled={current === 1}
            onClick={() => setPage(current - 1)}
            className="rounded border border-neutral-700 px-3 py-1 disabled:opacity-40"
          >
            Previous
          </button>
          <label>
            Page{" "}
            <select
              aria-label="Page"
              value={current}
              onChange={(e) => setPage(Number(e.target.value))}
              className="rounded border border-neutral-700 bg-black p-1"
            >
              {Array.from({ length: pages }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>{" "}
            of {pages}
          </label>
          <button
            disabled={current === pages}
            onClick={() => setPage(current + 1)}
            className="rounded border border-neutral-700 px-3 py-1 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </nav>
    </>
  );
}
function ObjectTable({
  rows,
  onOpen,
}: {
  rows: any[];
  onOpen: (r: any) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-neutral-500">
          <tr>
            <th className="p-4">Record</th>
            <th>Code</th>
            <th>Status</th>
            <th>Type / Level</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              onClick={() => onOpen(r)}
              className="cursor-pointer border-t border-neutral-800 hover:bg-white/[.025]"
            >
              <td className="p-4 font-bold">
                {r.name || r.legal_name || r.id}
              </td>
              <td>{r.code || "—"}</td>
              <td>{r.status || "—"}</td>
              <td>
                {r.program_type ||
                  r.competitive_level ||
                  r.organization_type ||
                  "—"}
              </td>
              <td>
                <ChevronRight className="h-4 w-4 text-neutral-600" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function RecordDrawer({
  record,
  entity,
  assignments,
  audit,
  roles,
  busy,
  error,
  onMutate,
  onClose,
}: {
  record: any;
  entity: string;
  assignments: any[];
  audit: any[];
  roles: Map<any, any>;
  busy: boolean;
  error: string;
  onMutate: (b: any) => Promise<boolean>;
  onClose: () => void;
}) {
  const props = Object.entries(record).filter(([k]) => !k.startsWith("__"));
  const fields: Record<string, string[]> = {
    organization: ["name", "legal_name", "organization_type", "status"],
    site: [
      "code",
      "name",
      "address_line1",
      "city",
      "region",
      "postal_code",
      "country_code",
      "timezone",
      "status",
    ],
    program: ["code", "name", "program_type", "status"],
    season: ["code", "name", "starts_on", "ends_on", "status"],
    team: ["code", "name", "competitive_level", "status"],
  };
  const editable = props.filter(([key]) =>
    (fields[entity] || []).includes(key),
  );
  const [editing, setEditing] = useState(false),
    [draft, setDraft] = useState<any>({}),
    [confirmArchive, setConfirmArchive] = useState(false);
  function begin() {
    setDraft(Object.fromEntries(editable.map(([k, v]) => [k, v ?? ""])));
    setEditing(true);
  }
  async function save() {
    const changes: any = {};
    for (const [k, v] of editable)
      if (String(draft[k] ?? "") !== String(v ?? ""))
        changes[k] = draft[k] === "" ? null : draft[k];
    if (Object.keys(changes).length)
      if (
        !(await onMutate({
          action: "update-master-record",
          entity,
          id: record.id,
          changes,
        }))
      )
        return;
    setEditing(false);
  }
  return (
    <AdminDrawerShell
      title={record.__audit ? "Club activity" : record.name || "Club record"}
      recordStatus={record.status}
      busy={busy}
      onClose={onClose}
    >
      {error && (
        <p
          role="alert"
          className="mb-4 rounded border border-red-700 p-3 text-red-300"
        >
          {error}
        </p>
      )}
      <div className="org-record-workspace">
        <header className="sticky top-0 z-10 flex items-start justify-between border-b border-neutral-800 bg-[#070909]/95 p-5 backdrop-blur">
          <div>
            <div className="text-[9px] font-black uppercase tracking-[.18em] text-[#FA4616]">
              {record.__audit ? "Audit record" : "Club record"}
            </div>
            <h2 className="mt-1 text-2xl font-black">
              {record.name || label(record) || record.action || record.id}
            </h2>
            <div className="mt-1 text-xs text-neutral-500">{record.id}</div>
          </div>
          <div className="flex gap-2">
            {!record.__audit && (
              <>
                {editing ? (
                  <>
                    <button
                      disabled={busy}
                      onClick={save}
                      className="rounded-lg bg-[#FA4616] px-3 py-2 text-xs font-black text-black"
                    >
                      Save
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => setEditing(false)}
                      className="rounded-lg border border-neutral-700 px-3 py-2 text-xs"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    disabled={busy}
                    onClick={begin}
                    className="rounded-lg bg-[#FA4616] px-3 py-2 text-xs font-black text-black"
                  >
                    Edit
                  </button>
                )}
                {String(record.status).toLowerCase() === "active" ? (
                  entity === "organization" &&
                  !record.parent_organization_id ? (
                    <span className="rounded-lg border border-neutral-800 px-3 py-2 text-xs text-neutral-600">
                      Main club cannot be archived
                    </span>
                  ) : (
                    <button
                      disabled={busy}
                      onClick={() => setConfirmArchive(true)}
                      className="rounded-lg border border-red-800 px-3 py-2 text-xs font-bold text-red-300"
                    >
                      Archive
                    </button>
                  )
                ) : (
                  <button
                    disabled={busy}
                    onClick={() =>
                      onMutate({
                        action: "update-master-record",
                        entity,
                        id: record.id,
                        changes: { status: "active" },
                      })
                    }
                    className="rounded-lg border border-neutral-600 px-3 py-2 text-xs font-bold"
                  >
                    Reactivate
                  </button>
                )}
              </>
            )}
            <button
              disabled={busy}
              onClick={onClose}
              className="rounded-lg border border-neutral-700 p-2"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>
        <div className="grid gap-4 p-4 xl:grid-cols-[minmax(220px,1fr)_minmax(260px,1.3fr)_minmax(200px,1fr)]">
          <section className="border-b border-neutral-800 p-5 lg:border-b-0 lg:border-r">
            <div className="mb-4 text-xs font-black uppercase tracking-wider text-neutral-500">
              Properties
            </div>
            <div className="space-y-3">
              {props.map(([k, v]) => (
                <div
                  key={k}
                  className="rounded-lg border border-neutral-800 bg-black p-3"
                >
                  <div className="text-[9px] uppercase tracking-wider text-neutral-600">
                    {k.replaceAll("_", " ")}
                  </div>
                  {editing && editable.some(([x]) => x === k) ? (
                    <input
                      disabled={busy}
                      type={
                        k.endsWith("_on") || k === "birth_date"
                          ? "date"
                          : k === "email"
                            ? "email"
                            : "text"
                      }
                      value={draft[k] ?? ""}
                      onChange={(e) =>
                        setDraft((d: any) => ({ ...d, [k]: e.target.value }))
                      }
                      className="mt-1 w-full rounded border border-neutral-700 bg-[#080909] px-2 py-1.5 text-sm"
                    />
                  ) : (
                    <div className="mt-1 break-words text-sm">
                      {v == null
                        ? "—"
                        : typeof v === "object"
                          ? JSON.stringify(v)
                          : String(v)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
          <section className="border-b border-neutral-800 p-5 lg:border-b-0 lg:border-r">
            <div className="mb-4 text-xs font-black uppercase tracking-wider text-neutral-500">
              Activity & lifecycle
            </div>
            {confirmArchive && (
              <div className="my-4 rounded border border-red-700 p-3 text-sm">
                <p>Archive this record? Its history will be retained.</p>
                <div className="mt-3 flex gap-2">
                  <button
                    disabled={busy}
                    onClick={() =>
                      void onMutate({
                        action: "archive-master-record",
                        entity,
                        id: record.id,
                      })
                    }
                    className="rounded bg-red-700 px-3 py-2"
                  >
                    Confirm archive
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => setConfirmArchive(false)}
                    className="rounded border border-[#30363D] px-3 py-2"
                  >
                    Keep record
                  </button>
                </div>
              </div>
            )}
            <p className="text-sm text-neutral-500">
              Changes recorded for this record.
            </p>
            <div className="mt-5 space-y-3">
              {audit.map((event: any) => (
                <div
                  key={event.id}
                  className="rounded border border-neutral-700 bg-[#161B22] p-4"
                >
                  <div className="font-semibold">
                    {String(event.action || "Record changed").replaceAll(
                      "_",
                      " ",
                    )}
                  </div>
                  <div className="mt-1 text-xs text-[#627188]">
                    {event.occurred_at
                      ? new Date(event.occurred_at).toLocaleString()
                      : "Time unavailable"}
                  </div>
                </div>
              ))}
              {!audit.length && (
                <div className="rounded border border-neutral-700 bg-[#161B22] p-5 text-sm text-[#627188]">
                  No recorded activity for this record.
                </div>
              )}
            </div>
          </section>
          <section className="p-5">
            <div className="mb-4 text-xs font-black uppercase tracking-wider text-neutral-500">
              Roles and linked records
            </div>
            {assignments.length ? (
              assignments.map((a) => (
                <div
                  key={a.id}
                  className="mb-2 rounded-lg border border-neutral-800 p-3 text-sm"
                >
                  <b>
                    {roles.get(a.role_definition_id) || a.role_definition_id}
                  </b>
                  <div className="text-xs text-neutral-500">
                    {scopeLabel(a)} · {a.status}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-neutral-500">
                No direct role assignments on this record.
              </p>
            )}
          </section>
        </div>
      </div>
    </AdminDrawerShell>
  );
}
function Assign({
  people,
  roles,
  organizationId,
  busy,
  onAssign,
}: {
  people: any[];
  roles: any[];
  organizationId: string;
  busy: boolean;
  onAssign: (p: string, r: string) => void;
}) {
  const [p, setP] = useState(""),
    [r, setR] = useState("");
  return (
    <div className="mt-5 grid gap-2 border-t border-neutral-800 pt-4 md:grid-cols-[1fr_1fr_auto]">
      <h3 className="font-semibold md:col-span-3">Assign a responsibility</h3>
      <select
        aria-label="Staff person"
        value={p}
        onChange={(e) => setP(e.target.value)}
        className="rounded-lg border border-neutral-700 bg-black p-2 text-sm"
      >
        <option value="">Select person</option>
        {people.map((x) => (
          <option key={x.id} value={x.id}>
            {label(x)}
          </option>
        ))}
      </select>
      <select
        aria-label="Staff responsibility"
        value={r}
        onChange={(e) => setR(e.target.value)}
        className="rounded-lg border border-neutral-700 bg-black p-2 text-sm"
      >
        <option value="">Select staff role</option>
        {roles.map((x) => (
          <option key={x.id} value={x.id}>
            {x.name}
          </option>
        ))}
      </select>
      <button
        disabled={busy || !p || !r || !organizationId}
        onClick={() => onAssign(p, r)}
        className="rounded-lg bg-[#FA4616] px-4 py-2 text-sm font-bold text-black disabled:opacity-40"
      >
        Assign role
      </button>
      {r && (
        <p className="text-sm text-neutral-300 md:col-span-3">
          {roles.find((x) => x.id === r)?.description ||
            roles.find((x) => x.id === r)?.name}{" "}
          · Access applies across this club.
        </p>
      )}
    </div>
  );
}

function CreateRecord({
  domain,
  busy,
  error,
  onClose,
  onCreate,
}: {
  domain: Domain;
  busy: boolean;
  error: string;
  onClose: () => void;
  onCreate: (v: any) => void;
}) {
  const [v, setV] = useState<any>({ status: "active" });
  const fields: Record<Domain, string[]> = {
    people: [
      "first_name",
      "last_name",
      "preferred_name",
      "email",
      "phone",
      "birth_date",
    ],
    sites: [
      "code",
      "name",
      "address_line1",
      "city",
      "region",
      "postal_code",
      "country_code",
      "timezone",
    ],
    programs: ["code", "name", "program_type"],
    seasons: ["code", "name", "starts_on", "ends_on"],
    teams: ["code", "name", "competitive_level"],
  };
  return (
    <AdminDrawerShell
      title={`Add ${domain === "people" ? "person" : domain.slice(0, -1)}`}
      busy={busy}
      onClose={onClose}
    >
      {error && (
        <p
          role="alert"
          className="mb-4 rounded border border-red-700 p-3 text-red-300"
        >
          {error}
        </p>
      )}
      <fieldset disabled={busy}>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {fields[domain].map((k) => (
            <label key={k} className="text-xs text-neutral-400">
              {k.replaceAll("_", " ")}
              <input
                type={k.includes("date") || k.endsWith("_on") ? "date" : "text"}
                value={v[k] || ""}
                onChange={(e) => setV({ ...v, [k]: e.target.value })}
                className="mt-1 w-full rounded-lg border border-neutral-700 bg-black px-3 py-2 text-white"
              />
            </label>
          ))}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-neutral-700 px-4 py-2 text-sm"
          >
            Cancel
          </button>
          <button
            disabled={busy}
            onClick={() => onCreate(v)}
            className="rounded-lg bg-[#FA4616] px-4 py-2 text-sm font-black text-black disabled:opacity-40"
          >
            Create & save
          </button>
        </div>
      </fieldset>
    </AdminDrawerShell>
  );
}

function State({ title, text }: { title: string; text: string }) {
  return (
    <div className="p-6 text-white">
      <h1 className="text-2xl font-black">{title}</h1>
      <p className="mt-3 text-neutral-400">{text}</p>
    </div>
  );
}
export default OrganizationArchitecture;
