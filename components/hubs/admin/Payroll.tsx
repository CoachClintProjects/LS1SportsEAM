'use client';

import { useState } from 'react';
import { renderIconSync } from '@/lib/icons';

interface Employee {
  id: string;
  name: string;
  role: string;
  hours: number;
  rate: number;
  total: number;
  status: string;
}

export function Payroll() {
  const [employees] = useState<Employee[]>([
    { id: 'EMP-001', name: 'Sarah Johnson', role: 'Head Coach', hours: 40, rate: 45.00, total: 1800.00, status: 'PAID' },
    { id: 'EMP-002', name: 'Mike Wilson', role: 'Assistant Coach', hours: 35, rate: 30.00, total: 1050.00, status: 'PENDING' },
    { id: 'EMP-003', name: 'Lisa Brown', role: 'Official', hours: 20, rate: 25.00, total: 500.00, status: 'PAID' },
  ]);

  const PlusIcon = renderIconSync('plus');
  const SearchIcon = renderIconSync('search');
  const DownloadIcon = renderIconSync('download');
  const BriefcaseIcon = renderIconSync('briefcase');
  const UsersIcon = renderIconSync('users');
  const CalendarIcon = renderIconSync('calendar-days');

  return (
    <div className="p-6 text-white">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="text-[9px] font-black uppercase tracking-[0.24em] text-[#FA4616]">💰 Payroll</div>
          <h1 className="mt-1 text-2xl font-black text-white">Payroll Management</h1>
          <p className="text-sm text-neutral-400">Manage staff payments and coaching stipends</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 rounded-xl border border-neutral-800 px-4 py-2 text-sm text-neutral-400 hover:border-neutral-600 hover:text-white transition-colors">
            {DownloadIcon}
            Export
          </button>
          <button className="flex items-center gap-2 rounded-xl bg-[#FA4616] px-4 py-2 text-sm font-bold text-black hover:bg-[#FA4616]/90 transition-colors">
            {PlusIcon}
            Add Payroll
          </button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-neutral-800 bg-[#090b0b] p-4">
          <div className="flex items-center gap-2 text-neutral-500 text-xs">{UsersIcon} Total Staff</div>
          <div className="text-2xl font-black text-white">24</div>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-[#090b0b] p-4">
          <div className="flex items-center gap-2 text-neutral-500 text-xs">{CalendarIcon} This Month</div>
          <div className="text-2xl font-black text-white">$8,450</div>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-[#090b0b] p-4">
          <div className="flex items-center gap-2 text-neutral-500 text-xs">{BriefcaseIcon} Pending</div>
          <div className="text-2xl font-black text-white">$1,050</div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-neutral-800 bg-[#090b0b]">
        <div className="flex items-center justify-between border-b border-neutral-800 p-4">
          <div className="relative flex-1 max-w-sm">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">{SearchIcon}</span>
            <input type="text" placeholder="Search staff..." className="w-full rounded-lg border border-neutral-800 bg-black py-2 pl-10 pr-4 text-sm text-white placeholder:text-neutral-500 focus:border-[#FA4616] focus:outline-none" />
          </div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-800 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Hours</th>
              <th className="px-4 py-3">Rate</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => (
              <tr key={emp.id} className="border-b border-neutral-800/50 hover:bg-neutral-800/30 transition-colors">
                <td className="px-4 py-3 font-medium text-white">{emp.name}</td>
                <td className="px-4 py-3 text-neutral-400">{emp.role}</td>
                <td className="px-4 py-3 text-neutral-400">{emp.hours}</td>
                <td className="px-4 py-3 text-neutral-400">${emp.rate.toFixed(2)}</td>
                <td className="px-4 py-3 font-bold text-white">${emp.total.toFixed(2)}</td>
                <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${emp.status === 'PAID' ? 'bg-emerald-400/10 text-emerald-400' : 'bg-amber-400/10 text-amber-400'}`}>{emp.status}</span></td>
                <td className="px-4 py-3 text-right">
                  <button className="rounded-lg px-3 py-1 text-xs font-bold text-[#FA4616] hover:bg-[#FA4616]/10 transition-colors">View</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Payroll;
