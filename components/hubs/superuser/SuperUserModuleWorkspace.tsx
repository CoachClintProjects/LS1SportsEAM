'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Database,
  ExternalLink,
  RefreshCw,
  ShieldCheck,
  Workflow,
  X,
} from 'lucide-react';

type MetricRow = {
  table: string;
  label: string;
  count: number | null;
};

type ModulePayload = {
  view: string;
  label: string;
  metrics: MetricRow[];
  generatedAt: string;
  source: string;
  error?: string;
};

type CommandPayload = {
  project: Record<string, unknown> | null;
  milestones: Array<Record<string, unknown>>;
  tasks: Array<Record<string, unknown>>;
  raci: Array<Record<string, unknown>>;
  counts: Record<string, number | null>;
  generatedAt: string;
  source?: string;
  error?: string;
};

type WorkspaceMeta = {
  section: string;
  description: string;
  purpose: string;
  actions: string[];
};

const META: Record<string, WorkspaceMeta> = {
  platform: {
    section: 'ENTERPRISE',
    description: 'Platform-wide operating controls, configuration evidence, and core system records.',
    purpose: 'Use this workspace to understand what exists, what is configured, and what remains to be built.',
    actions: ['Review platform records', 'Open configuration controls', 'Track implementation evidence'],
  },
  organizations: {
    section: 'ENTERPRISE',
    description: 'Canonical organization and tenant structure for every LS1Sports client.',
    purpose: 'Use this workspace to create and manage client organizations and their operating structure.',
    actions: ['Create organization', 'Review locations and legal entities', 'Validate governing-body relationships'],
  },
  people: {
    section: 'ENTERPRISE',
    description: 'Canonical person master across athletes, parents, staff, officials, and other identities.',
    purpose: 'Use this workspace to resolve identity, duplicates, relationships, and person-level records.',
    actions: ['Review person records', 'Resolve duplicates', 'Validate external identifiers'],
  },
  athletes: {
    section: 'ENTERPRISE',
    description: 'Athlete capital-asset intelligence and development evidence.',
    purpose: 'Use this workspace to monitor athlete records, participation, goals, performance, and asset history.',
    actions: ['Review athlete population', 'Inspect development records', 'Validate performance data'],
  },
  imports: {
    section: 'OPERATIONS',
    description: 'Canonical ingestion pipeline for source packages, results, and legacy-system migration.',
    purpose: 'Use this workspace to stage, validate, reconcile, and apply incoming data.',
    actions: ['Register source package', 'Review validation issues', 'Monitor reconciliation'],
  },
  agents: {
    section: 'INTELLIGENCE',
    description: 'AI agent registry, authority, tools, policies, runs, and actions.',
    purpose: 'Use this workspace to monitor and govern LS1Sports agents.',
    actions: ['Review agents', 'Inspect authority and policy', 'Monitor execution evidence'],
  },
  automation: {
    section: 'INTELLIGENCE',
    description: 'Platform-native automations replacing repetitive administrative work.',
    purpose: 'Use this workspace to define, monitor, and audit automations.',
    actions: ['Review automation definitions', 'Inspect runs', 'Investigate failures'],
  },
  settings: {
    section: 'SETTINGS & CUSTOMIZATION',
    description: 'Platform-wide configuration and defaults.',
    purpose: 'Use this workspace for site-wide behavior, presentation, policy defaults, and operational settings.',
    actions: ['Review system configuration', 'Review platform preferences', 'Review dashboard defaults'],
  },
  'role-customization': {
    section: 'SETTINGS & CUSTOMIZATION',
    description: 'Role-specific workspace defaults and personalization.',
    purpose: 'Use this workspace to control what each role sees and how its operating environment behaves.',
    actions: ['Review role defaults', 'Review permissions', 'Review role preferences'],
  },
};

