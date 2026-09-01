'use client';

import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bot,
  Building2,
  CheckCircle2,
  ChevronRight,
  Database,
  DollarSign,
  GitBranch,
  LayoutDashboard,
  ShieldCheck,
  Table2,
  Trophy,
  Users,
  Workflow,
  X,
} from 'lucide-react';

import { FinanceAccounting } from './command/FinanceAccounting';

// =====================================================
// LS1Sports SuperUser Workspace
//
// PURPOSE
// - Enterprise control-plane landing workspace.
//
// RESPONSIBILITIES
// - Master EAM / ERP project map.
// - 14-milestone development intelligence.
// - Calculated overall completion.
// - Two balanced milestone panels.
// - Right-hand milestone detail drawer.
// - Live core metrics.
// - Finance and accounting visibility.
//
// DATA NOTE
// - Current milestone percentages are development-model inputs.
// - Future implementation: replace them with live telemetry
//   from Supabase / CI / migration / UI / API registries.
//
// ARCHITECTURAL RULE
// - SuperUser sees the whole enterprise system.
// - This component does not modify HubContext or navigation.
// =====================================================

type WorkspaceTab =
  | 'overview'
  | 'intelligence'
  | 'operations'
  | 'governance';

type MilestoneStatus =
  | 'complete'
  | 'active'
  | 'blocked'
  | 'planned';

type MetricPair = [complete: number, total: number];

type Milestone = {
  id: number;
  name: string;
  status: MilestoneStatus;
  percent: number;
  detail: string;
  metrics: {
    features: MetricPair;
    tables: MetricPair;
    apis: MetricPair;
    ui: MetricPair;
    workflows: MetricPair;
    integrations: MetricPair;
  };
  architectureImpact: string[];
  remainingWork: string[];
  gaps: string[];
};

