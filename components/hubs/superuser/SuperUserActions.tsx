'use client';

import { useState } from 'react';

type Kind = 'client' | 'ticket' | 'import';

export default function SuperUserActions({
  onRefresh,
}: {
  onRefresh?: () => Promise<void> | void;
}) {
  const [kind, setKind] = useState<Kind | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState<any>({
    sports: 'SWIMMING',
    severity: 'MEDIUM',
    source_system: 'Hy-Tek',
    format: 'HY3',
  });

  const set = (key: string, value: string) =>
    setForm((current: any) => ({ ...current, [key]: value }));

  async function save() {
    setSaving(true);
    setMessage('');
    try {
      if (kind === 'import') {
        if (!file) throw new Error('Select the actual result export first.');
        const body = new FormData();
        body.append('file', file);
        body.append('source_system', form.source_system || 'UNKNOWN');
        body.append('format', form.format || 'UNKNOWN');
        const response = await fetch('/api/competition-import', { method: 'POST', body });
        const json = await response.json();
        if (!response.ok) throw new Error(json.error || 'Upload failed.');
        setMessage(
          `Result source saved to LS1 ingestion: ${json.filename || file.name}${
            json.staged_records !== undefined ? ` · ${json.staged_records} staged records` : ''
          }`,
        );
      } else {
        const action = kind === 'client' ? 'create-client' : 'create-ticket';
        const payload =
          kind === 'client'
            ? {
                action,
                client_name: form.client_name,
                primary_admin_email: form.primary_admin_email,
                sports: String(form.sports || 'SWIMMING')
                  .split(',')
                  .map((value) => value.trim().toUpperCase())
                  .filter(Boolean),
              }
            : {
                action,
                title: form.title,
                description: form.description,
                severity: form.severity,
              };

        const response = await fetch('/api/superuser-command', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const json = await response.json();
        if (!response.ok) throw new Error(json.error || 'Save failed.');
        setMessage('Saved to the live LS1SportsEAM database.');
      }

      setKind(null);
      setFile(null);
      await onRefresh?.();
      window.dispatchEvent(new CustomEvent('ls1sports:data-changed'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-neutral-800 bg-[#090b0b] p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-[9px] font-black uppercase tracking-[.2em] text-emerald-400">Live actions</div>
          <div className="mt-1 text-sm font-black text-white">Create and ingest into LS1Sports</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setKind('client')} className="rounded-lg bg-emerald-400 px-3 py-2 text-xs font-black text-black">+ New Client</button>
          <button onClick={() => setKind('import')} className="rounded-lg border border-neutral-700 px-3 py-2 text-xs font-bold text-white">Upload Live Results</button>
          <button onClick={() => setKind('ticket')} className="rounded-lg border border-neutral-700 px-3 py-2 text-xs font-bold text-white">Create Support Ticket</button>
        </div>
      </div>

      {message && (
        <div className="mt-3 rounded-lg border border-emerald-900/50 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-300">
          {message}
        </div>
      )}

      {kind && (
        <div className="mt-4 rounded-xl border border-neutral-800 bg-[#0d1010] p-5">
          <div className="text-sm font-black text-white">
            {kind === 'client'
              ? 'New Client Onboarding'
              : kind === 'ticket'
                ? 'New Support Ticket'
                : 'Live Competition Result Ingestion'}
          </div>

          <div className="mt-4 space-y-3">
            {kind === 'client' && (
              <>
                <input
                  required
                  placeholder="Client / organization name"
                  value={form.client_name || ''}
                  onChange={(event) => set('client_name', event.target.value)}
                  className="w-full rounded-lg border border-neutral-700 bg-black p-3 text-sm text-white"
                />
                <input
                  placeholder="Primary admin email"
                  value={form.primary_admin_email || ''}
                  onChange={(event) => set('primary_admin_email', event.target.value)}
                  className="w-full rounded-lg border border-neutral-700 bg-black p-3 text-sm text-white"
                />
                <input
                  placeholder="Sports, comma separated"
                  value={form.sports || ''}
                  onChange={(event) => set('sports', event.target.value)}
                  className="w-full rounded-lg border border-neutral-700 bg-black p-3 text-sm text-white"
                />
              </>
            )}

            {kind === 'ticket' && (
              <>
                <input
                  placeholder="Ticket title"
                  value={form.title || ''}
                  onChange={(event) => set('title', event.target.value)}
                  className="w-full rounded-lg border border-neutral-700 bg-black p-3 text-sm text-white"
                />
                <textarea
                  placeholder="Issue description"
                  value={form.description || ''}
                  onChange={(event) => set('description', event.target.value)}
                  className="min-h-24 w-full rounded-lg border border-neutral-700 bg-black p-3 text-sm text-white"
                />
              </>
            )}

            {kind === 'import' && (
              <>
                <input
                  type="file"
                  accept=".csv,.json,.txt,.xml,.hy3,.cl2,.mdb,.zip"
                  onChange={(event) => setFile(event.target.files?.[0] || null)}
                  className="w-full rounded-lg border border-neutral-700 bg-black p-3 text-sm text-white"
                />
                <input
                  value={form.source_system}
                  onChange={(event) => set('source_system', event.target.value)}
                  placeholder="Source system"
                  className="w-full rounded-lg border border-neutral-700 bg-black p-3 text-sm text-white"
                />
                <input
                  value={form.format}
                  onChange={(event) => set('format', event.target.value)}
                  placeholder="Format"
                  className="w-full rounded-lg border border-neutral-700 bg-black p-3 text-sm text-white"
                />
                <p className="text-xs leading-5 text-neutral-500">
                  CSV/JSON/XML/TXT source content is staged immediately. HY3, CL2, MDB and other binary exports retain source lineage and enter the parser queue. No result is fabricated.
                </p>
              </>
            )}
          </div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={() => void save()}
              disabled={saving}
              className="rounded-lg bg-emerald-400 px-4 py-2 text-xs font-black text-black disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save to live database'}
            </button>
            <button onClick={() => setKind(null)} className="rounded-lg border border-neutral-700 px-4 py-2 text-xs text-neutral-300">Cancel</button>
          </div>
        </div>
      )}
    </section>
  );
}
