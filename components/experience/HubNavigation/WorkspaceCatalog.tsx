"use client";
import { useEffect, useRef, useState } from "react";
import { authenticatedFetch } from "@/lib/client/authenticatedFetch";
export default function WorkspaceCatalog({
  hub,
  role,
  labelPrefix,
}: {
  hub: string;
  role: string;
  labelPrefix?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  const [kind, setKind] = useState("automations"),
    [rows, setRows] = useState<any[]>([]),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  async function open(next: string) {
    const current = ++generation.current;
    setKind(next);
    setRows([]);
    setError("");
    setLoading(true);
    dialog.current?.showModal();
    try {
      const r = await authenticatedFetch(
        `/api/workspace-catalog?hub=${encodeURIComponent(hub)}&role=${encodeURIComponent(role)}&kind=${next}`,
        { cache: "no-store" },
      );
      const j = await r.json();
      if (current !== generation.current) return;
      if (!r.ok) throw new Error(j.error);
      setRows(j.rows || []);
    } catch (e) {
      if (current === generation.current)
        setError(e instanceof Error ? e.message : "Catalog unavailable.");
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }
  return (
    <>
      <div className="mb-4 border-t border-neutral-800 pt-3">
        {["automations", "marketplace"].map((k) => (
          <button
            key={k}
            onClick={() => open(k)}
            className="block w-full rounded px-3 py-2 text-left text-sm text-neutral-300 hover:bg-neutral-900"
          >
            {labelPrefix
              ? `${labelPrefix} ${k === "automations" ? "Automations Center" : "App Marketplace"}`
              : k === "automations"
                ? "Automations"
                : "Marketplace"}
          </button>
        ))}
      </div>
      <dialog
        ref={dialog}
        aria-label={`${labelPrefix || "Workspace"} ${kind}`}
        onClose={() => {
          generation.current++;
        }}
        className="admin-slide-panel fixed inset-y-0 left-auto right-0 m-0 h-dvh max-h-none w-[min(720px,94vw)] max-w-none border-l border-neutral-600 bg-[#161B22] p-6 text-white backdrop:bg-black/65"
      >
        <div className="flex justify-between">
          <h2 className="text-xl font-semibold">
            {kind === "automations" ? "Automations" : "Marketplace"}
          </h2>
          <button
            onClick={() => dialog.current?.close()}
            className="rounded border border-neutral-600 px-3 py-1"
          >
            Close
          </button>
        </div>
        <p className="mt-3 text-sm text-neutral-400">
          {kind === "automations"
            ? "Configured workflow definitions for your organization."
            : "Organization-approved integration catalog. Listing a connection does not install or activate it."}
        </p>
        {loading && (
          <p role="status" className="mt-6">
            Loading…
          </p>
        )}
        {error && (
          <p role="alert" className="mt-6 text-red-300">
            {error}{" "}
            <button onClick={() => void open(kind)} className="ml-2 underline">
              Retry
            </button>
          </p>
        )}
        {!loading && !error && !rows.length && (
          <p className="mt-6 text-sm text-neutral-300">
            {kind === "automations"
              ? "No workflows configured."
              : "No integrations published to this catalog."}
          </p>
        )}
        <div className="mt-6 space-y-3">
          {rows.map((r) => (
            <details
              key={r.id}
              className="rounded border border-neutral-700 bg-[#242529] p-4"
            >
              <summary className="cursor-pointer font-semibold text-blue-200">
                {r.name}
              </summary>
              <dl className="mt-3 space-y-2 text-sm">
                <div>
                  <dt className="text-neutral-400">Code</dt>
                  <dd>{r.code}</dd>
                </div>
                {kind === "automations" ? (
                  <>
                    <div>Status: {r.status}</div>
                    <div>Version: {r.version}</div>
                  </>
                ) : (
                  <>
                    <div>{r.description}</div>
                    <div>Type: {r.integration_type}</div>
                  </>
                )}
              </dl>
            </details>
          ))}
        </div>
      </dialog>
    </>
  );
}
