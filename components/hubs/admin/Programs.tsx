'use client';

// =============================================================================
// PROGRAMS - Team Manager Programs
// =============================================================================

import { useState } from 'react';
import { renderIconSync } from '@/lib/icons';

interface Program {
  id: string;
  name: string;
  description: string;
  athletes: number;
  coaches: number;
  status: string;
}

export function Programs() {
  const [programs] = useState<Program[]>([
    { id: 'PRG-001', name: 'Senior Elite', description: 'Competitive national-level training', athletes: 24, coaches: 3, status: 'ACTIVE' },
    { id: 'PRG-002', name: 'Junior Elite', description: 'Development for emerging athletes', athletes: 32, coaches: 4, status: 'ACTIVE' },
    { id: 'PRG-003', name: 'Age Group Development', description: 'Foundation for 13-14 year olds', athletes: 45, coaches: 5, status: 'ACTIVE' },
    { id: 'PRG-004', name: 'Learn to Swim', description: 'Introductory swimming program', athletes: 18, coaches: 2, status: 'PAUSED' },
  ]);

  const SearchIcon = renderIconSync('search');
  const PlusIcon = renderIconSync('plus');
  const LayersIcon = renderIconSync('layers');
  const UsersIcon = renderIconSync('users');
  const BriefcaseIcon = renderIconSync('briefcase');

  return (
    <div className="p-6 text-white">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="text-[9px] font-black uppercase tracking-[0.24em] text-[#FA4616]">📋 Programs</div>
          <h1 className="mt-1 text-2xl font-black text-white">Program Management</h1>
          <p className="text-sm text-neutral-400">Manage development tracks and program tiers</p>
        </div>
        <button className="flex items-center gap-2 rounded-xl bg-[#FA4616] px-4 py-2 text-sm font-bold text-black hover:bg-[#FA4616]/90 transition-colors">
          {PlusIcon}
          Add Program
        </button>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-neutral-800 bg-[#090b0b] p-4">
          <div className="flex items-center gap-2 text-neutral-500 text-xs">{LayersIcon} Active Programs</div>
          <div className="text-2xl font-black text-white">4</div>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-[#090b0b] p-4">
          <div className="flex items-center gap-2 text-neutral-500 text-xs">{UsersIcon} Total Athletes</div>
          <div className="text-2xl font-black text-white">119</div>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-[#090b0b] p-4">
          <div className="flex items-center gap-2 text-neutral-500 text-xs">{BriefcaseIcon} Coaches</div>
          <div className="text-2xl font-black text-white">14</div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {programs.map((p) => (
          <div key={p.id} className="rounded-2xl border border-neutral-800 bg-[#090b0b] p-6 hover:border-neutral-600 transition-colors">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-lg font-bold text-white">{p.name}</div>
                <div className="text-xs text-neutral-500">{p.description}</div>
              </div>
              <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${p.status === 'ACTIVE' ? 'bg-emerald-400/10 text-emerald-400' : 'bg-amber-400/10 text-amber-400'}`}>
                {p.status}
              </span>
            </div>
            <div className="mt-4 flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1 text-neutral-400">{UsersIcon} {p.athletes} athletes</div>
              <div className="flex items-center gap-1 text-neutral-400">{BriefcaseIcon} {p.coaches} coaches</div>
            </div>
            <div className="mt-4 flex gap-2">
              <button className="flex-1 rounded-lg border border-neutral-800 px-3 py-1.5 text-xs text-white hover:border-neutral-600 transition-colors">View</button>
              <button className="flex-1 rounded-lg bg-[#FA4616] px-3 py-1.5 text-xs font-bold text-black hover:bg-[#FA4616]/90 transition-colors">Edit</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Programs;