function humanize(view: string) {
  return view
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function Panel({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-neutral-800 bg-[#090b0b] p-5 lg:p-6 ${className}`}>
      {children}
    </section>
  );
}

function MetricCard({
  metric,
  onOpen,
}: {
  metric: MetricRow;
  onOpen: (metric: MetricRow) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(metric)}
      className="group rounded-xl border border-neutral-800 bg-[#0d1010] p-4 text-left transition hover:border-emerald-500/40 hover:bg-[#101414]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="text-[9px] font-black uppercase tracking-[.18em] text-neutral-500">
          {metric.label}
        </div>
        <ExternalLink className="h-3.5 w-3.5 text-neutral-700 transition group-hover:text-emerald-400" />
      </div>
      <div className="mt-3 text-3xl font-black text-white">
        {metric.count ?? '—'}
      </div>
      <div className="mt-1 text-[10px] text-neutral-500">
        {metric.table}
      </div>
    </button>
  );
}

export default function SuperUserModuleWorkspace({ view }: { view: string }) {
  const safeView = view?.trim() || 'platform';
  const meta = META[safeView] ?? {
    section: 'SUPERUSER',
    description: `${humanize(safeView)} is an LS1Sports operational workspace backed by live platform evidence.`,
    purpose: 'Use this workspace to inspect the domain, understand its operational state, and identify the next required action.',
    actions: ['Review live records', 'Inspect operating evidence', 'Identify gaps and next actions'],
  };

  const [moduleData, setModuleData] = useState<ModulePayload | null>(null);
  const [command, setCommand] = useState<CommandPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<MetricRow | null>(null);

  const load = useCallback(async (background = false) => {
    if (background) setRefreshing(true);
    else setLoading(true);

    setError(null);

    try {
      const [moduleResponse, commandResponse] = await Promise.all([
        fetch(`/api/superuser-module?view=${encodeURIComponent(safeView)}`, {
          cache: 'no-store',
        }),
        fetch('/api/superuser-command', {
          cache: 'no-store',
        }),
      ]);

      const moduleJson = await moduleResponse.json().catch(() => null);
      const commandJson = await commandResponse.json().catch(() => null);

      if (!moduleResponse.ok) {
        throw new Error(moduleJson?.error || `Workspace API returned ${moduleResponse.status}`);
      }

      setModuleData(moduleJson as ModulePayload);
      setCommand(
        commandResponse.ok
          ? (commandJson as CommandPayload)
          : {
              project: null,
              milestones: [],
              tasks: [],
              raci: [],
              counts: {},
              generatedAt: new Date().toISOString(),
              error: commandJson?.error,
            },
      );
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Unable to load this workspace.';
      console.error('[SuperUserModuleWorkspace] load failed', {
        view: safeView,
        message,
      });
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [safeView]);

  useEffect(() => {
    void load();
    return undefined;
  }, [load]);

  const relatedTasks = useMemo(() => {
    const terms = [safeView, ...(meta.description.toLowerCase().match(/[a-z]{5,}/g) ?? [])];

    return (command?.tasks ?? [])
      .filter((task) => {
        const text = [
          task.code,
          task.name,
          task.description,
          task.status,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return terms.some((term) => text.includes(String(term).toLowerCase()));
      })
      .slice(0, 8);
  }, [command?.tasks, meta.description, safeView]);

  if (loading && !moduleData) {
    return (
      <Panel>
        <div className="flex min-h-48 items-center justify-center gap-3 text-neutral-500">
          <RefreshCw className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading live workspace…</span>
        </div>
      </Panel>
    );
  }

  if (error && !moduleData) {
    return (
      <Panel>
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
            <div>
              <h2 className="font-black text-white">Workspace could not load</h2>
              <p className="mt-1 text-sm text-neutral-400">{error}</p>
              <button
                type="button"
                onClick={() => void load()}
                className="mt-4 rounded-lg bg-white px-3 py-2 text-xs font-black text-black"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </Panel>
    );
  }

  const metrics = moduleData?.metrics ?? [];

  return (
    <div className="space-y-6">
      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-4xl">
            <div className="text-[9px] font-black uppercase tracking-[.25em] text-emerald-400">
              {meta.section}
            </div>
            <h1 className="mt-2 text-3xl font-black text-white">
              {moduleData?.label ?? humanize(safeView)}
            </h1>
            <p className="mt-2 text-sm leading-6 text-neutral-400">
              {meta.description}
            </p>
          </div>

          <button
            type="button"
            onClick={() => void load(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-xl border border-neutral-700 px-4 py-3 text-xs font-black text-neutral-300 transition hover:border-emerald-500/50 hover:text-white disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh live data
          </button>
        </div>
      </Panel>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-xs text-amber-200">
          <AlertTriangle className="h-4 w-4" />
          {error}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard
            key={metric.table}
            metric={metric}
            onOpen={setSelectedMetric}
          />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
        <Panel>
          <div className="flex items-center gap-2">
            <Workflow className="h-4 w-4 text-emerald-400" />
            <div>
              <div className="text-[9px] font-black uppercase tracking-[.18em] text-neutral-500">
                What this workspace is for
              </div>
              <h2 className="text-xl font-black text-white">Purpose and next actions</h2>
            </div>
          </div>

          <p className="mt-4 text-sm leading-6 text-neutral-400">{meta.purpose}</p>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {meta.actions.map((action, index) => (
              <div
                key={action}
                className="rounded-xl border border-neutral-800 bg-[#0d1010] p-4"
              >
                <div className="text-[9px] font-black uppercase tracking-[.15em] text-neutral-600">
                  {String(index + 1).padStart(2, '0')}
                </div>
                <div className="mt-2 text-sm font-bold text-white">{action}</div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <div>
              <div className="text-[9px] font-black uppercase tracking-[.18em] text-neutral-500">
                Evidence
              </div>
              <h2 className="text-xl font-black text-white">Live control posture</h2>
            </div>
          </div>

          <div className="mt-5 space-y-3 text-xs">
            <div className="rounded-xl border border-neutral-800 bg-[#0d1010] p-4 text-neutral-400">
              <span className="font-bold text-white">Source:</span>{' '}
              {moduleData?.source ?? 'LS1SportsEAM'}
            </div>
            <div className="rounded-xl border border-neutral-800 bg-[#0d1010] p-4 text-neutral-400">
              <span className="font-bold text-white">Last refresh:</span>{' '}
              {moduleData?.generatedAt
                ? new Date(moduleData.generatedAt).toLocaleString()
                : '—'}
            </div>
            <div className="rounded-xl border border-neutral-800 bg-[#0d1010] p-4 text-neutral-400">
              <span className="font-bold text-white">Records represented:</span>{' '}
              {metrics.reduce((sum, metric) => sum + (metric.count ?? 0), 0)}
            </div>
          </div>
        </Panel>
      </div>

      <Panel>
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-emerald-400" />
          <div>
            <div className="text-[9px] font-black uppercase tracking-[.18em] text-neutral-500">
              Implementation state
            </div>
            <h2 className="text-xl font-black text-white">Related build evidence</h2>
          </div>
        </div>

        <div className="mt-5 space-y-2">
          {relatedTasks.length ? (
            relatedTasks.map((task, index) => (
              <div
                key={String(task.id ?? task.code ?? index)}
                className="grid gap-3 rounded-xl border border-neutral-800 bg-[#0d1010] p-4 sm:grid-cols-[1fr_auto] sm:items-center"
              >
                <div>
                  <div className="text-sm font-bold text-white">
                    {String(task.code ?? 'TASK')} · {String(task.name ?? 'Unnamed task')}
                  </div>
                  <div className="mt-1 text-[10px] text-neutral-500">
                    {String(task.status ?? 'UNKNOWN')}
                    {task.blocker ? ` · blocker: ${String(task.blocker)}` : ''}
                  </div>
                </div>
                <div className="text-xl font-black text-white">
                  {Number(task.percent_complete ?? 0)}%
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-neutral-800 bg-[#0d1010] p-5 text-sm text-neutral-500">
              No build task is currently mapped to this domain.
            </div>
          )}
        </div>
      </Panel>

      {selectedMetric && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-end bg-black/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={selectedMetric.label}
          onMouseDown={() => setSelectedMetric(null)}
        >
          <div
            className="w-full max-w-xl rounded-2xl border border-neutral-700 bg-[#0a0d0d] p-6 shadow-2xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[9px] font-black uppercase tracking-[.2em] text-emerald-400">
                  Live data domain
                </div>
                <h2 className="mt-2 text-2xl font-black text-white">
                  {selectedMetric.label}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMetric(null)}
                className="rounded-lg border border-neutral-700 p-2 text-neutral-400 hover:text-white"
                aria-label="Close drawer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <div className="rounded-xl border border-neutral-800 bg-[#0d1010] p-4">
                <div className="text-[9px] font-black uppercase tracking-[.16em] text-neutral-500">
                  Canonical table
                </div>
                <div className="mt-2 flex items-center gap-2 font-mono text-sm text-white">
                  <Database className="h-4 w-4 text-emerald-400" />
                  {selectedMetric.table}
                </div>
              </div>

              <div className="rounded-xl border border-neutral-800 bg-[#0d1010] p-4">
                <div className="text-[9px] font-black uppercase tracking-[.16em] text-neutral-500">
                  Current live record count
                </div>
                <div className="mt-2 text-4xl font-black text-white">
                  {selectedMetric.count ?? 'Unavailable'}
                </div>
              </div>

              <div className="rounded-xl border border-neutral-800 bg-[#0d1010] p-4 text-sm leading-6 text-neutral-400">
                This card is a control-surface entry point, not a decorative metric. The count identifies the live domain represented by the LS1Sports canonical data model. Domain-specific create, edit, approval, and workflow controls should be exposed through the owning operational workspace rather than by attempting unsafe generic browser-side database writes.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
