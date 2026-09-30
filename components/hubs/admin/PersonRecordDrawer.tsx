"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  X,
  Pencil,
  Phone,
  Mail,
  Users,
  Activity,
  ShieldCheck,
  CalendarDays,
  Building2,
} from "lucide-react";
import { authenticatedFetch } from "@/lib/client/authenticatedFetch";
const name = (p: any) =>
  [p?.preferred_name || p?.first_name, p?.last_name]
    .filter(Boolean)
    .join(" ") || "Unnamed person";
const human = (v: unknown) => String(v || "Not recorded").replaceAll("_", " ");
const date = (v: any) =>
  v
    ? new Date(
        String(v).length === 10 ? `${v}T12:00:00` : v,
      ).toLocaleDateString()
    : "Not recorded";
const fields: Record<string, [string, string, string?][]> = {
  identity: [
    ["first_name", "First name"],
    ["last_name", "Last name"],
    ["preferred_name", "Preferred name"],
    ["birth_date", "Date of birth", "date"],
  ],
  emergency: [
    ["name", "Contact name"],
    ["relationship", "Relationship"],
    ["phone_primary", "Primary telephone", "tel"],
    ["phone_secondary", "Alternate telephone", "tel"],
    ["email", "Email address", "email"],
  ],
  contact: [
    ["email", "Email address", "email"],
    ["phone", "Telephone", "tel"],
  ],
  medical: [
    ["allergies", "Allergies"],
    ["conditions", "Medical conditions"],
    ["medications", "Medications"],
    ["participation_restrictions", "Participation restrictions"],
    ["emergency_instructions", "Emergency instructions"],
    ["reviewed_on", "Reviewed on", "date"],
  ],
};
fields.profile = [...fields.identity, ...fields.contact];
function Card({
  title,
  children,
  edit,
}: {
  title: string;
  children: ReactNode;
  edit?: () => void;
}) {
  return (
    <section className="rounded-xl border border-[#41434a] bg-[#242529] p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {edit && (
          <button
            onClick={edit}
            className="flex items-center gap-1 rounded bg-blue-500/15 px-2 py-1 text-xs text-blue-200 hover:bg-blue-500/25"
          >
            <Pencil size={12} />
            Edit
          </button>
        )}
      </div>
      {children}
    </section>
  );
}
function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm leading-6 text-neutral-400">{children}</p>;
}
function Field({ label, value }: { label: string; value: any }) {
  return (
    <div className="mb-3 last:mb-0">
      <dt className="text-xs text-neutral-400">{label}</dt>
      <dd className="mt-1 break-words text-sm text-neutral-100">
        {value || "Not recorded"}
      </dd>
    </div>
  );
}
export default function PersonRecordDrawer({
  personId,
  role,
  onClose,
  onSaved,
}: {
  personId: string;
  role: string;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [tab, setTab] = useState("Overview"),
    [editing, setEditing] = useState<string | null>(null),
    [draft, setDraft] = useState<Record<string, string>>({}),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [contact, setContact] = useState<any>(null);
  const panel = useRef<HTMLElement>(null),
    close = useRef(onClose);
  close.current = onClose;
  const load = useCallback(
    async (signal?: AbortSignal) => {
      const r = await authenticatedFetch(
        `/api/admin-person-record?role=${encodeURIComponent(role)}&personId=${encodeURIComponent(personId)}`,
        { signal, cache: "no-store" },
      );
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Record unavailable.");
      setData(j);
    },
    [personId, role],
  );
  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setLoading(true);
    setError("");
    setEditing(null);
    load(controller.signal)
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [load]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null,
      overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    function key(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        close.current();
      }
      if (e.key === "Tab") {
        const nodes = Array.from(
          panel.current?.querySelectorAll<HTMLElement>(
            'button:not([disabled]),a[href],input,select,textarea,[tabindex="0"]',
          ) || [],
        ).filter((n) => n.getClientRects().length);
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (!first) {
          e.preventDefault();
          return;
        }
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === panel.current)
        ) {
          e.preventDefault();
          last.focus();
        } else if (
          !e.shiftKey &&
          (document.activeElement === last ||
            document.activeElement === panel.current)
        ) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, []);
  function begin(section: string, emergency: any = null) {
    setContact(emergency);
    setEditing(section);
    setNotice("");
    setError("");
    const source =
      section === "medical"
        ? data.medical
        : section === "emergency"
          ? emergency
          : data.person;
    setDraft(
      Object.fromEntries(
        fields[section].map(([key]) => [key, source?.[key] || ""]),
      ),
    );
  }
  async function save() {
    if (!editing) return;
    setBusy(true);
    setError("");
    const source =
      editing === "medical"
        ? data.medical
        : editing === "emergency"
          ? contact
          : data.person;
    const changes = Object.fromEntries(
      fields[editing]
        .filter(([key]) => (source?.[key] || "") !== draft[key])
        .map(([key]) => [key, draft[key]?.trim() || null]),
    );
    if (!Object.keys(changes).length) {
      setEditing(null);
      setBusy(false);
      return;
    }
    try {
      const r = await authenticatedFetch("/api/admin-person-record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          personId,
          section: editing,
          contactId: contact?.contact_id,
          expectedUpdatedAt: source?.updated_at || null,
          changes,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Save failed.");
      setEditing(null);
      await load();
      setNotice("Changes saved.");
      onSaved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }
  const p = data?.person,
    a = data?.athlete;
  const tabs = [
    "Overview",
    "Activity",
    "Registration",
    "Competitions",
    ...(data?.authorization.finance ? ["Fees"] : []),
    "Medical & Consent",
  ];
  return createPortal(
    <div
      className="fixed inset-0 z-[160] bg-black/65"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <aside
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="person-drawer-title"
        className="absolute right-0 top-0 flex h-full w-[min(1280px,94vw)] flex-col border-l border-[#41434a] bg-[#18191c] text-neutral-100 shadow-2xl outline-none"
        style={{ colorScheme: "dark" }}
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-orange-700 bg-[#c63812] px-5 py-3">
          <div>
            <p className="text-xs text-orange-100">
              {a ? "Athlete record" : "Person record"}
            </p>
            <h2 id="person-drawer-title" className="text-lg font-semibold">
              {p ? name(p) : "Loading record…"}
            </h2>
          </div>
          <div className="flex gap-2">
            {data?.authorization.edit && (
              <button
                onClick={() => begin("profile")}
                className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-[#a62d0b]"
              >
                Edit record
              </button>
            )}
            <button
              aria-label="Close record"
              onClick={onClose}
              className="rounded p-2 hover:bg-white/15"
            >
              <X size={20} />
            </button>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {loading && (
            <p role="status">Loading record and linked information…</p>
          )}
          {error && (
            <div
              role="alert"
              className="mb-4 rounded border border-red-700 bg-red-950 p-3 text-sm text-red-100"
            >
              {error}
              <button
                onClick={() => {
                  setError("");
                  load().catch((e) => setError(e.message));
                }}
                className="ml-3 underline"
              >
                Reload record
              </button>
            </div>
          )}
          {notice && (
            <p role="status" className="mb-4 text-sm text-emerald-300">
              {notice}
            </p>
          )}
          {data && (
            <div className="grid items-start gap-4 xl:grid-cols-[250px_minmax(0,1fr)_270px]">
              <div className="space-y-4">
                <Card
                  title={name(p)}
                  edit={
                    data.authorization.edit
                      ? () => begin("identity")
                      : undefined
                  }
                >
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-600/20 text-lg font-bold text-orange-200">
                      {p.first_name?.[0]}
                      {p.last_name?.[0]}
                    </div>
                    <div>
                      <p className="text-sm">
                        {a?.athlete_number || "Person record"}
                      </p>
                      <span className="text-xs text-emerald-300">
                        {human(a?.athlete_status || p.status)}
                      </span>
                    </div>
                  </div>
                  <dl>
                    <Field label="Date of birth" value={date(p.birth_date)} />
                    <Field label="Preferred name" value={p.preferred_name} />
                  </dl>
                </Card>
                <Card
                  title="Contact information"
                  edit={
                    data.authorization.edit ? () => begin("contact") : undefined
                  }
                >
                  <dl>
                    <Field
                      label="Email address"
                      value={
                        p.email ? (
                          <a
                            className="text-blue-300"
                            href={`mailto:${p.email}`}
                          >
                            {p.email}
                          </a>
                        ) : null
                      }
                    />
                    <Field
                      label="Telephone"
                      value={
                        p.phone ? (
                          <a className="text-blue-300" href={`tel:${p.phone}`}>
                            {p.phone}
                          </a>
                        ) : null
                      }
                    />
                  </dl>
                  <div className="mt-4 flex gap-2">
                    {p.email && (
                      <a
                        href={`mailto:${p.email}`}
                        className="flex items-center gap-1 rounded bg-blue-600 px-3 py-2 text-xs"
                      >
                        <Mail size={13} />
                        Email
                      </a>
                    )}
                    {p.phone && (
                      <a
                        href={`tel:${p.phone}`}
                        className="flex items-center gap-1 rounded bg-emerald-700 px-3 py-2 text-xs"
                      >
                        <Phone size={13} />
                        Call
                      </a>
                    )}
                  </div>
                </Card>
                <Card title="Program & season">
                  <dl>
                    <Field
                      label="Programs"
                      value={data.programs.map((x: any) => x.name).join(", ")}
                    />
                    <Field
                      label="Seasons"
                      value={data.seasons.map((x: any) => x.name).join(", ")}
                    />
                  </dl>
                </Card>
              </div>
              <div className="min-w-0 space-y-4">
                {editing && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      save();
                    }}
                    className="rounded-xl border border-blue-500 bg-[#242529] p-4"
                  >
                    <h3 className="mb-4 font-semibold">
                      Edit{" "}
                      {editing === "profile"
                        ? "record"
                        : editing === "medical"
                          ? "medical information"
                          : editing}
                    </h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {fields[editing].map(([key, title, type]) => (
                        <label key={key} className="text-xs text-neutral-300">
                          {title}
                          {editing === "medical" && !type ? (
                            <textarea
                              value={draft[key] || ""}
                              onChange={(e) =>
                                setDraft({ ...draft, [key]: e.target.value })
                              }
                              className="mt-1 min-h-20 w-full rounded border border-neutral-600 bg-[#18191c] p-2 text-sm text-white"
                            />
                          ) : (
                            <input
                              required={["first_name", "last_name"].includes(
                                key,
                              )}
                              type={type || "text"}
                              value={draft[key] || ""}
                              onChange={(e) =>
                                setDraft({ ...draft, [key]: e.target.value })
                              }
                              className="mt-1 w-full rounded border border-neutral-600 bg-[#18191c] p-2 text-sm text-white"
                            />
                          )}
                        </label>
                      ))}
                    </div>
                    <div className="mt-4 flex justify-end gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setEditing(null)}
                        className="rounded border border-neutral-500 px-3 py-2 text-sm"
                      >
                        Cancel
                      </button>
                      <button
                        disabled={busy}
                        className="rounded bg-emerald-700 px-4 py-2 text-sm font-semibold disabled:opacity-50"
                      >
                        {busy ? "Saving…" : "Save changes"}
                      </button>
                    </div>
                  </form>
                )}
                <div
                  role="tablist"
                  aria-label="Record sections"
                  className="flex flex-wrap gap-1 border-b border-neutral-700"
                >
                  {tabs.map((t) => (
                    <button
                      key={t}
                      role="tab"
                      aria-selected={tab === t}
                      onClick={() => setTab(t)}
                      className={`border-b-2 px-3 py-2 text-xs ${tab === t ? "border-orange-500 text-orange-300" : "border-transparent text-neutral-400"}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                {tab === "Overview" && (
                  <>
                    <Card title="At a glance">
                      <div className="grid grid-cols-2 gap-3">
                        <Field
                          label="Registration records"
                          value={String(data.registrations.length)}
                        />
                        <Field
                          label="Squad / team memberships"
                          value={String(
                            data.memberships.filter(
                              (m: any) => m.status === "active",
                            ).length,
                          )}
                        />
                        <Field
                          label="Linked competitions"
                          value={String(data.competitions.length)}
                        />
                        {data.authorization.finance && (
                          <Field
                            label="Outstanding invoices"
                            value={String(data.invoices.length)}
                          />
                        )}
                      </div>
                      <p className="mt-3 text-xs text-neutral-400">
                        Counts reflect linked records. Missing information does
                        not establish eligibility or clearance.
                      </p>
                    </Card>
                    <Card title="Needs attention">
                      {!data.registrations.length && a && (
                        <p className="mb-2 text-sm text-amber-200">
                          No registration linked to this athlete.
                        </p>
                      )}
                      {!data.guardians.length &&
                        !data.authorities.length &&
                        a && (
                          <p className="mb-2 text-sm text-amber-200">
                            No parent or guardian relationship recorded.
                          </p>
                        )}
                      {!data.emergency.length && a && (
                        <p className="mb-2 text-sm text-amber-200">
                          No emergency contact recorded.
                        </p>
                      )}
                      {data.invoices.length > 0 && (
                        <button
                          onClick={() => setTab("Fees")}
                          className="text-sm text-blue-300 underline"
                        >
                          Review outstanding fees
                        </button>
                      )}
                      {!a && <Empty>This person has no athlete record.</Empty>}
                    </Card>
                    <Card title="Recent activity">
                      {data.activity.slice(0, 5).map((x: any) => (
                        <div
                          key={x.id}
                          className="border-b border-neutral-700 py-2 text-sm"
                        >
                          <p>{human(x.action)}</p>
                          <p className="text-xs text-neutral-400">
                            {date(x.occurred_at)}
                          </p>
                        </div>
                      ))}
                      {!data.activity.length && (
                        <Empty>No activity available in this role.</Empty>
                      )}
                    </Card>
                  </>
                )}
                {tab === "Activity" && (
                  <Card title="Record activity">
                    {data.activity.map((x: any) => (
                      <div
                        key={x.id}
                        className="border-b border-neutral-700 py-3 text-sm"
                      >
                        <Activity size={14} className="mb-1 text-orange-300" />
                        {human(x.action)}
                        <p className="text-xs text-neutral-400">
                          {date(x.occurred_at)}
                        </p>
                      </div>
                    ))}
                    {!data.activity.length && (
                      <Empty>No activity available in this role.</Empty>
                    )}
                  </Card>
                )}
                {tab === "Registration" && (
                  <Card title="Registration history">
                    {data.registrations.map((r: any) => (
                      <dl
                        key={r.id}
                        className="mb-3 border-b border-neutral-700 pb-3"
                      >
                        <Field
                          label="Program"
                          value={
                            data.programs.find(
                              (p: any) => p.id === r.program_id,
                            )?.name
                          }
                        />
                        <Field
                          label="Season"
                          value={
                            data.seasons.find((s: any) => s.id === r.season_id)
                              ?.name
                          }
                        />
                        <Field label="Status" value={human(r.status)} />
                        <Field label="Submitted" value={date(r.submitted_at)} />
                      </dl>
                    ))}
                    {!data.registrations.length && (
                      <Empty>No registration linked to this record.</Empty>
                    )}
                  </Card>
                )}
                {tab === "Competitions" && (
                  <Card title="Competitions & entries">
                    {data.competitions.map((c: any) => (
                      <details
                        key={c.id}
                        className="mb-3 rounded border border-neutral-700 p-3"
                      >
                        <summary className="cursor-pointer text-sm font-semibold text-blue-200">
                          {c.name}
                        </summary>
                        <p className="mt-2 text-xs">
                          {date(c.starts_at)} · {human(c.status)}
                        </p>
                        <p className="mt-2 text-sm">
                          Response: {human(c.response)}
                        </p>
                        {c.entries.map((e: any) => (
                          <p key={e.id} className="mt-2 text-sm">
                            {e.name} · {human(e.entry_status)} · Eligibility:{" "}
                            {human(e.eligibility_status)}
                          </p>
                        ))}
                      </details>
                    ))}
                    {!data.competitions.length && (
                      <Empty>
                        No competition entries or invitations linked to this
                        athlete.
                      </Empty>
                    )}
                  </Card>
                )}
                {tab === "Fees" && data.authorization.finance && (
                  <Card title="Outstanding fees">
                    {data.invoices.map((i: any) => (
                      <details
                        key={i.id}
                        className="mb-3 rounded border border-neutral-700 p-3"
                      >
                        <summary className="cursor-pointer text-sm text-blue-200">
                          {i.invoice_number} · {i.currency}{" "}
                          {Number(i.balance_due).toFixed(2)}
                        </summary>
                        <dl className="mt-3">
                          <Field label="Billing account" value={i.account} />
                          <Field label="Due date" value={date(i.due_date)} />
                          <Field
                            label="Invoice status"
                            value={human(i.status)}
                          />
                        </dl>
                        <p className="text-xs text-neutral-400">
                          Family accounts can cover more than one athlete.
                        </p>
                      </details>
                    ))}
                    {!data.invoices.length && (
                      <Empty>
                        No outstanding invoices linked to this person or family
                        account.
                      </Empty>
                    )}
                  </Card>
                )}
                {tab === "Medical & Consent" && (
                  <>
                    <Card
                      title="Medical information"
                      edit={
                        a && data.authorization.editMedical
                          ? () => begin("medical")
                          : undefined
                      }
                    >
                      {data.authorization.medical ? (
                        <>
                          {data.medical ? (
                            <dl>
                              {fields.medical.map(([k, n]) => (
                                <Field
                                  key={k}
                                  label={n}
                                  value={
                                    k === "reviewed_on"
                                      ? date(data.medical[k])
                                      : data.medical[k]
                                  }
                                />
                              ))}
                            </dl>
                          ) : (
                            <Empty>
                              No medical information recorded. This does not
                              mean there are no medical conditions.
                            </Empty>
                          )}
                        </>
                      ) : (
                        <Empty>
                          Medical information is restricted in this role.
                        </Empty>
                      )}
                    </Card>
                    <Card title="Consents">
                      {data.consents.map((c: any) => (
                        <div key={c.id} className="mb-3 text-sm">
                          <ShieldCheck size={15} className="text-emerald-300" />
                          {c.name || "Consent"}
                          <p className="text-xs text-neutral-400">
                            {c.revoked_at
                              ? `Revoked ${date(c.revoked_at)}`
                              : `Granted ${date(c.granted_at)}`}
                          </p>
                        </div>
                      ))}
                      {!data.consents.length && (
                        <Empty>No consent records linked.</Empty>
                      )}
                    </Card>
                  </>
                )}
              </div>
              <div className="space-y-4">
                <Card title="Parents & guardians">
                  {[
                    ...data.authorities,
                    ...data.guardians.filter(
                      (g: any) =>
                        !data.authorities.some(
                          (a: any) => a.person_id === g.person_id,
                        ),
                    ),
                  ].map((g: any) => (
                    <div
                      key={g.person_id}
                      className="mb-3 border-b border-neutral-700 pb-3"
                    >
                      <p className="text-sm font-semibold">{name(g.person)}</p>
                      <p className="text-xs text-neutral-400">
                        {human(g.relationship_type)}
                      </p>
                      {g.person.email && (
                        <a
                          className="mt-1 block break-all text-xs text-blue-300"
                          href={`mailto:${g.person.email}`}
                        >
                          {g.person.email}
                        </a>
                      )}
                      {g.person.phone && (
                        <a
                          className="mt-1 block text-xs text-blue-300"
                          href={`tel:${g.person.phone}`}
                        >
                          {g.person.phone}
                        </a>
                      )}
                    </div>
                  ))}
                  {!data.guardians.length && !data.authorities.length && (
                    <Empty>No relationships recorded.</Empty>
                  )}
                </Card>
                <Card
                  title="Emergency contacts"
                  edit={
                    a && data.authorization.edit
                      ? () => begin("emergency")
                      : undefined
                  }
                >
                  {data.emergency.map((c: any) => (
                    <div key={c.contact_id} className="mb-3 text-sm">
                      <p className="font-semibold">
                        {data.authorization.edit && (
                          <button
                            aria-label={`Edit emergency contact ${c.name}`}
                            onClick={() => begin("emergency", c)}
                            className="float-right text-blue-300"
                          >
                            <Pencil size={13} />
                          </button>
                        )}
                        {c.name}
                        {c.is_primary ? " · Primary" : ""}
                      </p>
                      <p className="text-xs text-neutral-400">
                        {human(c.relationship)}
                      </p>
                      {c.phone_primary && (
                        <a
                          className="text-blue-300"
                          href={`tel:${c.phone_primary}`}
                        >
                          {c.phone_primary}
                        </a>
                      )}
                      <p className="text-xs text-neutral-400">
                        Pickup authorized: {c.can_pickup ? "Yes" : "No"}
                      </p>
                    </div>
                  ))}
                  {!data.emergency.length && (
                    <Empty>No emergency contacts recorded.</Empty>
                  )}
                </Card>
                <Card title="Squad & coach">
                  {data.teams.map((t: any) => (
                    <div key={t.id} className="mb-3">
                      <p className="flex items-center gap-2 text-sm font-semibold">
                        <Users size={14} />
                        {t.name}
                      </p>
                      {data.coaches
                        .filter((c: any) => c.team_id === t.id)
                        .map((c: any) => (
                          <p
                            key={c.id}
                            className="mt-1 text-xs text-neutral-300"
                          >
                            {name(c.person)} ·{" "}
                            {c.is_head_coach ? "Head coach" : human(c.role_key)}
                          </p>
                        ))}
                    </div>
                  ))}
                  {!data.teams.length && (
                    <Empty>No team or squad assigned.</Empty>
                  )}
                </Card>
                <Card title="Training facilities">
                  {data.bookings.map((b: any) => (
                    <div
                      key={b.id}
                      className="mb-3 border-b border-neutral-700 pb-3"
                    >
                      <p className="flex items-center gap-2 text-sm">
                        <Building2 size={14} />
                        {b.facility?.name}
                      </p>
                      <p className="mt-1 text-xs text-neutral-400">
                        {
                          data.sites.find(
                            (s: any) => s.id === b.facility?.site_id,
                          )?.name
                        }
                      </p>
                      <p className="mt-1 flex items-center gap-1 text-xs">
                        <CalendarDays size={12} />
                        {date(b.starts_at)} · {human(b.status)}
                      </p>
                    </div>
                  ))}
                  {!data.bookings.length && (
                    <Empty>
                      No upcoming facility bookings linked to the athlete’s
                      team.
                    </Empty>
                  )}
                </Card>
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>,
    document.body,
  );
}
