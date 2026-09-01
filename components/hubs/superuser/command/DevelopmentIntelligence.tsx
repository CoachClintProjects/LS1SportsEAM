'use client';

// =====================================================
// LS1Sports SuperUser Development Intelligence
// =====================================================
// SECTION: RESPONSIBILITY
// - Calculate platform completion from explicit work units.
// - Track all 14 platform milestones.
// - Separate completed, active, blocked, and not-started work.
// - Recalculate overall completion from milestone weights.
//
// SECTION: PRINCIPLE
// - Percentages are calculated.
// - No cosmetic manually-entered overall percentage.
// - The registry becomes the development intelligence source.
// - Later this registry can be backed by live database telemetry.
// =====================================================

import React from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Clock3,
  Database,
  GitBranch,
  Plug,
  ShieldCheck,
  Table2,
  Workflow,
  Wrench,
} from 'lucide-react';

// =====================================================
// SECTION: WORK UNIT MODEL
// =====================================================

type WorkUnits = {
  features: number;
  tables: number;
  apis: number;
  ui: number;
  workflows: number;
  integrations: number;
};

// =====================================================
// SECTION: MILESTONE MODEL
// =====================================================

type Milestone = {
  id: number;
  name: string;
  description: string;
  weight: number;
  required: WorkUnits;
  complete: WorkUnits;
  status: 'complete' | 'active' | 'blocked' | 'not_started';
};

// =====================================================
// SECTION: MILESTONE REGISTRY
//
// Initial state is based on the established platform
// roadmap. Unknown implementation quantities remain
// explicit rather than fabricated.
// =====================================================

