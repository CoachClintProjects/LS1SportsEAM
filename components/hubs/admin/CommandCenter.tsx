'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
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

type TaskDraft = {
  id?: string;
  title: string;
  description: string;
  priority: string;
};

const emptyDraft: TaskDraft = { title: '', description: '', priority: 'normal' };

const money = (value: unknown) =>
  new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(Number(value || 0));

function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-neutral-800 bg-[#090b0b] p-5 ${className}`}>{children}</section>;
}

export function CommandCenter() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<TaskDraft | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

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

  async function saveDraft() {
    if (!draft?.title.trim()) return;
    const ok = await action({
      action: draft.id ? 'update-task' : 'create-task',
      id: draft.id,
      title: draft.title,
      description: draft.description,
      priority: draft.priority,
    });
    if (ok) setDraft(null);
  }

  async function deleteTask(task: Row) {
    const title = task.payload?.title || 'this Admin task';
    if (!window.confirm(`Delete “${title}”? This is allowed only for ADMIN_TASK work items and will be audit logged.`)) return;
    const ok = await action({ action: 'delete-task', id: task.id });
    if (ok) setSelectedTaskId(null);
  }

  const metrics = data?.metrics;
  const tasks = data?.tasks || [];
  const openTasks = useMemo(() => tasks.filter((task) => task.status !== 'completed'), [tasks]);
  const completedTasks = useMemo(() => tasks.filter((task) => task.status === 'completed'), [tasks]);
  const invoices = data?.invoices || [];
  const selectedTask = tasks.find((task) => task.id === selectedTaskId) || null;

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
            onClick={() => setDraft({ ...emptyDraft })}
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

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,.9fr)]">
        <Panel>
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[9px] font-black uppercase tracking-[.18em] text-[#FA4616]">Operational work queue</div>
              <h2 className="mt-1 text-xl font-black text-white">Admin Tasks</h2>
            </div>
            <div className="text-right">
              <div className="text-2xl font-black text-white">{openTasks.length}</div>
              <div className="text-[9px] uppercase tracking-[.12em] text-neutral-600">open</div>
            </div>
          </div>

          <div className="mt-5 space-y-2">
            {openTasks.length ? (
              openTasks.map((task) => (
                <button
                  type="button"
                  key={task.id}
                  onClick={() => setSelectedTaskId(task.id)}
                  className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition ${
                    selectedTaskId === task.id
                      ? 'border-[#FA4616]/60 bg-[#15100d]'
                      : 'border-neutral-800 bg-[#0d1010] hover:border-neutral-700'
                  }`}
                >
                  <Activity className="mt-0.5 h-4 w-4 shrink-0 text-[#FA4616]" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-white">{task.payload?.title || task.work_type}</div>
                    <div className="mt-1 line-clamp-2 text-xs text-neutral-500">{task.payload?.description || 'No description'}</div>
                  </div>
                  <div className="rounded-md border border-neutral-700 px-2 py-1 text-[9px] font-black uppercase text-neutral-400">
                    {task.priority || 'normal'}
                  </div>
                </button>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-neutral-800 p-6 text-sm text-neutral-500">No open Admin work items.</div>
            )}
          </div>

          {completedTasks.length > 0 && (
            <details className="mt-4 rounded-xl border border-neutral-800 bg-[#0d1010] p-4">
              <summary className="cursor-pointer text-xs font-black uppercase tracking-[.14em] text-neutral-500">
                Completed ({completedTasks.length})
              </summary>
              <div className="mt-3 space-y-2">
                {completedTasks.map((task) => (
                  <button
                    type="button"
                    key={task.id}
                    onClick={() => setSelectedTaskId(task.id)}
                    className="w-full rounded-lg border border-neutral-800 bg-black/20 p-3 text-left"
                  >
                    <div className="text-sm font-bold text-neutral-300">{task.payload?.title || task.work_type}</div>
                    <div className="mt-1 text-[10px] text-neutral-600">completed · {task.priority || 'normal'}</div>
                  </button>
                ))}
              </div>
            </details>
          )}
        </Panel>

        <Panel>
          {selectedTask ? (
            <div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[9px] font-black uppercase tracking-[.18em] text-[#FA4616]">Selected work item</div>
                  <h2 className="mt-1 text-xl font-black text-white">{selectedTask.payload?.title || 'Admin Task'}</h2>
                </div>
                <button type="button" onClick={() => setSelectedTaskId(null)} className="rounded-lg border border-neutral-700 p-2 text-neutral-500 hover:text-white">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-5 space-y-4">
                <div className="rounded-xl border border-neutral-800 bg-[#0d1010] p-4 text-sm leading-6 text-neutral-400">
                  {selectedTask.payload?.description || 'No description'}
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-xl border border-neutral-800 bg-[#0d1010] p-4">
                    <div className="text-[9px] font-black uppercase text-neutral-600">Status</div>
                    <div className="mt-2 font-bold text-white">{selectedTask.status || 'open'}</div>
                  </div>
                  <div className="rounded-xl border border-neutral-800 bg-[#0d1010] p-4">
                    <div className="text-[9px] font-black uppercase text-neutral-600">Priority</div>
                    <div className="mt-2 font-bold text-white">{selectedTask.priority || 'normal'}</div>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setDraft({
                    id: selectedTask.id,
                    title: selectedTask.payload?.title || '',
                    description: selectedTask.payload?.description || '',
                    priority: selectedTask.priority || 'normal',
                  })}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-700 px-3 py-3 text-xs font-black text-white"
                >
                  <Pencil className="h-4 w-4" /> Edit
                </button>
                {selectedTask.status === 'completed' ? (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void action({ action: 'reopen-task', id: selectedTask.id })}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-3 text-xs font-black text-amber-200"
                  >
                    <RotateCcw className="h-4 w-4" /> Reopen
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void action({ action: 'complete-task', id: selectedTask.id })}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-400 px-3 py-3 text-xs font-black text-black"
                  >
                    <CheckCircle2 className="h-4 w-4" /> Complete
                  </button>
                )}
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void deleteTask(selectedTask)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/5 px-3 py-3 text-xs font-black text-red-300 sm:col-span-2"
                >
                  <Trash2 className="h-4 w-4" /> Delete Admin task
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="text-[9px] font-black uppercase tracking-[.18em] text-[#FA4616]">Accounts receivable</div>
              <h2 className="mt-1 text-xl font-black text-white">Recent Invoices</h2>
              <p className="mt-2 text-xs leading-5 text-neutral-500">Select a task to open its operational workspace. Invoice records remain read-only here until their accounting lifecycle actions are wired to the finance rules.</p>
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
            </div>
          )}
        </Panel>
      </div>

      {draft && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-neutral-700 bg-[#090b0b] p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[9px] font-black uppercase tracking-[.18em] text-[#FA4616]">Write to live database</div>
                <h2 className="mt-1 text-2xl font-black text-white">{draft.id ? 'Edit Admin Task' : 'New Admin Task'}</h2>
              </div>
              <button type="button" onClick={() => setDraft(null)} className="rounded-lg border border-neutral-700 p-2 text-neutral-400">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-6 space-y-4">
              <input
                autoFocus
                value={draft.title}
                onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                placeholder="Task title"
                className="w-full rounded-xl border border-neutral-700 bg-black p-3 text-white"
              />
              <textarea
                value={draft.description}
                onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                placeholder="Description"
                className="min-h-28 w-full rounded-xl border border-neutral-700 bg-black p-3 text-white"
              />
              <select
                value={draft.priority}
                onChange={(event) => setDraft({ ...draft, priority: event.target.value })}
                className="w-full rounded-xl border border-neutral-700 bg-black p-3 text-white"
              >
                <option value="low">Low priority</option>
                <option value="normal">Normal priority</option>
                <option value="high">High priority</option>
                <option value="urgent">Urgent priority</option>
              </select>
            </div>
            <button
              type="button"
              disabled={saving || !draft.title.trim()}
              onClick={() => void saveDraft()}
              className="mt-5 w-full rounded-xl bg-[#FA4616] px-4 py-3 text-sm font-black text-black disabled:opacity-40"
            >
              {saving ? 'Saving…' : draft.id ? 'Save changes' : 'Create live task'}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
