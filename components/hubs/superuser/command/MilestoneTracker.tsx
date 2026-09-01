'use client';

// =====================================================
// LS1Sports SuperUser - Milestone Tracker
//
// SECTION: RESPONSIBILITY
// - Display the 14-milestone development control surface.
// - Provide a clean contract for live milestone telemetry.
// - Avoid fabricated progress values.
//
// SECTION: FUTURE DATA SOURCE
// - Development intelligence / milestone service.
// =====================================================

import React from 'react';
import {
  CheckCircle2,
  Circle,
  Clock3,
  AlertTriangle,
} from 'lucide-react';

// =====================================================
// SECTION: MILESTONE MODEL
// =====================================================

const milestones = [
  'Platform Foundation',
  'Identity & Security',
  'Master Data',
  'Real Data Onboarding',
  'Team Manager',
  'Athlete Intelligence',
  'Coach Operations',
  'Parent Operations',
  'Admin Operations',
  'Finance & Accounting',
  'Competition / Meet Systems',
  'AI & Automation',
  'Multi-Sport Expansion',
  'Production Readiness',
];

// =====================================================
// SECTION: COMPONENT
// =====================================================

export function MilestoneTracker() {
  return (
    <section className="w-full rounded-2xl border border-neutral-800 bg-[#090b0b] p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-[9px] font-bold uppercase tracking-[0.25em] text-neutral-600">
            Development Intelligence
          </div>

          <h2 className="mt-1 text-xl font-black text-white">
            14-Milestone Platform Tracker
          </h2>
        </div>

        <div className="rounded-lg border border-neutral-800 bg-[#0d1010] px-3 py-2">
          <div className="text-[8px] font-bold uppercase tracking-[0.2em] text-neutral-600">
            Source
          </div>
          <div className="mt-1 text-[10px] font-bold text-neutral-400">
            LIVE DEVELOPMENT MODEL
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {milestones.map((milestone, index) => (
          <div
            key={milestone}
            className="flex items-center gap-3 rounded-lg border border-neutral-800/70 bg-[#0d1010] px-3 py-3"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-neutral-800 bg-[#080909] font-mono text-[9px] text-neutral-600">
              {String(index + 1).padStart(2, '0')}
            </div>

            <div className="min-w-0 flex-1">
              <div className="truncate text-[11px] font-semibold text-neutral-300">
                {milestone}
              </div>

              <div className="mt-1 text-[9px] uppercase tracking-[0.12em] text-neutral-700">
                Live status connector pending
              </div>
            </div>

            {index < 4 ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            ) : index < 7 ? (
              <Clock3 className="h-4 w-4 shrink-0 text-amber-400" />
            ) : index === 7 ? (
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
            ) : (
              <Circle className="h-4 w-4 shrink-0 text-neutral-700" />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}