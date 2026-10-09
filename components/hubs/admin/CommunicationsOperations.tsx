"use client";
import { AdminDrawerShell } from "./AdminDrawerShell";
import { useEffect, useMemo, useState } from "react";
import { authenticatedFetch } from "@/lib/client/authenticatedFetch";
export function CommunicationsOperations({
  role = "communications_media",
}: {
  role?: string;
}) {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState<any>(null),
    [create, setCreate] = useState(false);
  async function load() {
    const r = await authenticatedFetch(
        `/api/admin-command?role=${encodeURIComponent(role)}`,
        { cache: "no-store" },
      ),
      j = await r.json();
    if (!r.ok) throw new Error(j.error);
    setData(j.communicationData);
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [role]);
  async function act(body: any) {
    setBusy(true);
    setError("");
    try {
      const r = await authenticatedFetch("/api/admin-command", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...body, role }),
        }),
        j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setSelected(null);
      setCreate(false);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (!data)
    return (
      <div className="p-8 text-white">{error || "Loading communications…"}</div>
    );
  return (
    <main className="p-5 text-white lg:p-7">
      <div className="text-[9px] font-black uppercase tracking-[.22em] text-[#FA4616]">
        {role.replaceAll("_", " ")} · Communications
      </div>
      <div className="mt-1 flex items-center justify-between gap-3">
        <h1 className="text-3xl font-black">Communications operations</h1>
        <button
          onClick={() => setCreate(true)}
          className="rounded bg-[#FA4616] px-4 py-2 text-xs font-black text-black"
        >
          + Campaign
        </button>
      </div>
      <p className="mt-2 text-sm text-neutral-400">
        Club audiences, message templates and campaign status. External delivery
        is not implied until a configured delivery channel exists.
      </p>
      {error && <p className="mt-3 text-red-300">{error}</p>}
      <section className="mt-5 overflow-hidden rounded-2xl border border-neutral-800 bg-[#090b0b]">
        <div className="grid grid-cols-4 border-b border-neutral-800 p-4 text-xs text-neutral-500">
          <b>Campaign</b>
          <b>Channel</b>
          <b>Scheduled</b>
          <b>Status</b>
        </div>
        {(data.campaigns || []).map((x: any) => (
          <button
            key={x.id}
            onClick={() => setSelected(x)}
            className="grid w-full grid-cols-4 border-b border-neutral-800 p-4 text-left text-sm hover:bg-white/[.03]"
          >
            <b>{x.name}</b>
            <span>{x.channel_type || "—"}</span>
            <span>
              {x.scheduled_at ? new Date(x.scheduled_at).toLocaleString() : "—"}
            </span>
            <span>{x.status || "draft"}</span>
          </button>
        ))}
        {!data.campaigns?.length && (
          <div className="p-8 text-sm text-neutral-500">
            No canonical communication campaigns exist.
          </div>
        )}
      </section>
      {create && (
        <CampaignModal
          error={error}
          data={data}
          busy={busy}
          close={() => setCreate(false)}
          save={(v) => act({ action: "create-communication-campaign", ...v })}
        />
      )}{" "}
      {selected && (
        <AdminDrawerShell
          title={selected.name || "Campaign"}
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
              <div className="mt-4 text-sm text-neutral-400">
                {selected.channel_type} · {selected.status}
              </div>
            </section>
            <fieldset disabled={busy} className="min-w-0">
              <legend className="font-semibold">Actions</legend>
              <div className="mt-6 flex gap-2">
                {selected.status !== "cancelled" && (
                  <button
                    disabled={busy}
                    onClick={() =>
                      act({
                        action: "update-communication-campaign",
                        id: selected.id,
                        changes: { status: "cancelled" },
                      })
                    }
                    className="rounded border border-red-900 px-3 py-2 text-xs font-black text-red-300"
                  >
                    Cancel campaign
                  </button>
                )}
                {selected.status === "cancelled" && (
                  <button
                    disabled={busy}
                    onClick={() =>
                      act({
                        action: "update-communication-campaign",
                        id: selected.id,
                        changes: { status: "draft" },
                      })
                    }
                    className="rounded border border-neutral-600 px-3 py-2 text-xs font-black"
                  >
                    Restore draft
                  </button>
                )}
              </div>
            </fieldset>
            <section className="min-w-0">
              <h3 className="font-semibold">Linked records</h3>
              <dl className="mt-4 space-y-3 text-sm">
                <dt>Audience</dt>
                <dd>
                  {data.audiences?.find(
                    (row: any) => row.id === selected.audience_id,
                  )?.name || "Not linked"}
                </dd>
                <dt>Template</dt>
                <dd>
                  {data.templates?.find(
                    (row: any) => row.id === selected.template_id,
                  )?.name || "Not linked"}
                </dd>
                <dt>Scheduled</dt>
                <dd>
                  {selected.scheduled_at
                    ? new Date(selected.scheduled_at).toLocaleString()
                    : "Not scheduled"}
                </dd>
              </dl>
            </section>
          </div>
        </AdminDrawerShell>
      )}
    </main>
  );
}
function CampaignModal({
  data,
  busy,
  error,
  close,
  save,
}: {
  data: any;
  busy: boolean;
  error: string;
  close: () => void;
  save: (v: any) => void;
}) {
  const [v, setV] = useState<any>({
    name: "",
    audienceId: "",
    templateId: "",
    channelType: "",
    scheduledAt: "",
  });
  const templates = useMemo(() => data.templates || [], [data]);
  return (
    <AdminDrawerShell title="Create campaign" busy={busy} onClose={close}>
      <fieldset disabled={busy}>
        {error && (
          <p
            role="alert"
            className="mb-4 rounded border border-red-700 p-3 text-red-300"
          >
            {error}
          </p>
        )}

        <input
          value={v.name}
          onChange={(e) => setV({ ...v, name: e.target.value })}
          placeholder="Campaign name"
          className="mt-4 w-full rounded border border-neutral-700 bg-black px-3 py-2"
        />
        <select
          value={v.audienceId}
          onChange={(e) => setV({ ...v, audienceId: e.target.value })}
          className="mt-3 w-full rounded border border-neutral-700 bg-black px-3 py-2"
        >
          <option value="">Select active audience</option>
          {(data.audiences || [])
            .filter((x: any) => x.status === "active")
            .map((x: any) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
        </select>
        <select
          value={v.templateId}
          onChange={(e) => {
            const t = templates.find((x: any) => x.id === e.target.value);
            setV({
              ...v,
              templateId: e.target.value,
              channelType: t?.channel_type || v.channelType,
            });
          }}
          className="mt-3 w-full rounded border border-neutral-700 bg-black px-3 py-2"
        >
          <option value="">No template</option>
          {templates
            .filter((x: any) => x.status === "active")
            .map((x: any) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
        </select>
        <select
          value={v.channelType}
          onChange={(e) => setV({ ...v, channelType: e.target.value })}
          className="mt-3 w-full rounded border border-neutral-700 bg-black px-3 py-2"
        >
          <option value="">Select active channel</option>
          {(data.channels || [])
            .filter((x: any) => x.status === "active")
            .map((x: any) => (
              <option key={x.id} value={x.channel_type}>
                {x.name || x.code}
              </option>
            ))}
        </select>
        <input
          type="datetime-local"
          value={v.scheduledAt}
          onChange={(e) => setV({ ...v, scheduledAt: e.target.value })}
          className="mt-3 w-full rounded border border-neutral-700 bg-black px-3 py-2"
        />
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={close}>Cancel</button>
          <button
            disabled={busy || !v.name || !v.audienceId || !v.channelType}
            onClick={() => save(v)}
            className="rounded bg-[#FA4616] px-4 py-2 font-black text-black"
          >
            Create
          </button>
        </div>
      </fieldset>
    </AdminDrawerShell>
  );
}
export default CommunicationsOperations;