const milestones: Milestone[] = [
  {
    id: 1,
    name: 'Platform Foundation',
    description: 'Multi-tenant enterprise foundation and core platform architecture.',
    weight: 10,
    required: {
      features: 10,
      tables: 10,
      apis: 8,
      ui: 6,
      workflows: 4,
      integrations: 2,
    },
    complete: {
      features: 10,
      tables: 10,
      apis: 8,
      ui: 6,
      workflows: 4,
      integrations: 2,
    },
    status: 'complete',
  },
  {
    id: 2,
    name: 'Identity & Security',
    description: 'Identity gateway, RBAC, authorization, tenant scope, and security controls.',
    weight: 10,
    required: {
      features: 12,
      tables: 14,
      apis: 8,
      ui: 7,
      workflows: 5,
      integrations: 2,
    },
    complete: {
      features: 10,
      tables: 12,
      apis: 6,
      ui: 5,
      workflows: 4,
      integrations: 2,
    },
    status: 'active',
  },
  {
    id: 3,
    name: 'Master Data',
    description: 'Person, organization, athlete, relationship, team, program, and season masters.',
    weight: 9,
    required: {
      features: 20,
      tables: 30,
      apis: 12,
      ui: 10,
      workflows: 6,
      integrations: 2,
    },
    complete: {
      features: 14,
      tables: 26,
      apis: 9,
      ui: 7,
      workflows: 4,
      integrations: 1,
    },
    status: 'active',
  },
  {
    id: 4,
    name: 'Real Data Onboarding',
    description: 'Staging, validation, identity resolution, and controlled production onboarding.',
    weight: 8,
    required: {
      features: 12,
      tables: 10,
      apis: 8,
      ui: 7,
      workflows: 6,
      integrations: 4,
    },
    complete: {
      features: 2,
      tables: 4,
      apis: 1,
      ui: 1,
      workflows: 1,
      integrations: 1,
    },
    status: 'active',
  },
  {
    id: 5,
    name: 'Team Manager',
    description: 'Organization, roster, membership, staff, programs, teams, and seasons.',
    weight: 10,
    required: {
      features: 30,
      tables: 25,
      apis: 18,
      ui: 16,
      workflows: 10,
      integrations: 3,
    },
    complete: {
      features: 5,
      tables: 9,
      apis: 2,
      ui: 2,
      workflows: 1,
      integrations: 0,
    },
    status: 'active',
  },
  {
    id: 6,
    name: 'Athlete Intelligence',
    description: 'Longitudinal athlete development and performance intelligence.',
    weight: 8,
    required: {
      features: 24,
      tables: 25,
      apis: 15,
      ui: 14,
      workflows: 8,
      integrations: 3,
    },
    complete: {
      features: 7,
      tables: 14,
      apis: 4,
      ui: 3,
      workflows: 2,
      integrations: 0,
    },
    status: 'active',
  },
  {
    id: 7,
    name: 'Coach Operations',
    description: 'Training, workouts, attendance, development, communication, and overwatch.',
    weight: 7,
    required: {
      features: 24,
      tables: 22,
      apis: 14,
      ui: 14,
      workflows: 8,
      integrations: 3,
    },
    complete: {
      features: 4,
      tables: 10,
      apis: 2,
      ui: 2,
      workflows: 1,
      integrations: 0,
    },
    status: 'active',
  },
  {
    id: 8,
    name: 'Parent Operations',
    description: 'Family, permissions, documents, registration, payments, and communication.',
    weight: 6,
    required: {
      features: 20,
      tables: 18,
      apis: 12,
      ui: 12,
      workflows: 8,
      integrations: 3,
    },
    complete: {
      features: 3,
      tables: 7,
      apis: 1,
      ui: 1,
      workflows: 1,
      integrations: 0,
    },
    status: 'active',
  },
  {
    id: 9,
    name: 'Admin Operations',
    description: 'Registrar, administration, configuration, reporting, and organizational controls.',
    weight: 6,
    required: {
      features: 22,
      tables: 20,
      apis: 12,
      ui: 12,
      workflows: 7,
      integrations: 3,
    },
    complete: {
      features: 4,
      tables: 8,
      apis: 2,
      ui: 2,
      workflows: 1,
      integrations: 0,
    },
    status: 'active',
  },
  {
    id: 10,
    name: 'Finance & Accounting',
    description: 'Billing, invoicing, payments, expenses, accounting, reporting, grants, and sponsorships.',
    weight: 8,
    required: {
      features: 24,
      tables: 20,
      apis: 14,
      ui: 14,
      workflows: 8,
      integrations: 5,
    },
    complete: {
      features: 3,
      tables: 17,
      apis: 1,
      ui: 1,
      workflows: 0,
      integrations: 0,
    },
    status: 'active',
  },
  {
    id: 11,
    name: 'Competition / Meet Systems',
    description: 'Competition lifecycle, entries, results, officials, publication, and Hy-Tek integration.',
    weight: 7,
    required: {
      features: 30,
      tables: 30,
      apis: 20,
      ui: 18,
      workflows: 12,
      integrations: 8,
    },
    complete: {
      features: 1,
      tables: 10,
      apis: 1,
      ui: 1,
      workflows: 0,
      integrations: 1,
    },
    status: 'active',
  },
  {
    id: 12,
    name: 'AI & Automation',
    description: 'Agent registry, permissions, actions, recommendations, approvals, and orchestration.',
    weight: 5,
    required: {
      features: 18,
      tables: 18,
      apis: 12,
      ui: 10,
      workflows: 8,
      integrations: 4,
    },
    complete: {
      features: 3,
      tables: 8,
      apis: 1,
      ui: 1,
      workflows: 0,
      integrations: 0,
    },
    status: 'active',
  },
  {
    id: 13,
    name: 'Multi-Sport Expansion',
    description: 'Sport-neutral framework and second-sport implementation.',
    weight: 3,
    required: {
      features: 18,
      tables: 15,
      apis: 10,
      ui: 8,
      workflows: 5,
      integrations: 3,
    },
    complete: {
      features: 3,
      tables: 8,
      apis: 3,
      ui: 2,
      workflows: 1,
      integrations: 1,
    },
    status: 'active',
  },
  {
    id: 14,
    name: 'Production Readiness',
    description: 'Operational hardening, observability, security, recovery, deployment, and release gates.',
    weight: 3,
    required: {
      features: 20,
      tables: 10,
      apis: 12,
      ui: 8,
      workflows: 8,
      integrations: 5,
    },
    complete: {
      features: 2,
      tables: 7,
      apis: 3,
      ui: 2,
      workflows: 2,
      integrations: 1,
    },
    status: 'active',
  },
];

// =====================================================
// SECTION: CALCULATION ENGINE
// =====================================================

function calculateUnitPercentage(
  required: number,
  complete: number,
): number {
  if (required <= 0) return 0;
  return Math.min(100, Math.round((complete / required) * 100));
}

function calculateMilestonePercentage(
  milestone: Milestone,
): number {
  const units = [
    milestone.required.features,
    milestone.required.tables,
    milestone.required.apis,
    milestone.required.ui,
    milestone.required.workflows,
    milestone.required.integrations,
  ];

  const complete = [
    milestone.complete.features,
    milestone.complete.tables,
    milestone.complete.apis,
    milestone.complete.ui,
    milestone.complete.workflows,
    milestone.complete.integrations,
  ];

  const percentages = units.map((required, index) =>
    calculateUnitPercentage(required, complete[index]),
  );

  const total =
    percentages.reduce((sum, value) => sum + value, 0) /
    percentages.length;

  return Math.round(total);
}

function calculateOverallPercentage(): number {
  const totalWeight = milestones.reduce(
    (sum, milestone) => sum + milestone.weight,
    0,
  );

  const weightedCompletion = milestones.reduce(
    (sum, milestone) =>
      sum +
      calculateMilestonePercentage(milestone) *
        milestone.weight,
    0,
  );

  if (totalWeight === 0) return 0;

  return Math.round(weightedCompletion / totalWeight);
}

// =====================================================
// SECTION: STATUS PRESENTATION
// =====================================================

