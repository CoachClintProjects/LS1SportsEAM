'use client';

// =====================================================
// LS1Sports SuperUser - Finance & Accounting
//
// SECTION: RESPONSIBILITY
// - Establish the SuperUser financial command surface.
// - Cover revenue, costs, overhead, accounting, cash,
//   receivables, payables, budgets, and profitability.
//
// SECTION: DATA SOURCE
// - finance schema.
// - Live transaction and reporting services.
// - No hardcoded financial outcomes.
// =====================================================

import React from 'react';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Wallet,
  Receipt,
  Calculator,
} from 'lucide-react';

// =====================================================
// SECTION: FINANCIAL AREAS
// =====================================================

const areas = [
  { label: 'Revenue', icon: TrendingUp },
  { label: 'Costs & Overhead', icon: TrendingDown },
  { label: 'Cash', icon: Wallet },
  { label: 'AR / AP', icon: Receipt },
  { label: 'General Ledger', icon: Calculator },
  { label: 'Profitability', icon: DollarSign },
];

// =====================================================
// SECTION: COMPONENT
// =====================================================

export function FinanceAccounting() {
  return (
    <section className="w-full rounded-2xl border border-neutral-800 bg-[#090b0b] p-6">
      <div>
        <div className="text-[9px] font-bold uppercase tracking-[0.25em] text-emerald-400">
          ERP Finance
        </div>

        <h2 className="mt-1 text-xl font-black text-white">
          Finance & Accounting
        </h2>

        <p className="mt-1 max-w-2xl text-xs leading-5 text-neutral-500">
          SuperUser financial command surface for understanding whether
          LS1Sports is generating revenue, controlling costs, and producing
          sustainable operating results.
        </p>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {areas.map((area) => {
          const Icon = area.icon;

          return (
            <div
              key={area.label}
              className="rounded-xl border border-neutral-800/70 bg-[#0d1010] p-4"
            >
              <div className="flex items-center gap-2">
                <Icon
                  className="h-4 w-4 text-emerald-400"
                  strokeWidth={1.8}
                />

                <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-400">
                  {area.label}
                </span>
              </div>

              <div className="mt-4 text-xl font-black text-neutral-300">
                —
              </div>

              <div className="mt-1 text-[9px] uppercase tracking-[0.13em] text-neutral-700">
                Live finance connector pending
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}