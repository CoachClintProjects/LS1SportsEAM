"use client";
import { useEffect, useRef, useState } from "react";
import { authenticatedFetch } from "@/lib/client/authenticatedFetch";
export type EvidenceDomain = "credentials" | "backgroundChecks" | "safeSport";
const categories: Record<EvidenceDomain, { label: string; fields: string[] }> =
  {
    credentials: {
      label: "Credential",
      fields: [
        "credential_type",
        "issuer",
        "credential_number",
        "issued_on",
        "expires_on",
      ],
    },
    backgroundChecks: {
      label: "Background check",
      fields: [
        "check_type",
        "provider",
        "reference_number",
        "submitted_at",
        "completed_at",
        "expires_on",
        "result_classification",
      ],
    },
    safeSport: {
      label: "SafeSport certificate",
      fields: [
        "certification_type",
        "certificate_id",
        "completed_on",
        "expires_on",
        "source",
      ],
    },
  };
type Person = {
  id: string;
  first_name: string;
  last_name: string;
  preferred_name?: string;
  email?: string;
};
const name = (p: Person) =>
  `${p.preferred_name || p.first_name} ${p.last_name}`;
export function ComplianceEvidenceIntake({
  role,
  domain,
  onClose,
  onSaved,
}: {
  role: string;
  domain: EvidenceDomain;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [query, setQuery] = useState(""),
    [people, setPeople] = useState<Person[]>([]),
    [person, setPerson] = useState<Person | null>(null),
    [values, setValues] = useState<Record<string, string>>({}),
    [reason, setReason] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false),
    [allowed, setAllowed] = useState(false);
  const [recordId] = useState(() => crypto.randomUUID());
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    let current = true;
    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(() => {
      void authenticatedFetch(
        `/api/admin-compliance?role=${encodeURIComponent(role)}&q=${encodeURIComponent(query)}`,
        { signal: controller.signal, cache: "no-store" },
      )
        .then(async (r) => {
          const j = await r.json();
          if (!r.ok) throw Error(j.error);
          if (current) {
            setPeople(j.people);
            setAllowed(j.authorization.create);
            setError("");
          }
        })
        .catch((e) => {
          if (current) setError(e.message);
        })
        .finally(() => {
          if (current) setLoading(false);
        });
    }, 200);
    return () => {
      current = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [role, query]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null,
      overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    root.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
      if (e.key === "Tab") {
        const elements = root.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled)",
        );
        if (!elements?.length) return;
        const first = elements[0],
          last = elements[elements.length - 1];
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === root.current)
        ) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [busy, onClose]);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!person) return;
    setBusy(true);
    setError("");
    try {
      const payload = Object.fromEntries(
        Object.entries(values).map(([k, v]) => [
          k,
          v.trim()
            ? k.endsWith("_at")
              ? new Date(v).toISOString()
              : v.trim()
            : null,
        ]),
      );
      const r = await authenticatedFetch("/api/admin-compliance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          domain,
          id: recordId,
          personId: person.id,
          values: payload,
          reason,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw Error(j.error);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Evidence could not be saved.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="fixed inset-0 z-[110] bg-black/70">
      <aside
        ref={root}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="intake-heading"
        className="ml-auto h-full w-full max-w-3xl overflow-y-auto border-l border-neutral-600 bg-[#242529] p-6 text-white"
      >
        <button
          disabled={busy}
          onClick={onClose}
          className="float-right rounded border border-neutral-500 px-3 py-2"
        >
          Close
        </button>
        <h2 id="intake-heading" className="text-2xl font-bold">
          Add {categories[domain].label.toLowerCase()}
        </h2>
        <p className="mt-2 text-sm text-neutral-300">
          Save evidence against an existing person. It remains pending until
          reviewed.
        </p>
        {error && (
          <p
            role="alert"
            className="my-4 rounded border border-red-600 bg-red-950 p-3 text-red-200"
          >
            {error}
          </p>
        )}
        <form onSubmit={save} className="mt-5 space-y-5">
          <fieldset disabled={busy || !allowed}>
            <legend className="font-bold">Person</legend>
            <label className="mt-2 block text-sm">
              Search by name or email
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="mt-1 block w-full rounded border border-neutral-600 bg-black p-2"
              />
            </label>
            {loading ? (
              <p className="p-2 text-sm">Loading people…</p>
            ) : (
              <div className="mt-2 max-h-48 overflow-y-auto rounded border border-neutral-700">
                {people.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPerson(p)}
                    className={`block w-full p-2 text-left text-sm ${person?.id === p.id ? "bg-blue-900" : "hover:bg-neutral-800"}`}
                  >
                    {name(p)}
                    {p.email && (
                      <span className="ml-2 text-neutral-400">{p.email}</span>
                    )}
                  </button>
                ))}
                {!people.length && (
                  <p className="p-3 text-sm">No matching people.</p>
                )}
              </div>
            )}
            {person && (
              <p className="mt-2 text-sm text-green-300">
                Selected: {name(person)}
              </p>
            )}
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {categories[domain].fields.map((field, i) => (
                <label key={field} className="text-sm">
                  {field.replaceAll("_", " ")}
                  {i === 0 ? " *" : ""}
                  <input
                    required={i === 0}
                    type={
                      field.endsWith("_on")
                        ? "date"
                        : field.endsWith("_at")
                          ? "datetime-local"
                          : "text"
                    }
                    value={values[field] || ""}
                    onChange={(e) =>
                      setValues({ ...values, [field]: e.target.value })
                    }
                    className="mt-1 block w-full rounded border border-neutral-600 bg-black p-2"
                  />
                </label>
              ))}
            </div>
            <label className="mt-5 block text-sm">
              Intake reason
              <textarea
                required
                minLength={5}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="mt-1 block w-full rounded border border-neutral-600 bg-black p-2"
              />
            </label>
          </fieldset>
          <button
            disabled={busy || !allowed || !person || reason.trim().length < 5}
            className="rounded bg-[#FA4616] px-4 py-2 font-bold text-black disabled:opacity-40"
          >
            {busy ? "Saving…" : "Save for review"}
          </button>
          {!loading && !allowed && (
            <p className="text-sm text-amber-200">
              Your current role does not permit evidence intake.
            </p>
          )}
        </form>
      </aside>
    </div>
  );
}
