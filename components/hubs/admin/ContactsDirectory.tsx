"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { authenticatedFetch } from "@/lib/client/authenticatedFetch";
const fields = [
  ["first_name", "First name"],
  ["last_name", "Last name"],
  ["email", "Email"],
  ["phone", "Telephone"],
  ["relationship_type", "Contact type"],
  ["job_title", "Job title"],
  ["department", "Department"],
  ["notes", "Notes"],
];
export function ContactsDirectory({ role = "org_admin" }: { role?: string }) {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [q, setQ] = useState(""),
    [page, setPage] = useState(1),
    [selected, setSelected] = useState<any>(null),
    [form, setForm] = useState<Record<string, string>>({}),
    [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const load = useCallback(async () => {
    const r = await authenticatedFetch(
      `/api/admin-contacts?role=${encodeURIComponent(role)}`,
      { cache: "no-store" },
    );
    const j = await r.json();
    if (!r.ok) throw new Error(j.error);
    setData(j);
  }, [role]);
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);
  function open(c: any) {
    setSelected(c);
    setError("");
    setForm(
      Object.fromEntries([
        ...fields.map(([k]) => [k, c?.person?.[k] || c?.[k] || ""]),
        ["status", c?.status || "active"],
        ...["facility_id", "vendor_id", "external_organization_id"].map((k) => [
          k,
          c?.[k] || "",
        ]),
      ]),
    );
    dialog.current?.showModal();
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await authenticatedFetch("/api/admin-contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          id: selected?.id,
          expectedUpdatedAt: selected?.updated_at,
          values: form,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      await load();
      dialog.current?.close();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }
  const rows = (data?.contacts || []).filter((c: any) =>
      JSON.stringify(c).toLowerCase().includes(q.toLowerCase()),
    ),
    pages = Math.max(1, Math.ceil(rows.length / 25)),
    current = Math.min(page, pages);
  return (
    <main className="p-6 text-white">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Contacts</h1>
          <p className="mt-2 text-sm text-neutral-400">
            External operating contacts: facility staff, vendors and sports or
            recreation councils.
          </p>
        </div>
        {data?.canCreate && (
          <button
            onClick={() => open(null)}
            className="rounded bg-orange-600 px-4 py-2 font-semibold"
          >
            Add contact
          </button>
        )}
      </header>
      {error && (
        <p role="alert" className="mt-4 text-red-300">
          {error}
        </p>
      )}
      <input
        aria-label="Search contacts"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setPage(1);
        }}
        placeholder="Search contacts"
        className="my-5 rounded border border-neutral-600 bg-[#242529] p-2"
      />
      <div className="overflow-x-auto rounded border border-neutral-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-neutral-400">
              {["Name", "Contact type", "Email", "Telephone", "Status"].map(
                (x) => (
                  <th key={x} className="p-3">
                    {x}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {rows.slice((current - 1) * 25, current * 25).map((c: any) => (
              <tr key={c.id} className="border-t border-neutral-700">
                <td className="p-3">
                  <button
                    onClick={() => open(c)}
                    className="font-semibold text-blue-300"
                  >
                    {[c.person?.first_name, c.person?.last_name]
                      .filter(Boolean)
                      .join(" ")}
                  </button>
                </td>
                <td className="p-3">{c.relationship_type}</td>
                <td className="p-3">{c.person?.email || "Not recorded"}</td>
                <td className="p-3">{c.person?.phone || "Not recorded"}</td>
                <td className="p-3">{c.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <p className="p-5 text-sm text-neutral-400">
            {data ? "No external contacts found." : "Loading contacts…"}
          </p>
        )}
      </div>
      <div className="mt-4 flex items-center gap-4 text-sm">
        <button disabled={current === 1} onClick={() => setPage(current - 1)}>
          Previous
        </button>
        <span>
          Page {current} of {pages} · 25 per page
        </span>
        <button
          disabled={current === pages}
          onClick={() => setPage(current + 1)}
        >
          Next
        </button>
      </div>
      <dialog
        ref={dialog}
        className="fixed inset-y-0 left-auto right-0 m-0 h-dvh max-h-none w-[min(640px,94vw)] max-w-none border-l border-neutral-600 bg-[#18191c] p-6 text-white backdrop:bg-black/65"
      >
        <div className="flex justify-between">
          <h2 className="text-xl font-semibold">
            {selected ? "Contact record" : "New contact"}
          </h2>
          <button onClick={() => dialog.current?.close()}>Close</button>
        </div>
        <form onSubmit={save} className="mt-5 space-y-3">
          {fields.map(([key, label]) => (
            <label key={key} className="block text-sm">
              {label}
              <input
                readOnly={!data?.canEdit}
                required={[
                  "first_name",
                  "last_name",
                  "relationship_type",
                ].includes(key)}
                type={key === "email" ? "email" : "text"}
                value={form[key] || ""}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                className="mt-1 w-full rounded border border-neutral-600 bg-[#242529] p-2"
              />
            </label>
          ))}
          {[
            ["facility_id", "Facility", "facilities"],
            ["vendor_id", "Vendor", "vendors"],
            [
              "external_organization_id",
              "External organization",
              "externalOrganizations",
            ],
          ].map(([key, label, list]) => (
            <label key={key} className="block text-sm">
              {label}
              <select
                disabled={!data?.canEdit}
                value={form[key] || ""}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                className="mt-1 w-full rounded border border-neutral-600 bg-[#242529] p-2"
              >
                <option value="">No association</option>
                {(data?.[list] || []).map((x: any) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <label className="block text-sm">
            Status
            <select
              disabled={!data?.canEdit}
              value={form.status || "active"}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="mt-1 w-full rounded border border-neutral-600 bg-[#242529] p-2"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
          {error && (
            <p role="alert" className="text-sm text-red-300">
              {error}
            </p>
          )}
          {data?.canEdit && (
            <button
              disabled={busy}
              className="rounded bg-emerald-700 px-4 py-2 font-semibold disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save contact"}
            </button>
          )}
        </form>
      </dialog>
    </main>
  );
}
