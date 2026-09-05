'use client';

import { useState } from 'react';
import { renderIconSync } from '@/lib/icons';

interface Organization {
  id: string;
  name: string;
  type: string;
  location: string;
  status: string;
}

export function OrganizationArchitecture() {
  const [orgs] = useState<Organization[]>([
    { id: 'ORG-001', name: 'Halifax Aquatics Club', type: 'Club', location: 'Halifax, NS', status: 'ACTIVE' },
    { id: 'ORG-002', name: 'HPAC Senior Squad', type: 'Squad', location: 'Halifax, NS', status: 'ACTIVE' },
    { id: 'ORG-003', name: 'HPAC Junior Squad', type: 'Squad', location: 'Halifax, NS', status: 'ACTIVE' },
  ]);

  const Building2Icon = renderIconSync('building2');
  const UsersIcon = renderIconSync('users');
  const MapPinIcon = renderIconSync('map-pin');
  const PlusIcon = renderIconSync('plus');
  const SearchIcon = renderIconSync('search');

  return (
    <div className="p-6 text-white">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="text-[9px] font-black uppercase tracking-[0.24em] text-[#FA4616]">🏢 Organization</div>
          <h1 className="mt-1 text-2xl font-black text-white">Organization Architecture</h1>
          <p className="text-sm text-neutral-400">Manage corporate hierarchy and structure</p>
        </div>
        <button className="flex items-center gap-2 rounded-xl bg-[#FA4616] px-4 py-2 text-sm font-bold text-black hover:bg-[#FA4616]/90 transition-colors">
          {PlusIcon}
          Add Organization
        </button>
      </div>

      <div className="mb-6">
        <div className="relative flex-1 max-w-sm">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">{SearchIcon}</span>
          <input type="text" placeholder="Search organizations..." className="w-full rounded-xl border border-neutral-800 bg-[#090b0b] py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-neutral-500 focus:border-[#FA4616] focus:outline-none" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {orgs.map((org) => (
          <div key={org.id} className="rounded-2xl border border-neutral-800 bg-[#090b0b] p-6 hover:border-neutral-600 transition-colors">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-[#FA4616]/10 p-2.5 text-[#FA4616]">{Building2Icon}</div>
                <div>
                  <div className="font-bold text-white">{org.name}</div>
                  <div className="flex items-center gap-1 text-xs text-neutral-500">{MapPinIcon} {org.location}</div>
                </div>
              </div>
              <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${org.status === 'ACTIVE' ? 'bg-emerald-400/10 text-emerald-400' : 'bg-amber-400/10 text-amber-400'}`}>
                {org.status}
              </span>
            </div>
            <div className="mt-3 flex items-center gap-1 text-xs text-neutral-500">{UsersIcon} {org.type}</div>
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

export default OrganizationArchitecture;
