'use client';

// =============================================================================
// TEAMS - Team Manager Teams
// =============================================================================

import { useState } from 'react';
import { renderIconSync } from '@/lib/icons';

interface Team {
  id: string;
  name: string;
  program: string;
  athletes: number;
  coach: string;
  status: string;
}

export function Teams() {
  const [teams] = useState<Team[]>([
    { id: 'TM-001', name: 'HPAC Senior Squad A', program: 'Senior Elite', athletes: 12, coach: 'Sarah Johnson', status: 'ACTIVE' },
    { id: 'TM-002', name: 'HPAC Senior Squad B', program: 'Senior Elite', athletes: 12, coach: 'Mike Wilson', status: 'ACTIVE' },
    { id: 'TM-003', name: 'Junior Elite Team 1', program: 'Junior Elite', athletes: 16, coach: 'Lisa Brown', status: 'ACTIVE' },
    { id: 'TM-004', name: 'Junior Elite Team 2', program: 'Junior Elite', athletes: 16, coach: 'David Lee', status: 'ACTIVE' },
  ]);

  const SearchIcon = renderIconSync('search');
  const PlusIcon = renderIconSync('plus');
  const UsersIcon = renderIconSync('users');
  const UserIcon = renderIconSync('user');
  const MedalIcon = renderIconSync('medal');

  return (
    <div className="p-6 text-white">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="text-[9px] font-black uppercase tracking-[0.24em] text-[#FA4616]">👥 Teams</div>
          <h1 className="mt-1 text-2xl font-black text-white">Team Management</h1>
          <p className="text-sm text-neutral-400">Manage squads and team assignments</p>
        </div>
        <button className="flex items-center gap-2 rounded-xl bg-[#FA4616] px-4 py-2 text-sm font-bold text-black hover:bg-[#FA4616]/90 transition-colors">
          {PlusIcon}
          Create Team
        </button>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-neutral-800 bg-[#090b0b] p-4">
          <div className="flex items-center gap-2 text-neutral-500 text-xs">{UsersIcon} Total Teams</div>
          <div className="text-2xl font-black text-white">8</div>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-[#090b0b] p-4">
          <div className="flex items-center gap-2 text-neutral-500 text-xs">{MedalIcon} Active Squads</div>
          <div className="text-2xl font-black text-white">6</div>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-[#090b0b] p-4">
          <div className="flex items-center gap-2 text-neutral-500 text-xs">{UserIcon} Total Athletes</div>
          <div className="text-2xl font-black text-white">56</div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-neutral-800 bg-[#090b0b]">
        <div className="flex items-center justify-between border-b border-neutral-800 p-4">
          <div className="relative flex-1 max-w-sm">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">{SearchIcon}</span>
            <input type="text" placeholder="Search teams..." className="w-full rounded-lg border border-neutral-800 bg-black py-2 pl-10 pr-4 text-sm text-white placeholder:text-neutral-500 focus:border-[#FA4616] focus:outline-none" />
          </div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-800 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              <th className="px-4 py-3">Team Name</th>
              <th className="px-4 py-3">Program</th>
              <th className="px-4 py-3">Athletes</th>
              <th className="px-4 py-3">Coach</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((t) => (
              <tr key={t.id} className="border-b border-neutral-800/50 hover:bg-neutral-800/30 transition-colors">
                <td className="px-4 py-3 font-medium text-white">{t.name}</td>
                <td className="px-4 py-3 text-neutral-400">{t.program}</td>
                <td className="px-4 py-3 text-neutral-400">{t.athletes}</td>
                <td className="px-4 py-3 text-neutral-400">{t.coach}</td>
                <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${t.status === 'ACTIVE' ? 'bg-emerald-400/10 text-emerald-400' : 'bg-amber-400/10 text-amber-400'}`}>{t.status}</span></td>
                <td className="px-4 py-3 text-right">
                  <button className="mr-2 rounded-lg px-3 py-1 text-xs font-bold text-[#FA4616] hover:bg-[#FA4616]/10 transition-colors">Roster</button>
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

export default Teams;
