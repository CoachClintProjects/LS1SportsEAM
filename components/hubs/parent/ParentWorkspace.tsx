"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authenticatedFetch } from "@/lib/client/authenticatedFetch";
import { parentNavigation, overlappingEvents } from "@/lib/parent/policy";
import { AdminDrawerShell } from "@/components/hubs/admin/AdminDrawerShell";
type Row = Record<string, any>;
const control =
  "mt-1 w-full rounded border border-neutral-600 bg-[#161B22] p-2 text-white";
const button =
  "rounded bg-blue-700 px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40";
const name = (p: Row) =>
  [p?.preferred_name || p?.first_name, p?.last_name].filter(Boolean).join(" ");
const label = (v: string) => String(v || "Not recorded").replaceAll("_", " ");
const date = (v: string, tz?: string) =>
  v
    ? new Date(v).toLocaleString(
        undefined,
        tz ? { timeZone: tz, timeZoneName: "short" } : undefined,
      )
    : "Not scheduled";
const amount = (v: number, c: string) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: c.trim(),
  }).format(Number(v));
function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-neutral-700 bg-[#0A0C10] p-5">
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-3 text-sm text-neutral-400">{children}</p>;
}
export default function ParentWorkspace() {
  const router = useRouter(),
    params = useSearchParams(),
    rawView = params.get("view") || "household",
    view =
      (
        {
          accounts: "financial",
          invoices: "financial",
          payments: "financial",
          compliance: "documents",
          registration: "athletes",
          tasks: "household",
          transport: "schedule",
        } as Record<string, string>
      )[rawView] || rawView,
    guardian = params.get("guardian") || "";
  const [data, setData] = useState<Row | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [child, setChild] = useState(""),
    [sport, setSport] = useState(""),
    [club, setClub] = useState(""),
    [drawer, setDrawer] = useState<Row | null>(null),
    [values, setValues] = useState<Row>({});
  const lock = useRef(false),
    requestId = useRef("");
  const query = guardian ? `?guardian=${encodeURIComponent(guardian)}` : "";
  const load = useCallback(
    async (signal?: AbortSignal) => {
      const r = await authenticatedFetch("/api/parent" + query, {
        cache: "no-store",
        signal,
      });
      const j = await r.json();
      if (!r.ok) throw Error(j.error);
      setData(j);
    },
    [query],
  );
  useEffect(() => {
    const c = new AbortController();
    setData(null);
    setDrawer(null);
    setError("");
    load(c.signal).catch((e) => {
      if (e.name !== "AbortError") setError(e.message);
    });
    return () => c.abort();
  }, [load]);
  useEffect(() => {
    const refresh = () => load().catch((e) => setError(e.message));
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [load]);
  const go = (next: string) => {
    const q = new URLSearchParams(params.toString());
    q.set("view", next);
    router.push("/parent?" + q.toString());
  };
  const open = (d: Row) => {
    setError("");
    setValues(
      d.kind === "contact"
        ? {
            phone: data?.viewer?.phone || "",
            phone_secondary: data?.viewer?.phone_secondary || "",
          }
        : {},
    );
    requestId.current = crypto.randomUUID();
    setDrawer(d);
  };
  async function action(
    action: string,
    athleteId: string,
    organizationId: string,
    id: string,
    payload: Row,
  ) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const r = await authenticatedFetch("/api/parent" + query, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          athleteId,
          organizationId,
          id,
          values: payload,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw Error(j.error);
      setDrawer(null);
      setNotice("Saved.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  if (!data)
    return (
      <main className="p-8 text-white">
        <h1 className="text-2xl font-bold">Parent workspace</h1>
        <p role={error ? "alert" : "status"} className="mt-4">
          {error || "Loading your family…"}
        </p>
        {error && (
          <button
            className={button}
            onClick={() => {
              setError("");
              load().catch((e) => setError(e.message));
            }}
          >
            Retry
          </button>
        )}
      </main>
    );
  const athletes = data.athletes.filter(
    (a: Row) =>
      (!child || a.id === child) &&
      (!sport || a.sportIds?.includes(sport)) &&
      (!club ||
        data.memberships.some(
          (m: Row) =>
            m.athlete_id === a.id &&
            data.teams.some(
              (t: Row) => t.id === m.team_id && t.organization_id === club,
            ),
        ) ||
        (!child && !sport && !club)),
  );
  const athleteIds = athletes.map((a: Row) => a.id),
    childName = (id: string) =>
      name(data.athletes.find((a: Row) => a.id === id)?.person),
    clubName = (id: string) =>
      data.organizations.find((o: Row) => o.id === id)?.name || "Club",
    sportName = (id: string) =>
      data.sports.find((s: Row) => s.id === id)?.name || "Sport not assigned";
  const orgsFor = (id: string) =>
    data.organizations.filter(
      (o: Row) =>
        data.memberships.some(
          (m: Row) =>
            m.athlete_id === id &&
            data.teams.some(
              (t: Row) => t.id === m.team_id && t.organization_id === o.id,
            ),
        ) ||
        data.registrations.some(
          (r: Row) => r.athlete_id === id && r.organization_id === o.id,
        ),
    );
  const allowed = (id: string, scope: string) =>
    !data.readOnly &&
    data.grants.some(
      (g: Row) => g.athlete_id === id && g.scopes.includes(scope),
    );
  const competitions = data.competitions.filter(
    (c: Row) =>
      athleteIds.includes(c.athlete_id) &&
      (!sport || c.sport_id === sport) &&
      (!club || c.organization_id === club),
  );
  const events = data.events.filter(
    (e: Row) =>
      e.athleteIds.some((id: string) => athleteIds.includes(id)) &&
      (!sport || e.sport_id === sport) &&
      (!club || e.organization_id === club),
  );
  const calendar = [
    ...events,
    ...competitions.map((c: Row) => ({
      ...c,
      id: `competition:${c.id}`,
      title: c.name,
      athleteIds: [c.athlete_id],
      event_type: c.competition_type,
    })),
  ];
  const conflicts = overlappingEvents(calendar);
  const pending = competitions.filter(
    (c: Row) =>
      c.response?.invitation_status === "notified" &&
      c.response.response_status === "awaiting_response",
  );
  const docs = data.documents.filter((d: Row) =>
    athletes.some((a: Row) => a.person_id === d.owner_person_id),
  );
  const waivers = data.waivers.filter(
    (w: Row) =>
      athleteIds.includes(w.athlete_id) &&
      (!club || w.organization_id === club),
  );
  const actionScope = drawer?.kind === "upload" ? "parent.documents" : drawer?.kind === "contact" ? "parent.contact" : drawer?.requestKind === "billing" ? "parent.finance" : "parent.read";
  const actionAthletes = athletes.filter((a: Row) => allowed(a.id, actionScope));
  const visibleInvoices = data.invoices.filter((i: Row) => (!club || i.organization_id === club) && i.athleteIds?.some((id: string) => athleteIds.includes(id)));
  const selectedAthlete =
      drawer?.athleteId || values.athleteId || actionAthletes[0]?.id || "",
    selectedOrg =
      drawer?.organizationId ||
      values.organizationId ||
      orgsFor(selectedAthlete)[0]?.id ||
      "";
  const request = (kind: string, athleteId?: string, organizationId?: string) =>
    open({ kind: "request", requestKind: kind, athleteId, organizationId });
  const picker = (
    <>
      <label className="block">
        Athlete
        <select
          className={control}
          value={selectedAthlete}
          disabled={!!drawer?.athleteId}
          onChange={(e) =>
            setValues({
              ...values,
              athleteId: e.target.value,
              organizationId: "",
            })
          }
        >
          {actionAthletes.map((a: Row) => (
            <option key={a.id} value={a.id}>
              {name(a.person)}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        Club
        <select
          className={control}
          value={selectedOrg}
          disabled={!!drawer?.organizationId}
          onChange={(e) =>
            setValues({ ...values, organizationId: e.target.value })
          }
        >
          {orgsFor(selectedAthlete).map((o: Row) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </label>
    </>
  );
  function exportCalendar() {
    const escape = (s: string) =>
      String(s || "")
        .replaceAll("\\", "\\\\")
        .replaceAll("\n", "\\n")
        .replaceAll(",", "\\,")
        .replaceAll(";", "\\;");
    const stamp = (s: string) =>
      new Date(s)
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}/, "");
    const unique = [
      ...new Map(
        calendar
          .filter((e: Row) => e.starts_at && e.ends_at)
          .map((e: Row) => [e.id, e]),
      ).values(),
    ] as Row[];
    const text = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//LS1Sports//Family calendar//EN",
      ...unique.flatMap((e) => [
        "BEGIN:VEVENT",
        `UID:${escape(e.id)}@ls1sports`,
        `DTSTAMP:${stamp(new Date().toISOString())}`,
        `DTSTART:${stamp(e.starts_at)}`,
        `DTEND:${stamp(e.ends_at)}`,
        `SUMMARY:${escape(e.title)}`,
        `DESCRIPTION:${escape(clubName(e.organization_id))}`,
        "END:VEVENT",
      ]),
      "END:VCALENDAR",
    ].join("\r\n");
    const url = URL.createObjectURL(
      new Blob([text], { type: "text/calendar" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "family-calendar.ics";
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <main className="mx-auto max-w-[1500px] p-5 text-white lg:p-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-orange-300">
            Parent ·{" "}
            {data.families.map((f: Row) => f.name).join(" / ") || "My family"}
          </p>
          <h1 className="mt-1 text-3xl font-bold">
            {parentNavigation.find(([id]) => id === view)?.[1] || "Home"}
          </h1>
          <p className="mt-2 text-sm text-neutral-400">
            Your children, their sports and what needs your attention.
          </p>
        </div>
        <button
          className={button}
          disabled={busy}
          onClick={() => load().catch((e) => setError(e.message))}
        >
          Refresh
        </button>
      </header>
      {(data.previewGuardians.length > 0 || data.readOnly) && (
        <label className="my-4 block text-sm">
          Superuser preview · read-only
          <select
            className={control}
            value={guardian}
            onChange={(e) => router.push("/parent?guardian=" + e.target.value)}
          >
            <option value="">My own parent access</option>
            {data.previewGuardians.map((p: Row) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {error && (
        <p
          role="alert"
          className="my-4 rounded border border-red-700 p-3 text-red-200"
        >
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="my-3 text-emerald-300">
          {notice}
        </p>
      )}
      {data.setupRequired ? (
        <div className="mt-6">
          <Card title="No athletes linked to this account">
            <p className="text-sm text-neutral-300">
              Your club administrator must link your guardian email and grant
              Parent portal access for each athlete. Emergency contact details
              alone do not grant access.
            </p>
            <p className="mt-3 text-sm text-neutral-400">
              Organization Admin: open the athlete → edit the saved
              parent/guardian → Parent portal access. No family records are
              selected automatically.
            </p>
          </Card>
        </div>
      ) : (
        <>
          <div className="my-6 flex flex-wrap gap-4">
            {[
              [
                "Child",
                child,
                setChild,
                [
                  { id: "", name: "All children" },
                  ...data.athletes.map((a: Row) => ({
                    id: a.id,
                    name: name(a.person),
                  })),
                ],
              ],
              [
                "Sport",
                sport,
                setSport,
                [
                  { id: "", name: "All sports" },
                  ...data.sports.filter((s: Row) =>
                    data.athletes.some((a: Row) => a.sportIds?.includes(s.id)),
                  ),
                ],
              ],
              [
                "Club",
                club,
                setClub,
                [{ id: "", name: "All clubs" }, ...data.organizations],
              ],
            ].map(([title, value, setter, options]: any) => (
              <label key={title} className="min-w-44 text-sm">
                {title}
                <select
                  className={control}
                  value={value}
                  onChange={(e) => setter(e.target.value)}
                >
                  {options.map((o: Row) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          {view === "household" && (
            <div className="grid gap-5 lg:grid-cols-2">
              <Card title="Needs your response">
                {pending.map((c: Row) => (
                  <button
                    key={`${c.id}:${c.athlete_id}`}
                    className="mb-2 block w-full rounded border border-neutral-600 p-3 text-left"
                    onClick={() => go("competitions")}
                  >
                    {childName(c.athlete_id)} · {c.name}
                    <span className="block text-sm text-orange-300">
                      Participation response needed
                    </span>
                  </button>
                ))}
                {waivers
                  .filter(
                    (w: Row) => !["completed", "waived"].includes(w.status),
                  )
                  .map((w: Row) => (
                    <button
                      key={w.id}
                      onClick={() => go("documents")}
                      className="mb-2 block w-full rounded border border-neutral-600 p-3 text-left"
                    >
                      {childName(w.athlete_id)} ·{" "}
                      {w.definition?.name || "Assigned waiver"}
                      <span className="block text-sm text-orange-300">
                        {label(w.status)}
                      </span>
                    </button>
                  ))}
                {!pending.length &&
                  !waivers.some(
                    (w: Row) => !["completed", "waived"].includes(w.status),
                  ) && (
                    <Empty>
                      No unanswered invitations or open waivers in this view.
                      Registration and competition clearance are shown
                      separately.
                    </Empty>
                  )}
              </Card>
              <Card title="Coming up">
                {calendar
                  .sort(
                    (a: Row, b: Row) =>
                      Date.parse(a.starts_at) - Date.parse(b.starts_at),
                  )
                  .slice(0, 6)
                  .map((e: Row, i: number) => (
                    <div
                      key={`${e.id}:${i}`}
                      className="mb-3 border-b border-neutral-700 pb-3"
                    >
                      <b>{e.title}</b>
                      <p className="text-sm text-neutral-300">
                        {date(e.starts_at, e.timezone)} ·{" "}
                        {sportName(e.sport_id)}
                      </p>
                      <p className="text-sm text-neutral-400">
                        {e.athleteIds.map(childName).join(", ")} ·{" "}
                        {clubName(e.organization_id)}
                      </p>
                    </div>
                  ))}
                {!calendar.length && (
                  <Empty>
                    No upcoming activities are published for these athletes.
                  </Empty>
                )}
                <button className={button} onClick={() => go("schedule")}>
                  Open calendar
                </button>
              </Card>
              <Card title="Fees and payments">
                {visibleInvoices
                  .filter(
                    (i: Row) =>
                      Number(i.balance_due) > 0 &&
                      (!club || i.organization_id === club),
                  )
                  .map((i: Row) => (
                    <p key={i.id} className="mb-2">
                      {clubName(i.organization_id)} · {i.invoice_number} ·{" "}
                      {amount(i.balance_due, i.currency)}
                    </p>
                  ))}
                <button className={button} onClick={() => go("financial")}>
                  Review fees
                </button>
              </Card>
              <Card title="Requests with the club">
                {data.requests
                  .filter((r: Row) => athleteIds.includes(r.payload.athlete_id))
                  .slice(0, 5)
                  .map((r: Row) => (
                    <p className="mb-2" key={r.id}>
                      {r.payload.title} · {label(r.status)}
                    </p>
                  ))}
                <button className={button} onClick={() => go("messages")}>
                  Open messages & requests
                </button>
              </Card>
            </div>
          )}
          {view === "athletes" && (
            <div className="grid gap-5 md:grid-cols-2">
              {athletes.map((a: Row) => (
                <Card key={a.id} title={name(a.person)}>
                  <p className="text-sm text-neutral-300">
                    {a.athlete_number || "Athlete"} · {label(a.athlete_status)}
                  </p>
                  <p className="mt-2">
                    {a.sportIds?.map(sportName).join(" · ") ||
                      "Sport not assigned"}
                  </p>
                  {data.memberships
                    .filter((m: Row) => m.athlete_id === a.id)
                    .map((m: Row) => {
                      const t = data.teams.find((t: Row) => t.id === m.team_id);
                      return (
                        <p key={m.id} className="mt-2 text-sm">
                          {t?.name} · {clubName(t?.organization_id)}
                        </p>
                      );
                    })}
                  <button
                    className={button + " mt-4"}
                    onClick={() => open({ kind: "athlete", athleteId: a.id })}
                  >
                    Open athlete
                  </button>
                </Card>
              ))}
            </div>
          )}
          {view === "schedule" && (
            <Card title="Family calendar">
              <div className="mb-4 flex gap-3">
                <button className={button} onClick={exportCalendar}>
                  Add to my calendar (.ics)
                </button>
                <button
                  className={button}
                  disabled={data.readOnly}
                  onClick={() => request("absence")}
                >
                  Report an absence
                </button>
              </div>
              {calendar.map((e: Row, i: number) => (
                <article
                  key={`${e.id}:${i}`}
                  className="mb-3 rounded border border-neutral-700 p-4"
                >
                  <h3 className="font-semibold">
                    {e.title} · {label(e.status)}
                  </h3>
                  <p>
                    {date(e.starts_at, e.timezone)} –{" "}
                    {date(e.ends_at, e.timezone)}
                  </p>
                  <p className="text-sm text-neutral-400">
                    {e.athleteIds.map(childName).join(", ")} ·{" "}
                    {sportName(e.sport_id)} · {clubName(e.organization_id)}
                    {e.timezone ? ` · ${e.timezone}` : ""}
                  </p>
                  {conflicts.has(e.id) && (
                    <p className="text-amber-300">
                      Overlaps another family activity.
                    </p>
                  )}
                </article>
              ))}
              {!calendar.length && (
                <Empty>No activities published for this view.</Empty>
              )}
            </Card>
          )}
          {view === "competitions" && (
            <div className="space-y-4">
              {competitions.map((c: Row) => (
                <Card
                  key={`${c.id}:${c.athlete_id}`}
                  title={`${c.name} · ${childName(c.athlete_id)}`}
                >
                  <p>
                    {sportName(c.sport_id)} · {label(c.competition_type)} ·{" "}
                    {clubName(c.organization_id)}
                  </p>
                  <p className="text-sm text-neutral-400">
                    {date(c.starts_at, c.timezone)}
                  </p>
                  <p
                    className={`my-3 ${c.assessment.status === "Eligible" ? "text-emerald-300" : "text-amber-300"}`}
                  >
                    {c.assessment.status}
                  </p>
                  {c.assessment.reason && (
                    <p className="text-sm">{c.assessment.reason}</p>
                  )}
                  {c.assessment.checks.map((x: Row, i: number) => (
                    <p key={i} className="text-sm">
                      {x.name}: {label(x.status)}
                      {x.reason ? ` — ${x.reason}` : ""}
                    </p>
                  ))}
                  {c.response ? (
                    <>
                      <p className="my-3">
                        Your response: {label(c.response.response_status)}
                      </p>
                      <div className="flex gap-3">
                        {[
                          ["going", "Attending"],
                          ["not_going", "Not attending"],
                        ].map(([response, title]) => (
                          <button
                            key={response}
                            disabled={
                              busy ||
                              !allowed(c.athlete_id, "parent.respond") ||
                              c.response.invitation_status !== "notified"
                            }
                            className={button}
                            onClick={() =>
                              action(
                                "respond",
                                c.athlete_id,
                                c.organization_id,
                                c.response.id,
                                {
                                  response,
                                  expected_updated_at: c.response.updated_at,
                                },
                              )
                            }
                          >
                            {title}
                          </button>
                        ))}
                        {c.response.metadata?.parent_mode === "nomination" && (
                          <button
                            disabled={!allowed(c.athlete_id, "parent.respond")}
                            className={button}
                            onClick={() =>
                              request(
                                "nomination",
                                c.athlete_id,
                                c.organization_id,
                              )
                            }
                          >
                            Request event entries
                          </button>
                        )}
                      </div>
                      <p className="mt-3 text-sm text-neutral-400">
                        Confirming attendance does not enter the athlete or
                        establish eligibility. Staff review entry requests.
                      </p>
                    </>
                  ) : (
                    <Empty>
                      No invitation addressed to you. Contact the team manager
                      to request participation.
                    </Empty>
                  )}
                </Card>
              ))}
              {!competitions.length && (
                <Empty>
                  No competitions match this athlete, sport and club selection.
                </Empty>
              )}
            </div>
          )}
          {view === "financial" && (
            <div className="space-y-4">
              <p className="text-sm text-neutral-400">
                Only accounts covered by your billing authority are shown.
                Balances remain separate by club and currency. Online card
                payment is not configured.
              </p>
              {visibleInvoices
                .filter((i: Row) => !club || i.organization_id === club)
                .map((i: Row) => (
                  <Card
                    key={i.id}
                    title={`${clubName(i.organization_id)} · ${i.invoice_number}`}
                  >
                    <p>
                      {label(i.status)} · Due {i.due_date} · Balance{" "}
                      {amount(i.balance_due, i.currency)}
                    </p>
                    {data.invoiceLines
                      .filter((l: Row) => l.invoice_id === i.id)
                      .map((l: Row) => (
                        <p className="mt-2 text-sm" key={l.id}>
                          {l.description} · {amount(l.line_total, i.currency)}
                        </p>
                      ))}
                    <button
                      className={button + " mt-3"}
                      disabled={data.readOnly}
                      onClick={() =>
                        request("billing", i.athleteIds?.find((id: string) => athleteIds.includes(id)), i.organization_id)
                      }
                    >
                      Ask Treasurer about this invoice
                    </button>
                  </Card>
                ))}
              {!visibleInvoices.length && (
                <Empty>
                  No invoices available under your billing permissions. This
                  does not establish financial clearance.
                </Empty>
              )}
            </div>
          )}
          {view === "documents" && (
            <div className="space-y-4">
              <button
                className={button}
                disabled={
                  data.readOnly ||
                  !athletes.some((a: Row) => allowed(a.id, "parent.documents"))
                }
                onClick={() => open({ kind: "upload" })}
              >
                Upload document
              </button>
              {waivers.map((w: Row) => (
                <Card
                  key={w.id}
                  title={`${childName(w.athlete_id)} · ${w.definition?.name || "Waiver"}`}
                >
                  <p>
                    {label(w.status)} · Due {date(w.due_at)}
                  </p>
                  {w.template ? (
                    <button
                      className={button + " mt-3"}
                      disabled={
                        !allowed(w.athlete_id, "parent.sign") ||
                        !["assigned", "pending", "required", "open"].includes(
                          w.status,
                        )
                      }
                      onClick={() =>
                        open({
                          kind: "waiver",
                          athleteId: w.athlete_id,
                          organizationId: w.organization_id,
                          waiver: w,
                        })
                      }
                    >
                      Read and sign
                    </button>
                  ) : (
                    <Empty>
                      The club has not published matching waiver text for
                      signing.
                    </Empty>
                  )}
                </Card>
              ))}
              {docs.map((d: Row) => {
                const a = athletes.find(
                  (a: Row) => a.person_id === d.owner_person_id,
                );
                return (
                  <Card key={d.id} title={d.title}>
                    <p>
                      {name(a.person)} · {label(d.verification_status)}
                      {d.expires_at ? ` · Expires ${date(d.expires_at)}` : ""}
                    </p>
                    <button
                      className={button + " mt-3"}
                      onClick={async () => {
                        try {
                          const r = await authenticatedFetch(
                            `/api/parent-document?athleteId=${a.id}&id=${d.id}${guardian ? "&guardian=" + guardian : ""}`,
                          );
                          const j = await r.json();
                          if (!r.ok) throw Error(j.error);
                          window.open(j.url, "_blank", "noopener,noreferrer");
                        } catch (e) {
                          setError(
                            e instanceof Error
                              ? e.message
                              : "Unable to open file",
                          );
                        }
                      }}
                    >
                      Open document
                    </button>
                  </Card>
                );
              })}
              {!waivers.length && !docs.length && (
                <Empty>
                  No forms or documents are available under your permissions.
                </Empty>
              )}
            </div>
          )}
          {view === "messages" && (
            <div className="space-y-4">
              <button
                className={button}
                disabled={data.readOnly}
                onClick={() => request("message")}
              >
                Contact the club
              </button>
              {data.messages
                .filter((m: Row) => athleteIds.includes(m.athlete_id))
                .map((m: Row) => (
                  <Card key={m.id} title={m.title}>
                    <p className="whitespace-pre-wrap">{m.body}</p>
                    <p className="mt-2 text-sm text-neutral-400">
                      {childName(m.athlete_id)} · {date(m.created_at)}
                    </p>
                  </Card>
                ))}
              <Card title="Your requests">
                {data.requests
                  .filter((r: Row) => athleteIds.includes(r.payload.athlete_id))
                  .map((r: Row) => (
                    <article
                      key={r.id}
                      className="mb-4 border-b border-neutral-700 pb-3"
                    >
                      <b>{r.payload.title}</b>
                      <p>
                        {childName(r.payload.athlete_id)} · {label(r.status)} ·
                        With {label(r.payload.assigned_role)}
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-300">
                        {r.payload.description}
                      </p>
                      {r.payload.parent_reply && (
                        <p className="mt-2">
                          Club reply: {r.payload.parent_reply}
                        </p>
                      )}
                    </article>
                  ))}
                {!data.requests.length && <Empty>No submitted requests.</Empty>}
              </Card>
            </div>
          )}
          {view === "volunteer" && (
            <div className="space-y-4">
              <p className="text-sm text-neutral-400">
                Sign-ups are requests pending club review; they do not grant
                clearance or award hours.
              </p>
              {data.opportunities
                .filter((o: Row) => !club || o.organization_id === club)
                .map((o: Row) => {
                  const assignment = data.volunteer.find(
                    (v: Row) =>
                      v.opportunity_id === o.id &&
                      !["cancelled", "declined"].includes(v.status),
                  );
                  const athlete = athletes.find((a: Row) =>
                    orgsFor(a.id).some(
                      (org: Row) => org.id === o.organization_id,
                    ),
                  );
                  return (
                    <Card key={o.id} title={o.title}>
                      <p>
                        {clubName(o.organization_id)} · {date(o.starts_at)}
                      </p>
                      <p>
                        {assignment
                          ? `Your status: ${label(assignment.status)}`
                          : `Capacity: ${o.capacity ?? "Not specified"}`}
                      </p>
                      <button
                        className={button + " mt-3"}
                        disabled={busy || data.readOnly || !athlete}
                        onClick={() =>
                          action(
                            assignment ? "volunteer_cancel" : "volunteer_join",
                            athlete.id,
                            o.organization_id,
                            o.id,
                            {},
                          )
                        }
                      >
                        {assignment ? "Cancel my request" : "Request a place"}
                      </button>
                    </Card>
                  );
                })}
              <Card title="Recorded volunteering">
                {data.volunteer.map((v: Row) => (
                  <p key={v.id}>
                    {label(v.status)} · Credits recorded:{" "}
                    {v.credits_awarded ?? 0}
                    {v.completed_at ? ` · ${date(v.completed_at)}` : ""}
                  </p>
                ))}
                {!data.opportunities.length && (
                  <Empty>No open volunteer opportunities published.</Empty>
                )}
              </Card>
            </div>
          )}
          {view === "members" && (
            <Card title="My contact details & access">
              <p>
                {name(data.viewer)} · {data.viewer?.email}
              </p>
              <p>{data.viewer?.phone || "No telephone recorded"}</p>
              <button
                className={button + " mt-3"}
                disabled={
                  data.readOnly ||
                  !athletes.some((a: Row) => allowed(a.id, "parent.contact"))
                }
                onClick={() => open({ kind: "contact" })}
              >
                Edit my telephone details
              </button>
              <button
                className={button + " ml-3 mt-3"}
                disabled={data.readOnly}
                onClick={() => request("family_access")}
              >
                Request family access change
              </button>
              {athletes.map((a: Row) => (
                <div
                  key={a.id}
                  className="mt-4 border-t border-neutral-700 pt-3"
                >
                  <b>{name(a.person)}</b>
                  <p className="text-sm text-neutral-400">
                    {data.grants
                      .filter((g: Row) => g.athlete_id === a.id)
                      .flatMap((g: Row) => g.scopes)
                      .map((s: string) => label(s.replace("parent.", "")))
                      .join(" · ")}
                  </p>
                </div>
              ))}
            </Card>
          )}
        </>
      )}
      {drawer && (
        <AdminDrawerShell
          title={
            drawer.kind === "athlete"
              ? childName(drawer.athleteId)
              : drawer.kind === "waiver"
                ? "Read and sign waiver"
                : drawer.kind === "upload"
                  ? "Upload document"
                  : drawer.kind === "contact"
                    ? "My telephone details"
                    : "Send request to club"
          }
          busy={busy}
          onClose={() => setDrawer(null)}
        >
          {error && (
            <p role="alert" className="mb-4 text-red-300">
              {error}
            </p>
          )}
          {drawer.kind === "athlete" && (
            <div className="space-y-5">
              <Card title="Athlete record">
                <p>{childName(drawer.athleteId)}</p>
                <p className="text-sm">
                  {
                    data.athletes.find((a: Row) => a.id === drawer.athleteId)
                      ?.person.birth_date
                  }
                </p>
                <button
                  className={button + " mt-3"}
                  disabled={data.readOnly}
                  onClick={() => request("identity", drawer.athleteId)}
                >
                  Request a profile correction
                </button>
              </Card>
              <Card title="Programs, squads & registration">
                {data.registrations
                  .filter((r: Row) => r.athlete_id === drawer.athleteId)
                  .map((r: Row) => (
                    <div key={r.id} className="mb-3">
                      <p>
                        {data.programs.find((p: Row) => p.id === r.program_id)
                          ?.name || "Program"}{" "}
                        ·{" "}
                        {
                          data.seasons.find((s: Row) => s.id === r.season_id)
                            ?.name
                        }{" "}
                        · {label(r.status)}
                      </p>
                      {data.requirements
                        .filter(
                          (q: Row) =>
                            q.organization_id === r.organization_id &&
                            (!q.program_id || q.program_id === r.program_id) &&
                            (!q.season_id || q.season_id === r.season_id),
                        )
                        .map((q: Row) => (
                          <p className="text-sm text-neutral-300" key={q.id}>
                            {q.name}:{" "}
                            {label(
                              data.requirementStatus.find(
                                (s: Row) =>
                                  s.registration_id === r.id &&
                                  s.requirement_id === q.id,
                              )?.status || "not assessed",
                            )}
                          </p>
                        ))}
                    </div>
                  ))}
                <div className="flex flex-wrap gap-2">
                  <button
                    className={button}
                    disabled={data.readOnly}
                    onClick={() => request("registration", drawer.athleteId)}
                  >
                    Request program registration
                  </button>
                  <button
                    className={button}
                    disabled={data.readOnly}
                    onClick={() => request("squad_change", drawer.athleteId)}
                  >
                    Request squad change
                  </button>
                </div>
              </Card>
              <Card title="Competitions">
                {data.competitions
                  .filter((c: Row) => c.athlete_id === drawer.athleteId)
                  .map((c: Row) => (
                    <p className="mb-2" key={c.id}>
                      {c.name}: {c.assessment.status}
                    </p>
                  ))}
              </Card>
            </div>
          )}
          {drawer.kind === "request" && (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                action(
                  "request",
                  selectedAthlete,
                  selectedOrg,
                  requestId.current,
                  { kind: drawer.requestKind, description: values.description },
                );
              }}
            >
              <fieldset disabled={busy || data.readOnly} className="space-y-4">
                {picker}
                <p className="text-sm">Request: {label(drawer.requestKind)}</p>
                <label className="block">
                  Tell the club what you need
                  <textarea
                    required
                    minLength={3}
                    maxLength={4000}
                    rows={5}
                    className={control}
                    value={values.description || ""}
                    onChange={(e) =>
                      setValues({ ...values, description: e.target.value })
                    }
                  />
                </label>
                <button
                  className={button}
                  disabled={!selectedAthlete || !selectedOrg}
                >
                  Submit request
                </button>
              </fieldset>
            </form>
          )}
          {drawer.kind === "contact" && (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                action(
                  "contact",
                  selectedAthlete,
                  selectedOrg,
                  requestId.current,
                  { ...values, expected_updated_at: data.viewer.updated_at },
                );
              }}
            >
              <fieldset disabled={busy || data.readOnly} className="space-y-4">
                {picker}
                {[
                  ["phone", "Primary telephone"],
                  ["phone_secondary", "Alternate telephone"],
                ].map(([id, title]) => (
                  <label key={id} className="block">
                    {title}
                    <input
                      type="tel"
                      maxLength={100}
                      className={control}
                      value={values[id] || ""}
                      onChange={(e) =>
                        setValues({ ...values, [id]: e.target.value })
                      }
                    />
                  </label>
                ))}
                <button className={button}>Save changes</button>
              </fieldset>
            </form>
          )}
          {drawer.kind === "waiver" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const t = drawer.waiver.template;
                action("sign", selectedAthlete, selectedOrg, drawer.waiver.id, {
                  ...values,
                  agree: String(values.agree || false),
                  template_id: t.id,
                  template_updated_at: t.updated_at,
                  body: t.body_template,
                });
              }}
            >
              <fieldset disabled={busy || data.readOnly} className="space-y-4">
                <h3 className="font-semibold">
                  {drawer.waiver.definition.name} · Version{" "}
                  {drawer.waiver.definition.version}
                </h3>
                <p className="max-h-96 overflow-auto whitespace-pre-wrap rounded border border-neutral-600 p-4">
                  {drawer.waiver.template.body_template}
                </p>
                <label className="block">
                  Your full name
                  <input
                    required
                    minLength={3}
                    className={control}
                    value={values.signed_name || ""}
                    onChange={(e) =>
                      setValues({ ...values, signed_name: e.target.value })
                    }
                  />
                </label>
                <label className="flex gap-2">
                  <input
                    type="checkbox"
                    required
                    checked={!!values.agree}
                    onChange={(e) =>
                      setValues({ ...values, agree: e.target.checked })
                    }
                  />
                  I have read this version and agree on behalf of this athlete
                  under my authorized guardian role.
                </label>
                <button className={button}>Sign this waiver</button>
              </fieldset>
            </form>
          )}
          {drawer.kind === "upload" && (
            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                if (lock.current) return;
                lock.current = true;
                setBusy(true);
                setError("");
                const f = new FormData(e.currentTarget);
                f.set("athleteId", selectedAthlete);
                try {
                  const r = await authenticatedFetch(
                    "/api/parent-document" + query,
                    { method: "POST", body: f },
                  );
                  const j = await r.json();
                  if (!r.ok) throw Error(j.error);
                  setDrawer(null);
                  setNotice("Document uploaded for review.");
                  await load();
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Upload failed");
                } finally {
                  lock.current = false;
                  setBusy(false);
                }
              }}
            >
              <fieldset disabled={busy || data.readOnly} className="space-y-4">
                {picker}
                <label className="block">
                  Title
                  <input
                    name="title"
                    required
                    maxLength={200}
                    className={control}
                  />
                </label>
                <label className="block">
                  Document type
                  <select name="documentTypeId" required className={control}>
                    <option value="">Choose type</option>
                    {data.documentTypes.map((t: Row) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  PDF, PNG or JPEG · up to 4 MB
                  <input
                    name="file"
                    type="file"
                    required
                    accept="application/pdf,image/png,image/jpeg"
                    className={control}
                  />
                </label>
                <button className={button}>Upload for review</button>
              </fieldset>
            </form>
          )}
        </AdminDrawerShell>
      )}
    </main>
  );
}
