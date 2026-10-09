"use client";
import { AdminDrawerShell } from "./AdminDrawerShell";
import { useEffect, useMemo, useState } from "react";
import { authenticatedFetch } from "@/lib/client/authenticatedFetch";
export function Facilities({ role = "org_admin" }: { role?: string }) {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [tab, setTab] = useState<
      "facilities" | "bookings" | "closures" | "contracts"
    >("facilities"),
    [q, setQ] = useState(""),
    [selected, setSelected] = useState<any>(null),
    [contractDraft, setContractDraft] = useState<any>({}),
    [contractTerms, setContractTerms] = useState("{}"),
    [bookingDraft, setBookingDraft] = useState<any>({}),
    [creating, setCreating] = useState(false),
    [booking, setBooking] = useState(false),
    [contract, setContract] = useState(false),
    [closure, setClosure] = useState(false),
    [busy, setBusy] = useState(false),
    [form, setForm] = useState<any>({
      siteId: "",
      code: "",
      name: "",
      facilityType: "",
      capacity: "",
    });
  const load = () =>
    authenticatedFetch(`/api/admin-command?role=${encodeURIComponent(role)}`, {
      cache: "no-store",
    })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        setData({ ...j.enterprise, context: j.context });
      })
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, [role]);
  const rows = useMemo(
    () =>
      (
        (tab === "bookings"
          ? data?.facilityBookings
          : tab === "closures"
            ? data?.facilityClosures
            : data?.[tab]) || []
      ).filter((r: any) =>
        JSON.stringify(r).toLowerCase().includes(q.toLowerCase()),
      ),
    [data, tab, q],
  );
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await authenticatedFetch("/api/admin-command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create-facility", role, ...form }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Create failed");
      setCreating(false);
      setForm({
        siteId: "",
        code: "",
        name: "",
        facilityType: "",
        capacity: "",
      });
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const lifecycle = async (r: any) => {
    setBusy(true);
    try {
      const x = await authenticatedFetch("/api/admin-command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update-facility",
          role,
          id: r.id,
          changes: { status: r.status === "inactive" ? "active" : "inactive" },
        }),
      });
      const j = await x.json();
      if (!x.ok) throw new Error(j.error);
      setSelected(null);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const bookingLifecycle = async (r: any) => {
    setBusy(true);
    setError("");
    try {
      const x = await authenticatedFetch("/api/admin-command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update-facility-booking",
          role,
          id: r.id,
          changes: {
            status: r.status === "cancelled" ? "booked" : "cancelled",
          },
        }),
      });
      const j = await x.json();
      if (!x.ok) throw new Error(j.error);
      setSelected(null);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  if (!data) return <State text={error || "Loading facilities…"} />;
  return (
    <main className="p-5 text-white lg:p-7">
      <div className="text-[9px] font-black uppercase tracking-[.22em] text-[#FA4616]">
        {role.replaceAll("_", " ")} · Facilities
      </div>
      <div className="flex items-center justify-between">
        <h1 className="mt-1 text-3xl font-black">Facilities & bookings</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setContract(true)}
            className="rounded-lg border border-neutral-600 px-4 py-2 text-xs font-black"
          >
            + Contract
          </button>
          <button
            onClick={() => setBooking(true)}
            className="rounded-lg border border-neutral-600 px-4 py-2 text-xs font-black"
          >
            + Booking
          </button>
          <button
            onClick={() => setCreating(true)}
            className="rounded-lg bg-[#FA4616] px-4 py-2 text-xs font-black text-black"
          >
            + Facility
          </button>
        </div>
      </div>
      <p className="mt-2 text-sm text-neutral-400">
        Canonical facility assets and booking transactions. No invented
        capacity, availability or utilization.
      </p>
      <div className="mt-5 flex gap-2">
        <button
          onClick={() => setTab("facilities")}
          className={
            tab === "facilities"
              ? "rounded-lg bg-[#FA4616] px-3 py-2 text-xs font-black text-black"
              : "rounded-lg border border-neutral-700 px-3 py-2 text-xs"
          }
        >
          Facilities · {data.facilities?.length || 0}
        </button>
        <button
          onClick={() => setTab("bookings")}
          className={
            tab === "bookings"
              ? "rounded-lg bg-[#FA4616] px-3 py-2 text-xs font-black text-black"
              : "rounded-lg border border-neutral-700 px-3 py-2 text-xs"
          }
        >
          Bookings · {data.facilityBookings?.length || 0}
        </button>
        <button
          onClick={() => setTab("closures")}
          className={
            tab === "closures"
              ? "rounded-lg bg-[#FA4616] px-3 py-2 text-xs font-black text-black"
              : "rounded-lg border border-neutral-700 px-3 py-2 text-xs"
          }
        >
          Closures · {data.facilityClosures?.length || 0}
        </button>
        <button
          onClick={() => setClosure(true)}
          className="rounded-lg border border-neutral-700 px-3 py-2 text-xs"
        >
          + Closure
        </button>
        <button
          onClick={() => setTab("contracts")}
          className={
            tab === "contracts"
              ? "rounded-lg bg-[#FA4616] px-3 py-2 text-xs font-black text-black"
              : "rounded-lg border border-neutral-700 px-3 py-2 text-xs"
          }
        >
          Contracts · {data.contracts?.length || 0}
        </button>
      </div>
      <section className="mt-4 overflow-hidden rounded-2xl border border-neutral-800 bg-[#090b0b]">
        <div className="border-b border-neutral-800 p-4">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Find a record"
            className="w-full max-w-sm rounded-lg border border-neutral-700 bg-black px-3 py-2 text-sm"
          />
        </div>
        <div className="divide-y divide-neutral-800">
          {rows.map((r: any) => (
            <button
              key={r.id}
              onClick={() => {
                setSelected(r);
                setContractDraft({ ...r });
                setBookingDraft({ ...r });
              }}
              className="grid w-full grid-cols-[1fr_auto] gap-4 p-4 text-left hover:bg-white/[.03]"
            >
              <span>
                <b>{r.name || r.code || r.id}</b>
                <span className="mt-1 block text-xs text-neutral-500">
                  {r.facility_type || r.starts_at || ""}
                </span>
              </span>
              <span className="text-xs uppercase text-neutral-400">
                {r.status || "recorded"}
              </span>
            </button>
          ))}
        </div>
        {!rows.length && (
          <div className="p-8 text-sm text-neutral-500">
            No {tab} records are recorded.
          </div>
        )}
      </section>
      {closure && (
        <ClosureModal
          error={error}
          facilities={data.facilities || []}
          busy={busy}
          onClose={() => setClosure(false)}
          onSave={async (v: any) => {
            setBusy(true);
            setError("");
            try {
              const r = await authenticatedFetch("/api/admin-command", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "create-facility-closure",
                  role,
                  ...v,
                }),
              });
              const j = await r.json();
              if (!r.ok) throw new Error(j.error);
              setClosure(false);
              await load();
            } catch (e: any) {
              setError(e.message);
            } finally {
              setBusy(false);
            }
          }}
        />
      )}{" "}
      {contract && (
        <ContractModal
          error={error}
          organizations={data.organizations || []}
          vendors={data.vendors || []}
          busy={busy}
          onClose={() => setContract(false)}
          onSave={async (v: any) => {
            setBusy(true);
            setError("");
            try {
              const r = await authenticatedFetch("/api/admin-command", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "create-contract", role, ...v }),
              });
              const j = await r.json();
              if (!r.ok) throw new Error(j.error);
              setContract(false);
              await load();
            } catch (e: any) {
              setError(e.message);
            } finally {
              setBusy(false);
            }
          }}
        />
      )}{" "}
      {booking && (
        <BookingModal
          error={error}
          facilities={data.facilities || []}
          busy={busy}
          onClose={() => setBooking(false)}
          onSave={async (v: any) => {
            setBusy(true);
            setError("");
            try {
              const r = await authenticatedFetch("/api/admin-command", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "create-facility-booking",
                  role,
                  ...v,
                }),
              });
              const j = await r.json();
              if (!r.ok) throw new Error(j.error || "Booking failed");
              setBooking(false);
              await load();
            } catch (e: any) {
              setError(e.message);
            } finally {
              setBusy(false);
            }
          }}
        />
      )}{" "}
      {creating && (
        <AdminDrawerShell
          title="Add facility"
          busy={busy}
          onClose={() => setCreating(false)}
        >
          <fieldset disabled={busy}>
            {error && (
              <p
                role="alert"
                className="mb-4 rounded border border-red-700 p-3 text-red-300"
              >
                {error}
              </p>
            )}

            <label className="mt-4 block text-xs text-neutral-400">
              Site
              <select
                value={form.siteId}
                onChange={(e) => setForm({ ...form, siteId: e.target.value })}
                className="mt-1 w-full rounded border border-neutral-700 bg-black px-3 py-2"
              >
                <option value="">Select authorized site</option>
                {(data.sites || [])
                  .filter((s: any) => s.status !== "archived")
                  .map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {s.name || s.code}
                    </option>
                  ))}
              </select>
            </label>
            {[
              ["code", "Code"],
              ["name", "Name"],
              ["facilityType", "Type"],
              ["capacity", "Capacity"],
            ].map(([k, n]) => (
              <label key={k} className="mt-3 block text-xs text-neutral-400">
                {n}
                <input
                  value={form[k] || ""}
                  onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                  className="mt-1 w-full rounded border border-neutral-700 bg-black px-3 py-2"
                />
              </label>
            ))}
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => setCreating(false)}>Cancel</button>
              <button
                disabled={busy || !form.siteId || !form.code || !form.name}
                onClick={save}
                className="rounded bg-[#FA4616] px-4 py-2 font-black text-black"
              >
                Create facility
              </button>
            </div>
          </fieldset>
        </AdminDrawerShell>
      )}
      {selected && (
        <AdminDrawerShell
          title={selected.name || selected.title || "Facility record"}
          busy={busy}
          onClose={() => setSelected(null)}
          recordStatus={selected.status}
        >
          {error && (
            <p role="alert" className="mb-4 text-red-300">
              {error}
            </p>
          )}
          <div className="grid gap-6 lg:grid-cols-3">
            <section className="min-w-0">
              <h3 className="font-semibold">Record details</h3>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {Object.entries(selected).map(([k, v]) => (
                  <div key={k} className="border-b border-neutral-800 pb-2">
                    <div className="text-[9px] uppercase text-neutral-600">
                      {k.replaceAll("_", " ")}
                    </div>
                    <div className="break-words text-sm">
                      {typeof v === "object"
                        ? JSON.stringify(v)
                        : String(v ?? "—")}
                    </div>
                  </div>
                ))}
              </div>
            </section>
            <fieldset disabled={busy} className="min-w-0">
              <legend className="font-semibold">Actions</legend>
              {tab === "closures" && (
                <button
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      const r = await authenticatedFetch("/api/admin-command", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          action: "update-facility-closure",
                          role,
                          id: selected.id,
                          changes: {
                            status:
                              selected.status === "inactive"
                                ? "active"
                                : "inactive",
                          },
                        }),
                      });
                      const j = await r.json();
                      if (!r.ok) throw new Error(j.error);
                      setSelected(null);
                      await load();
                    } catch (e: any) {
                      setError(e.message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                  className="mt-5 rounded border border-neutral-600 px-4 py-2 text-xs font-bold"
                >
                  {selected.status === "inactive"
                    ? "Reactivate"
                    : "Close closure"}
                </button>
              )}
              {tab === "contracts" && (
                <div className="mt-5 border-t border-neutral-800 pt-4">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      value={contractDraft.title || ""}
                      onChange={(e) =>
                        setContractDraft({
                          ...contractDraft,
                          title: e.target.value,
                        })
                      }
                      placeholder="Title"
                      className="rounded border border-neutral-700 bg-black px-3 py-2 text-sm"
                    />
                    <input
                      value={contractDraft.status || ""}
                      onChange={(e) =>
                        setContractDraft({
                          ...contractDraft,
                          status: e.target.value,
                        })
                      }
                      placeholder="Status"
                      className="rounded border border-neutral-700 bg-black px-3 py-2 text-sm"
                    />
                    <input
                      type="date"
                      value={contractDraft.expires_on || ""}
                      onChange={(e) =>
                        setContractDraft({
                          ...contractDraft,
                          expires_on: e.target.value,
                        })
                      }
                      className="rounded border border-neutral-700 bg-black px-3 py-2 text-sm"
                    />
                    <input
                      value={contractDraft.counterparty_name || ""}
                      onChange={(e) =>
                        setContractDraft({
                          ...contractDraft,
                          counterparty_name: e.target.value,
                        })
                      }
                      placeholder="Counterparty"
                      className="rounded border border-neutral-700 bg-black px-3 py-2 text-sm"
                    />
                    <select
                      value={contractDraft.vendor_id || ""}
                      onChange={(e) =>
                        setContractDraft({
                          ...contractDraft,
                          vendor_id: e.target.value || null,
                        })
                      }
                      className="rounded border border-neutral-700 bg-black px-3 py-2 text-sm"
                    >
                      <option value="">No vendor association</option>
                      {(data.vendors || [])
                        .filter(
                          (v: any) =>
                            v.organization_id === selected.organization_id &&
                            v.status !== "inactive",
                        )
                        .map((v: any) => (
                          <option key={v.id} value={v.id}>
                            {v.name || v.vendor_code}
                          </option>
                        ))}
                    </select>
                  </div>
                  <button
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      setError("");
                      try {
                        const x = await authenticatedFetch(
                          "/api/admin-command",
                          {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              action: "update-contract",
                              role,
                              id: selected.id,
                              changes: {
                                title: contractDraft.title,
                                status: contractDraft.status,
                                expires_on: contractDraft.expires_on || null,
                                counterparty_name:
                                  contractDraft.counterparty_name || null,
                                vendor_id: contractDraft.vendor_id || null,
                              },
                            }),
                          },
                        );
                        const j = await x.json();
                        if (!x.ok) throw new Error(j.error);
                        setSelected(null);
                        await load();
                      } catch (e: any) {
                        setError(e.message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                    className="mt-3 rounded bg-[#FA4616] px-4 py-2 text-xs font-black text-black"
                  >
                    Save contract
                  </button>
                  <div className="mt-5 border-t border-neutral-800 pt-4">
                    <h3 className="text-sm font-black">Contract versions</h3>
                    {(data.contractVersions || [])
                      .filter((v: any) => v.contract_id === selected.id)
                      .map((v: any) => (
                        <div
                          key={v.id}
                          className="mt-2 rounded border border-neutral-800 p-2 text-xs"
                        >
                          Version {v.version_no} ·{" "}
                          {new Date(v.created_at).toLocaleString()}
                          <pre className="mt-1 overflow-auto text-neutral-500">
                            {JSON.stringify(v.terms, null, 2)}
                          </pre>
                        </div>
                      ))}
                    <textarea
                      value={contractTerms}
                      onChange={(e) => setContractTerms(e.target.value)}
                      className="mt-3 h-24 w-full rounded border border-neutral-700 bg-black p-2 text-xs"
                      aria-label="Contract version terms JSON"
                    />
                    <button
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        setError("");
                        try {
                          const terms = JSON.parse(contractTerms);
                          const x = await authenticatedFetch(
                            "/api/admin-command",
                            {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                action: "create-contract-version",
                                role,
                                contractId: selected.id,
                                terms,
                              }),
                            },
                          );
                          const j = await x.json();
                          if (!x.ok) throw new Error(j.error);
                          setContractTerms("{}");
                          await load();
                        } catch (e: any) {
                          setError(e.message);
                        } finally {
                          setBusy(false);
                        }
                      }}
                      className="mt-2 rounded border border-neutral-600 px-3 py-2 text-xs font-black"
                    >
                      Add version
                    </button>
                  </div>
                </div>
              )}
              {tab === "bookings" && (
                <div className="mt-5 border-t border-neutral-800 pt-4">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      type="datetime-local"
                      value={String(bookingDraft.starts_at || "").slice(0, 16)}
                      onChange={(e) =>
                        setBookingDraft({
                          ...bookingDraft,
                          starts_at: e.target.value,
                        })
                      }
                      className="rounded border border-neutral-700 bg-black px-3 py-2 text-sm"
                    />
                    <input
                      type="datetime-local"
                      value={String(bookingDraft.ends_at || "").slice(0, 16)}
                      onChange={(e) =>
                        setBookingDraft({
                          ...bookingDraft,
                          ends_at: e.target.value,
                        })
                      }
                      className="rounded border border-neutral-700 bg-black px-3 py-2 text-sm"
                    />
                  </div>
                  <button
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      setError("");
                      try {
                        const x = await authenticatedFetch(
                          "/api/admin-command",
                          {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              action: "update-facility-booking",
                              role,
                              id: selected.id,
                              changes: {
                                starts_at: bookingDraft.starts_at,
                                ends_at: bookingDraft.ends_at,
                              },
                            }),
                          },
                        );
                        const j = await x.json();
                        if (!x.ok) throw new Error(j.error);
                        setSelected(null);
                        await load();
                      } catch (e: any) {
                        setError(e.message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                    className="mt-3 rounded bg-[#FA4616] px-4 py-2 text-xs font-black text-black"
                  >
                    Save booking
                  </button>
                </div>
              )}
              {tab === "bookings" && (
                <button
                  disabled={busy}
                  onClick={() => bookingLifecycle(selected)}
                  className="mt-5 mr-2 rounded border border-neutral-600 px-4 py-2 text-xs font-bold"
                >
                  {selected.status === "cancelled" ? "Restore" : "Cancel"}{" "}
                  booking
                </button>
              )}
              {tab === "facilities" && (
                <button
                  disabled={busy}
                  onClick={() => lifecycle(selected)}
                  className="mt-5 rounded border border-neutral-600 px-4 py-2 text-xs font-bold"
                >
                  {selected.status === "inactive" ? "Reactivate" : "Deactivate"}{" "}
                  facility
                </button>
              )}
            </fieldset>
            <section className="min-w-0">
              <h3 className="font-semibold">Linked records</h3>
              <dl className="mt-4 space-y-3 text-sm">
                <dt>Site</dt>
                <dd>
                  {data.sites?.find((row: any) => row.id === selected.site_id)
                    ?.name || "Not linked"}
                </dd>
                <dt>Facility</dt>
                <dd>
                  {data.facilities?.find(
                    (row: any) => row.id === selected.facility_id,
                  )?.name ||
                    (tab === "facilities" ? selected.name : "Not linked")}
                </dd>
                <dt>Vendor</dt>
                <dd>
                  {data.vendors?.find(
                    (row: any) => row.id === selected.vendor_id,
                  )?.name || "Not linked"}
                </dd>
              </dl>
              {tab === "facilities" &&
                (data.facilityBookings || [])
                  .filter((row: any) => row.facility_id === selected.id)
                  .map((row: any) => (
                    <button
                      key={row.id}
                      disabled={busy}
                      onClick={() => {
                        setTab("bookings");
                        setSelected(row);
                        setBookingDraft({ ...row });
                      }}
                      className="mt-3 block w-full rounded border border-[#30363D] p-3 text-left text-sm"
                    >
                      Open booking · {new Date(row.starts_at).toLocaleString()}
                    </button>
                  ))}
            </section>
          </div>
        </AdminDrawerShell>
      )}
    </main>
  );
}
function ClosureModal({
  facilities,
  busy,
  error,
  onClose,
  onSave,
}: {
  facilities: any[];
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (v: any) => void;
}) {
  const [v, setV] = useState<any>({
    facilityId: "",
    startsAt: "",
    endsAt: "",
    reason: "",
  });
  return (
    <AdminDrawerShell
      title="Record facility closure"
      busy={busy}
      onClose={onClose}
    >
      <fieldset disabled={busy}>
        {error && (
          <p
            role="alert"
            className="mb-4 rounded border border-red-700 p-3 text-red-300"
          >
            {error}
          </p>
        )}

        <select
          value={v.facilityId}
          onChange={(e) => setV({ ...v, facilityId: e.target.value })}
          className="mt-4 w-full rounded border border-neutral-700 bg-black px-3 py-2"
        >
          <option value="">Select facility</option>
          {facilities.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name || x.code}
            </option>
          ))}
        </select>
        {[
          ["startsAt", "Starts"],
          ["endsAt", "Ends"],
          ["reason", "Reason"],
        ].map(([k, n]) => (
          <label key={k} className="mt-3 block text-xs text-neutral-400">
            {n}
            <input
              type={k === "reason" ? "text" : "datetime-local"}
              value={v[k] || ""}
              onChange={(e) => setV({ ...v, [k]: e.target.value })}
              className="mt-1 w-full rounded border border-neutral-700 bg-black px-3 py-2"
            />
          </label>
        ))}
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose}>Cancel</button>
          <button
            disabled={
              busy || !v.facilityId || !v.startsAt || !v.endsAt || !v.reason
            }
            onClick={() => onSave(v)}
            className="rounded bg-[#FA4616] px-4 py-2 font-black text-black"
          >
            Create closure
          </button>
        </div>
      </fieldset>
    </AdminDrawerShell>
  );
}
function ContractModal({
  organizations,
  vendors,
  busy,
  error,
  onClose,
  onSave,
}: {
  organizations: any[];
  vendors: any[];
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (v: any) => void;
}) {
  const [v, setV] = useState<any>({
    organizationId: organizations.length === 1 ? organizations[0].id : "",
    title: "",
    contractType: "",
    status: "",
    effectiveOn: "",
    expiresOn: "",
    counterpartyName: "",
    vendorId: "",
  });
  return (
    <AdminDrawerShell title="Add contract" busy={busy} onClose={onClose}>
      <fieldset disabled={busy}>
        {error && (
          <p
            role="alert"
            className="mb-4 rounded border border-red-700 p-3 text-red-300"
          >
            {error}
          </p>
        )}

        {organizations.length > 1 && (
          <select
            value={v.organizationId}
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
        )}
        {v.organizationId && (
          <label className="mt-3 block text-xs text-neutral-400">
            Vendor (optional)
            <select
              value={v.vendorId || ""}
              onChange={(e) => setV({ ...v, vendorId: e.target.value })}
              className="mt-1 w-full rounded border border-neutral-700 bg-black px-3 py-2"
            >
              <option value="">No vendor association</option>
              {vendors
                .filter(
                  (x) =>
                    x.organization_id === v.organizationId &&
                    x.status !== "inactive",
                )
                .map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name || x.vendor_code}
                  </option>
                ))}
            </select>
          </label>
        )}
        {[
          ["title", "Title"],
          ["contractType", "Type"],
          ["status", "Status"],
          ["counterpartyName", "Counterparty"],
          ["effectiveOn", "Effective date"],
          ["expiresOn", "Expiry date"],
        ].map(([k, n]) => (
          <label key={k} className="mt-3 block text-xs text-neutral-400">
            {n}
            <input
              type={k === "effectiveOn" || k === "expiresOn" ? "date" : "text"}
              value={v[k] || ""}
              onChange={(e) => setV({ ...v, [k]: e.target.value })}
              className="mt-1 w-full rounded border border-neutral-700 bg-black px-3 py-2"
            />
          </label>
        ))}
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose}>Cancel</button>
          <button
            disabled={
              busy ||
              !v.organizationId ||
              !v.title ||
              !v.contractType ||
              !v.status
            }
            onClick={() => onSave(v)}
            className="rounded bg-[#FA4616] px-4 py-2 font-black text-black"
          >
            Create contract
          </button>
        </div>
      </fieldset>
    </AdminDrawerShell>
  );
}
function BookingModal({
  facilities,
  busy,
  error,
  onClose,
  onSave,
}: {
  facilities: any[];
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (v: any) => void;
}) {
  const [v, setV] = useState<any>({ facilityId: "", startsAt: "", endsAt: "" });
  return (
    <AdminDrawerShell title="Book facility" busy={busy} onClose={onClose}>
      <fieldset disabled={busy}>
        {error && (
          <p
            role="alert"
            className="mb-4 rounded border border-red-700 p-3 text-red-300"
          >
            {error}
          </p>
        )}

        <label className="mt-4 block text-xs text-neutral-400">
          Facility
          <select
            value={v.facilityId}
            onChange={(e) => setV({ ...v, facilityId: e.target.value })}
            className="mt-1 w-full rounded border border-neutral-700 bg-black px-3 py-2"
          >
            <option value="">Select facility</option>
            {facilities
              .filter((f) => f.status === "active")
              .map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name || f.code}
                </option>
              ))}
          </select>
        </label>
        {[
          ["startsAt", "Starts"],
          ["endsAt", "Ends"],
        ].map(([k, n]) => (
          <label key={k} className="mt-3 block text-xs text-neutral-400">
            {n}
            <input
              type="datetime-local"
              value={v[k] || ""}
              onChange={(e) => setV({ ...v, [k]: e.target.value })}
              className="mt-1 w-full rounded border border-neutral-700 bg-black px-3 py-2"
            />
          </label>
        ))}
        <div className="mt-5 flex justify-end gap-3">
          <button onClick={onClose}>Cancel</button>
          <button
            disabled={busy || !v.facilityId || !v.startsAt || !v.endsAt}
            onClick={() => onSave(v)}
            className="rounded bg-[#FA4616] px-4 py-2 font-black text-black"
          >
            Create booking
          </button>
        </div>
      </fieldset>
    </AdminDrawerShell>
  );
}
function State({ text }: { text: string }) {
  return (
    <div className="p-8 text-white">
      <h1 className="text-2xl font-black">Facilities</h1>
      <p className="mt-2 text-neutral-500">{text}</p>
    </div>
  );
}
export default Facilities;
