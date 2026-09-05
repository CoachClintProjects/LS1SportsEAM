'use client';

// =============================================================================
// SEASONS - Team Manager Seasons
// =============================================================================

import { useState } from 'react';
import { renderIconSync } from '@/lib/icons';

interface Season {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  programs: number;
  athletes: number;
  status: string;
}

export function Seasons() {
  const [seasons] = useState<Season[]>([
    { id: 'SZN-001', name: 'Fall 2026', start_date: '2026-09-01', end_date: '2026-12-15', programs: 4, athletes: 89, status: 'UPCOMING' },
    { id: 'SZN-002', name: 'Spring 2026', start_date: '2026-01-15', end_date: '2026-06-30', programs: 4, athletes: 119, status: 'COMPLETED' },
    { id: 'SZN-003', name: 'Summer 2026', start_date: '2026-07-01', end_date: '2026-08-31', programs: 3, athletes: 67, status: 'ACTIVE' },
  ]);

  const SearchIcon = renderIconSync('search');
  const PlusIcon = renderIconSync('plus');
  const CalendarIcon = renderIconSync('calendar-days');
  const UsersIcon = renderIconSync('users');
  const LayersIcon = renderIconSync('layers');

  return (
    <div className="p-6 text-white">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="text-[9px] font-black uppercase tracking-[0.24em] text-[#FA4616]">📅 Seasons</div>
          <h1 className="mt-1 text-2xl font-black text-white">Season Management</h1>
          <p className="text-sm text-neutral-400">Manage seasonal cycles and registration windows</p>
        </div>
        <button className="flex items-center gap-2 rounded-xl bg-[#FA4616] px-4 py-2 text-sm font-bold text-black hover:bg-[#FA4616]/90 transition-colors">
          {PlusIcon}
          Create Season
        </button>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-neutral-800 bg-[#090b0b] p-4">
          <div className="flex items-center gap-2 text-neutral-500 text-xs">{CalendarIcon} Total Seasons</div>
          <div className="text-2xl font-black text-white">3</div>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-[#090b0b] p-4">
          <div className="flex items-center gap-2 text-neutral-500 text-xs">{UsersIcon} Total Athletes</div>
          <div className="text-2xl font-black text-white">275</div>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-[#090b0b] p-4">
          <div className="flex items-center gap-2 text-neutral-500 text-xs">{LayersIcon} Active Programs</div>
          <div className="text-2xl font-black text-white">3</div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-neutral-800 bg-[#090b0b]">
        <div className="flex items-center justify-between border-b border-neutral-800 p-4">
          <div className="relative flex-1 max-w-sm">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">{SearchIcon}</span>
            <input type="text" placeholder="Search seasons..." className="w-full rounded-lg border border-neutral-800 bg-black py-2 pl-10 pr-4 text-sm text-white placeholder:text-neutral-500 focus:border-[#FA4616] focus:outline-none" />
          </div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-800 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              <th className="px-4 py-3">Season</th>
              <th className="px-4 py-3">Start</th>
              <th className="px-4 py-3">End</th>
              <th className="px-4 py-3">Programs</th>
              <th className="px-4 py-3">Athletes</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {seasons.map((s) => (
              <tr key={s.id} className="border-b border-neutral-800/50 hover:bg-neutral-800/30 transition-colors">
                <td className="px-4 py-3 font-medium text-white">{s.name}</td>
                <td className="px-4 py-3 text-neutral-400">{new Date(s.start_date).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-neutral-400">{new Date(s.end_date).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-neutral-400">{s.programs}</td>
                <td className="px-4 py-3 text-neutral-400">{s.athletes}</td>
                <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${s.status === 'ACTIVE' ? 'bg-emerald-400/10 text-emerald-400' : s.status === 'UPCOMING' ? 'bg-blue-400/10 text-blue-400' : 'bg-neutral-400/10 text-neutral-400'}`}>{s.status}</span></td>
                <td className="px-4 py-3 text-right">
                  <button className="mr-2 rounded-lg px-3 py-1 text-xs font-bold text-[#FA4616] hover:bg-[#FA4616]/10 transition-colors">View</button>
                  <button className="rounded-lg px-3 py-1 text-xs font-bold text-neutral-400 hover:bg-neutral-800 hover:text-white transition-colors">Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Seasons;
