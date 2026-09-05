'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  RefreshCw,
  Wallet,
  X,
} from 'lucide-react';

type Row = Record<string, any>;
type Payload = {
  invoices: Row[];
  vendorBills: Row[];
  tasks: Row[];
  metrics: {
    arBalance: number;
    apBalance: number;
    openInvoices: number;
    pastDue: number;
    activeAthletes: number;
    activeTeams: number;
  };
  generatedAt: string;
  source: string;
  error?: string;
};

const money = (value: unknown) =>
  new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(Number(value || 0));

function Panel({ children }: { children: React.ReactNode }) {
  return <section className="rounded-2xl border border-neutral-800 bg-[#090b0b] p-5">{children}</section>;
}

export function CommandCenter() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showTask, setShowTask] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin-command', { cache: 'no-store' });
      const json = (await response.json()) as Payload;
      if (!response.ok) throw new Error(json.error || 'Unable to load Admin command data.');
      setData(json);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load Admin command data.');
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
      const response = await fetch('/api/admin-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Admin action failed.');
      await load();
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Admin action failed.');
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function createTask() {
    const ok = await action({ action: 'create-task', title, description, priority: 'normal' });
    if (ok) {
      setTitle('');
      setDescription('');
      setShowTask(false);
    }
  }

  const metrics = data?.metrics;
  const tasks = data?.tasks || [];
  const invoices = data?.invoices || [];

  return (
    <main className="space-y-6 p-5 text-white lg:p-7">
      <section className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <div className="text-[9px] font-black uppercase tracking-[0.24em] text-[#FA4616]">HPAC ADMIN · LIVE OPERATIONS</div>
          <h1 className="mt-1 text-3xl font-black text-white">Command Center</h1>
          <p className="mt-2 text-sm text-neutral-400">
            {new Date().toLocaleDateString('en-CA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
          <p className="mt-1 text-[10px] text-neutral-600">
            {data?.generatedAt ? `Live refresh ${new Date(data.generatedAt).toLocaleTimeString('en-CA')}` : 'Loading live LS1SportsEAM data'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowTask(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-[#FA4616] px-4 py-3 text-xs font-black text-black"
          >
            <Plus className="h-4 w-4" /> New task
          </button>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-xl border border-neutral-700 p-3 text-neutral-400 hover:text-white"
            aria-label="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </section>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-200">
          <AlertTriangle className="h-4 w-4" /> {error}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {[
          ['AR Balance', money(metrics?.arBalance), Wallet],
          ['AP Balance', money(metrics?.apBalance), Wallet],
          ['Open Invoices', metrics?.openInvoices ?? '—', Clock],
          ['Past Due', metrics?.pastDue ?? '—', AlertTriangle],
          ['Active Athletes', metrics?.activeAthletes ?? '—', Activity],
          ['Active Teams', metrics?.activeTeams ?? '—', CheckCircle2],
        ].map(([label, value, Icon]: any) => (
          <Panel key={label}>
            <div className="flex items-center justify-between gap-2">
              <div className="text-[8px] font-black uppercase tracking-[.16em] text-neutral-600">{label}</div>
              <Icon className="h-4 w-4 text-[#FA4616]" />
            </div>
            <div className="mt-3 text-2xl font-black text-white">{value}</div>
          </Panel>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_.95fr]">
        <Panel>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[9px] font-black uppercase tracking-[.18em] text-[#FA4616]">Operational work</div>
              <h2 className="mt-1 text-xl font-black text-white">Open Admin Tasks</h2>
            </div>
            <div className="text-2xl font-black text-white">{tasks.length}</div>
          </div>
          <div className="mt-5 space-y-2">
            {tasks.length ? (
              tasks.map((task) => (
                <div key={task.id} className="flex items-start gap-3 rounded-xl border border-neutral-800 bg-[#0d1010] p-4">
                  <Activity className="mt-0.5 h-4 w-4 shrink-0 text-[#FA4616]" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-white">{task.payload?.title || task.work_type}</div>
                    <div className="mt-1 text-xs text-neutral-500">{task.payload?.description || 'No description'} · {task.priority || 'normal'}</div>
                  </div>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void action({ action: 'complete-task', id: task.id })}
                    className="rounded-lg bg-emerald-400 px-3 py-2 text-[10px] font-black text-black"
                  >
                    Complete
                  </button>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-neutral-800 p-6 text-sm text-neutral-500">No open Admin work items.</div>
            )}
          </div>
        </Panel>

        <Panel>
          <div className="text-[9px] font-black uppercase tracking-[.18em] text-[#FA4616]">Accounts receivable</div>
          <h2 className="mt-1 text-xl font-black text-white">Recent Invoices</h2>
          <div className="mt-5 space-y-2">
            {invoices.length ? (
              invoices.slice(0, 8).map((invoice) => (
                <div key={invoice.id} className="rounded-xl border border-neutral-800 bg-[#0d1010] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-bold text-white">{invoice.invoice_number}</div>
                    <div className="font-black text-white">{money(invoice.balance_due)}</div>
                  </div>
                  <div className="mt-1 text-[10px] uppercase tracking-[.12em] text-neutral-600">
                    {invoice.status || 'unknown'} · due {invoice.due_date || 'not set'}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-neutral-800 p-6 text-sm text-neutral-500">No invoice records are currently loaded.</div>
            )}
          </div>
        </Panel>
      </div>

      {showTask && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-neutral-700 bg-[#090b0b] p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[9px] font-black uppercase tracking-[.18em] text-[#FA4616]">Write to live database</div>
                <h2 className="mt-1 text-2xl font-black text-white">New Admin Task</h2>
              </div>
              <button type="button" onClick={() => setShowTask(false)} className="rounded-lg border border-neutral-700 p-2 text-neutral-400">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-6 space-y-4">
              <input
                autoFocus
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Task title"
                className="w-full rounded-xl border border-neutral-700 bg-black p-3 text-white"
              />
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Description"
                className="min-h-28 w-full rounded-xl border border-neutral-700 bg-black p-3 text-white"
              />
            </div>
            <button
              type="button"
              disabled={saving || !title.trim()}
              onClick={() => void createTask()}
              className="mt-5 w-full rounded-xl bg-[#FA4616] px-4 py-3 text-sm font-black text-black disabled:opacity-40"
            >
              {saving ? 'Saving…' : 'Create live task'}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
