'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UsersRound,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { authenticatedFetch } from '@/lib/client/authenticatedFetch';

type Row = Record<string, any>;
type Payload = {
  actor: { displayName: string; roles: string[]; isSuperUser: boolean };
  events: Row[];
  tasks: Row[];
  quickActions: Row[];
  registrations: Row[];
  invoices: Row[];
  vendorBills: Row[];
  activity: Row[];
  metrics: {
    priorityWork: number;
    todayEvents: number;
    pendingRegistrations: number;
    arBalance: number;
    apBalance: number;
    pastDue: number;
    activeAthletes: number;
    activeTeams: number;
  };
  generatedAt: string;
  source: string;
  error?: string;
};

type Drawer = {
  kind: 'event' | 'task' | 'metric';
  title: string;
  row?: Row;
  metric?: { label: string; value: string | number; description: string };
};

const roleLabel = (roles: string[]) =>
  roles
    .map(
      (role) =>
        ({
          org_admin: 'Organization Admin',
          registrar: 'Registrar',
          treasurer: 'Treasurer',
          operations: 'Operations',
          compliance: 'Compliance',
          reporting: 'Reporting',
          team_engine: 'Team Engine Admin',
        })[role] || role,
    )
    .join(' · ');

const money = (value: unknown) =>
  new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const time = (value: unknown) =>
  value ? new Date(String(value)).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' }) : '—';

const dateTime = (value: unknown) =>
  value
    ? new Date(String(value)).toLocaleString('en-CA', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : '—';

const DETAIL_LABELS: Record<string, string> = {
  event_type: 'Event type',
  starts_at: 'Starts',
  ends_at: 'Ends',
  timezone: 'Timezone',
  status: 'Status',
  metadata: 'Event details',
  due_at: 'Due',
  created_at: 'Created',
  updated_at: 'Updated',
  occurred_at: 'Occurred',
  work_type: 'Work type',
  priority: 'Priority',
  description: 'Description',
};

const HIDDEN_DETAIL_FIELDS = new Set([
  'id',
  'title',
  'tenant_id',
  'organization_id',
  'person_id',
  'actor_user_id',
  'actor_person_id',
]);

function formatDateInTimezone(value: unknown, timezone?: string) {
  if (!value) return '—';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone || undefined,
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    }).format(date);
  } catch {
    return date.toLocaleString('en-CA', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }
}

function humanizeKey(key: string) {
  return DETAIL_LABELS[key] || key.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function scalarDetail(value: unknown) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value).replaceAll('_', ' ');
}

function metadataEntries(value: unknown): Array<[string, unknown]> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  return Object.entries(value as Record<string, unknown>).filter(([, nested]) => nested !== null && nested !== undefined && nested !== '');
}

