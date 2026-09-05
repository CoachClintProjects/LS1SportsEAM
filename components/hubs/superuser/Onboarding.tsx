'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Circle,
  Plus,
  RefreshCw,
  Rocket,
  Save,
  X,
} from 'lucide-react';

type Row = Record<string, any>;
type CasePayload = { case: Row | null; steps: Row[]; error?: string };
type QueuePayload = { cases: Row[]; error?: string };

function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-neutral-800 bg-[#090b0b] p-5 lg:p-6 ${className}`}>
      {children}
    </section>
  );
}

export function Onboarding() {
  const [queue, setQueue] = useState<Row[]>([]);
  const [selected, setSelected] = useState<CasePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ client_name: '', primary_admin_email: '', sports: 'SWIMMING' });

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/superuser/onboarding', { cache: 'no-store' });
      const json = (await response.json()) as QueuePayload;
      if (!response.ok) throw new Error(json.error || 'Unable to load onboarding queue.');
      setQueue(json.cases || []);

      if (typeof window !== 'undefined') {
        const id = new URLSearchParams(window.location.search).get('case');
        if (id) await openCase(id, false);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load onboarding queue.');
    } finally {
      setLoading(false);
    }
  }, []);

  async function openCase(id: string, updateUrl = true) {
    setError('');
    try {
      const response = await fetch(`/api/superuser/onboarding?case=${encodeURIComponent(id)}`, { cache: 'no-store' });
      const json = (await response.json()) as CasePayload;
      if (!response.ok) throw new Error(json.error || 'Unable to load onboarding case.');
      setSelected(json);
      if (updateUrl && typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.set('case', id);
        window.history.replaceState({}, '', url.toString());
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load onboarding case.');
    }
  }

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  async function post(body: Record<string, unknown>) {
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/superuser/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Unable to save onboarding data.');
      if (json.case) {
        setSelected(json);
        if (typeof window !== 'undefined') {
          const url = new URL(window.location.href);
          url.searchParams.set('case', json.case.id);
          window.history.replaceState({}, '', url.toString());
        }
      }
      await loadQueue();
      return json;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save onboarding data.');
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function createCase() {
    const sports = form.sports
      .split(',')
      .map((value) => value.trim().toUpperCase())
      .filter(Boolean);
    const result = await post({
      action: 'create-case',
      client_name: form.client_name,
      primary_admin_email: form.primary_admin_email || null,
      sports,
      notes: { created_from: 'superuser_onboarding_workspace' },
    });
    if (result) {
      setShowCreate(false);
      setForm({ client_name: '', primary_admin_email: '', sports: 'SWIMMING' });
    }
  }

  const completeCount = useMemo(
    () => selected?.steps.filter((step) => step.status === 'completed').length || 0,
    [selected],
  );
  const progress = selected?.steps.length
    ? Math.round((completeCount / selected.steps.length) * 100)
    : 0;

  return (
    <main className="mx-auto max-w-[1600px] space-y-6 p-5 lg:p-8">
      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <div className="text-[9px] font-black uppercase tracking-[.24em] text-[#FA4616]">
              SUPERUSER · CLIENT OPERATIONS
            </div>
            <h1 className="mt-2 text-3xl font-black text-white">Client Onboarding</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-400">
              Provision and validate a client through one canonical LS1Sports workflow. Every step writes to the live onboarding tables and remains auditable.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-[#FA4616] px-4 py-3 text-xs font-black text-black"
            >
              <Plus className="h-4 w-4" /> New client
            </button>
            <button
              type="button"
              onClick={() => void loadQueue()}
              className="rounded-xl border border-neutral-700 p-3 text-neutral-400 hover:text-white"
              aria-label="Refresh"
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

      <div className="grid gap-6 xl:grid-cols-[.8fr_1.2fr]">
        <Panel>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[9px] font-black uppercase tracking-[.18em] text-neutral-600">Queue</div>
              <h2 className="mt-1 text-xl font-black text-white">Clients</h2>
            </div>
            <div className="text-2xl font-black text-white">{queue.length}</div>
          </div>
          <div className="mt-5 space-y-2">
            {queue.length ? (
              queue.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => void openCase(item.id)}
                  className={`w-full rounded-xl border p-4 text-left transition ${
                    selected?.case?.id === item.id
                      ? 'border-[#FA4616]/50 bg-[#FA4616]/5'
                      : 'border-neutral-800 bg-[#0d1010] hover:border-neutral-600'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-black text-white">{item.client_name}</div>
                      <div className="mt-1 text-[10px] uppercase tracking-[.12em] text-neutral-500">
                        {item.status} · step {item.current_step}/12
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-neutral-600" />
                  </div>
                </button>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-neutral-800 p-6 text-sm text-neutral-500">
                No onboarding cases yet. Create the first client here.
              </div>
            )}
          </div>
        </Panel>

        <Panel>
          {selected?.case ? (
            <div>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-[9px] font-black uppercase tracking-[.18em] text-emerald-400">Live case</div>
                  <h2 className="mt-1 text-2xl font-black text-white">{selected.case.client_name}</h2>
                  <div className="mt-1 text-xs text-neutral-500">
                    {selected.case.primary_admin_email || 'Primary admin not assigned'} · {(selected.case.sports || []).join(', ') || 'No sport selected'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-black text-white">{progress}%</div>
                  <div className="text-[9px] uppercase tracking-[.16em] text-neutral-600">{completeCount}/12 complete</div>
                </div>
              </div>

              <div className="mt-5 h-2 overflow-hidden rounded-full bg-neutral-800">
                <div className="h-full rounded-full bg-emerald-400" style={{ width: `${progress}%` }} />
              </div>

              <div className="mt-6 space-y-2">
                {selected.steps.map((step) => {
                  const complete = step.status === 'completed';
                  return (
                    <div key={step.id} className="flex items-center gap-3 rounded-xl border border-neutral-800 bg-[#0d1010] p-4">
                      {complete ? (
                        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
                      ) : (
                        <Circle className="h-5 w-5 shrink-0 text-neutral-700" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold text-white">{step.sort_order}. {step.step_name}</div>
                        <div className="mt-1 text-[10px] uppercase tracking-[.14em] text-neutral-600">{step.status}</div>
                      </div>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() =>
                          void post({
                            action: 'update-step',
                            case_id: selected.case.id,
                            step_id: step.id,
                            status: complete ? 'in_progress' : 'completed',
                            evidence: { updated_from: 'superuser_onboarding_workspace' },
                          })
                        }
                        className={`rounded-lg px-3 py-2 text-[10px] font-black ${
                          complete
                            ? 'border border-neutral-700 text-neutral-300'
                            : 'bg-emerald-400 text-black'
                        }`}
                      >
                        {complete ? 'Reopen' : 'Complete'}
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 flex flex-wrap gap-2 border-t border-neutral-800 pt-5">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() =>
                    void post({
                      action: 'update-case',
                      id: selected.case.id,
                      status: 'IN_PROGRESS',
                      current_step: selected.case.current_step,
                    })
                  }
                  className="inline-flex items-center gap-2 rounded-xl border border-neutral-700 px-4 py-3 text-xs font-black text-white"
                >
                  <Save className="h-4 w-4" /> Save state
                </button>
                <button
                  type="button"
                  disabled={saving || progress < 90}
                  onClick={() => void post({ action: 'activate', id: selected.case.id })}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#FA4616] px-4 py-3 text-xs font-black text-black disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Rocket className="h-4 w-4" /> Activate client
                </button>
              </div>
            </div>
          ) : (
            <div className="flex min-h-[420px] items-center justify-center text-center">
              <div>
                <div className="text-lg font-black text-white">Select a client</div>
                <p className="mt-2 max-w-md text-sm leading-6 text-neutral-500">
                  Open an onboarding case to see the live 12-step provisioning workflow, evidence, and actions.
                </p>
              </div>
            </div>
          )}
        </Panel>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-neutral-700 bg-[#090b0b] p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[9px] font-black uppercase tracking-[.18em] text-[#FA4616]">Create live record</div>
                <h2 className="mt-1 text-2xl font-black text-white">New client onboarding</h2>
              </div>
              <button type="button" onClick={() => setShowCreate(false)} className="rounded-lg border border-neutral-700 p-2 text-neutral-400">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-6 space-y-4">
              <label className="block text-xs text-neutral-400">
                Client / organization name
                <input
                  value={form.client_name}
                  onChange={(event) => setForm({ ...form, client_name: event.target.value })}
                  className="mt-1 w-full rounded-xl border border-neutral-700 bg-black p-3 text-white"
                />
              </label>
              <label className="block text-xs text-neutral-400">
                Primary admin email
                <input
                  type="email"
                  value={form.primary_admin_email}
                  onChange={(event) => setForm({ ...form, primary_admin_email: event.target.value })}
                  className="mt-1 w-full rounded-xl border border-neutral-700 bg-black p-3 text-white"
                />
              </label>
              <label className="block text-xs text-neutral-400">
                Sports (comma separated)
                <input
                  value={form.sports}
                  onChange={(event) => setForm({ ...form, sports: event.target.value })}
                  className="mt-1 w-full rounded-xl border border-neutral-700 bg-black p-3 text-white"
                />
              </label>
            </div>
            <button
              type="button"
              disabled={saving || !form.client_name.trim()}
              onClick={() => void createCase()}
              className="mt-6 w-full rounded-xl bg-[#FA4616] px-4 py-3 text-sm font-black text-black disabled:opacity-40"
            >
              {saving ? 'Creating…' : 'Create client & 12-step workflow'}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
