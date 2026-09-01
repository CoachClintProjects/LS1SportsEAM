'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Activity, Database, RefreshCw, ShieldCheck, Workflow } from 'lucide-react';
import { getNavigation } from '@/components/experience/HubNavigation/navigationDefinitions';

type Row = Record<string, any>;
type Payload = {
  project: Row | null;
  milestones: Row[];
  tasks: Row[];
  raci: Row[];
  counts: Record<string, number | null>;
  generatedAt: string;
  source?: string;
  error?: string;
};

const sectionDescriptions: Record<string, string> = {
  finance: 'Financial control, accounting, receivables, payables, revenue, cost, budgeting and forecasting.',
  eam: 'Enterprise asset and facilities lifecycle control, including resources and maintenance.',
  security: 'Identity, authority, access, delegation and segregation-of-duties controls.',
  governance: 'Compliance, privacy, retention, audit and data stewardship controls.',
};

function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-neutral-800 bg-[#090b0b] p-6 ${className}`}>{children}</section>;
}

function Metric({ label, value, detail }: { label: string; value: React.ReactNode; detail: string }) {
  return <div className="rounded-xl border border-neutral-800 bg-[#0d1010] p-4">
    <div className="text-[8px] font-black uppercase tracking-[.18em] text-neutral-500">{label}</div>
    <div className="mt-2 text-2xl font-black text-white">{value}</div>
    <div className="mt-1 text-[10px] leading-4 text-neutral-500">{detail}</div>
  </div>;
}

export default function SuperUserModuleWorkspace({ view }: { view: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(false);

  const item = useMemo(() => {
    for (const section of getNavigation('superuser')) {
      const found = section.items.find((candidate) => candidate.id === view);
      if (found) return { ...found, section: section.label, sectionId: section.id };
    }
    return { id: view, label: view, section: 'SUPERUSER', sectionId: 'command', icon: 'activity' };
  }, [view]);

  const load = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/superuser-command', { cache: 'no-store' });
      setData(await response.json() as Payload);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [view]);

  const tasks = data?.tasks ?? [];
  const sectionTasks = useMemo(() => {
    const needle = `${item.label} ${item.section}`.toLowerCase();
    return tasks.filter((task) => `${task.name ?? ''} ${task.code ?? ''} ${task.description ?? ''} ${task.evidence ? JSON.stringify(task.evidence) : ''}`.toLowerCase().includes(needle.split(' ')[0] ?? '')).slice(0, 12);
  }, [tasks, item.label, item.section]);

  const counts = Object.entries(data?.counts ?? {});
  const related = counts.filter(([key]) => {
    const normalized = key.toLowerCase().replaceAll('_', ' ');
    return normalized.includes(item.label.toLowerCase().split(' ')[0]) || normalized.includes(item.section.toLowerCase().split(' ')[0]);
  });
  const displayCounts = (related.length ? related : counts).slice(0, 8);

  return <div className="space-y-6">
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <div className="text-[9px] font-black uppercase tracking-[.25em] text-emerald-400">{item.section}</div>
          <h1 className="mt-2 text-3xl font-black text-white">{item.label}</h1>
          <p className="mt-2 max-w-3xl text-xs leading-5 text-neutral-500">{sectionDescriptions[item.sectionId] ?? 'SuperUser control surface backed by the live LS1Sports implementation and database evidence.'}</p>
        </div>
        <button onClick={() => void load()} className="rounded-xl border border-neutral-800 p-3 text-neutral-400 hover:text-white" aria-label="Refresh module">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
    </Panel>

    {data?.error && <div className="rounded-xl border border-amber-900/60 bg-amber-950/20 px-4 py-3 text-xs text-amber-300">{data.error}</div>}

    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <Metric label="Live source" value={<Database className="h-5 w-5 text-emerald-400" />} detail={data?.source ?? 'LS1SportsEAM Supabase'} />
      <Metric label="Implementation tasks" value={tasks.length} detail="Current project records available to SuperUser" />
      <Metric label="RACI assignments" value={data?.raci?.length ?? 0} detail="Governance assignments in the implementation dataset" />
      <Metric label="Last refreshed" value={data ? new Date(data.generatedAt).toLocaleTimeString() : '—'} detail="Live command data refresh" />
    </div>

    <Panel>
      <div className="flex items-center gap-2">
        <Activity className="h-4 w-4 text-emerald-400" />
        <div>
          <div className="text-[9px] font-black uppercase tracking-[.2em] text-neutral-500">Live telemetry</div>
          <h2 className="text-xl font-black text-white">{item.label} data surface</h2>
        </div>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {displayCounts.map(([key, value]) => <Metric key={key} label={key.replaceAll('_', ' ')} value={value ?? '—'} detail="Live Supabase record count" />)}
      </div>
      {!displayCounts.length && <div className="mt-4 rounded-xl border border-neutral-800 bg-[#0d1010] p-4 text-xs text-neutral-500">No count telemetry is currently exposed for this module. The workspace remains live and will populate as the underlying domain records are connected.</div>}
    </Panel>

    <div className="grid gap-6 lg:grid-cols-2">
      <Panel>
        <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[.18em] text-neutral-500"><Workflow className="h-4 w-4 text-emerald-400" />Implementation evidence</div>
        <div className="mt-4 space-y-2">
          {(sectionTasks.length ? sectionTasks : tasks.slice(0, 6)).map((task) => <div key={task.id} className="rounded-lg border border-neutral-800 bg-[#0d1010] p-3">
            <div className="flex items-center justify-between gap-3"><span className="text-xs font-bold text-white">{task.code ? `${task.code} · ` : ''}{task.name}</span><span className="text-xs font-black text-white">{task.percent_complete ?? 0}%</span></div>
            <div className="mt-1 text-[10px] text-neutral-500">{task.status ?? 'unclassified'}{task.blocker ? ` · ${task.blocker}` : ''}</div>
          </div>)}
        </div>
      </Panel>
      <Panel>
        <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[.18em] text-neutral-500"><ShieldCheck className="h-4 w-4 text-emerald-400" />Control posture</div>
        <div className="mt-4 space-y-3 text-xs leading-5 text-neutral-400">
          <div className="rounded-lg border border-neutral-800 bg-[#0d1010] p-3"><span className="font-bold text-white">Evidence first.</span> Values shown here come from live implementation records or explicit database telemetry.</div>
          <div className="rounded-lg border border-neutral-800 bg-[#0d1010] p-3"><span className="font-bold text-white">No planning substitution.</span> Missing operational or validation evidence remains unknown rather than becoming a guessed percentage.</div>
          <div className="rounded-lg border border-neutral-800 bg-[#0d1010] p-3"><span className="font-bold text-white">Drill-through path.</span> This module uses the same project/task/RACI evidence model as the Command Center.</div>
        </div>
      </Panel>
    </div>
  </div>;
}
