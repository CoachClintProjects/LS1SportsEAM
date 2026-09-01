'use client';

// =====================================================
// LS1Sports SuperUser - Live Core Metrics
//
// SECTION: RESPONSIBILITY
// - Establish the live telemetry surface.
// - Display high-value command metrics.
// - Use explicit connector states rather than fake data.
// =====================================================

import React from 'react';
import {
  Activity,
  Building2,
  Database,
  ShieldCheck,
  Users,
  Trophy,
  Bot,
  Receipt,
} from 'lucide-react';

// =====================================================
// SECTION: METRIC DEFINITIONS
// =====================================================

const metrics = [
  { label: 'Platform', icon: Activity },
  { label: 'Organizations / Tenants', icon: Building2 },
  { label: 'Athletes', icon: Users },
  { label: 'Competitions', icon: Trophy },
  { label: 'Database', icon: Database },
  { label: 'Security', icon: ShieldCheck },
  { label: 'Finance', icon: Receipt },
  { label: 'AI Operations', icon: Bot },
];

// =====================================================
// SECTION: COMPONENT
// =====================================================

export function LiveCoreMetrics() {
  return (
    <section className="w-full">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;

          return (
            <div
              key={metric.label}
              className="rounded-xl border border-neutral-800 bg-[#090b0b] p-4"
            >
              <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.16em] text-neutral-600">
                <Icon className="h-4 w-4 text-neutral-500" />
                {metric.label}
              </div>

              <div className="mt-4 text-lg font-black text-neutral-300">
                —
              </div>

              <div className="mt-1 text-[9px] uppercase tracking-[0.15em] text-neutral-700">
                Awaiting live telemetry
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}