"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { authenticatedFetch } from "@/lib/client/authenticatedFetch";
import { AdminDrawerShell } from "./AdminDrawerShell";
import { timeWindow } from "@/lib/equipmentPolicy";
type Row = Record<string, any>;
const button =
  "rounded border border-[#30363D] bg-[#161B22] px-3 py-2 text-sm disabled:opacity-40";
const input =
  "mt-1 w-full rounded border border-[#30363D] bg-[#0A0C10] p-2 text-white";
const card = "rounded-lg border border-[#30363D] bg-[#161B22] p-4";
const titles: Record<string, string> = {
  "eq-home": "Today’s Tasks",
  "eq-maintenance": "Facility Maintenance Logs",
  "eq-intake": "Warehouse Shipping Intake",
  "eq-crates": "Squad Training Crates",
  "eq-scrap": "Gear Disposal & Scrap",
  "eq-schedules": "Warehouse Schedules",
};
const localDate = (v: string) => {
  const d = new Date(v);
  return Number.isFinite(d.getTime())
    ? new Date(d.getTime() - d.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16)
    : "";
};
const date = (v: string) => (v ? new Date(v).toLocaleString() : "Not recorded");
function Table({
  rows,
  columns,
  open,
}: {
  rows: Row[];
  columns: [string, (r: Row) => React.ReactNode][];
  open: (r: Row) => void;
}) {
  const [page, setPage] = useState(0);
  const last = Math.max(0, Math.ceil(rows.length / 25) - 1),
    current = Math.min(page, last);
  return (
    <div className="space-y-3">
      {!rows.length ? (
        <p className="text-slate-400">No saved records.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  {columns.map(([c]) => (
                    <th className="border-b border-[#30363D] p-2" key={c}>
                      {c}
                    </th>
                  ))}
                  <th className="p-2">Record</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(current * 25, current * 25 + 25).map((r) => (
                  <tr key={r.id}>
                    {columns.map(([c, render]) => (
                      <td className="border-b border-[#30363D] p-2" key={c}>
                        {render(r)}
                      </td>
                    ))}
                    <td className="p-2">
                      <button className={button} onClick={() => open(r)}>
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-3">
            <button
              className={button}
              disabled={!current}
              onClick={() => setPage(current - 1)}
            >
              Previous
            </button>
            <span>
              {current + 1} / {last + 1}
            </span>
            <button
              className={button}
              disabled={current === last}
              onClick={() => setPage(current + 1)}
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
export default function EquipmentWorkspace() {
  const params = useSearchParams(),
    view = params.get("view") || "eq-home";
  const [data, setData] = useState<Row | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState<Row | null>(null),
    [form, setForm] = useState<Row>({}),
    [reason, setReason] = useState(""),
    [history, setHistory] = useState<Row[]>([]),
    [filter, setFilter] = useState(""),
    [days, setDays] = useState(14),
    [start, setStart] = useState(new Date().toISOString().slice(0, 10));
  const suppressClick = useRef(false);
  const sequence = useRef(0),
    detailSeq = useRef(0),
    requestId = useRef(""),
    requestBody = useRef("");
  const load = useCallback(async () => {
    const seq = ++sequence.current;
    try {
      const r = await authenticatedFetch("/api/admin-equipment", {
          cache: "no-store",
        }),
        j = await r.json();
      if (!r.ok) throw new Error(j.error);
      if (seq === sequence.current) {
        setData(j);
        setError("");
      }
    } catch (e) {
      if (seq === sequence.current)
        setError(e instanceof Error ? e.message : "Equipment unavailable.");
    }
  }, []);
  useEffect(() => {
    load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 30000);
    return () => {
      clearInterval(timer);
      sequence.current++;
      detailSeq.current++;
    };
  }, [load]);
  useEffect(() => {
    setSelected(null);
    setFilter("");
    detailSeq.current++;
  }, [view]);
  const open = (kind: string, row: Row = {}, changes: Row = {}) => {
    setSelected({ ...row, kind });
    setReason("");
    setError("");
    setHistory([]);
    requestId.current = "";
    requestBody.current = "";
    setForm({
      ...row,
      starts_at: localDate(
        row.starts_at || row.scheduled_start || new Date().toISOString(),
      ),
      ends_at: localDate(
        row.ends_at ||
          row.scheduled_end ||
          new Date(Date.now() + 3600000).toISOString(),
      ),
      currency: row.currency || "",
      ...changes,
    });
    const seq = ++detailSeq.current;
    if (row.id)
      authenticatedFetch(`/api/admin-equipment?id=${row.id}`, {
        cache: "no-store",
      })
        .then(async (r) => {
          const j = await r.json();
          if (!r.ok) throw new Error(j.error);
          if (seq === detailSeq.current) setHistory(j.history);
        })
        .catch((e) => {
          if (seq === detailSeq.current) setError(e.message);
        });
  };
  const save = async (action: string, values: Row = form) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (reason.trim().length < 10)
        throw new Error("Enter a reason of at least 10 characters.");
      let v = { ...values };
      if (
        ["maintenance", "shutdown", "reschedule", "blackout"].includes(action)
      )
        v = { ...v, ...timeWindow(v.starts_at, v.ends_at) };
      const key = JSON.stringify({ action, values: v, reason });
      if (key !== requestBody.current) {
        requestId.current = crypto.randomUUID();
        requestBody.current = key;
      }
      const r = await authenticatedFetch("/api/admin-equipment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            values: v,
            request_id: requestId.current,
            reason,
            authority:
              action === "reopen"
                ? "org_admin"
                : action === "release_hold"
                  ? "treasurer"
                  : undefined,
          }),
        }),
        j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setNotice(j.message);
      setSelected(null);
      detailSeq.current++;
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  };
  const field = (key: string, label: string, type = "text") => (
    <label className="block text-sm" key={key}>
      {label}
      <input
        type={type}
        className={input}
        value={form[key] ?? ""}
        step={type === "number" ? "0.001" : undefined}
        maxLength={type === "text" ? 200 : undefined}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
      />
    </label>
  );
  const choose = (
    key: string,
    label: string,
    rows: Row[],
    display: (r: Row) => string = (r) => r.name,
  ) => (
    <label className="block text-sm" key={key}>
      {label}
      <select
        className={input}
        value={form[key] || ""}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
      >
        <option value="">Select…</option>
        {rows.map((r) => (
          <option key={r.id} value={r.id}>
            {display(r)}
          </option>
        ))}
      </select>
    </label>
  );
  if (!data)
    return (
      <main className="p-6 text-white">
        <p>{error || "Loading equipment records…"}</p>
        <button className={button} onClick={load}>
          Retry
        </button>
      </main>
    );
  const name = (rows: Row[], id: string) =>
    rows.find((r) => r.id === id)?.name || id;
  const crates = data.tasks.filter(
      (t: Row) => t.metadata.kind === "equipment_crate",
    ),
    openCrates = crates.filter((t: Row) => t.status !== "completed"),
    holds = data.tasks.filter((t: Row) => t.metadata.kind === "equipment_hold"),
    closures = data.closures.filter((c: Row) => c.status === "active"),
    receipts = data.transactions.filter(
      (t: Row) => t.transaction_type === "receipt",
    );
  const filtered = (rows: Row[]) =>
    rows.filter((r) =>
      JSON.stringify(r).toLowerCase().includes(filter.toLowerCase()),
    );
  const activeItems = data.items.filter((r: Row) => r.active),
    screened = openCrates.filter((t: Row) => t.metadata.safety_pass).length;
  const onHand = data.balances.reduce(
      (s: number, b: Row) => s + Number(b.on_hand),
      0,
    ),
    reserved = data.balances.reduce(
      (s: number, b: Row) => s + Number(b.reserved),
      0,
    );
  const accuracy = receipts.filter(
    (t: Row) =>
      Number(t.metadata.expected) === Number(t.metadata.quantity) &&
      !Number(t.metadata.damaged),
  ).length;
  const empty = (
    <section className={card}>
      <h2 className="font-bold">
        0 ACTIVE WAREHOUSE STOCK ITEMS RECORDED [INVENTORY SCHEMA VACANT]
      </h2>
      <p className="my-3 text-sm text-slate-300">
        Register your first stock item and warehouse bin, then record the real
        delivery.
      </p>
      <button
        className={`${button} border-orange-500`}
        disabled={!data.canCreate}
        onClick={() => open("intake")}
      >
        + RECEIVE AND INTAKE BULK DELIVERY SHIPMENT
      </button>
    </section>
  );
  const ranges = [
    ...data.bookings.map((r: Row) => ({
      ...r,
      kind: "booking",
      label: "Booking",
      starts_at: r.starts_at,
      ends_at: r.ends_at,
    })),
    ...data.closures.map((r: Row) => ({
      ...r,
      kind: "closure",
      label: r.reason,
    })),
    ...data.maintenance.map((r: Row) => ({
      ...r,
      kind: "maintenance",
      label: r.description,
      starts_at: r.scheduled_start,
      ends_at: r.scheduled_end,
    })),
  ].filter((r) => !["cancelled", "completed", "resolved"].includes(r.status));
  const begin = new Date(start + "T00:00:00").getTime(),
    duration = days * 86400000;
  const draftSchedule = (r: Row, shift = 0, resize = false) =>
    open("schedule", r, {
      kind: r.kind,
      previous_start: r.starts_at,
      previous_end: r.ends_at,
      starts_at: localDate(
        new Date(Date.parse(r.starts_at) + (resize ? 0 : shift)).toISOString(),
      ),
      ends_at: localDate(new Date(Date.parse(r.ends_at) + shift).toISOString()),
    });
  const submitButton = (
    action: string,
    label: string,
    values?: Row,
    disabled = false,
  ) => (
    <button
      type="button"
      className={`${button} border-orange-500 bg-orange-950`}
      disabled={busy || disabled || !data.canUpdate}
      onClick={() => save(action, values || form)}
    >
      {busy ? "Saving…" : label}
    </button>
  );
  return (
    <main className="min-h-screen space-y-5 bg-[#0A0C10] p-6 text-white">
      <header className="flex flex-wrap justify-between gap-3">
        <div>
          <p className="text-sm text-orange-400">Gear & Field Crew</p>
          <h1 className="text-3xl font-bold">
            {titles[view] || titles["eq-home"]}
          </h1>
        </div>
        <button className={button} onClick={load}>
          Refresh
        </button>
      </header>
      {notice && (
        <p role="status" className={card}>
          {notice}
        </p>
      )}
      {error && !selected && (
        <p role="alert" className="rounded border border-red-600 p-3">
          {error}
        </p>
      )}
      <div className="grid gap-3 md:grid-cols-3">
        {[
          [
            "Delivery accuracy",
            receipts.length
              ? `${Math.round((accuracy / receipts.length) * 100)}% · ${receipts.length} receipts`
              : "No receipts recorded",
          ],
          [
            "Stock reserved",
            onHand
              ? `${Math.round((reserved / onHand) * 100)}% of recorded units`
              : "No stock recorded",
          ],
          [
            "Equipment screening",
            openCrates.length
              ? `${screened} / ${openCrates.length} active crates passed`
              : "No active crates",
          ],
        ].map(([label, value]) => (
          <section className={card} key={label}>
            <h2 className="text-sm text-slate-400">{label}</h2>
            <p className="mt-2 text-lg font-bold">{value}</p>
          </section>
        ))}
      </div>
      {activeItems.length === 0 && empty}
      <div className="flex flex-wrap gap-2">
        <button
          className={button}
          disabled={!data.canCreate}
          onClick={() => open("intake")}
        >
          Receive shipment
        </button>
        <button
          className={button}
          disabled={!data.canCreate}
          onClick={() => open("item")}
        >
          Register stock item
        </button>
        <button
          className={button}
          disabled={!data.canCreate}
          onClick={() => open("bin")}
        >
          Add warehouse bin
        </button>
        <button
          className={button}
          disabled={!data.canCreate}
          onClick={() => open("maintenance_new")}
        >
          Schedule maintenance
        </button>
        <button
          className={`${button} border-red-500`}
          disabled={!data.canCreate}
          onClick={() => open("shutdown")}
        >
          Report emergency closure
        </button>
        <button
          className={button}
          disabled={!data.canCreate}
          onClick={() => open("blackout")}
        >
          Plan holiday / maintenance blackout
        </button>
      </div>
      <label className="block max-w-md text-sm">
        Search records
        <input
          className={input}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </label>
      {view === "eq-home" && (
        <section className={`${card} space-y-3`}>
          <h2 className="font-bold">What needs attention</h2>
          {!activeItems.length && (
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={false}
                onChange={() => open("intake")}
              />
              STOCK CATALOG VACANT — receive and register stock
            </label>
          )}
          {holds
            .filter((t: Row) => t.status !== "completed")
            .map((t: Row) => (
              <label key={t.id} className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={false}
                  onChange={() => open("hold", t)}
                />
                DELIVERY MISMATCH —{" "}
                {data.orders.find(
                  (o: Row) => o.id === t.metadata.purchase_order_id,
                )?.po_number || t.title}
                <button className={button} onClick={() => open("hold", t)}>
                  Review
                </button>
              </label>
            ))}
          {openCrates
            .filter((t: Row) => !t.metadata.safety_pass)
            .map((t: Row) => (
              <label key={t.id} className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={false}
                  onChange={() => open("crate", t)}
                />
                SAFETY PROVISIONING — {t.title}
              </label>
            ))}
          {closures.map((c: Row) => (
            <button
              key={c.id}
              className={`${button} block text-red-300`}
              onClick={() => open("closure", c)}
            >
              UNAVAILABLE · {name(data.facilities, c.facility_id)} · {c.reason}
            </button>
          ))}
          {activeItems.length > 0 &&
            !holds.some((t: Row) => t.status !== "completed") &&
            !openCrates.some((t: Row) => !t.metadata.safety_pass) &&
            !closures.length && (
              <p>No equipment exceptions currently recorded.</p>
            )}
        </section>
      )}
      {view === "eq-intake" && (
        <>
          <section className={card}>
            <h2 className="mb-3 font-bold">Stock catalog</h2>
            <Table
              rows={filtered(data.items)}
              open={(r) => open("stock", r)}
              columns={[
                ["Item", (r) => r.name],
                ["SKU", (r) => r.sku],
                ["Unit", (r) => r.unit_of_measure],
                [
                  "On hand",
                  (r) =>
                    data.balances
                      .filter((b: Row) => b.item_id === r.id)
                      .reduce((s: number, b: Row) => s + Number(b.on_hand), 0),
                ],
              ]}
            />
          </section>
          <section className={card}>
            <h2 className="mb-3 font-bold">Shipment history</h2>
            <Table
              rows={filtered(receipts)}
              open={(r) => open("transaction", r)}
              columns={[
                ["Item", (r) => name(data.items, r.item_id)],
                ["Packing slip", (r) => r.metadata.packing_slip],
                ["Usable quantity", (r) => r.quantity],
                ["Received", (r) => date(r.occurred_at)],
              ]}
            />
          </section>
          <section className={card}>
            <h2 className="mb-3 font-bold">Vendor discrepancy holds</h2>
            <Table
              rows={filtered(holds)}
              open={(r) => open("hold", r)}
              columns={[
                [
                  "Order",
                  (r) =>
                    data.orders.find(
                      (o: Row) => o.id === r.metadata.purchase_order_id,
                    )?.po_number,
                ],
                ["Status", (r) => r.status],
                ["Reason", (r) => r.description],
              ]}
            />
          </section>
        </>
      )}
      {view === "eq-crates" && (
        <section className={card}>
          <div className="mb-4 flex justify-between">
            <h2 className="font-bold">Squad crates</h2>
            <button
              className={button}
              onClick={() => open("crate_new", {}, { lines: [] })}
            >
              Build training crate
            </button>
          </div>
          <p className="mb-4 text-sm text-slate-400">
            Choose item sizes from the stock catalog. Athlete sizing is not
            recorded in the current athlete profiles; confirm fit with the squad
            before allocation.
          </p>
          <Table
            rows={filtered(crates)}
            open={(r) => open("crate", r)}
            columns={[
              ["Crate", (r) => r.title],
              ["Squad", (r) => name(data.teams, r.team_id)],
              [
                "Safety",
                (r) =>
                  r.metadata.safety_pass ? "Passed" : "Inspection required",
              ],
              ["Stage", (r) => r.metadata.stage],
            ]}
          />
        </section>
      )}
      {view === "eq-scrap" && (
        <section className={card}>
          <div className="mb-4 flex justify-between">
            <h2 className="font-bold">Certified disposals</h2>
            <button className={button} onClick={() => open("scrap")}>
              Record disposal
            </button>
          </div>
          <p className="mb-3 text-sm text-slate-400">
            Disposal reduces unreserved stock and records cost evidence.
            Treasurer reconciles the financial write-off.
          </p>
          <Table
            rows={filtered(
              data.transactions.filter(
                (r: Row) => r.transaction_type === "disposal",
              ),
            )}
            open={(r) => open("transaction", r)}
            columns={[
              ["Item", (r) => name(data.items, r.item_id)],
              ["Quantity", (r) => -Number(r.quantity)],
              [
                "Declared value",
                (r) =>
                  `${r.metadata.currency} ${(Math.abs(Number(r.quantity)) * Number(r.unit_cost)).toFixed(2)}`,
              ],
              ["Disposed", (r) => date(r.occurred_at)],
            ]}
          />
        </section>
      )}
      {view === "eq-maintenance" && (
        <section className={card}>
          <h2 className="mb-4 font-bold">Maintenance work orders</h2>
          <Table
            rows={filtered(data.maintenance)}
            open={(r) => open("work", r)}
            columns={[
              ["Facility", (r) => name(data.facilities, r.facility_id)],
              ["Work", (r) => r.description],
              ["Status", (r) => r.status],
              ["Start", (r) => date(r.scheduled_start)],
            ]}
          />
        </section>
      )}
      {view === "eq-schedules" && (
        <section className={`${card} space-y-3`}>
          <div className="flex flex-wrap gap-3">
            <label>
              Window start
              <input
                className={input}
                type="date"
                value={start}
                onChange={(e) => e.target.value && setStart(e.target.value)}
              />
            </label>
            <label>
              Days
              <select
                className={input}
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
              >
                {[7, 14, 28].map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </label>
          </div>
          <p className="text-sm text-slate-300">
            Blue: booking · Amber: maintenance · Red: closure. Click a bar to
            review. Drag a booking or maintenance bar to move it; drag its right
            edge to change its duration. Review and save in the drawer.
          </p>
          <div className="overflow-x-auto">
            <div className="min-w-[900px]">
              <div className="ml-48 flex text-xs">
                {Array.from({ length: days }, (_, i) => (
                  <span key={i} style={{ width: `${100 / days}%` }}>
                    {new Date(begin + i * 86400000).toLocaleDateString(
                      undefined,
                      { month: "short", day: "numeric" },
                    )}
                  </span>
                ))}
              </div>
              {filtered(data.facilities).map((f: Row) => {
                const bars = ranges.filter(
                  (r) =>
                    r.facility_id === f.id &&
                    Date.parse(r.starts_at) < begin + duration &&
                    Date.parse(r.ends_at) > begin,
                );
                return (
                  <div key={f.id} className="flex border-t border-[#30363D]">
                    <div className="w-48 shrink-0 p-2 text-sm">
                      {f.name}
                      <small className="block text-slate-400">{f.status}</small>
                    </div>
                    <div
                      className="relative flex-1"
                      style={{ height: Math.max(48, bars.length * 34) }}
                    >
                      {bars.map((r: Row, i: number) => {
                        const left = Math.max(
                            0,
                            ((Date.parse(r.starts_at) - begin) / duration) *
                              100,
                          ),
                          right = Math.min(
                            100,
                            ((Date.parse(r.ends_at) - begin) / duration) * 100,
                          );
                        return (
                          <button
                            key={r.kind + r.id}
                            className={`absolute h-7 truncate rounded px-2 text-left text-xs ${r.kind === "closure" ? "bg-red-900" : r.kind === "booking" ? "bg-blue-900" : "bg-amber-900"}`}
                            style={{
                              left: `${left}%`,
                              width: `${Math.max(0.5, right - left)}%`,
                              top: i * 34 + 4,
                              touchAction: "none",
                            }}
                            title={`${r.label}: ${date(r.starts_at)} – ${date(r.ends_at)}`}
                            onClick={() => {
                              if (suppressClick.current) {
                                suppressClick.current = false;
                                return;
                              }
                              r.kind === "closure"
                                ? open("closure", r)
                                : draftSchedule(r);
                            }}
                            onPointerDown={(e) => {
                              if (
                                r.kind === "closure" ||
                                !data.canUpdate ||
                                e.button !== 0
                              )
                                return;
                              const element = e.currentTarget,
                                rect = element.getBoundingClientRect(),
                                parent =
                                  element.parentElement!.getBoundingClientRect(),
                                x = e.clientX,
                                resize = x > rect.right - 12;
                              element.setPointerCapture(e.pointerId);
                              element.onpointerup = (ev) => {
                                element.onpointerup = null;
                                const dx = ev.clientX - x;
                                if (Math.abs(dx) < 8) return;
                                const shift =
                                  Math.round(
                                    ((dx / parent.width) * duration) / 3600000,
                                  ) * 3600000;
                                if (
                                  shift &&
                                  (!resize ||
                                    Date.parse(r.ends_at) + shift >
                                      Date.parse(r.starts_at))
                                )
                                  draftSchedule(r, shift, resize);
                                suppressClick.current = true;
                              };
                            }}
                          >
                            {r.label || r.kind}
                            {r.kind !== "closure" && (
                              <span className="absolute right-0 top-0 h-full w-2 cursor-ew-resize bg-white/20" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {!data.facilities.length && (
                <p className="p-3">
                  No club facilities configured. Organization Admin can register
                  facilities under Staff and club settings.
                </p>
              )}
            </div>
          </div>
        </section>
      )}
      {selected && (
        <AdminDrawerShell
          title={
            selected.name ||
            selected.title ||
            (
              {
                item: "Register stock item",
                bin: "Add warehouse bin",
                intake: "Receive and intake bulk delivery shipment",
                crate_new: "Build squad training crate",
                scrap: "Certified equipment disposal",
                shutdown: "Emergency facility closure",
                blackout: "Planned facility blackout",
                maintenance_new: "Schedule maintenance",
                schedule: "Adjust warehouse schedule",
              } as Row
            )[selected.kind] ||
            "Equipment record"
          }
          busy={busy}
          onClose={() => {
            setSelected(null);
            detailSeq.current++;
          }}
        >
          <div className="grid gap-5 lg:grid-cols-[1fr_2fr_1fr]">
            <aside className="space-y-3">
              <h3 className="font-semibold">Record context</h3>
              <p className="break-all text-xs text-slate-400">
                {selected.id || "New record"}
              </p>
              <p>{selected.status || "Preparing"}</p>
              {selected.facility_id && (
                <p>{name(data.facilities, selected.facility_id)}</p>
              )}
              {selected.team_id && <p>{name(data.teams, selected.team_id)}</p>}
              <p className="text-sm text-slate-400">
                Equipment actions do not change athlete clearance or banking
                access.
              </p>
            </aside>
            <section className="space-y-4">
              {error && (
                <p role="alert" className="border border-red-600 p-3">
                  {error}
                </p>
              )}
              {selected.kind === "item" && (
                <>
                  {field("sku", "Stock code / SKU")}
                  {field("name", "Item name, including size where relevant")}
                  {field("item_type", "Equipment type")}
                  {field("unit", "Unit of measure")}
                  {submitButton(
                    "create_item",
                    "Register item",
                    undefined,
                    !data.canCreate,
                  )}
                </>
              )}
              {selected.kind === "bin" && (
                <>
                  {choose("facility_id", "Facility", data.facilities)}
                  {field("code", "Bin code")}
                  {field("name", "Bin name")}
                  {submitButton(
                    "create_bin",
                    "Register bin",
                    undefined,
                    !data.canCreate,
                  )}
                </>
              )}
              {["intake", "scrap"].includes(selected.kind) && (
                <>
                  {choose("item_id", "Stock item", activeItems)}
                  {choose(
                    "location_id",
                    "Warehouse bin",
                    data.bins,
                    (r) =>
                      `${r.name} · ${name(data.facilities, r.facility_id)}`,
                  )}
                  {(!activeItems.length || !data.bins.length) && (
                    <div className="flex gap-2">
                      <button className={button} onClick={() => open("item")}>
                        Register item
                      </button>
                      <button className={button} onClick={() => open("bin")}>
                        Add bin
                      </button>
                    </div>
                  )}
                  {selected.kind === "intake" && (
                    <>
                      {choose(
                        "purchase_order_line_id",
                        "Purchase order line (required for a vendor error)",
                        data.lines.filter(
                          (l: Row) =>
                            l.item_id === form.item_id &&
                            data.orders.some(
                              (o: Row) =>
                                o.id === l.purchase_order_id &&
                                ["issued", "partially_received"].includes(
                                  o.status,
                                ),
                            ),
                        ),
                        (r) =>
                          `${data.orders.find((o: Row) => o.id === r.purchase_order_id)?.po_number} · ${r.description} · ${Number(r.quantity) - Number(r.received_quantity)} outstanding`,
                      )}
                      {field(
                        "packing_slip",
                        "Packing slip / shipment reference",
                      )}
                      {field("expected", "Expected count", "number")}
                      {field("damaged", "Damaged count", "number")}
                    </>
                  )}
                  {field(
                    "quantity",
                    selected.kind === "intake"
                      ? "Delivered count (including damaged)"
                      : "Quantity to dispose",
                    "number",
                  )}
                  {field("unit_cost", "Recorded unit cost", "number")}
                  {choose(
                    "currency",
                    "Cost currency",
                    ["CAD", "USD", "EUR", "GBP", "AUD", "NZD"].map((c) => ({
                      id: c,
                      name: c,
                    })),
                  )}
                  {selected.kind === "scrap" &&
                    field(
                      "certificate",
                      "Disposal certificate / evidence reference",
                    )}
                  {selected.kind === "intake"
                    ? submitButton(
                        "receive",
                        Number(form.quantity) !== Number(form.expected) ||
                          Number(form.damaged) > 0
                          ? "LOG VENDOR ERROR"
                          : "Receive shipment",
                        undefined,
                        !activeItems.length || !data.bins.length,
                      )
                    : submitButton("scrap", "COMIT LIFECYCLE DISPOSAL")}
                </>
              )}
              {selected.kind === "crate_new" && (
                <>
                  {field("name", "Crate name")}
                  {choose(
                    "team_id",
                    "Squad",
                    data.teams.filter((t: Row) => t.status === "active"),
                  )}
                  {(form.lines || []).map((line: Row, index: number) => (
                    <div
                      className="space-y-2 rounded border border-[#30363D] p-2"
                      key={index}
                    >
                      <label className="block text-sm">
                        Item
                        <select
                          className={input}
                          value={line.item_id || ""}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              lines: form.lines.map((l: Row, i: number) =>
                                i === index
                                  ? { ...l, item_id: e.target.value }
                                  : l,
                              ),
                            })
                          }
                        >
                          <option value="">Select item…</option>
                          {activeItems.map((i: Row) => (
                            <option key={i.id} value={i.id}>
                              {i.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block text-sm">
                        Warehouse bin
                        <select
                          className={input}
                          value={line.location_id || ""}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              lines: form.lines.map((l: Row, i: number) =>
                                i === index
                                  ? { ...l, location_id: e.target.value }
                                  : l,
                              ),
                            })
                          }
                        >
                          <option value="">Select bin…</option>
                          {data.bins.map((b: Row) => (
                            <option key={b.id} value={b.id}>
                              {b.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block text-sm">
                        Quantity
                        <input
                          className={input}
                          type="number"
                          min="0.001"
                          step="0.001"
                          value={line.quantity || ""}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              lines: form.lines.map((l: Row, i: number) =>
                                i === index
                                  ? { ...l, quantity: e.target.value }
                                  : l,
                              ),
                            })
                          }
                        />
                      </label>
                      <button
                        className={button}
                        onClick={() =>
                          setForm({
                            ...form,
                            lines: form.lines.filter(
                              (_: Row, i: number) => i !== index,
                            ),
                          })
                        }
                      >
                        Remove line
                      </button>
                    </div>
                  ))}
                  <button
                    className={button}
                    disabled={(form.lines || []).length >= 100}
                    onClick={() =>
                      setForm({ ...form, lines: [...(form.lines || []), {}] })
                    }
                  >
                    Add stock line
                  </button>
                  {submitButton("create_crate", "Reserve crate")}
                </>
              )}
              {selected.kind === "crate" && (
                <>
                  <h3 className="font-semibold">Reserved gear</h3>
                  {selected.metadata.lines.map((l: Row, i: number) => (
                    <p key={i}>
                      {name(data.items, l.item_id)} ·{" "}
                      {name(data.bins, l.location_id)} · {l.quantity}
                    </p>
                  ))}
                  <p>
                    Screening:{" "}
                    {selected.metadata.safety_pass ? "Passed" : "Required"}
                  </p>
                  {selected.status !== "completed" && (
                    <>
                      {!selected.metadata.safety_pass && (
                        <>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={!!form.inspected}
                              onChange={(e) =>
                                setForm({
                                  ...form,
                                  inspected: e.target.checked,
                                })
                              }
                            />
                            TOGGLE SAFETY SCREENING PASS — I physically
                            inspected this crate
                          </label>
                          {submitButton(
                            "safety_pass",
                            "Save safety screening",
                            {
                              id: selected.id,
                              revision: selected.revision,
                              inspected: form.inspected,
                            },
                            !form.inspected,
                          )}
                        </>
                      )}
                      {submitButton("return_crate", "Confirm crate returned", {
                        id: selected.id,
                        revision: selected.revision,
                      })}
                    </>
                  )}
                </>
              )}
              {["maintenance_new", "shutdown", "schedule", "blackout"].includes(
                selected.kind,
              ) && (
                <>
                  {selected.kind !== "schedule" &&
                    choose("facility_id", "Facility", data.facilities)}
                  {field(
                    "starts_at",
                    "Starts (your local time)",
                    "datetime-local",
                  )}
                  {field("ends_at", "Ends (your local time)", "datetime-local")}
                  {submitButton(
                    selected.kind === "maintenance_new"
                      ? "maintenance"
                      : selected.kind === "blackout"
                        ? "blackout"
                        : selected.kind === "shutdown"
                          ? "shutdown"
                          : "reschedule",
                    selected.kind === "shutdown"
                      ? "Mark UNAVAILABLE and escalate"
                      : "Save schedule",
                  )}
                </>
              )}
              {selected.kind === "work" && (
                <>
                  <p>{selected.description}</p>
                  <p>
                    {date(selected.scheduled_start)} –{" "}
                    {date(selected.scheduled_end)}
                  </p>
                  {!["completed", "cancelled"].includes(selected.status) && (
                    <>
                      <button
                        className={button}
                        onClick={() =>
                          draftSchedule({
                            ...selected,
                            kind: "maintenance",
                            starts_at: selected.scheduled_start,
                            ends_at: selected.scheduled_end,
                          })
                        }
                      >
                        Adjust schedule
                      </button>
                      {submitButton(
                        "complete_maintenance",
                        "Record repair complete",
                        { id: selected.id },
                      )}
                    </>
                  )}
                </>
              )}
              {selected.kind === "closure" && (
                <>
                  {selected.status === "active" &&
                    !data.tasks.some(
                      (t: Row) =>
                        t.metadata.kind === "equipment_shutdown" &&
                        t.metadata.closure_id === selected.id,
                    ) && (
                      <button
                        className={button}
                        onClick={() =>
                          draftSchedule({ ...selected, kind: "closure" })
                        }
                      >
                        Adjust blackout window
                      </button>
                    )}
                  <p>{selected.reason}</p>
                  <p>
                    {date(selected.starts_at)} – {date(selected.ends_at)}
                  </p>
                  {selected.status === "active" &&
                    (data.canReopen ? (
                      submitButton("reopen", "Authorize reopening", {
                        id: selected.id,
                      })
                    ) : (
                      <p className="text-sm text-amber-300">
                        Organization Admin must authorize reopening.
                      </p>
                    ))}
                </>
              )}
              {selected.kind === "hold" && (
                <>
                  <p>{selected.description}</p>
                  <p>
                    Expected {selected.metadata.expected} · Delivered{" "}
                    {selected.metadata.delivered} · Damaged{" "}
                    {selected.metadata.damaged}
                  </p>
                  <p>Packing slip: {selected.metadata.packing_slip}</p>
                  <p className="text-sm">
                    Payments to this vendor within the club are blocked until
                    this discrepancy is resolved.
                  </p>
                  {selected.status !== "completed" &&
                    (data.canReleaseHold ? (
                      submitButton("release_hold", "Resolve vendor hold", {
                        id: selected.id,
                        revision: selected.revision,
                      })
                    ) : (
                      <p>
                        Treasurer or Organization Admin must resolve this hold.
                      </p>
                    ))}
                </>
              )}
              {selected.kind === "stock" && (
                <>
                  <p>
                    SKU: {selected.sku} · {selected.unit_of_measure}
                  </p>
                  {data.balances
                    .filter((b: Row) => b.item_id === selected.id)
                    .map((b: Row) => (
                      <p key={b.location_id}>
                        {name(data.bins, b.location_id)}: {b.on_hand} on hand ·{" "}
                        {b.reserved} reserved · {b.available} available
                      </p>
                    ))}
                  <button
                    className={button}
                    onClick={() => open("intake", {}, { item_id: selected.id })}
                  >
                    Receive this item
                  </button>
                  <h3 className="font-semibold">Stock movements</h3>
                  {data.transactions
                    .filter((t: Row) => t.item_id === selected.id)
                    .map((t: Row) => (
                      <button
                        key={t.id}
                        className={`${button} block`}
                        onClick={() => open("transaction", t)}
                      >
                        {t.transaction_type} · {t.quantity} ·{" "}
                        {date(t.occurred_at)}
                      </button>
                    ))}
                </>
              )}
              {selected.kind === "transaction" && (
                <>
                  <p>
                    {name(data.items, selected.item_id)} ·{" "}
                    {name(data.bins, selected.location_id)}
                  </p>
                  <p>
                    {selected.transaction_type}: {selected.quantity}
                  </p>
                  <p>
                    Cost evidence: {selected.metadata.currency}{" "}
                    {selected.unit_cost} / unit
                  </p>
                  <p>{selected.metadata.reason}</p>
                  <p>
                    {selected.metadata.certificate ||
                      selected.metadata.packing_slip}
                  </p>
                  <p>{date(selected.occurred_at)}</p>
                </>
              )}
              {!["stock", "transaction"].includes(selected.kind) && (
                <label className="block text-sm">
                  Reason / inspection / supporting evidence
                  <textarea
                    className={input}
                    rows={4}
                    maxLength={2000}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </label>
              )}
            </section>
            <aside className="space-y-3">
              <h3 className="font-semibold">Audit history</h3>
              {history.length ? (
                history.map((h) => (
                  <div
                    className="border-b border-[#30363D] pb-2 text-xs"
                    key={h.id}
                  >
                    <p>
                      {h.action.replace("equipment.", "").replaceAll("_", " ")}
                    </p>
                    <p>{date(h.occurred_at)}</p>
                    <p>{h.reason}</p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400">
                  No recorded equipment action history for this record.
                </p>
              )}
              <p className="text-xs text-slate-400">
                Refresh after a colleague changes a record. Stock reservations
                and receipts are checked again when saved.
              </p>
            </aside>
          </div>
        </AdminDrawerShell>
      )}
    </main>
  );
}
