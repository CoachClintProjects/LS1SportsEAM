"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { authenticatedFetch } from "@/lib/client/authenticatedFetch";
const input =
  "mt-1 w-full rounded border border-neutral-600 bg-[#18191c] p-2 text-sm text-white";
export default function RecordWorkPanel({
  tab,
  record,
  role,
  onChanged,
}: {
  tab: string;
  record: any;
  role: string;
  onChanged: () => void;
}) {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [title, setTitle] = useState(""),
    [description, setDescription] = useState(""),
    [due, setDue] = useState(""),
    [notice, setNotice] = useState(""),
    [documentLink, setDocumentLink] = useState<{
      id: string;
      url: string;
    } | null>(null),
    [values, setValues] = useState<Record<string, string>>({}),
    [operation, setOperation] = useState("team_add");
  const personId = record.person.id;
  const taskRequest = useRef<string | null>(null);
  const load = useCallback(
    async (signal?: AbortSignal) => {
      const r = await authenticatedFetch(
        `/api/admin-record-work?role=${encodeURIComponent(role)}&personId=${personId}&section=${encodeURIComponent(tab)}`,
        { cache: "no-store", signal },
      );
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setData(j);
    },
    [personId, role, tab],
  );
  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError("");
    setValues({});
    setNotice("");
    load(controller.signal).catch((e) => {
      if (e.name !== "AbortError") setError(e.message);
    });
    return () => controller.abort();
  }, [load]);
  async function action(
    kind: string,
    operation: string,
    values: any = {},
    id?: string,
  ) {
    if (busy) return;
    if (kind === "task" && operation === "create")
      taskRequest.current ||= crypto.randomUUID();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const r = await authenticatedFetch("/api/admin-record-work", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          personId,
          kind,
          operation,
          values,
          id: id || taskRequest.current || crypto.randomUUID(),
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      if (kind === "task" && operation === "create") taskRequest.current = null;
      await load();
      onChanged();
      setNotice("Saved.");
      setTitle("");
      setDescription("");
      setValues({});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }
  async function reviewDocument(
    e: React.FormEvent<HTMLFormElement>,
    document: any,
  ) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const r = await authenticatedFetch("/api/admin-record-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          personId,
          id: document.id,
          expectedVersion: document.current_version,
          expectedStatus: document.verification_status,
          status: form.get("status"),
          reason: form.get("reason"),
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      await load();
      onChanged();
      setNotice(
        "Document review saved. Registration approval remains a separate decision.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Review failed.");
    } finally {
      setBusy(false);
    }
  }
  async function upload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    form.set("role", role);
    form.set("personId", personId);
    setBusy(true);
    setError("");
    try {
      const r = await authenticatedFetch("/api/admin-record-document", {
        method: "POST",
        body: form,
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      await load();
      onChanged();
      setNotice("Document uploaded.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }
  async function download(id: string) {
    setError("");
    try {
      const r = await authenticatedFetch(
        `/api/admin-record-document?role=${encodeURIComponent(role)}&personId=${personId}&id=${id}`,
        { cache: "no-store" },
      );
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setDocumentLink({ id, url: j.url });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to open document.");
    }
  }
  if (!data)
    return (
      <div className="rounded border border-neutral-700 p-4 text-sm">
        {error || "Loading record operations…"}
      </div>
    );
  const choice = (
    key: string,
    label: string,
    options: any[],
    getName = (x: any) => x.name,
  ) => (
    <label className="block text-xs text-neutral-300">
      {label}
      <select
        required
        value={values[key] || ""}
        onChange={(e) => setValues({ ...values, [key]: e.target.value })}
        className={input}
      >
        <option value="">Select {label.toLowerCase()}</option>
        {options.map((x) => (
          <option key={x.id} value={x.id}>
            {getName(x)}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <section className="space-y-4 rounded-xl border border-neutral-700 bg-[#242529] p-4">
      {error && (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm text-emerald-300">
          {notice}
        </p>
      )}
      {tab === "Activity & Tasks" && (
        <>
          <h3 className="font-semibold">Record tasks</h3>
          {data.authorization.createTask && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                action("task", "create", {
                  title,
                  description,
                  due_at: due ? new Date(due).toISOString() : null,
                });
              }}
              className="space-y-3"
            >
              <label className="block text-xs">
                Task
                <input
                  required
                  maxLength={300}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={input}
                />
              </label>
              <label className="block text-xs">
                Details
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className={input}
                />
              </label>
              <label className="block text-xs">
                Due
                <input
                  type="datetime-local"
                  value={due}
                  onChange={(e) => setDue(e.target.value)}
                  className={input}
                />
              </label>
              <button
                disabled={busy}
                className="rounded bg-orange-600 px-3 py-2 text-sm"
              >
                Add task
              </button>
            </form>
          )}
          {data.tasks.map((t: any) => (
            <article key={t.id} className="border-t border-neutral-600 pt-3">
              <h4 className="text-sm font-semibold">{t.payload?.title}</h4>
              <p className="mt-1 text-xs text-neutral-400">
                {t.status} · {t.payload?.assigned_role?.replaceAll("_", " ")}
                {t.payload?.due_at
                  ? ` · Due ${new Date(t.payload.due_at).toLocaleString()}`
                  : ""}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm">
                {t.payload?.description}
              </p>
              {data.authorization.updateTask && (
                <div className="mt-2 flex gap-2">
                  {["open", "in_progress"].includes(t.status) ? (
                    <>
                      <button
                        disabled={busy}
                        onClick={() => action("task", "complete", {}, t.id)}
                        className="rounded bg-emerald-700 px-3 py-1 text-xs"
                      >
                        Complete
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => action("task", "cancel", {}, t.id)}
                        className="rounded border border-red-500 px-3 py-1 text-xs text-red-200"
                      >
                        Cancel task
                      </button>
                    </>
                  ) : (
                    <button
                      disabled={busy}
                      onClick={() => action("task", "reopen", {}, t.id)}
                      className="rounded bg-blue-700 px-3 py-1 text-xs"
                    >
                      Reopen
                    </button>
                  )}
                </div>
              )}
            </article>
          ))}
          {!data.tasks.length && (
            <p className="text-sm text-neutral-400">
              No tasks linked to this record in your role.
            </p>
          )}
        </>
      )}
      {tab === "Documents" && (
        <>
          <h3 className="font-semibold">Documents</h3>
          {!data.authorization.documents ? (
            <p className="text-sm text-neutral-400">
              Document access is restricted to authorized Organization
              Administrator and Registrar roles.
            </p>
          ) : (
            <>
              {data.documents.map((d: any) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between gap-3 border-b border-neutral-600 py-3"
                >
                  <div>
                    <p className="text-sm">{d.title}</p>
                    {data.authorization.reviewDocuments && (
                      <form
                        className="mt-3 space-y-2"
                        onSubmit={(e) => reviewDocument(e, d)}
                      >
                        <label className="block text-xs">
                          Review decision
                          <select name="status" required className={input}>
                            <option value="">Select decision</option>
                            <option value="verified">Verified</option>
                            <option value="rejected">Rejected</option>
                            <option value="pending">Return for review</option>
                          </select>
                        </label>
                        <label className="block text-xs">
                          Review evidence / reason
                          <textarea name="reason" required className={input} />
                        </label>
                        <button
                          disabled={busy}
                          className="rounded bg-emerald-700 px-3 py-2 text-xs text-white"
                        >
                          Save review
                        </button>
                      </form>
                    )}
                    <p className="text-xs text-neutral-400">
                      {d.verification_status || "Not verified"}
                      {d.expires_at
                        ? ` · Expires ${new Date(d.expires_at).toLocaleDateString()}`
                        : ""}
                    </p>
                  </div>
                  {documentLink && documentLink.id === d.id ? (
                    <a
                      href={documentLink.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded bg-blue-700 px-3 py-1 text-xs"
                      onClick={() => setDocumentLink(null)}
                    >
                      Open document
                    </a>
                  ) : (
                    <button
                      onClick={() => download(d.id)}
                      className="rounded bg-blue-700 px-3 py-1 text-xs"
                    >
                      Prepare secure link
                    </button>
                  )}
                </div>
              ))}
              {!data.documents.length && (
                <p className="text-sm text-neutral-400">
                  No documents attached.
                </p>
              )}
              {data.authorization.upload && (
                <form
                  onSubmit={upload}
                  className="space-y-3 border-t border-neutral-700 pt-4"
                >
                  <label className="block text-xs">
                    Document title
                    <input
                      required
                      name="title"
                      maxLength={200}
                      className={input}
                    />
                  </label>
                  <label className="block text-xs">
                    Document type
                    <select required name="documentTypeId" className={input}>
                      <option value="">Select type</option>
                      {data.documentTypes.map((d: any) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs">
                    File (PDF, PNG, JPEG or text; up to 10 MB)
                    <input
                      required
                      name="file"
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg,.txt"
                      className={input}
                    />
                  </label>
                  <button
                    disabled={busy || !data.documentTypes.length}
                    className="rounded bg-orange-600 px-3 py-2 text-sm"
                  >
                    Upload document
                  </button>
                  {!data.documentTypes.length && (
                    <p className="text-xs text-amber-200">
                      Document types must be configured before uploading.
                    </p>
                  )}
                </form>
              )}
            </>
          )}
        </>
      )}
      {tab === "Competitions" && (
        <>
          <h3 className="font-semibold">Eligibility & deadlines</h3>
          {record.competitions.map((competition: any) => {
            const eligibility = data.eligibility.find(
              (e: any) => e.competition_id === competition.id,
            );
            const expired =
              eligibility?.expires_at &&
              new Date(eligibility.expires_at).getTime() < Date.now();
            const deadlines = data.deadlines.filter(
              (d: any) =>
                d.competition_id === competition.id &&
                !["cancelled", "completed"].includes(d.status),
            );
            return (
              <article
                key={competition.id}
                className="space-y-2 border-t border-neutral-600 pt-3"
              >
                <h4 className="text-sm font-semibold">{competition.name}</h4>
                <p
                  className={`text-sm ${!eligibility || expired || ["blocked", "ineligible"].includes(eligibility.status) ? "text-amber-200" : "text-neutral-200"}`}
                >
                  Eligibility:{" "}
                  {expired
                    ? "Assessment expired — review required"
                    : eligibility?.status || "Not assessed"}
                </p>
                {eligibility?.reason && (
                  <p className="text-xs text-neutral-400">
                    {eligibility.reason}
                  </p>
                )}
                {deadlines.map((d: any) => (
                  <p key={d.id} className="text-sm">
                    {d.name} · {new Date(d.due_at).toLocaleString()} ·{" "}
                    {d.status}
                  </p>
                ))}
                {!deadlines.length && (
                  <p className="text-xs text-neutral-400">
                    No open deadlines recorded.
                  </p>
                )}
              </article>
            );
          })}
          {!record.competitions.length && (
            <p className="text-sm text-neutral-400">
              No linked competitions. An empty list does not establish
              eligibility.
            </p>
          )}
        </>
      )}
      {tab === "Registration" && (
        <>
          <h3 className="font-semibold">Manage registration</h3>
          {data.authorization.createRegistration && (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                action("registration", "create", values);
              }}
            >
              {choice("program_id", "Program", data.programOptions)}
              {choice("season_id", "Season", data.seasonOptions)}
              <button
                disabled={busy}
                className="rounded bg-orange-600 px-3 py-2 text-sm"
              >
                Submit registration
              </button>
            </form>
          )}
          {data.authorization.reviewRequirements &&
            record.registrations
              .filter((r: any) =>
                ["submitted", "pending", "under_review"].includes(r.status),
              )
              .map((r: any) => (
                <div
                  key={`checks-${r.id}`}
                  className="space-y-3 border-t border-neutral-600 pt-3"
                >
                  <h4 className="text-sm font-semibold">
                    Registration checks ·{" "}
                    {
                      data.programOptions.find(
                        (p: any) => p.id === r.program_id,
                      )?.name
                    }
                  </h4>
                  {data.requirements
                    .filter(
                      (q: any) =>
                        (!q.program_id || q.program_id === r.program_id) &&
                        (!q.season_id || q.season_id === r.season_id) &&
                        (!q.valid_from ||
                          q.valid_from <=
                            new Date().toISOString().slice(0, 10)) &&
                        (!q.valid_until ||
                          q.valid_until >=
                            new Date().toISOString().slice(0, 10)),
                    )
                    .map((q: any) => {
                      const status = data.requirementStatus.find(
                        (x: any) =>
                          x.registration_id === r.id &&
                          x.requirement_id === q.id,
                      );
                      return (
                        <form
                          key={q.id}
                          className="space-y-2 rounded border border-neutral-600 p-3"
                          onSubmit={(e) => {
                            e.preventDefault();
                            const f = new FormData(e.currentTarget);
                            action("requirement", "review", {
                              registration_id: r.id,
                              requirement_id: q.id,
                              expected_status: status?.status ?? null,
                              expected_satisfied_at:
                                status?.satisfied_at ?? null,
                              document_id: f.get("document"),
                              reason: f.get("reason"),
                            });
                          }}
                        >
                          <p className="text-sm">
                            {q.name} · {q.required ? "Required" : "Optional"} ·{" "}
                            {status?.status || "Not reviewed"}
                          </p>
                          <label className="block text-xs">
                            Verified evidence
                            <select required name="document" className={input}>
                              <option value="">Select evidence</option>
                              {data.documents
                                .filter(
                                  (d: any) =>
                                    d.verification_status === "verified" &&
                                    (!d.expires_at ||
                                      new Date(d.expires_at).getTime() >
                                        Date.now()),
                                )
                                .map((d: any) => (
                                  <option key={d.id} value={d.id}>
                                    {d.title}
                                  </option>
                                ))}
                            </select>
                          </label>
                          <label className="block text-xs">
                            Review reason
                            <textarea
                              required
                              name="reason"
                              className={input}
                            />
                          </label>
                          <button
                            disabled={busy}
                            className="rounded bg-emerald-700 px-3 py-2 text-xs"
                          >
                            Confirm requirement met
                          </button>
                        </form>
                      );
                    })}
                </div>
              ))}
          {data.authorization.decideRegistration &&
            record.registrations.map((r: any) => {
              const transitions = [
                "submitted",
                "pending",
                "under_review",
              ].includes(r.status)
                ? ["approved", "rejected", "cancelled"]
                : r.status === "approved"
                  ? ["cancelled"]
                  : ["rejected", "cancelled"].includes(r.status)
                    ? ["submitted"]
                    : [];
              if (!transitions.length) return null;
              return (
                <form
                  key={r.id}
                  className="space-y-3 border-t border-neutral-600 pt-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const form = new FormData(e.currentTarget);
                    action("registration", "transition", {
                      id: r.id,
                      expected_status: r.status,
                      status: form.get("status"),
                      reason: form.get("reason"),
                    });
                  }}
                >
                  <p className="text-sm">
                    {data.programOptions.find((p: any) => p.id === r.program_id)
                      ?.name || "Registration"}{" "}
                    ·{" "}
                    {
                      data.seasonOptions.find((p: any) => p.id === r.season_id)
                        ?.name
                    }{" "}
                    · {r.status}
                  </p>
                  <label className="block text-xs">
                    Decision
                    <select required name="status" className={input}>
                      <option value="">Select decision</option>
                      {transitions.map((status) => (
                        <option key={status} value={status}>
                          {status === "submitted"
                            ? "Resubmit"
                            : status === "approved"
                              ? "Approve"
                              : status === "rejected"
                                ? "Reject"
                                : "Cancel registration"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs">
                    Reason
                    <textarea required name="reason" className={input} />
                  </label>
                  <button
                    disabled={busy}
                    className="rounded bg-blue-700 px-3 py-2 text-sm"
                  >
                    Save decision
                  </button>
                </form>
              );
            })}
          {!data.authorization.createRegistration &&
            !data.authorization.decideRegistration && (
              <p className="text-sm text-neutral-400">
                Your role can view registration history below.
              </p>
            )}
        </>
      )}
      {tab === "Relationships" && (
        <>
          <h3 className="font-semibold">Manage relationships & lifecycle</h3>
          {!record.athlete ? (
            <p className="text-sm text-neutral-400">
              An athlete record is required.
            </p>
          ) : !data.authorization.relationships ? (
            <p className="text-sm text-neutral-400">
              Relationship changes require Organization Administrator access.
            </p>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                action("relationship", operation, values);
              }}
              className="space-y-3"
            >
              <label className="block text-xs">
                Action
                <select
                  value={operation}
                  onChange={(e) => {
                    setOperation(e.target.value);
                    setValues({});
                  }}
                  className={input}
                >
                  {[
                    ...(data.authorization.coaches
                      ? [
                          ["coach_add", "Assign squad coach"],
                          ["coach_remove", "End squad coach assignment"],
                        ]
                      : []),
                    ["team_add", "Add to squad / team"],
                    ["team_remove", "End squad membership"],
                    ["guardian_link", "Add / update guardian contact"],
                    ["guardian_remove", "Remove guardian contact"],
                    ["athlete_inactivate", "Deactivate athlete"],
                    ["athlete_reactivate", "Reactivate athlete"],
                  ].map(([v, n]) => (
                    <option key={v} value={v}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              {operation.startsWith("coach_") && (
                <>
                  {choice("team_id", "Squad", record.teams)}
                  <p className="text-xs text-amber-200">
                    This changes coaching access for the entire squad, including
                    its other athletes.
                  </p>
                  {operation === "coach_add" ? (
                    <>
                      {choice(
                        "coach_person_id",
                        "Coach",
                        data.coachOptions,
                        (p) =>
                          [p.preferred_name || p.first_name, p.last_name]
                            .filter(Boolean)
                            .join(" "),
                      )}
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={values.is_head_coach === "true"}
                          onChange={(e) =>
                            setValues({
                              ...values,
                              is_head_coach: String(e.target.checked),
                            })
                          }
                        />
                        Head coach
                      </label>
                    </>
                  ) : (
                    choice(
                      "assignment_id",
                      "Coach assignment",
                      record.coaches.filter(
                        (c: any) => c.team_id === values.team_id,
                      ),
                      (c) =>
                        [c.person.first_name, c.person.last_name].join(" "),
                    )
                  )}
                </>
              )}
              {operation === "team_add" &&
                choice("team_id", "Team", data.teamOptions)}
              {operation === "team_remove" &&
                choice(
                  "membership_id",
                  "Membership",
                  record.memberships.filter((m: any) => m.status === "active"),
                  (m) =>
                    record.teams.find((t: any) => t.id === m.team_id)?.name ||
                    m.membership_type,
                )}
              {operation === "guardian_link" && (
                <>
                  {choice(
                    "person_id",
                    "Person",
                    data.peopleOptions.filter((p: any) => p.id !== personId),
                    (p) =>
                      [p.preferred_name || p.first_name, p.last_name]
                        .filter(Boolean)
                        .join(" "),
                  )}
                  <label className="block text-xs">
                    Relationship
                    <input
                      required
                      value={values.relationship_type || ""}
                      onChange={(e) =>
                        setValues({
                          ...values,
                          relationship_type: e.target.value,
                        })
                      }
                      placeholder="Parent / guardian"
                      className={input}
                    />
                  </label>
                  {!record.athlete.primary_family_id && (
                    <>
                      <label className="block text-xs">
                        Existing family
                        <select
                          value={values.family_id || ""}
                          onChange={(e) =>
                            setValues({ ...values, family_id: e.target.value })
                          }
                          className={input}
                        >
                          <option value="">Create a family</option>
                          {data.families.map((f: any) => (
                            <option key={f.id} value={f.id}>
                              {f.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      {!values.family_id && (
                        <label className="block text-xs">
                          New family name
                          <input
                            required
                            value={values.family_name || ""}
                            onChange={(e) =>
                              setValues({
                                ...values,
                                family_name: e.target.value,
                              })
                            }
                            className={input}
                          />
                        </label>
                      )}
                    </>
                  )}
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={values.is_primary === "true"}
                      onChange={(e) =>
                        setValues({
                          ...values,
                          is_primary: String(e.target.checked),
                        })
                      }
                    />
                    Primary family contact
                  </label>
                  <p className="text-xs text-neutral-400">
                    This updates family contact relationships. It does not grant
                    access or custody authority.
                  </p>
                </>
              )}
              {operation === "guardian_remove" && (
                <>
                  <label className="block text-xs">
                    Guardian
                    <select
                      required
                      value={values.person_id || ""}
                      onChange={(e) => {
                        const g = record.guardians.find(
                          (g: any) => g.person_id === e.target.value,
                        );
                        setValues({
                          ...values,
                          person_id: e.target.value,
                          family_id: g?.family_id || "",
                        });
                      }}
                      className={input}
                    >
                      <option value="">Select guardian</option>
                      {record.guardians.map((g: any) => (
                        <option key={g.person_id} value={g.person_id}>
                          {[g.person.first_name, g.person.last_name].join(" ")}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="text-xs text-amber-200">
                    Removes the family contact relationship for all linked
                    siblings. Active authority must be revoked separately first.
                  </p>
                </>
              )}
              {operation.startsWith("athlete_") && (
                <p className="text-xs text-amber-200">
                  Updates athlete status and retains all history. Existing
                  competition entries and bookings are retained for operational
                  review.
                </p>
              )}
              <label className="block text-xs">
                Reason
                <textarea
                  required
                  value={values.reason || ""}
                  onChange={(e) =>
                    setValues({ ...values, reason: e.target.value })
                  }
                  className={input}
                />
              </label>
              <button
                disabled={busy}
                className={`rounded px-3 py-2 text-sm ${operation.endsWith("remove") || operation === "athlete_inactivate" ? "bg-red-800" : "bg-emerald-700"}`}
              >
                {busy ? "Saving…" : "Apply change"}
              </button>
            </form>
          )}
        </>
      )}
    </section>
  );
}
