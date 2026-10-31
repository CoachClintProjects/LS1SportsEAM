"use client";
import { useEffect, useRef, useState } from "react";
import { authenticatedFetch } from "@/lib/client/authenticatedFetch";
const input =
  "mt-1 w-full rounded border border-neutral-600 bg-[#161B22] p-2 text-white";
const fullName = (p: any) =>
  [p.first_name, p.last_name].filter(Boolean).join(" ");
export default function GuardianEditor({
  record,
  guardian,
  role,
  onSaved,
  onClose,
  onBusy,
}: {
  record: any;
  guardian?: any;
  role: string;
  onSaved: () => Promise<void>;
  onClose: () => void;
  onBusy: (busy: boolean) => void;
}) {
  const [options, setOptions] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [draft, setDraft] = useState<Record<string, string>>(() =>
      initialDraft(guardian ? "edit" : "new", guardian),
    );
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
  function initialDraft(mode: string, g?: any) {
    return {
      mode,
      person_id: g?.person_id || (mode === "link" ? "" : crypto.randomUUID()),
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
      phone_secondary: g?.person?.phone_secondary || "",
      contact_name: g ? fullName(g.person) : "",
      reason: "Parent / guardian contact saved from athlete record",
    };
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
          values: (() => {
            const parts = draft.contact_name.trim().split(/\s+/);
            const unchanged =
              guardian && draft.contact_name === fullName(guardian.person);
            return {
              ...draft,
              first_name: unchanged ? guardian.person.first_name : parts[0],
              last_name: unchanged
                ? guardian.person.last_name
                : parts.slice(1).join(" "),
            };
          })(),
        }),
      });
      const j = await r.json();
      if (!r.ok) throw Error(j.error);
      await onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save guardian.");
    } finally {
      lock.current = false;
      setBusy(false);
      onBusy(false);
    }
  }
  const change = (key: string, value: string) =>
    setDraft((d) => ({ ...d, [key]: value }));
  return (
    <section
      className="rounded-xl border border-blue-500 bg-[#0A0C10] p-5"
      aria-label="Parent and guardian editor"
    >
      <h3 className="mb-4 text-xl font-semibold">Edit parent / guardian</h3>
      {error && (
        <p role="alert" className="mb-3 text-red-300">
          {error}
        </p>
      )}
      <form onSubmit={save}>
        <fieldset disabled={busy || !options?.authorization.relationships}>
          {draft.mode !== "edit" && (
            <button
              type="button"
              className="mb-3 text-sm text-blue-300"
              onClick={() =>
                setDraft(initialDraft(draft.mode === "link" ? "new" : "link"))
              }
            >
              {draft.mode === "link"
                ? "Enter a new contact"
                : "Use an existing person"}
            </button>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {draft.mode === "link" ? (
              <label className="text-sm">
                Contact name
                <select
                  required
                  className={input}
                  value={draft.person_id}
                  onChange={(e) => change("person_id", e.target.value)}
                >
                  <option value="">Select person</option>
                  {options?.peopleOptions
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
              <label className="text-sm">
                Contact name
                <input
                  autoFocus
                  required
                  maxLength={200}
                  className={input}
                  value={draft.contact_name}
                  onChange={(e) => change("contact_name", e.target.value)}
                />
              </label>
            )}
            <label className="text-sm">
              Relationship
              <select
                required
                className={input}
                value={draft.relationship_type}
                onChange={(e) => change("relationship_type", e.target.value)}
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
            {draft.mode !== "link" &&
              [
                ["phone", "Primary telephone"],
                ["phone_secondary", "Alternate telephone"],
                ["email", "Email address"],
              ].map(([key, label]) => (
                <label key={key} className="text-sm">
                  {label}
                  <input
                    type={key === "email" ? "email" : "tel"}
                    maxLength={254}
                    className={input}
                    value={draft[key]}
                    onChange={(e) => change(key, e.target.value)}
                  />
                </label>
              ))}
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-neutral-600 px-4 py-3 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded bg-emerald-700 px-4 py-3 font-semibold"
            >
              {busy ? "Saving…" : "Save changes"}
            </button>
          </div>
        </fieldset>
        {!options && !error && (
          <p role="status" className="mt-2 text-sm">
            Loading contacts…
          </p>
        )}
      </form>
    </section>
  );
}
