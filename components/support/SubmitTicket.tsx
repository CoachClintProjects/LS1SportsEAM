"use client";
import { useRef, useState } from "react";
import { authenticatedFetch } from "@/lib/client/authenticatedFetch";
export default function SubmitTicket() {
  const dialog = useRef<HTMLDialogElement>(null),
    requestId = useRef("");
  const [title, setTitle] = useState(""),
    [description, setDescription] = useState(""),
    [severity, setSeverity] = useState("normal"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [ticket, setTicket] = useState<any>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await authenticatedFetch("/api/support-tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: requestId.current,
          title,
          description,
          severity,
          page: location.pathname + location.search,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setTicket(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submission failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button
        onClick={() => {
          requestId.current = crypto.randomUUID();
          setTicket(null);
          setError("");
          dialog.current?.showModal();
        }}
        className="mb-3 w-full rounded-md bg-[#FA4616] px-3 py-2 text-sm font-semibold text-white hover:bg-orange-600"
      >
        ➕ SUBMIT HELP TICKET
      </button>
      <dialog
        ref={dialog}
        className="fixed inset-y-0 left-auto right-0 m-0 h-dvh max-h-none w-[min(520px,94vw)] max-w-none border-l border-neutral-600 bg-[#18191c] p-6 text-white backdrop:bg-black/65"
        style={{ colorScheme: "dark" }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Submit Ticket</h2>
          <button
            aria-label="Close ticket drawer"
            onClick={() => dialog.current?.close()}
            className="rounded border border-neutral-600 px-3 py-1"
          >
            Close
          </button>
        </div>
        {ticket ? (
          <div role="status" className="mt-6">
            <h3 className="text-lg text-emerald-300">Ticket saved</h3>
            <p className="mt-3 break-all text-sm">{ticket.ticket_number}</p>
            <p className="mt-2 text-sm">Status: {ticket.status}</p>
            <p className="mt-5 text-sm text-amber-200">
              Email delivery is pending support mailbox configuration.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block text-sm">
              Subject
              <input
                autoFocus
                required
                maxLength={200}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-2 w-full rounded border border-neutral-600 bg-[#242529] p-2"
              />
            </label>
            <label className="block text-sm">
              What happened?
              <textarea
                required
                maxLength={10000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-2 min-h-40 w-full rounded border border-neutral-600 bg-[#242529] p-2"
              />
            </label>
            <label className="block text-sm">
              Priority
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                className="mt-2 w-full rounded border border-neutral-600 bg-[#242529] p-2"
              >
                {["low", "normal", "high", "critical"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            {error && (
              <p role="alert" className="text-sm text-red-300">
                {error}
              </p>
            )}
            <button
              disabled={busy}
              className="rounded bg-[#FA4616] px-4 py-2 font-semibold disabled:opacity-50"
            >
              {busy ? "Submitting…" : "Submit ticket"}
            </button>
          </form>
        )}
      </dialog>
    </>
  );
}
