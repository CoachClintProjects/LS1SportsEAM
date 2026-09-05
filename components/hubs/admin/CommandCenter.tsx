'use client';

// =============================================================================
// COMMAND CENTER - Admin Dashboard with AP/AR
// =============================================================================

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { renderIconSync } from '@/lib/icons';
import {
  AlertTriangle,
  CheckCircle2,
  Activity,
  Clock,
  ChevronRight,
  Plus,
} from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// =============================================================================
// TYPES
// =============================================================================

interface Invoice {
  id: string;
  family_name: string;
  amount: number;
  status: 'PAID' | 'PENDING' | 'OVERDUE';
  due_date: string;
  created_at: string;
}

interface Metric {
  label: string;
  value: string | number;
  change?: number;
  icon: string;  // Icon name from database
  color: string;
}

interface Task {
  id: number;
  type: 'warning' | 'error' | 'info' | 'success';
  message: string;
  action: string;
  actionLabel: string;
  time: string;
}

// =============================================================================
// MAIN COMPONENT: CommandCenter
// =============================================================================

export function CommandCenter() {
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState({
    arBalance: 0,
    apBalance: 0,
    openInvoices: 0,
    pastDue: 0
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Simulated data - replace with real Supabase queries
      const mockInvoices: Invoice[] = [
        { id: 'INV-2026-101', family_name: 'Smith Family', amount: 450.00, status: 'OVERDUE', due_date: '2026-08-15', created_at: '2026-08-01' },
        { id: 'INV-2026-102', family_name: 'Jones Family', amount: 325.00, status: 'PENDING', due_date: '2026-09-10', created_at: '2026-08-20' },
        { id: 'INV-2026-103', family_name: 'Wilson Family', amount: 275.00, status: 'PAID', due_date: '2026-08-30', created_at: '2026-08-15' },
        { id: 'INV-2026-104', family_name: 'Brown Family', amount: 500.00, status: 'OVERDUE', due_date: '2026-08-20', created_at: '2026-08-05' },
        { id: 'INV-2026-105', family_name: 'Davis Family', amount: 380.00, status: 'PENDING', due_date: '2026-09-15', created_at: '2026-08-25' },
        { id: 'INV-2026-106', family_name: 'Miller Family', amount: 295.00, status: 'PAID', due_date: '2026-08-25', created_at: '2026-08-10' },
      ];
      setInvoices(mockInvoices);

      // Calculate financial stats
      const totalAr = mockInvoices.filter(i => i.status !== 'PAID').reduce((sum, i) => sum + i.amount, 0);
      const totalAp = 12340;
      const openInvoices = mockInvoices.filter(i => i.status === 'PENDING').length;
      const pastDue = mockInvoices.filter(i => i.status === 'OVERDUE').length;

      setStats({
        arBalance: totalAr,
        apBalance: totalAp,
        openInvoices,
        pastDue
      });

      // Metrics with icon names from database
      setMetrics([
        { label: 'AR Balance', value: `$${totalAr.toFixed(2)}`, change: 12, icon: 'dollar-sign', color: 'text-[#FA4616]' },
        { label: 'AP Balance', value: `$${totalAp.toFixed(2)}`, change: -5, icon: 'wallet', color: 'text-blue-400' },
        { label: 'Open Invoices', value: openInvoices, change: 3, icon: 'receipt', color: 'text-amber-400' },
        { label: 'Past Due', value: pastDue, change: 2, icon: 'alert-triangle', color: 'text-red-400' },
      ]);

      setTasks([
        { id: 1, type: 'error', message: '3 coach certifications expiring in 30 days', action: 'resolve', actionLabel: 'RESOLVE', time: 'Today' },
        { id: 2, type: 'error', message: '2 invoices overdue >30 days', action: 'review', actionLabel: 'REVIEW', time: 'Today' },
        { id: 3, type: 'warning', message: 'Spring Meet entries due in 48 hours - 12 swimmers not entered', action: 'notify', actionLabel: 'NOTIFY', time: 'Today' },
        { id: 4, type: 'info', message: '1 facility booking conflict (pool - Sat AM)', action: 'fix', actionLabel: 'FIX', time: 'Today' },
      ]);

    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PAID': return 'text-emerald-400 bg-emerald-400/10';
      case 'PENDING': return 'text-amber-400 bg-amber-400/10';
      case 'OVERDUE': return 'text-red-400 bg-red-400/10';
      default: return 'text-neutral-400 bg-neutral-400/10';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PAID': return <CheckCircle2 className="h-4 w-4" />;
      case 'PENDING': return <Clock className="h-4 w-4" />;
      case 'OVERDUE': return <AlertTriangle className="h-4 w-4" />;
      default: return null;
    }
  };

  return (
    <div className="p-6 text-white">
      {/* ================================================================
           HEADER
           ================================================================ */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <div className="text-[9px] font-black uppercase tracking-[0.24em] text-[#FA4616]">
            🏊 HPAC Admin
          </div>
          <h1 className="mt-1 text-3xl font-black text-white">Good morning, Clint</h1>
          <p className="mt-1 text-sm text-neutral-400">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <button className="flex items-center gap-2 rounded-xl border border-neutral-800 px-4 py-2 text-sm text-neutral-400 hover:border-neutral-600 hover:text-white transition-colors">
          <Plus className="h-4 w-4" />
          New Task
        </button>
      </div>

      {/* ================================================================
           TODAY'S PRIORITIES (Tasks)
           ================================================================ */}
      <div className="mb-6">
        <h2 className="text-sm font-bold text-white mb-3">📋 Today's Priorities</h2>
        <div className="space-y-2">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-3 rounded-xl border border-neutral-800 bg-[#090b0b] p-3 hover:border-neutral-600 transition-colors"
            >
              <div>
                {task.type === 'error' && <AlertTriangle className="h-5 w-5 text-red-400" />}
                {task.type === 'warning' && <AlertTriangle className="h-5 w-5 text-amber-400" />}
                {task.type === 'info' && <Activity className="h-5 w-5 text-blue-400" />}
                {task.type === 'success' && <CheckCircle2 className="h-5 w-5 text-emerald-400" />}
              </div>
              <div className="flex-1">
                <span className="text-sm text-white">{task.message}</span>
                <span className="ml-3 text-xs text-neutral-500">{task.time}</span>
              </div>
              <button className="rounded-lg bg-[#FA4616] px-3 py-1.5 text-xs font-bold text-black hover:bg-[#FA4616]/90 transition-colors">
                {task.actionLabel}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ================================================================
           FINANCIAL SNAPSHOT (AP/AR) - ICONS FROM DATABASE
           ================================================================ */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-white">💰 Financial Snapshot</h2>
          <button className="text-xs text-[#FA4616] hover:text-[#FA4616]/80 transition-colors flex items-center gap-1">
            View All <ChevronRight className="h-3 w-3" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {loading ? (
            Array(4).fill(0).map((_, i) => (
              <div key={i} className="rounded-xl border border-neutral-800 bg-[#090b0b] p-4">
                <div className="h-4 w-20 animate-pulse rounded bg-neutral-800" />
                <div className="mt-2 h-6 w-16 animate-pulse rounded bg-neutral-800" />
              </div>
            ))
          ) : (
            metrics.map((metric, index) => {
              const iconElement = renderIconSync(metric.icon);
              return (
                <div key={index} className="rounded-xl border border-neutral-800 bg-[#090b0b] p-4">
                  <div className="flex items-center justify-between">
                    <div className={metric.color}>
                      {iconElement}
                    </div>
                    {metric.change !== undefined && (
                      <span className={`text-[10px] font-bold ${metric.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {metric.change >= 0 ? '▲' : '▼'} {Math.abs(metric.change)}%
                      </span>
                    )}
                  </div>
                  <div className="mt-2 text-xl font-black text-white">{metric.value}</div>
                  <div className="text-xs text-neutral-500">{metric.label}</div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ================================================================
           RECENT INVOICES & PAYMENTS
           ================================================================ */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-white">📋 Recent Invoices & Payments</h2>
          <button className="text-xs text-[#FA4616] hover:text-[#FA4616]/80 transition-colors flex items-center gap-1">
            View All <ChevronRight className="h-3 w-3" />
          </button>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-neutral-800 bg-[#090b0b]">
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
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-neutral-500">
                    Loading invoices...
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-neutral-500">
                    No invoices found
                  </td>
                </tr>
              ) : (
                invoices.slice(0, 6).map((invoice) => (
                  <tr
                    key={invoice.id}
                    className="border-b border-neutral-800/50 hover:bg-neutral-800/30 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-neutral-400">
                      {invoice.id}
                    </td>
                    <td className="px-4 py-3 font-medium text-white">
                      {invoice.family_name}
                    </td>
                    <td className="px-4 py-3 font-bold text-white">
                      ${invoice.amount.toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${getStatusColor(invoice.status)}`}>
                        {getStatusIcon(invoice.status)}
                        {invoice.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-neutral-400">
                      {new Date(invoice.due_date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button className="rounded-lg px-3 py-1 text-xs font-bold text-[#FA4616] hover:bg-[#FA4616]/10 transition-colors">
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================================================================
           TWO COLUMN: EVENTS + QUICK STATS
           ================================================================ */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Today's Events */}
        <div className="rounded-2xl border border-neutral-800 bg-[#090b0b] p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">📅 Today's Events</h2>
            <button className="text-xs text-[#FA4616] hover:text-[#FA4616]/80 transition-colors flex items-center gap-1">
              Calendar <ChevronRight className="h-3 w-3" />
            </button>
          </div>
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-3 rounded-xl border border-neutral-800 p-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#FA4616]/10 text-[#FA4616] text-xs font-black">
                9:00
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold text-white">Board Meeting Prep</div>
                <div className="text-xs text-neutral-500">Virtual · 30 min</div>
              </div>
              <button className="text-xs text-neutral-500 hover:text-white transition-colors">Join</button>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-neutral-800 p-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#FA4616]/10 text-[#FA4616] text-xs font-black">
                11:00
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold text-white">Staff Review</div>
                <div className="text-xs text-neutral-500">Conference Room A · 1 hr</div>
              </div>
              <button className="text-xs text-neutral-500 hover:text-white transition-colors">Join</button>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="rounded-2xl border border-neutral-800 bg-[#090b0b] p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">📊 Quick Stats</h2>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-neutral-800 bg-[#0d1010] p-3">
              <div className="text-xs text-neutral-500">Active Swimmers</div>
              <div className="text-xl font-black text-white">247</div>
            </div>
            <div className="rounded-xl border border-neutral-800 bg-[#0d1010] p-3">
              <div className="text-xs text-neutral-500">Open Roles</div>
              <div className="text-xl font-black text-white">12</div>
            </div>
            <div className="rounded-xl border border-neutral-800 bg-[#0d1010] p-3">
              <div className="text-xs text-neutral-500">Upcoming Meets</div>
              <div className="text-xl font-black text-white">3</div>
            </div>
            <div className="rounded-xl border border-neutral-800 bg-[#0d1010] p-3">
              <div className="text-xs text-neutral-500">Retention</div>
              <div className="text-xl font-black text-white">89%</div>
            </div>
          </div>
        </div>
      </div>

      {/* ================================================================
           ACTIVITY FEED
           ================================================================ */}
      <div className="mt-6 rounded-2xl border border-neutral-800 bg-[#090b0b] p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white">📋 Activity Feed</h2>
          <button className="text-xs text-[#FA4616] hover:text-[#FA4616]/80 transition-colors flex items-center gap-1">
            View All <ChevronRight className="h-3 w-3" />
          </button>
        </div>
        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-3 rounded-lg border-b border-neutral-800/50 pb-2 last:border-0">
            <div className="h-2 w-2 rounded-full bg-emerald-400" />
            <span className="text-sm text-white">Payment received: Smith Family <span className="font-bold">$450.00</span></span>
            <span className="ml-auto text-xs text-neutral-500">2 min ago</span>
          </div>
          <div className="flex items-center gap-3 rounded-lg border-b border-neutral-800/50 pb-2 last:border-0">
            <div className="h-2 w-2 rounded-full bg-amber-400" />
            <span className="text-sm text-white">Invoice generated: Jones Family <span className="font-bold">$325.00</span></span>
            <span className="ml-auto text-xs text-neutral-500">15 min ago</span>
          </div>
          <div className="flex items-center gap-3 rounded-lg border-b border-neutral-800/50 pb-2 last:border-0">
            <div className="h-2 w-2 rounded-full bg-blue-400" />
            <span className="text-sm text-white">Valentina C. - Spring Meet entry suggested (AI matched)</span>
            <span className="ml-auto text-xs text-neutral-500">1 hour ago</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CommandCenter;