"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { authenticatedFetch } from "@/lib/client/authenticatedFetch";
import { AdminDrawerShell } from "@/components/hubs/admin/AdminDrawerShell";
type Notification = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  read_at: string | null;
};
export default function NotificationDrawer({
  onClose,
}: {
  onClose: () => void;
}) {
  const [rows, setRows] = useState<Notification[] | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const version = useRef(0);
  const load = useCallback(async () => {
    const n = ++version.current;
    const r = await authenticatedFetch("/api/my-notifications", {
      cache: "no-store",
    });
    const j = await r.json();
    if (n !== version.current) return;
    if (!r.ok) throw new Error(j.error);
    setRows(j);
    setError("");
  }, []);
  useEffect(() => {
    let active = true;
    const generation = version;
    const refresh = () =>
      void load().catch((e) => {
        if (active) setError(e.message);
      });
    refresh();
    const timer = setInterval(refresh, 30000);
    return () => {
      active = false;
      generation.current++;
      clearInterval(timer);
    };
  }, [load]);
  const read = async (id: string) => {
    setBusy(true);
    try {
      const r = await authenticatedFetch("/api/my-notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!r.ok) throw new Error((await r.json()).error);
      await load();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to update notification.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <AdminDrawerShell
      title="Your LS1 notifications"
      onClose={onClose}
      busy={busy}
    >
      <div className="space-y-4">
        {error && <p role="alert">{error}</p>}
        <button
          className="rounded border border-neutral-600 px-3 py-2"
          onClick={() => void load().catch((e) => setError(e.message))}
        >
          Refresh
        </button>
        {!rows && !error && <p role="status">Loading notifications…</p>}
        {rows?.length === 0 && (
          <p>No notifications have been recorded for you.</p>
        )}
        {rows?.map((n) => (
          <article
            key={n.id}
            className="rounded border border-neutral-600 bg-[#161B22] p-4"
          >
            <h3 className="font-semibold">{n.title}</h3>
            <p className="whitespace-pre-wrap py-3">{n.body}</p>
            <p className="text-sm">
              {new Date(n.created_at).toLocaleString()} ·{" "}
              {n.read_at ? "Read" : "Unread"}
            </p>
            {!n.read_at && (
              <button
                disabled={busy}
                className="mt-3 rounded border border-neutral-600 px-3 py-2"
                onClick={() => void read(n.id)}
              >
                Mark read
              </button>
            )}
          </article>
        ))}
      </div>
    </AdminDrawerShell>
  );
}