function StatusIcon({
  status,
}: {
  status: Milestone['status'];
}) {
  if (status === 'complete') {
    return (
      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
    );
  }

  if (status === 'blocked') {
    return (
      <AlertTriangle className="h-4 w-4 text-red-400" />
    );
  }

  if (status === 'active') {
    return <Clock3 className="h-4 w-4 text-amber-400" />;
  }

  return <Circle className="h-4 w-4 text-neutral-700" />;
}

// =====================================================
// SECTION: COMPONENT
// =====================================================

export function DevelopmentIntelligence() {
  const overall = calculateOverallPercentage();

  return (
    <section className="w-full rounded-2xl border border-neutral-800 bg-[#090b0b] p-6">
      {/* =================================================
          SECTION: HEADER
          ================================================= */}

      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.25em] text-emerald-400">
            <Activity className="h-4 w-4" />
            Development Intelligence
          </div>

          <h2 className="mt-2 text-xl font-black text-white">
            Platform Completion
          </h2>

          <p className="mt-1 max-w-3xl text-xs leading-5 text-neutral-500">
            Completion is calculated from the registered implementation
            units across features, database tables, APIs, UI modules,
            workflows, and integrations.
          </p>
        </div>

        {/* =================================================
            SECTION: OVERALL COMPLETION
            ================================================= */}

        <div className="min-w-[190px] rounded-xl border border-neutral-800 bg-[#0d1010] p-4">
          <div className="flex items-center justify-between">
            <span className="text-[8px] font-black uppercase tracking-[0.2em] text-neutral-600">
              Overall Platform
            </span>
            <span className="text-[9px] font-bold text-emerald-400">
              CALCULATED
            </span>
          </div>

          <div className="mt-2 text-3xl font-black text-white">
            {overall}%
          </div>

          <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-800">
            <div
              className="h-full rounded-full bg-emerald-400 transition-all"
              style={{ width: `${overall}%` }}
            />
          </div>
        </div>
      </div>

      {/* =================================================
          SECTION: MILESTONE GRID
          ================================================= */}

      <div className="mt-6 space-y-2">
        {milestones.map((milestone) => {
          const percentage =
            calculateMilestonePercentage(milestone);

          return (
            <div
              key={milestone.id}
              className="rounded-xl border border-neutral-800/80 bg-[#0d1010] p-4"
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

                  <div className="mt-0.5 hidden truncate text-[9px] text-neutral-600 md:block">
                    {milestone.description}
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <div className="text-lg font-black text-white">
                    {percentage}%
                  </div>

                  <div className="text-[8px] uppercase tracking-[0.15em] text-neutral-700">
                    weight {milestone.weight}
                  </div>
                </div>
              </div>

              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-neutral-800">
                <div
                  className="h-full rounded-full bg-emerald-400 transition-all"
                  style={{ width: `${percentage}%` }}
                />
              </div>

              {/* =============================================
                  SECTION: CALCULATION BREAKDOWN
                  ============================================= */}

              <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-6">
                {[
                  ['Features', milestone.required.features, milestone.complete.features],
                  ['Tables', milestone.required.tables, milestone.complete.tables],
                  ['APIs', milestone.required.apis, milestone.complete.apis],
                  ['UI', milestone.required.ui, milestone.complete.ui],
                  ['Workflow', milestone.required.workflows, milestone.complete.workflows],
                  ['Integrations', milestone.required.integrations, milestone.complete.integrations],
                ].map(([label, required, complete]) => (
                  <div
                    key={String(label)}
                    className="rounded-md border border-neutral-800/70 bg-[#080909] px-2 py-2"
                  >
                    <div className="text-[7px] font-bold uppercase tracking-[0.12em] text-neutral-700">
                      {String(label)}
                    </div>

                    <div className="mt-1 text-[10px] font-bold text-neutral-400">
                      {String(complete)} / {String(required)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* =================================================
          SECTION: CALCULATION LEGEND
          ================================================= */}

      <div className="mt-5 grid gap-2 md:grid-cols-3">
        <div className="flex items-center gap-2 rounded-lg border border-neutral-800/70 bg-[#080909] px-3 py-2">
          <Table2 className="h-3.5 w-3.5 text-neutral-600" />
          <span className="text-[8px] uppercase tracking-[0.12em] text-neutral-600">
            Tables
          </span>
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-neutral-800/70 bg-[#080909] px-3 py-2">
          <GitBranch className="h-3.5 w-3.5 text-neutral-600" />
          <span className="text-[8px] uppercase tracking-[0.12em] text-neutral-600">
            APIs / Architecture
          </span>
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-neutral-800/70 bg-[#080909] px-3 py-2">
          <Workflow className="h-3.5 w-3.5 text-neutral-600" />
          <span className="text-[8px] uppercase tracking-[0.12em] text-neutral-600">
            Workflows / Integrations
          </span>
        </div>
      </div>
    </section>
  );
}