const milestones: Milestone[] = [
  { id: 1, name: 'Platform Foundation', status: 'complete', percent: 100,
    detail: 'Multi-tenant foundation, organization model, membership, and RLS foundation.',
    metrics: { features: [10,10], tables:[10,10], apis:[8,8], ui:[6,6], workflows:[4,4], integrations:[2,2] },
    architectureImpact: ['Tenant architecture','Organization model','Membership','RLS foundation'],
    remainingWork: [], gaps: [] },

  { id: 2, name: 'Identity Gateway', status: 'complete', percent: 100,
    detail: 'Person model, user identity model, and authentication mapping foundation.',
    metrics: { features: [10,10], tables:[10,10], apis:[7,7], ui:[5,5], workflows:[4,4], integrations:[2,2] },
    architectureImpact: ['Person Master','User Identity','Authentication','Identity mapping'],
    remainingWork: [], gaps: [] },

  { id: 3, name: 'RBAC / Permission Framework', status: 'complete', percent: 100,
    detail: 'Roles, permissions, role assignments, scope model, and hub access foundation.',
    metrics: { features: [12,12], tables:[14,14], apis:[8,8], ui:[7,7], workflows:[5,5], integrations:[2,2] },
    architectureImpact: ['Roles','Permissions','Scope Model','Hub Access','Authority boundaries'],
    remainingWork: [], gaps: [] },

  { id: 4, name: 'Real Data Onboarding', status: 'active', percent: 25,
    detail: 'Import staging, validation, identity resolution, and controlled production onboarding.',
    metrics: { features: [3,12], tables:[4,10], apis:[2,8], ui:[1,7], workflows:[1,6], integrations:[1,4] },
    architectureImpact: ['Import staging','Validation engine','Identity resolution','Data quality','Production ingestion'],
    remainingWork: ['Build staging workflows','Identity matching','Exception review','Production approval'],
    gaps: ['Production onboarding workflow','Automated reconciliation'] },

  { id: 5, name: 'Team Manager', status: 'active', percent: 18,
    detail: 'Organization, roster, membership, roles, programs, groups, staff, and communication.',
    metrics: { features: [6,30], tables:[9,25], apis:[3,18], ui:[3,16], workflows:[1,10], integrations:[0,3] },
    architectureImpact: ['Organizations','Teams','Rosters','Membership','Programs','Seasons','Staff'],
    remainingWork: ['Finish data presentation','Complete roster workflows','Complete membership workflows','Reporting surfaces'],
    gaps: ['Operational data presentation','Full workflow completion'] },

  { id: 6, name: 'Athlete Intelligence', status: 'active', percent: 24,
    detail: 'Athlete master, development, performance, goals, skills, records, and trajectory.',
    metrics: { features: [7,24], tables:[10,25], apis:[4,15], ui:[3,14], workflows:[2,8], integrations:[0,3] },
    architectureImpact: ['Athlete Passport','Performance','Development','Goals','Readiness','Trajectory'],
    remainingWork: ['Athlete Passport workspace','Results / rankings / cuts','Experience modes','Multi-sport context'],
    gaps: ['Longitudinal intelligence','Advanced performance analytics'] },

  { id: 7, name: 'Coach Operations', status: 'active', percent: 15,
    detail: 'Training plans, workouts, attendance, development, performance, and communication.',
    metrics: { features: [5,24], tables:[8,22], apis:[3,14], ui:[2,14], workflows:[1,8], integrations:[0,3] },
    architectureImpact: ['Training','Workouts','Attendance','Development','Coach AI'],
    remainingWork: ['Coach command deck','AI co-pilot','LTAD intelligence','Workout generation'],
    gaps: ['Deep coaching intelligence','Competition intelligence'] },

  { id: 8, name: 'Parent Operations', status: 'active', percent: 14,
    detail: 'Family, permissions, registrations, documents, payments, and communication.',
    metrics: { features: [4,20], tables:[7,18], apis:[2,12], ui:[2,12], workflows:[1,8], integrations:[0,3] },
    architectureImpact: ['Household','Athlete relationships','Approvals','Documents','Financials'],
    remainingWork: ['Family dashboard','Multi-athlete context','Event selection approvals','Family activity feed'],
    gaps: ['Complete family operating model','Multi-sport family context'] },

  { id: 9, name: 'Admin Operations', status: 'active', percent: 18,
    detail: 'Registrar, organization administration, configuration, reporting, and compliance.',
    metrics: { features: [5,22], tables:[8,20], apis:[2,12], ui:[2,12], workflows:[1,7], integrations:[0,3] },
    architectureImpact: ['Organization Admin','Registrar','Treasurer','Compliance','Reporting'],
    remainingWork: ['Role selector','Onboarding workspace','Registrar queue','Treasurer workspace'],
    gaps: ['Role-specific operating surfaces','Client onboarding controls'] },

  { id: 10, name: 'Finance & Accounting', status: 'active', percent: 20,
    detail: 'Billing, invoices, payments, expenses, accounting, reporting, grants, and sponsorships.',
    metrics: { features: [5,24], tables:[17,20], apis:[2,14], ui:[2,14], workflows:[1,8], integrations:[0,5] },
    architectureImpact: ['General Ledger','AR','AP','Revenue','Payments','Tax-ready data'],
    remainingWork: ['Accounting workflows','Reconciliation','QuickBooks gateway','Tax-year package'],
    gaps: ['Operational accounting engine','Tax preparation workflow'] },

  { id: 11, name: 'Competition / Meet Systems', status: 'active', percent: 12,
    detail: 'Competition lifecycle, entries, results, officials, publication, and native LS1Sports competition architecture.',
    metrics: { features: [4,30], tables:[10,30], apis:[1,20], ui:[1,18], workflows:[0,12], integrations:[1,8] },
    architectureImpact: ['Competition Engine','Events','Entries','Officials','Results','Rankings'],
    remainingWork: ['Native meet engine','Entries','Results','Rules engine','Parallel Hy-Tek validation'],
    gaps: ['Native competition source of truth','Equivalence validation engine'] },

  { id: 12, name: 'AI & Automation', status: 'active', percent: 12,
    detail: 'Agent registry, permissions, actions, recommendations, approvals, and orchestration.',
    metrics: { features: [3,18], tables:[7,18], apis:[1,12], ui:[1,10], workflows:[0,8], integrations:[0,4] },
    architectureImpact: ['AI Orchestrator','Agent Registry','Permissions','Approvals','Action execution'],
    remainingWork: ['Coach agents','Admin agents','Competition agents','Execution framework','Human approval routing'],
    gaps: ['Production agent execution','Cross-domain orchestration'] },

  { id: 13, name: 'Multi-Sport Expansion', status: 'planned', percent: 5,
    detail: 'Sport-neutral framework and additional sport adapters.',
    metrics: { features: [1,18], tables:[4,15], apis:[1,10], ui:[1,8], workflows:[0,5], integrations:[0,3] },
    architectureImpact: ['Sport-neutral records','Sport adapters','Multi-sport identity context'],
    remainingWork: ['Sport abstraction','Track adapter','Additional sport schemas'],
    gaps: ['Second validated sport','Cross-sport analytics'] },

  { id: 14, name: 'Production Readiness', status: 'active', percent: 22,
    detail: 'Security hardening, observability, recovery, deployment, telemetry, and release gates.',
    metrics: { features: [4,20], tables:[7,10], apis:[3,12], ui:[2,8], workflows:[2,8], integrations:[1,5] },
    architectureImpact: ['Observability','Security','Recovery','Deployment','Release management'],
    remainingWork: ['Production gates','Recovery validation','Security review','Deployment automation'],
    gaps: ['Production certification','Operational resilience validation'] },
];

