"use client";
import { useEffect, useRef, useState } from "react";
import { authenticatedFetch } from "@/lib/client/authenticatedFetch";
const input =
  "mt-1 w-full rounded border border-neutral-600 bg-[#161B22] p-2 text-white";
const fullName = (p: any) =>
  [p.first_name, p.last_name].filter(Boolean).join(" ");
export default function GuardianEditor({
  record,
  role,
  onSaved,
  onClose,
  onBusy,
}: {
  record: any;
  role: string;
  onSaved: () => Promise<void>;
  onClose: () => void;
  onBusy: (busy: boolean) => void;
}) {
  const [options, setOptions] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [draft, setDraft] = useState<Record<string, string> | null>(null);
  const lock = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    authenticatedFetch(
      `/api/admin-record-work?role=${encodeURIComponent(role)}&personId=${record.person.id}&section=Relationships`,
      { signal: controller.signal },
    )
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw Error(j.error);
        setOptions(j);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => controller.abort();
  }, [record.person.id, role]);
  function start(mode: string, g?: any) {
    setError("");
    setDraft({
      mode,
      person_id: g?.person_id || crypto.randomUUID(),
      first_name: g?.person?.first_name || "",
      last_name: g?.person?.last_name || "",
      email: g?.person?.email || "",
      phone: g?.person?.phone || "",
      relationship_type: g?.relationship_type || "parent",
      is_primary: String(g?.is_primary_guardian || false),
      expected_updated_at: g?.person?.updated_at || "",
      expected_relationship: g?.relationship_type || "",
      expected_primary: String(g?.is_primary_guardian || false),
      family_name: `${record.person.last_name || "Athlete"} family`,
      reason: "",
    });
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft || lock.current) return;
    lock.current = true;
    setBusy(true);
    onBusy(true);
    setError("");
    try {
      const r = await authenticatedFetch("/api/admin-record-work", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          personId: record.person.id,
          kind: "guardian",
          values: draft,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw Error(j.error);
      setDraft(null);
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save guardian.");
    } finally {
      lock.current = false;
      setBusy(false);
      onBusy(false);
    }
  }
  return (
    <section
      className="mb-5 rounded-xl border border-blue-500 bg-[#0A0C10] p-5"
      aria-label="Parent and guardian editor"
    >
      <div className="flex justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold">Parents & guardians</h3>
          <p className="mt-1 text-sm text-neutral-400">
            Family contacts for {fullName(record.person)}. Emergency contacts
            are managed separately.
          </p>
        </div>
        <button disabled={busy} onClick={onClose}>
          Close editor
        </button>
      </div>
      {error && (
        <p role="alert" className="my-3 text-red-300">
          {error}
        </p>
      )}
      {!options ? (
        <p className="mt-4">Loading available contacts…</p>
      ) : !options.authorization.relationships ? (
        <p className="mt-4">
          Only an authorized club administrator can change family relationships.
        </p>
      ) : (
        <>
          {!draft ? (
            <>
              <div className="my-4 space-y-3">
                {record.guardians.map((g: any) => (
                  <div
                    key={`${g.family_id}:${g.person_id}`}
                    className="flex justify-between gap-3 rounded border border-neutral-700 p-3"
                  >
                    <div>
                      <b>{fullName(g.person)}</b>
                      <p>
                        {g.relationship_type.replaceAll("_", " ")}
                        {g.is_primary_guardian ? " · Primary contact" : ""}
                      </p>
                      <p className="text-sm text-neutral-400">
                        {g.person.email || "No email"} ·{" "}
                        {g.person.phone || "No phone"}
                      </p>
                    </div>
                    <button
                      disabled={
                        g.family_id !== record.athlete?.primary_family_id
                      }
                      onClick={() => start("edit", g)}
                      className="text-blue-300 disabled:opacity-40"
                    >
                      Edit contact
                    </button>
                  </div>
                ))}
                {!record.guardians.length && (
                  <p>No parent or guardian contact is linked yet.</p>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => start("new")}
                  className="rounded bg-blue-700 px-4 py-2"
                >
                  Add new parent / guardian
                </button>
                <button
                  onClick={() => {
                    start("link");
                    setDraft((d) => (d ? { ...d, person_id: "" } : d));
                  }}
                  className="rounded border border-blue-500 px-4 py-2"
                >
                  Link existing person
                </button>
              </div>
            </>
          ) : (
            <form onSubmit={save} className="mt-4 space-y-4">
              <fieldset disabled={busy} className="space-y-4">
                <h4 className="font-semibold">
                  {draft.mode === "edit"
                    ? "Edit parent / guardian"
                    : draft.mode === "new"
                      ? "New parent / guardian"
                      : "Link an existing person"}
                </h4>
                {draft.mode === "link" ? (
                  <label className="block text-sm">
                    Existing person
                    <select
                      required
                      className={input}
                      value={draft.person_id}
                      onChange={(e) =>
                        setDraft({ ...draft, person_id: e.target.value })
                      }
                    >
                      <option value="">Select person</option>
                      {options.peopleOptions
                        .filter((p: any) => p.id !== record.person.id)
                        .map((p: any) => (
                          <option key={p.id} value={p.id}>
                            {fullName(p)}
                            {p.email ? ` · ${p.email}` : ""}
                          </option>
                        ))}
                    </select>
                  </label>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      ["first_name", "First name"],
                      ["last_name", "Last name"],
                      ["email", "Email"],
                      ["phone", "Telephone"],
                    ].map(([k, l]) => (
                      <label key={k} className="text-sm">
                        {l}
                        <input
                          required={k.endsWith("name")}
                          maxLength={k === "email" ? 254 : 200}
                          type={
                            k === "email"
                              ? "email"
                              : k === "phone"
                                ? "tel"
                                : "text"
                          }
                          className={input}
                          value={draft[k]}
                          onChange={(e) =>
                            setDraft({ ...draft, [k]: e.target.value })
                          }
                        />
                      </label>
                    ))}
                  </div>
                )}
                <label className="block text-sm">
                  Relationship
                  <select
                    required
                    className={input}
                    value={draft.relationship_type}
                    onChange={(e) =>
                      setDraft({ ...draft, relationship_type: e.target.value })
                    }
                  >
                    {[
                      "parent",
                      "guardian",
                      "mother",
                      "father",
                      "step_parent",
                      "foster_parent",
                      "grandparent_guardian",
                    ].map((v) => (
                      <option key={v} value={v}>
                        {v.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </label>
                {!record.athlete?.primary_family_id && (
                  <label className="block text-sm">
                    Family name
                    <input
                      required
                      className={input}
                      value={draft.family_name}
                      onChange={(e) =>
                        setDraft({ ...draft, family_name: e.target.value })
                      }
                    />
                  </label>
                )}
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={draft.is_primary === "true"}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        is_primary: String(e.target.checked),
                      })
                    }
                  />
                  Primary family contact
                </label>
                <p className="text-sm text-amber-200">
                  Changes to this person’s contact details apply wherever they
                  are linked, including siblings. Primary contact applies to the
                  family. This does not grant account access, custody or consent
                  authority.
                </p>
                <label className="block text-sm">
                  Reason for change
                  <textarea
                    required
                    maxLength={1000}
                    className={input}
                    value={draft.reason}
                    onChange={(e) =>
                      setDraft({ ...draft, reason: e.target.value })
                    }
                  />
                </label>
                <div className="flex gap-3">
                  <button
                    type="submit"
                    className="rounded bg-emerald-700 px-4 py-2"
                  >
                    {busy ? "Saving…" : "Save parent / guardian"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDraft(null)}
                    className="rounded border border-neutral-600 px-4 py-2"
                  >
                    Cancel
                  </button>
                </div>
              </fieldset>
            </form>
          )}
        </>
      )}
    </section>
  );
}
