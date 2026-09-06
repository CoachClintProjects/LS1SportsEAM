'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Archive, Building2, Pencil, Plus, RefreshCw, RotateCcw, X } from 'lucide-react';

type Row = Record<string, any>;
type Payload = {
  organizations: Row[];
  tenants: Row[];
  generatedAt: string;
  source: string;
  error?: string;
};

type Draft = {
  id?: string;
  tenantId: string;
  code: string;
  name: string;
  legalName: string;
  organizationType: string;
  status: string;
};

function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-neutral-800 bg-[#090b0b] p-5 lg:p-6 ${className}`}>{children}</section>;
}

export default function SuperUserOrganizationsWorkspace() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/superuser-organizations', { cache: 'no-store' });
      const json = (await response.json()) as Payload;
      if (!response.ok) throw new Error(json.error || 'Unable to load organizations.');
      setData(json);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load organizations.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function action(body: Record<string, unknown>) {
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/superuser-organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'SuperUser action failed.');
      await load();
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'SuperUser action failed.');
      return false;
    } finally {
      setSaving(false);
    }
  }

  function newDraft() {
    const tenantId = data?.tenants?.[0]?.id || '';
    setDraft({
      tenantId,
      code: '',
      name: '',
      legalName: '',
      organizationType: 'club',
      status: 'active',
    });
  }

  function editDraft(row: Row) {
    setDraft({
      id: row.id,
      tenantId: row.tenant_id,
      code: row.code || '',
      name: row.name || '',
      legalName: row.legal_name || '',
      organizationType: row.organization_type || 'club',
      status: row.status || 'active',
    });
  }

  async function saveDraft() {
    if (!draft) return;
    const ok = await action({
      action: draft.id ? 'update-organization' : 'create-organization',
      id: draft.id,
      tenantId: draft.tenantId,
      code: draft.code,
      name: draft.name,
      legalName: draft.legalName,
      organizationType: draft.organizationType,
      status: draft.status,
    });
    if (ok) setDraft(null);
  }

  const organizations = data?.organizations || [];
  const activeCount = useMemo(() => organizations.filter((row) => row.status === 'active').length, [organizations]);
  const archivedCount = useMemo(() => organizations.filter((row) => row.status === 'archived').length, [organizations]);
  const selected = organizations.find((row) => row.id === selectedId) || null;

  return (
    <div className="space-y-6">
      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <div className="text-[9px] font-black uppercase tracking-[.25em] text-emerald-400">SUPERUSER · ENTERPRISE</div>
            <h1 className="mt-2 text-3xl font-black text-white">Organizations</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-400">
              Canonical organization master. Create, edit, archive, and restore organizations through audited server-side actions.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={newDraft}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-4 py-3 text-xs font-black text-black"
            >
              <Plus className="h-4 w-4" /> New organization
            </button>
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-xl border border-neutral-700 p-3 text-neutral-400 hover:text-white"
              aria-label="Refresh organizations"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </Panel>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-200">
          <AlertTriangle className="h-4 w-4" /> {error}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Panel>
          <div className="text-[9px] font-black uppercase tracking-[.16em] text-neutral-600">Organizations</div>
          <div className="mt-3 text-3xl font-black text-white">{organizations.length}</div>
        </Panel>
        <Panel>
          <div className="text-[9px] font-black uppercase tracking-[.16em] text-neutral-600">Active</div>
          <div className="mt-3 text-3xl font-black text-white">{activeCount}</div>
        </Panel>
        <Panel>
          <div className="text-[9px] font-black uppercase tracking-[.16em] text-neutral-600">Archived</div>
          <div className="mt-3 text-3xl font-black text-white">{archivedCount}</div>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,.8fr)]">
        <Panel>
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-emerald-400" />
            <div>
              <div className="text-[9px] font-black uppercase tracking-[.18em] text-neutral-500">Master data</div>
              <h2 className="text-xl font-black text-white">Organization records</h2>
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-xl border border-neutral-800">
            <div className="grid grid-cols-[100px_minmax(0,1.2fr)_minmax(120px,.7fr)_100px] gap-3 border-b border-neutral-800 bg-[#0d1010] px-4 py-3 text-[9px] font-black uppercase tracking-[.12em] text-neutral-600">
              <div>Code</div><div>Name</div><div>Type</div><div>Status</div>
            </div>
            {organizations.length ? organizations.map((row) => (
              <button
                type="button"
                key={row.id}
                onClick={() => setSelectedId(row.id)}
                className={`grid w-full grid-cols-[100px_minmax(0,1.2fr)_minmax(120px,.7fr)_100px] gap-3 border-b border-neutral-900 px-4 py-3 text-left text-xs transition last:border-b-0 ${
                  selectedId === row.id ? 'bg-emerald-500/10' : 'bg-black/10 hover:bg-white/[0.03]'
                }`}
              >
                <div className="font-mono font-bold text-white">{row.code}</div>
                <div className="truncate font-bold text-white">{row.name}</div>
                <div className="truncate text-neutral-500">{row.organization_type || '—'}</div>
                <div className="text-neutral-400">{row.status || '—'}</div>
              </button>
            )) : (
              <div className="p-6 text-sm text-neutral-500">No organization records found.</div>
            )}
          </div>
        </Panel>

        <Panel>
          {selected ? (
            <div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[9px] font-black uppercase tracking-[.18em] text-emerald-400">Selected record</div>
                  <h2 className="mt-1 text-2xl font-black text-white">{selected.name}</h2>
                  <div className="mt-1 font-mono text-xs text-neutral-500">{selected.code}</div>
                </div>
                <button type="button" onClick={() => setSelectedId(null)} className="rounded-lg border border-neutral-700 p-2 text-neutral-500 hover:text-white">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-5 space-y-3 text-xs">
                <div className="rounded-xl border border-neutral-800 bg-[#0d1010] p-4">
                  <div className="text-[9px] font-black uppercase text-neutral-600">Legal name</div>
                  <div className="mt-2 text-white">{selected.legal_name || 'Not set'}</div>
                </div>
                <div className="rounded-xl border border-neutral-800 bg-[#0d1010] p-4">
                  <div className="text-[9px] font-black uppercase text-neutral-600">Organization type</div>
                  <div className="mt-2 text-white">{selected.organization_type || 'Not set'}</div>
                </div>
                <div className="rounded-xl border border-neutral-800 bg-[#0d1010] p-4">
                  <div className="text-[9px] font-black uppercase text-neutral-600">Status</div>
                  <div className="mt-2 text-white">{selected.status}</div>
                </div>
              </div>

              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => editDraft(selected)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-700 px-3 py-3 text-xs font-black text-white"
                >
                  <Pencil className="h-4 w-4" /> Edit
                </button>
                {selected.status === 'archived' ? (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void action({ action: 'restore-organization', id: selected.id })}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-3 py-3 text-xs font-black text-emerald-300"
                  >
                    <RotateCcw className="h-4 w-4" /> Restore
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void action({ action: 'archive-organization', id: selected.id })}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-3 text-xs font-black text-amber-200"
                  >
                    <Archive className="h-4 w-4" /> Archive
                  </button>
                )}
              </div>

              <p className="mt-5 text-[10px] leading-5 text-neutral-600">
                Organizations are lifecycle-managed rather than hard-deleted because downstream teams, people, finance, competition, audit, and compliance records may reference them.
              </p>
            </div>
          ) : (
            <div className="flex min-h-64 items-center justify-center text-center text-sm text-neutral-500">
              Select an organization to open its record workspace.
            </div>
          )}
        </Panel>
      </div>

      {draft && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-neutral-700 bg-[#090b0b] p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[9px] font-black uppercase tracking-[.18em] text-emerald-400">Privileged write</div>
                <h2 className="mt-1 text-2xl font-black text-white">{draft.id ? 'Edit organization' : 'New organization'}</h2>
              </div>
              <button type="button" onClick={() => setDraft(null)} className="rounded-lg border border-neutral-700 p-2 text-neutral-400">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {!draft.id && (
                <label className="sm:col-span-2">
                  <span className="mb-2 block text-[9px] font-black uppercase tracking-[.14em] text-neutral-600">Tenant</span>
                  <select
                    value={draft.tenantId}
                    onChange={(event) => setDraft({ ...draft, tenantId: event.target.value })}
                    className="w-full rounded-xl border border-neutral-700 bg-black p-3 text-white"
                  >
                    {data?.tenants?.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name || tenant.id}</option>)}
                  </select>
                </label>
              )}
              <label>
                <span className="mb-2 block text-[9px] font-black uppercase tracking-[.14em] text-neutral-600">Code</span>
                <input value={draft.code} onChange={(event) => setDraft({ ...draft, code: event.target.value })} className="w-full rounded-xl border border-neutral-700 bg-black p-3 text-white" />
              </label>
              <label>
                <span className="mb-2 block text-[9px] font-black uppercase tracking-[.14em] text-neutral-600">Type</span>
                <input value={draft.organizationType} onChange={(event) => setDraft({ ...draft, organizationType: event.target.value })} className="w-full rounded-xl border border-neutral-700 bg-black p-3 text-white" />
              </label>
              <label className="sm:col-span-2">
                <span className="mb-2 block text-[9px] font-black uppercase tracking-[.14em] text-neutral-600">Name</span>
                <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className="w-full rounded-xl border border-neutral-700 bg-black p-3 text-white" />
              </label>
              <label className="sm:col-span-2">
                <span className="mb-2 block text-[9px] font-black uppercase tracking-[.14em] text-neutral-600">Legal name</span>
                <input value={draft.legalName} onChange={(event) => setDraft({ ...draft, legalName: event.target.value })} className="w-full rounded-xl border border-neutral-700 bg-black p-3 text-white" />
              </label>
              {draft.id && (
                <label className="sm:col-span-2">
                  <span className="mb-2 block text-[9px] font-black uppercase tracking-[.14em] text-neutral-600">Status</span>
                  <select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })} className="w-full rounded-xl border border-neutral-700 bg-black p-3 text-white">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="archived">Archived</option>
                  </select>
                </label>
              )}
            </div>

            <button
              type="button"
              disabled={saving || !draft.tenantId || !draft.code.trim() || !draft.name.trim()}
              onClick={() => void saveDraft()}
              className="mt-5 w-full rounded-xl bg-emerald-400 px-4 py-3 text-sm font-black text-black disabled:opacity-40"
            >
              {saving ? 'Saving…' : draft.id ? 'Save organization' : 'Create organization'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
