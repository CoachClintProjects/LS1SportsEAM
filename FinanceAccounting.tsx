'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { renderIconSync } from '@/lib/icons';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Invoice {
  id: string;
  family_name: string;
  amount: number;
  status: string;
  due_date: string;
}

export function FinanceAccounting() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  const DollarIcon = renderIconSync('dollar-sign');
  const WalletIcon = renderIconSync('wallet');
  const ReceiptIcon = renderIconSync('receipt');
  const TrendingUpIcon = renderIconSync('trending-up');
  const TrendingDownIcon = renderIconSync('trending-down');
  const PlusIcon = renderIconSync('plus');
  const SearchIcon = renderIconSync('search');
  const ChevronDownIcon = renderIconSync('chevron-down');
  const EyeIcon = renderIconSync('eye');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const mockInvoices: Invoice[] = [
        { id: 'INV-2026-101', family_name: 'Smith Family', amount: 450.00, status: 'OVERDUE', due_date: '2026-08-15' },
        { id: 'INV-2026-102', family_name: 'Jones Family', amount: 325.00, status: 'PENDING', due_date: '2026-09-10' },
        { id: 'INV-2026-103', family_name: 'Wilson Family', amount: 275.00, status: 'PAID', due_date: '2026-08-30' },
        { id: 'INV-2026-104', family_name: 'Brown Family', amount: 500.00, status: 'OVERDUE', due_date: '2026-08-20' },
      ];
      setInvoices(mockInvoices);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PAID': return 'bg-emerald-400/10 text-emerald-400';
      case 'PENDING': return 'bg-amber-400/10 text-amber-400';
      case 'OVERDUE': return 'bg-red-400/10 text-red-400';
      default: return 'bg-neutral-400/10 text-neutral-400';
    }
  };

  const tabs = ['Overview', 'Billing', 'Invoices', 'Payments', 'Budgets'];

  return (
    <div className="p-6 text-white">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="text-[9px] font-black uppercase tracking-[0.24em] text-[#FA4616]">💰 Finance & Accounting</div>
          <h1 className="mt-1 text-2xl font-black text-white">Financial Overview</h1>
          <p className="text-sm text-neutral-400">Manage billing, invoices, and payments</p>
        </div>
        <button className="flex items-center gap-2 rounded-xl bg-[#FA4616] px-4 py-2 text-sm font-bold text-black hover:bg-[#FA4616]/90 transition-colors">
          {PlusIcon}
          New Invoice
        </button>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 border-b border-neutral-800">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab.toLowerCase())}
            className={`px-4 py-2.5 text-sm font-bold transition-colors border-b-2 ${
              activeTab === tab.toLowerCase()
                ? 'border-[#FA4616] text-white'
                : 'border-transparent text-neutral-500 hover:text-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Metrics */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-neutral-800 bg-[#090b0b] p-4">
          <div className="flex items-center gap-2 text-neutral-500">
            {DollarIcon}
            <span className="text-xs">AR Balance</span>
          </div>
          <div className="mt-1 text-2xl font-black text-white">$42,890</div>
          <div className="flex items-center gap-1 text-xs text-emerald-400">
            {TrendingUpIcon} 12%
          </div>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-[#090b0b] p-4">
          <div className="flex items-center gap-2 text-neutral-500">
            {WalletIcon}
            <span className="text-xs">AP Balance</span>
          </div>
          <div className="mt-1 text-2xl font-black text-white">$12,340</div>
          <div className="flex items-center gap-1 text-xs text-red-400">
            {TrendingDownIcon} 5%
          </div>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-[#090b0b] p-4">
          <div className="flex items-center gap-2 text-neutral-500">
            {ReceiptIcon}
            <span className="text-xs">Open Invoices</span>
          </div>
          <div className="mt-1 text-2xl font-black text-white">24</div>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-[#090b0b] p-4">
          <div className="flex items-center gap-2 text-neutral-500">
            <span className="text-xs">Past Due</span>
          </div>
          <div className="mt-1 text-2xl font-black text-white">8</div>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="overflow-x-auto rounded-2xl border border-neutral-800 bg-[#090b0b]">
        <div className="flex items-center justify-between border-b border-neutral-800 p-4">
          <div className="relative flex-1 max-w-sm">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">{SearchIcon}</span>
            <input type="text" placeholder="Search invoices..." className="w-full rounded-lg border border-neutral-800 bg-black py-2 pl-10 pr-4 text-sm text-white placeholder:text-neutral-500 focus:border-[#FA4616] focus:outline-none" />
          </div>
          <button className="flex items-center gap-2 rounded-lg border border-neutral-800 px-3 py-1.5 text-sm text-neutral-400 hover:border-neutral-600 hover:text-white transition-colors">
            {ChevronDownIcon}
            Filter
          </button>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-800 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              <th className="px-4 py-3">Invoice #</th>
              <th className="px-4 py-3">Family</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Due Date</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-neutral-500">Loading...</td></tr>
            ) : invoices.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-neutral-500">No invoices found</td></tr>
            ) : (
              invoices.map((inv) => (
                <tr key={inv.id} className="border-b border-neutral-800/50 hover:bg-neutral-800/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-neutral-400">{inv.id}</td>
                  <td className="px-4 py-3 font-medium text-white">{inv.family_name}</td>
                  <td className="px-4 py-3 font-bold text-white">${inv.amount.toFixed(2)}</td>
                  <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${getStatusColor(inv.status)}`}>{inv.status}</span></td>
                  <td className="px-4 py-3 text-neutral-400">{new Date(inv.due_date).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right">
                    <button className="rounded-lg px-3 py-1 text-xs font-bold text-[#FA4616] hover:bg-[#FA4616]/10 transition-colors">{EyeIcon} View</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default FinanceAccounting;
