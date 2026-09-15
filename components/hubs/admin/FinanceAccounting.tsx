'use client';

import { useState } from 'react';
import { renderIconSync } from '@/lib/icons';

export function FinanceAccounting() {
  const [activeTab, setActiveTab] = useState('overview');
  const DollarIcon = renderIconSync('dollar-sign');
  const WalletIcon = renderIconSync('wallet');
  const ReceiptIcon = renderIconSync('receipt');
  const tabs = ['Overview', 'Billing', 'Invoices', 'Payments', 'Budgets'];

  return (
    <div className="p-6 text-white">
      <div className="mb-6">
        <div className="text-[9px] font-black uppercase tracking-[0.24em] text-[#FA4616]">Finance & Accounting</div>
        <h1 className="mt-1 text-2xl font-black text-white">Financial Overview</h1>
        <p className="text-sm text-neutral-400">Canonical finance data only. No demo balances or fabricated invoices are shown.</p>
      </div>

      <div className="mb-6 flex gap-1 border-b border-neutral-800">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab.toLowerCase())}
            className={`border-b-2 px-4 py-2.5 text-sm font-bold transition-colors ${activeTab === tab.toLowerCase() ? 'border-[#FA4616] text-white' : 'border-transparent text-neutral-500 hover:text-white'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-neutral-800 bg-[#090b0b] p-4">
          <div className="flex items-center gap-2 text-neutral-500">{DollarIcon}<span className="text-xs">Receivables</span></div>
          <div className="mt-2 text-sm font-bold text-neutral-300">Awaiting canonical finance feed</div>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-[#090b0b] p-4">
          <div className="flex items-center gap-2 text-neutral-500">{WalletIcon}<span className="text-xs">Payables</span></div>
          <div className="mt-2 text-sm font-bold text-neutral-300">Awaiting canonical finance feed</div>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-[#090b0b] p-4">
          <div className="flex items-center gap-2 text-neutral-500">{ReceiptIcon}<span className="text-xs">Invoices</span></div>
          <div className="mt-2 text-sm font-bold text-neutral-300">No fabricated invoice activity</div>
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-800 bg-[#090b0b] px-6 py-12 text-center">
        <div className="text-sm font-bold text-white">No canonical finance records loaded in this Admin surface.</div>
        <div className="mx-auto mt-2 max-w-2xl text-xs leading-5 text-neutral-500">
          This workspace intentionally remains empty until its authenticated finance API is connected. Financial totals, invoice status, balances, and trends must come from LS1 canonical records rather than UI fixtures.
        </div>
      </div>
    </div>
  );
}

export default FinanceAccounting;
