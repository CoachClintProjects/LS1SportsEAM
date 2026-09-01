'use client';

// =====================================================
// LS1Sports SuperUser - EAM / ERP Project Map
//
// SECTION: RESPONSIBILITY
// - Display the master implementation map.
// - Keep the platform roadmap visible at the top.
// - Establish the command-center hierarchy.
//
// SECTION: DATA CONTRACT
// - Phase status will later be sourced from the
//   live development intelligence / milestone model.
// - No fictional completion percentages are injected.
// =====================================================

import React from 'react';
import {
  Database,
  ShieldCheck,
  Workflow,
  Plug,
  Bot,
  Users,
  Building2,
  Trophy,
  FileText,
  Search,
  BarChart3,
  Wrench,
} from 'lucide-react';

// =====================================================
// SECTION: PROJECT DOMAINS
// =====================================================

const domains = [
  {
    title: 'MASTER DATA',
    icon: Database,
    items: [
      'Tenant',
      'Organization',
      'Person Master',
      'Athlete Master',
      'Teams',
      'Programs',
      'Seasons',
      'Membership',
      'Facilities',
    ],
  },
  {
    title: 'TRANSACTIONS',
    icon: Workflow,
    items: [
      'Registration',
      'Scheduling',
      'Competition',
      'Finance',
      'Documents',
      'Compliance',
      'Communications',
    ],
  },
  {
    title: 'PLATFORM SERVICES',
    icon: ShieldCheck,
    items: [
      'Identity',
      'Security',
      'Authorization',
      'Workflow',
      'Rules',
      'Audit',
      'Search',
      'Reporting',
    ],
  },
  {
    title: 'INTEGRATIONS',
    icon: Plug,
    items: [
      'Hy-Tek',
      'Payments',
      'SSO',
      'Timing Systems',
      'Accounting',
      'Storage',
      'Governing Bodies',
    ],
  },
  {
    title: 'AI ORCHESTRATION',
    icon: Bot,
    items: [
      'Agent Registry',
      'Agent Permissions',
      'Actions',
      'Recommendations',
      'Human Approval',
      'Execution Results',
      'AI Audit',
    ],
  },
  {
    title: 'OPERATIONS',
    icon: Wrench,
    items: [
      'EAM',
      'Facilities',
      'Assets',
      'Maintenance',
      'Procurement',
      'Payroll',
      'Operational Exceptions',
    ],
  },
];

// =====================================================
// SECTION: COMPONENT
// =====================================================

export function EAMERPProjectMap() {
  return (
    <section className="w-full rounded-2xl border border-neutral-800 bg-[#090b0b] p-6">
      {/* =================================================
          SECTION: HEADER
          ================================================= */}

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.25em] text-[#FA4616]">
            <Database className="h-4 w-4" />
            Master Architecture
          </div>

          <h2 className="mt-2 text-xl font-black text-white">
            EAM / ERP Project Map
          </h2>

          <p className="mt-1 max-w-3xl text-xs leading-5 text-neutral-500">
            Enterprise control-plane map spanning master data, transactions,
            platform services, integrations, AI orchestration, and operations.
          </p>
        </div>

        <div className="hidden shrink-0 rounded-lg border border-neutral-800 bg-[#0d1010] px-3 py-2 text-right md:block">
          <div className="text-[8px] font-bold uppercase tracking-[0.2em] text-neutral-600">
            Architecture
          </div>
          <div className="mt-1 text-xs font-bold text-emerald-400">
            LIVE MODEL
          </div>
        </div>
      </div>

      {/* =================================================
          SECTION: ARCHITECTURE GRID
          ================================================= */}

      <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {domains.map((domain) => {
          const Icon = domain.icon;

          return (
            <div
              key={domain.title}
              className="rounded-xl border border-neutral-800/80 bg-[#0d1010] p-4"
            >
              <div className="flex items-center gap-2">
                <Icon
                  className="h-4 w-4 text-emerald-400"
                  strokeWidth={1.8}
                />

                <h3 className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-300">
                  {domain.title}
                </h3>
              </div>

              <div className="mt-3 space-y-1.5">
                {domain.items.map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-2 text-[11px] text-neutral-500"
                  >
                    <span className="h-1 w-1 rounded-full bg-neutral-700" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}