function calculateOverallPercentage(): number {
  if (!milestones.length) return 0;
  return Math.round(
    milestones.reduce((sum, milestone) => sum + milestone.percent, 0) /
      milestones.length,
  );
}

function StatusIcon({ status }: { status: MilestoneStatus }) {
  if (status === 'complete') {
    return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
  }
  if (status === 'blocked') {
    return <AlertTriangle className="h-4 w-4 text-red-400" />;
  }
  if (status === 'active') {
    return <Activity className="h-4 w-4 text-amber-400" />;
  }
  return <div className="h-3 w-3 rounded-full border border-neutral-700" />;
}

function MetricDetail({ label, value }: { label: string; value: MetricPair }) {
  const [complete, total] = value;
  const percent = total ? Math.round((complete / total) * 100) : 0;

  return (
    <div className="rounded-lg border border-neutral-800 bg-[#080909] p-3">
      <div className="text-[8px] font-bold uppercase tracking-[0.13em] text-neutral-700">
        {label}
      </div>
      <div className="mt-1 text-sm font-black text-neutral-300">
        {complete} / {total}
      </div>
      <div className="mt-1 text-[8px] text-neutral-600">
        {percent}% complete
      </div>
    </div>
  );
}

function MilestoneDrawer({
  milestone,
  onClose,
}: {
  milestone: Milestone;
  onClose: () => void;
}) {
  const buildItems: [string, MetricPair][] = [
    ['Features', milestone.metrics.features],
    ['Database Tables', milestone.metrics.tables],
    ['APIs', milestone.metrics.apis],
    ['UI Modules', milestone.metrics.ui],
    ['Workflows', milestone.metrics.workflows],
    ['Integrations', milestone.metrics.integrations],
  ];

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close milestone drawer"
        onClick={onClose}
        className="absolute inset-0 bg-black/60"
      />

      <aside className="absolute right-0 top-0 h-full w-full max-w-[500px] overflow-y-auto border-l border-neutral-800 bg-[#090b0b] shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-800 bg-[#090b0b]/95 px-6 py-5 backdrop-blur">
          <div>
            <div className="text-[8px] font-black uppercase tracking-[0.22em] text-emerald-400">
              Development Intelligence
            </div>
            <h2 className="mt-1 text-xl font-black text-white">
              {milestone.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg border border-neutral-800 p-2 text-neutral-500 hover:bg-neutral-900 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-6 p-6">
          <section className="rounded-2xl border border-neutral-800 bg-[#0d1010] p-5">
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="text-[8px] font-black uppercase tracking-[0.18em] text-neutral-600">
                  Completion
                </div>
                <div className="mt-1 text-4xl font-black text-white">
                  {milestone.percent}%
                </div>
              </div>
              <StatusIcon status={milestone.status} />
            </div>

            <div className="mt-4 h-2 overflow-hidden rounded-full bg-neutral-800">
              <div
                className="h-full rounded-full bg-emerald-400"
                style={{ width: `${milestone.percent}%` }}
              />
            </div>

            <div className="mt-3 text-[9px] uppercase tracking-[0.13em] text-neutral-600">
              Status: {milestone.status.replace('_', ' ')}
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2">
              <Table2 className="h-4 w-4 text-neutral-500" />
              <h3 className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-400">
                What This Metric Measures
              </h3>
            </div>

            <p className="mt-3 text-xs leading-5 text-neutral-500">
              {milestone.detail}
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <MetricDetail label="Features" value={milestone.metrics.features} />
              <MetricDetail label="Tables" value={milestone.metrics.tables} />
              <MetricDetail label="APIs" value={milestone.metrics.apis} />
              <MetricDetail label="UI Modules" value={milestone.metrics.ui} />
              <MetricDetail label="Workflows" value={milestone.metrics.workflows} />
              <MetricDetail label="Integrations" value={milestone.metrics.integrations} />
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2">
              <Workflow className="h-4 w-4 text-neutral-500" />
              <h3 className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-400">
                Build Stage
              </h3>
            </div>

            <div className="mt-4 space-y-3 rounded-xl border border-neutral-800 bg-[#0d1010] p-4">
              {buildItems.map(([label, pair]) => {
                const [complete, total] = pair;
                return (
                  <div key={label} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {complete >= total ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <div className="h-4 w-4 rounded border border-neutral-700" />
                      )}
                      <span className="text-xs text-neutral-400">{label}</span>
                    </div>
                    <span className="font-mono text-[10px] text-neutral-600">
                      {complete}/{total}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-neutral-500" />
              <h3 className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-400">
                Architecture Impact
              </h3>
            </div>
            <div className="mt-4 space-y-2">
              {milestone.architectureImpact.map((item) => (
                <div
                  key={item}
                  className="rounded-lg border border-neutral-800 bg-[#0d1010] px-3 py-2 text-xs text-neutral-400"
                >
                  {item}
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-neutral-500" />
              <h3 className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-400">
                Remaining Work
              </h3>
            </div>
            <div className="mt-4 space-y-2">
              {milestone.remainingWork.length ? (
                milestone.remainingWork.map((item) => (
                  <div
                    key={item}
                    className="flex gap-2 rounded-lg border border-neutral-800 bg-[#0d1010] px-3 py-2 text-xs text-neutral-400"
                  >
                    <div className="mt-1 h-2 w-2 shrink-0 rounded-full border border-neutral-600" />
                    {item}
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-emerald-900/50 bg-emerald-950/20 px-3 py-3 text-xs text-emerald-400">
                  No remaining milestone work recorded.
                </div>
              )}
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-neutral-500" />
              <h3 className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-400">
                Gap Analysis
              </h3>
            </div>
            <div className="mt-4 space-y-2">
              {milestone.gaps.length ? (
                milestone.gaps.map((item) => (
                  <div
                    key={item}
                    className="rounded-lg border border-amber-900/50 bg-amber-950/20 px-3 py-3 text-xs text-amber-300"
                  >
                    {item}
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-emerald-900/50 bg-emerald-950/20 px-3 py-3 text-xs text-emerald-400">
                  No material gaps recorded.
                </div>
              )}
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}

export default function SuperUserWorkspace() {
  const [active, setActive] = useState<WorkspaceTab>('overview');
  const [selectedMilestone, setSelectedMilestone] =
    useState<Milestone | null>(null);

  const overall = useMemo(() => calculateOverallPercentage(), []);

  return (
    <div className="min-h-full w-full bg-[#050807] p-6 lg:p-8">
      {/* =================================================
          SECTION: COMMAND HEADER
          ================================================= */}

      <section className="w-full rounded-3xl border border-neutral-800 bg-[#090b0b] p-7 lg:p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.3em] text-emerald-400">
              <LayoutDashboard className="h-4 w-4" />
              LS1Sports Platform Intelligence
            </div>

            <h1 className="mt-4 text-3xl font-black tracking-[-0.035em] text-white lg:text-4xl">
              SuperUser Command Center
            </h1>

            <p className="mt-3 max-w-4xl text-sm leading-6 text-neutral-500">
              Live control plane for the LS1Sports ERP across master data,
              transactions, platform services, integrations, AI orchestration,
              finance, operations, security, governance, and development.
            </p>
          </div>

          <div className="min-w-[190px] rounded-2xl border border-neutral-800 bg-[#0d1010] p-5">
            <div className="text-[8px] font-black uppercase tracking-[0.2em] text-neutral-600">
              Calculated Platform Completion
            </div>
            <div className="mt-2 text-4xl font-black text-white">{overall}%</div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-800">
              <div
                className="h-full rounded-full bg-emerald-400"
                style={{ width: `${overall}%` }}
              />
            </div>
            <div className="mt-2 text-[8px] uppercase tracking-[0.14em] text-emerald-400">
              Development intelligence
            </div>
          </div>
        </div>

        <div className="mt-7 flex flex-wrap gap-1 rounded-xl border border-neutral-800 bg-[#070909] p-1">
          {([
            ['overview', 'Overview'],
            ['intelligence', 'Sport Intelligence'],
            ['operations', 'Business Operations'],
            ['governance', 'Platform Governance'],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setActive(id)}
              className={`rounded-lg px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.16em] ${
                active === id
                  ? 'bg-emerald-400 text-black'
                  : 'text-neutral-500 hover:bg-neutral-900 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {active === 'overview' && (
        <div className="mt-6 space-y-6">
          {/* =================================================
              SECTION: MASTER ARCHITECTURE
              ================================================= */}

          <section className="w-full rounded-2xl border border-neutral-800 bg-[#090b0b] p-6">
            <div className="text-[9px] font-black uppercase tracking-[0.2em] text-neutral-600">
              Master Architecture
            </div>
            <h2 className="mt-1 text-xl font-black text-white">
              EAM / ERP Project Map
            </h2>
            <p className="mt-2 max-w-4xl text-xs leading-5 text-neutral-500">
              Authoritative platform map spanning master data, transactions,
              platform services, integrations, AI orchestration, and enterprise
              operations.
            </p>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {[
                ['MASTER DATA', ['Tenant','Organization','Person Master','Athlete Master','Teams','Programs','Seasons','Membership','Facilities']],
                ['TRANSACTIONS', ['Registration','Scheduling','Competition','Finance','Documents','Compliance','Communications']],
                ['PLATFORM SERVICES', ['Identity','Authorization','Security','Workflow','Rules','Audit','Search','Reporting','Data Quality']],
                ['INTEGRATIONS', ['Hy-Tek','Payments','SSO','Timing Systems','Accounting','Storage','Governing Bodies']],
                ['AI ORCHESTRATION', ['Agent Registry','Agent Permissions','AI Actions','Recommendations','Human Approval','Execution Results']],
                ['EAM / OPERATIONS', ['EAM','Facilities','Assets','Maintenance','Procurement','Payroll','Exceptions']],
              ].map(([title, items]) => (
                <div
                  key={String(title)}
                  className="rounded-xl border border-neutral-800 bg-[#0d1010] p-4"
                >
                  <div className="text-[10px] font-black tracking-[0.17em] text-neutral-300">
                    {String(title)}
                  </div>
                  <div className="mt-3 space-y-1.5">
                    {(items as string[]).map((item) => (
                      <div key={item} className="text-[11px] text-neutral-500">
                        <span className="mr-2 text-neutral-700">•</span>{item}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* =================================================
              SECTION: 14-MILESTONE DEVELOPMENT INTELLIGENCE
              ================================================= */}

          <section className="w-full rounded-2xl border border-neutral-800 bg-[#090b0b] p-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="text-[9px] font-black uppercase tracking-[0.2em] text-neutral-600">
                  Development Intelligence
                </div>
                <h2 className="mt-1 text-xl font-black text-white">
                  14-Milestone Platform Tracker
                </h2>
                <p className="mt-2 text-xs leading-5 text-neutral-600">
                  Click any milestone to open its detailed intelligence drawer.
                </p>
              </div>

              <div className="text-right">
                <div className="text-[8px] uppercase tracking-[0.16em] text-neutral-700">
                  Overall
                </div>
                <div className="text-2xl font-black text-emerald-400">
                  {overall}%
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-5 xl:grid-cols-2">
              {[
                {
                  title: 'FOUNDATION & CORE',
                  subtitle: 'Platform foundation through Coach Operations',
                  items: milestones.slice(0, 7),
                },
                {
                  title: 'OPERATIONS & SCALE',
                  subtitle: 'Parent, Admin, Finance, Competition, AI and Production',
                  items: milestones.slice(7, 14),
                },
              ].map((group) => (
                <div
                  key={group.title}
                  className="rounded-2xl border border-neutral-800 bg-[#080909] p-4"
                >
                  <div className="mb-4">
                    <div className="text-[9px] font-black uppercase tracking-[0.22em] text-neutral-300">
                      {group.title}
                    </div>
                    <div className="mt-1 text-[9px] leading-4 text-neutral-700">
                      {group.subtitle}
                    </div>
                  </div>

                  <div className="space-y-2">
                    {group.items.map((milestone) => (
                      <button
                        key={milestone.id}
                        type="button"
                        onClick={() => setSelectedMilestone(milestone)}
                        className="group w-full rounded-xl border border-neutral-800/80 bg-[#0d1010] p-3.5 text-left transition hover:border-neutral-700 hover:bg-[#101313]"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-neutral-800 bg-[#080909] font-mono text-[9px] text-neutral-500">
                            {String(milestone.id).padStart(2, '0')}
                          </div>

                          <StatusIcon status={milestone.status} />

                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[11px] font-black text-neutral-200">
                              {milestone.name}
                            </div>
                            <div className="mt-0.5 truncate text-[8px] text-neutral-600">
                              {milestone.status === 'complete'
                                ? 'Complete'
                                : milestone.status === 'active'
                                  ? 'In progress'
                                  : milestone.status === 'blocked'
                                    ? 'Blocked'
                                    : 'Planned'}
                            </div>
                          </div>

                          <div className="shrink-0 text-right">
                            <div className="text-lg font-black text-white">
                              {milestone.percent}%
                            </div>
                            <ChevronRight className="ml-auto mt-0.5 h-4 w-4 text-neutral-700 transition group-hover:text-emerald-400" />
                          </div>
                        </div>

                        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-neutral-800">
                          <div
                            className="h-full rounded-full bg-emerald-400"
                            style={{ width: `${milestone.percent}%` }}
                          />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* =================================================
              SECTION: LIVE CORE METRICS
              ================================================= */}

          <section>
            <div className="mb-3 text-[9px] font-black uppercase tracking-[0.2em] text-neutral-600">
              Live Core Metrics
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {[
                ['Platform', Activity, 'LIVE'],
                ['Organizations / Tenants', Building2, 'LIVE DATA'],
                ['Athletes', Users, 'LIVE DATA'],
                ['Competitions', Trophy, 'LIVE DATA'],
                ['Database', Database, 'LIVE'],
                ['Security', ShieldCheck, 'LIVE'],
                ['Finance', DollarSign, 'LIVE DATA'],
                ['AI Operations', Bot, 'LIVE'],
              ].map(([label, Icon, value]) => {
                const Component = Icon as React.ElementType;
                return (
                  <div
                    key={String(label)}
                    className="rounded-xl border border-neutral-800 bg-[#090b0b] p-4"
                  >
                    <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.15em] text-neutral-600">
                      <Component className="h-4 w-4" />
                      {String(label)}
                    </div>
                    <div className="mt-4 text-lg font-black text-emerald-400">
                      {String(value)}
                    </div>
                    <div className="mt-1 text-[8px] uppercase tracking-[0.14em] text-neutral-700">
                      Development / system connector
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <FinanceAccounting />
        </div>
      )}

      {active === 'intelligence' && (
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {[
            ['Athlete Intelligence', Activity, 'Systemwide athlete development, performance, trajectory, readiness, and recruiting intelligence.'],
            ['Competition Intelligence', Trophy, 'Competition lifecycle, qualification, results, officials, exceptions, and event intelligence.'],
            ['LS1Sports Copilot', Bot, 'Controlled AI search, recommendations, explanations, approvals, and authorized actions.'],
          ].map(([title, Icon, description]) => {
            const Component = Icon as React.ElementType;
            return (
              <div key={String(title)} className="rounded-2xl border border-neutral-800 bg-[#090b0b] p-6">
                <Component className="h-6 w-6 text-emerald-400" />
                <h2 className="mt-4 text-lg font-black text-white">{String(title)}</h2>
                <p className="mt-2 text-xs leading-5 text-neutral-500">{String(description)}</p>
              </div>
            );
          })}
        </div>
      )}

      {active === 'operations' && (
        <div className="mt-6 space-y-6">
          <FinanceAccounting />
        </div>
      )}

      {active === 'governance' && (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[
            'System Health',
            'Security',
            'Telemetry',
            'Audit Intelligence',
            'Data Governance',
            'Data Quality',
            'Development Intelligence',
            'Feature Flags',
            'Integrations',
          ].map((item) => (
            <div key={item} className="rounded-2xl border border-neutral-800 bg-[#090b0b] p-6">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
              <h2 className="mt-4 text-sm font-black text-white">{item}</h2>
              <p className="mt-2 text-xs leading-5 text-neutral-600">
                Live platform governance surface.
              </p>
            </div>
          ))}
        </div>
      )}

      {selectedMilestone && (
        <MilestoneDrawer
          milestone={selectedMilestone}
          onClose={() => setSelectedMilestone(null)}
        />
      )}
    </div>
  );
}
