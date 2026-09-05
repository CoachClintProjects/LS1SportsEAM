'use client';

// =============================================================================
// MEMBERSHIP - Team Manager Membership
// =============================================================================

import { useState } from 'react';
import { renderIconSync } from '@/lib/icons';

interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  joined: string;
}

export function Membership() {
  const [members] = useState<Member[]>([
    { id: 'MEM-001', name: 'Sarah Johnson', email: 'sarah.j@hpac.ca', role: 'Head Coach', status: 'ACTIVE', joined: '2024-01-15' },
    { id: 'MEM-002', name: 'Mike Wilson', email: 'mike.w@hpac.ca', role: 'Assistant Coach', status: 'ACTIVE', joined: '2024-03-10' },
    { id: 'MEM-003', name: 'Lisa Brown', email: 'lisa.b@hpac.ca', role: 'Official', status: 'PENDING', joined: '2024-06-20' },
    { id: 'MEM-004', name: 'David Lee', email: 'david.l@hpac.ca', role: 'Volunteer', status: 'ACTIVE', joined: '2024-02-05' },
  ]);

  const SearchIcon = renderIconSync('search');
  const PlusIcon = renderIconSync('plus');
  const UserCheckIcon = renderIconSync('user-check');
  const UsersIcon = renderIconSync('users');
  const MailIcon = renderIconSync('mail');

  return (
    <div className="p-6 text-white">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="text-[9px] font-black uppercase tracking-[0.24em] text-[#FA4616]">📁 Membership</div>
          <h1 className="mt-1 text-2xl font-black text-white">Membership Management</h1>
          <p className="text-sm text-neutral-400">Manage club members and their roles</p>
        </div>
        <button className="flex items-center gap-2 rounded-xl bg-[#FA4616] px-4 py-2 text-sm font-bold text-black hover:bg-[#FA4616]/90 transition-colors">
          {PlusIcon}
          Add Member
        </button>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-neutral-800 bg-[#090b0b] p-4">
          <div className="flex items-center gap-2 text-neutral-500 text-xs">{UsersIcon} Total Members</div>
          <div className="text-2xl font-black text-white">156</div>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-[#090b0b] p-4">
          <div className="flex items-center gap-2 text-neutral-500 text-xs">{UserCheckIcon} Active</div>
          <div className="text-2xl font-black text-white">142</div>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-[#090b0b] p-4">
          <div className="flex items-center gap-2 text-neutral-500 text-xs">{MailIcon} Pending</div>
          <div className="text-2xl font-black text-white">14</div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-neutral-800 bg-[#090b0b]">
        <div className="flex items-center justify-between border-b border-neutral-800 p-4">
          <div className="relative flex-1 max-w-sm">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">{SearchIcon}</span>
            <input type="text" placeholder="Search members..." className="w-full rounded-lg border border-neutral-800 bg-black py-2 pl-10 pr-4 text-sm text-white placeholder:text-neutral-500 focus:border-[#FA4616] focus:outline-none" />
          </div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-800 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-b border-neutral-800/50 hover:bg-neutral-800/30 transition-colors">
                <td className="px-4 py-3 font-medium text-white">{m.name}</td>
                <td className="px-4 py-3 text-neutral-400">{m.email}</td>
                <td className="px-4 py-3 text-neutral-400">{m.role}</td>
                <td className="px-4 py-3 text-neutral-400">{new Date(m.joined).toLocaleDateString()}</td>
                <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${m.status === 'ACTIVE' ? 'bg-emerald-400/10 text-emerald-400' : 'bg-amber-400/10 text-amber-400'}`}>{m.status}</span></td>
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

export default Membership;