function DetailValue({ field, value, timezone }: { field: string; value: unknown; timezone?: string }) {
  if (['starts_at', 'ends_at', 'due_at', 'created_at', 'updated_at', 'occurred_at'].includes(field)) {
    return <div className="mt-1 text-sm font-semibold text-white">{formatDateInTimezone(value, timezone)}</div>;
  }

  if (field === 'metadata' && value && typeof value === 'object') {
    const entries = metadataEntries(value);
    if (!entries.length) return <div className="mt-1 text-sm text-neutral-400">No additional event details.</div>;
    return (
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {entries.map(([key, nested]) => (
          <div key={key} className="rounded-lg border border-neutral-800 bg-black/20 p-3">
            <div className="text-[10px] font-black uppercase tracking-[.12em] text-neutral-500">{humanizeKey(key)}</div>
            <div className="mt-1 break-words text-sm font-semibold text-neutral-100">
              {nested && typeof nested === 'object' ? JSON.stringify(nested, null, 2) : scalarDetail(nested)}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (Array.isArray(value)) {
    return <div className="mt-1 text-sm font-semibold text-white">{value.map(scalarDetail).join(', ') || '—'}</div>;
  }

  if (value && typeof value === 'object') {
    return <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs leading-5 text-neutral-200">{JSON.stringify(value, null, 2)}</pre>;
  }

  return <div className="mt-1 break-words text-sm font-semibold capitalize text-white">{scalarDetail(value)}</div>;
}

function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-[var(--ls1-border)] bg-[var(--ls1-surface-1)] ${className}`}>{children}</section>;
}

function SignalCard({ tone, icon, value, label, description, onClick }: {
  tone: 'ai' | 'success' | 'danger' | 'warning' | 'info';
  icon: React.ReactNode;
  value: string | number;
  label: string;
  description: string;
  onClick: () => void;
}) {
  const tones = {
    ai: { border: 'border-[#7b46ad]', bg: 'bg-[#31203f]', value: 'text-[#ddb8ff]', label: 'text-[#d9a8ff]' },
    success: { border: 'border-[#187246]', bg: 'bg-[#123b29]', value: 'text-[#66f0aa]', label: 'text-[#50df99]' },
    danger: { border: 'border-[#8a353b]', bg: 'bg-[#452326]', value: 'text-[#ff9ca3]', label: 'text-[#ff8b94]' },
    warning: { border: 'border-[#8a6315]', bg: 'bg-[#4a3511]', value: 'text-[#ffd558]', label: 'text-[#ffd24a]' },
    info: { border: 'border-[#275f9d]', bg: 'bg-[#183452]', value: 'text-[#81baff]', label: 'text-[#70b0ff]' },
  } as const;
  const style = tones[tone];
  return (
    <button onClick={onClick} className={`min-h-[122px] rounded-xl border ${style.border} ${style.bg} p-4 text-left transition hover:-translate-y-0.5 hover:brightness-110`}>
      <div className={`flex items-center gap-3 ${style.value}`}>{icon}<div className="text-3xl font-black">{value}</div></div>
      <div className={`mt-2 text-xs font-black uppercase tracking-[.1em] ${style.label}`}>{label}</div>
      <div className="mt-1 text-sm leading-5 text-neutral-200">{description}</div>
    </button>
  );
}

export function CommandCenter() {
  const router = useRouter();
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [drawer, setDrawer] = useState<Drawer | null>(null);
  const pollRef = useRef(true);

  const load = useCallback(async (background = false) => {
    background ? setRefreshing(true) : setLoading(true);
    setError('');
    try {
      const response = await authenticatedFetch('/api/admin-command', { cache: 'no-store' });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || `Admin brief returned ${response.status}`);
      setData(json);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load Admin daily brief.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    pollRef.current = true;
    void load();
    const tick = () => {
      if (document.visibilityState === 'visible' && pollRef.current) void load(true);
    };
    const timer = window.setInterval(tick, 15000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      pollRef.current = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [load]);

  const roles = data?.actor.roles || [];
  const isRegistrar = roles.some((r) => r === 'registrar' || r === 'org_admin');
  const isTreasurer = roles.some((r) => r === 'treasurer' || r === 'org_admin');

  const today = useMemo(() => {
    const now = new Date();
    const start = new Date(now); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(end.getDate() + 1);
    return (data?.events || []).filter((event) => {
      const value = new Date(event.starts_at).getTime();
      return value >= start.getTime() && value < end.getTime();
    });
  }, [data?.events]);

  const upcoming = useMemo(() => {
    const todayIds = new Set(today.map((event) => event.id));
    return (data?.events || []).filter((event) => !todayIds.has(event.id)).slice(0, 6);
  }, [data?.events, today]);

  const firstName = (data?.actor.displayName || 'Admin').split(/[ @]/)[0];
  const pending = Number(data?.metrics.pendingRegistrations || 0);
  const pastDue = Number(data?.metrics.pastDue || 0);
  const priority = Number(data?.metrics.priorityWork || 0);
  const todayCount = Number(data?.metrics.todayEvents || 0);
  const activeTeams = Number(data?.metrics.activeTeams || 0);
  const activeAthletes = Number(data?.metrics.activeAthletes || 0);
  const openMetric = (label: string, value: string | number, description: string) => setDrawer({ kind: 'metric', title: label, metric: { label, value, description } });

  if (loading && !data) {
    return <main className="p-7 text-white"><div className="flex min-h-[55vh] items-center justify-center gap-3 text-neutral-400"><RefreshCw className="h-5 w-5 animate-spin"/>Loading your Admin command center…</div></main>;
  }

  return (
    <main className="space-y-5 p-4 text-white lg:p-6">
      <section className="flex flex-wrap items-start justify-between gap-5 border-b border-[var(--ls1-border)] pb-5">
        <div>
          <div className="text-sm font-semibold text-neutral-400">{new Date().toLocaleDateString('en-CA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-white">Admin Command Center</h1>
          <p className="mt-1 text-sm text-neutral-400">Good morning, {firstName}. {roleLabel(roles) || 'Admin'}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden text-right text-[11px] leading-4 text-neutral-500 sm:block"><div>Updated</div><div>{data?.generatedAt ? new Date(data.generatedAt).toLocaleTimeString('en-CA') : '—'}</div></div>
          <button onClick={() => void load(true)} disabled={refreshing} className="inline-flex items-center gap-2 rounded-lg border border-[var(--ls1-brand)] px-4 py-2.5 text-xs font-black uppercase tracking-wide text-[var(--ls1-brand)] hover:bg-[var(--ls1-brand-soft)]"><RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`}/>Sync now</button>
        </div>
      </section>

      {error && <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"><AlertTriangle className="h-4 w-4"/>{error}</div>}

      <section>
        <div className="mb-3 flex items-center gap-2 text-base font-black"><Sparkles className="h-4 w-4 text-[var(--ls1-brand)]"/>Action Center: What Should I Do Today?</div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <SignalCard tone="ai" icon={<UsersRound className="h-5 w-5"/>} value={isRegistrar ? pending : activeAthletes} label={isRegistrar ? 'Registration attention' : 'Active athletes'} description={isRegistrar ? (pending ? 'Registration records need review or completion.' : 'No registration records are waiting for review.') : 'Athletes currently visible in your authorized scope.'} onClick={() => openMetric(isRegistrar ? 'Registration attention' : 'Active athletes', isRegistrar ? pending : activeAthletes, isRegistrar ? 'Registration records not yet approved or completed.' : 'Active athlete records in your authorized scope.')}/>
          <SignalCard tone="success" icon={<ShieldCheck className="h-5 w-5"/>} value={activeTeams} label="Teams operating" description={activeTeams === 1 ? '1 active Team Engine team is operating.' : `${activeTeams} active Team Engine teams are operating.`} onClick={() => openMetric('Teams operating', activeTeams, 'Active Team Engine teams visible to your Admin scope.')}/>
          <SignalCard tone="danger" icon={<AlertTriangle className="h-5 w-5"/>} value={priority} label="Needs attention" description={priority ? 'Open operational items require Admin attention.' : 'No open priority work requires attention.'} onClick={() => openMetric('Needs attention', priority, 'Open Admin and operational work visible to your current authority.')}/>
          <SignalCard tone="warning" icon={<CircleDollarSign className="h-5 w-5"/>} value={isTreasurer ? pastDue : todayCount} label={isTreasurer ? 'Past due' : 'Today'} description={isTreasurer ? (pastDue ? 'Receivables are past due and should be reviewed.' : 'No receivables are currently past due.') : (todayCount ? `${todayCount} calendar item${todayCount === 1 ? '' : 's'} scheduled today.` : 'No calendar items are scheduled today.')} onClick={() => openMetric(isTreasurer ? 'Past due' : 'Today', isTreasurer ? pastDue : todayCount, isTreasurer ? 'Receivables past their due date.' : 'Calendar items scheduled for today.')}/>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-1 sm:grid-cols-3 xl:grid-cols-6">
        {[
          ['Today', todayCount, 'bg-[var(--ls1-brand)] text-black'],
          ['Priority work', priority, 'bg-[#37393f]'],
          ['Registrations', pending, 'bg-[#3a3b42]'],
          ['Active teams', activeTeams, 'bg-[#37393f]'],
          ['Receivables', money(data?.metrics.arBalance), 'bg-[#3a3b42]'],
          ['Payables', money(data?.metrics.apBalance), 'bg-[#37393f]'],
        ].map(([label, value, className]) => <button key={String(label)} onClick={() => openMetric(String(label), value as string | number, `Current ${String(label).toLowerCase()} value from authorized live data.`)} className={`min-h-[70px] px-3 py-2 text-center ${className}`}><div className="text-xl font-black">{value}</div><div className="mt-0.5 text-[10px] font-bold uppercase tracking-wide opacity-80">{label}</div></button>)}
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
        <Panel className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--ls1-border)] p-5"><div><div className="flex items-center gap-2 text-xs font-black uppercase tracking-[.15em] text-[var(--ls1-info)]"><CalendarDays className="h-4 w-4"/>Today’s operating calendar</div><h2 className="mt-1 text-xl font-black">Today and what’s coming next</h2></div><div className="rounded-full bg-[var(--ls1-info-bg)] px-3 py-1 text-xs font-bold text-[var(--ls1-info)]">{today.length} today</div></div>
          <div className="grid lg:grid-cols-[1.2fr_.8fr]">
            <div className="border-b border-[var(--ls1-border)] p-4 lg:border-b-0 lg:border-r"><div className="space-y-2">
              {today.length ? today.map((event) => <button key={event.id} onClick={() => setDrawer({ kind: 'event', title: event.title, row: event })} className="grid w-full grid-cols-[80px_1fr_auto] items-center gap-3 rounded-xl border border-[var(--ls1-border)] bg-[var(--ls1-surface-2)] p-3 text-left hover:border-[var(--ls1-info)]"><div className="text-sm font-black text-[var(--ls1-info)]">{time(event.starts_at)}</div><div><div className="font-bold text-white">{event.title}</div><div className="mt-1 text-xs text-neutral-400">{event.event_type || 'Calendar event'} · {event.status || 'scheduled'}</div></div><ChevronRight className="h-4 w-4 text-neutral-500"/></button>) : <div className="rounded-xl border border-dashed border-neutral-700 p-7 text-center"><CheckCircle2 className="mx-auto h-6 w-6 text-[var(--ls1-success)]"/><div className="mt-2 font-bold">No scheduled items today</div><div className="mt-1 text-sm text-neutral-400">Your next operating dates are shown beside this panel.</div></div>}
            </div></div>
            <div className="p-4"><div className="text-xs font-black uppercase tracking-[.14em] text-neutral-300">Coming up</div><div className="mt-3 space-y-2">{upcoming.length ? upcoming.map((event) => <button key={event.id} onClick={() => setDrawer({ kind: 'event', title: event.title, row: event })} className="w-full rounded-xl border border-[var(--ls1-border)] bg-[var(--ls1-surface-2)] p-3 text-left hover:border-[var(--ls1-brand)]"><div className="text-xs font-bold text-[var(--ls1-brand)]">{dateTime(event.starts_at)}</div><div className="mt-1 text-sm font-bold text-white">{event.title}</div></button>) : <div className="text-sm text-neutral-500">No upcoming calendar items in the current window.</div>}</div></div>
          </div>
        </Panel>

        <Panel className="p-5"><div className="flex items-center gap-2 text-xs font-black uppercase tracking-[.15em] text-[var(--ls1-ai)]"><Sparkles className="h-4 w-4"/>Quick actions</div><h2 className="mt-1 text-xl font-black">Go directly to the work</h2><p className="mt-1 text-sm text-neutral-400">Actions are configured by role and authority.</p><div className="mt-4 space-y-2">{(data?.quickActions || []).map((action) => <button key={action.id} onClick={() => router.push(action.href)} className="flex w-full items-center justify-between gap-4 rounded-xl border border-[var(--ls1-border)] bg-[var(--ls1-surface-2)] p-4 text-left hover:border-[var(--ls1-ai)]"><div><div className="font-bold text-white">{action.label}</div><div className="mt-1 text-xs leading-5 text-neutral-400">{action.description}</div></div><ChevronRight className="h-4 w-4 shrink-0 text-[var(--ls1-ai)]"/></button>)}{!data?.quickActions.length && <div className="rounded-xl border border-dashed border-neutral-700 p-5 text-sm text-neutral-400">No role-specific quick actions are configured yet.</div>}</div></Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
        <Panel className="p-5"><div className="flex items-center justify-between gap-4"><div><div className="flex items-center gap-2 text-xs font-black uppercase tracking-[.15em] text-[var(--ls1-danger)]"><Activity className="h-4 w-4"/>Needs attention</div><h2 className="mt-1 text-xl font-black">Open operational work</h2></div><div className="rounded-lg bg-[var(--ls1-danger-bg)] px-3 py-1.5 text-xl font-black text-[var(--ls1-danger)]">{data?.tasks.length || 0}</div></div><div className="mt-4 space-y-2">{(data?.tasks || []).slice(0, 10).map((task) => <button key={`${task.source}-${task.id}`} onClick={() => setDrawer({ kind: 'task', title: task.title || task.work_type, row: task })} className="flex w-full items-start gap-3 rounded-xl border border-[var(--ls1-border)] bg-[var(--ls1-surface-2)] p-4 text-left hover:border-[var(--ls1-danger)]"><Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ls1-danger)]"/><div className="min-w-0 flex-1"><div className="font-bold text-white">{task.title || task.work_type}</div><div className="mt-1 text-xs text-neutral-400">{task.description || 'No description'}{task.due_at ? ` · due ${dateTime(task.due_at)}` : ''} · {task.priority || 'normal'}</div></div><ChevronRight className="h-4 w-4 text-neutral-500"/></button>)}{!data?.tasks.length && <div className="rounded-xl border border-dashed border-neutral-700 p-6 text-center text-sm text-neutral-400"><CheckCircle2 className="mx-auto mb-2 h-5 w-5 text-[var(--ls1-success)]"/>No open Admin work is assigned in your current scope.</div>}</div></Panel>
        <Panel className="p-5"><div className="text-xs font-black uppercase tracking-[.15em] text-[var(--ls1-teal)]">Recent activity</div><h2 className="mt-1 text-xl font-black">What changed</h2><div className="mt-4 space-y-2">{(data?.activity || []).slice(0, 8).map((item) => <div key={item.id} className="rounded-xl border border-[var(--ls1-border)] bg-[var(--ls1-surface-2)] p-4"><div className="text-sm font-bold text-white">{item.action}</div><div className="mt-1 text-xs text-neutral-400">{item.entity_type || 'record'} · {dateTime(item.occurred_at)}</div></div>)}{!data?.activity.length && <div className="rounded-xl border border-dashed border-neutral-700 p-6 text-sm text-neutral-400">No recent audit activity is visible to this role.</div>}</div></Panel>
      </div>

      {drawer && (
        <div className="fixed inset-0 z-[100] flex justify-end bg-black/70 backdrop-blur-sm" onClick={() => setDrawer(null)}>
          <aside className="h-full w-full max-w-xl overflow-y-auto border-l border-[var(--ls1-border)] bg-[var(--ls1-bg)] p-6" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4"><div><div className="text-xs font-black uppercase tracking-[.16em] text-[var(--ls1-brand)]">{drawer.kind === 'event' ? 'Competition / event detail' : 'Admin detail'}</div><h2 className="mt-2 text-2xl font-black">{drawer.title}</h2></div><button onClick={() => setDrawer(null)} className="rounded-lg border border-neutral-700 p-2 text-neutral-300 hover:text-white"><X className="h-4 w-4"/></button></div>

            {drawer.metric && <div className="mt-6 rounded-2xl border border-[var(--ls1-border)] bg-[var(--ls1-surface-2)] p-5"><div className="text-4xl font-black text-white">{drawer.metric.value}</div><div className="mt-2 text-sm font-bold text-[var(--ls1-brand)]">{drawer.metric.label}</div><p className="mt-3 text-sm leading-6 text-neutral-300">{drawer.metric.description}</p></div>}

            {drawer.row && (
              <div className="mt-6 space-y-3">
                {Object.entries(drawer.row)
                  .filter(([key, value]) => value !== null && value !== undefined && !HIDDEN_DETAIL_FIELDS.has(key))
                  .slice(0, 20)
                  .map(([key, value]) => (
                    <div key={key} className="rounded-xl border border-[var(--ls1-border)] bg-[var(--ls1-surface-2)] p-4">
                      <div className="text-[10px] font-black uppercase tracking-[.14em] text-neutral-500">{humanizeKey(key)}</div>
                      <DetailValue field={key} value={value} timezone={drawer.row?.timezone}/>
                    </div>
                  ))}
              </div>
            )}
          </aside>
        </div>
      )}
    </main>
  );
}
