'use client';

import { useState } from 'react';
import { renderIconSync } from '@/lib/icons';

interface Facility {
  id: string;
  name: string;
  location: string;
  capacity: number;
  status: string;
  bookings: number;
}

export function Facilities() {
  const [facilities, setFacilities] = useState<Facility[]>([
    { id: 'FAC-001', name: 'Competition Pool', location: 'Main Campus', capacity: 2500, status: 'OPERATIONAL', bookings: 12 },
    { id: 'FAC-002', name: 'Training Pool', location: 'East Wing', capacity: 500, status: 'OPERATIONAL', bookings: 8 },
    { id: 'FAC-003', name: 'Diving Pool', location: 'West Wing', capacity: 300, status: 'MAINTENANCE', bookings: 3 },
  ]);

  const PlusIcon = renderIconSync('plus');
  const SearchIcon = renderIconSync('search');
  const BuildingIcon = renderIconSync('building');
  const MapPinIcon = renderIconSync('map-pin');
  const UsersIcon = renderIconSync('users');
  const CalendarIcon = renderIconSync('calendar-days');

  return (
    <div className="p-6 text-white">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="text-[9px] font-black uppercase tracking-[0.24em] text-[#FA4616]">🏟️ Facilities</div>
          <h1 className="mt-1 text-2xl font-black text-white">Facility Management</h1>
          <p className="text-sm text-neutral-400">Manage pool bookings and facility resources</p>
        </div>
        <button className="flex items-center gap-2 rounded-xl bg-[#FA4616] px-4 py-2 text-sm font-bold text-black hover:bg-[#FA4616]/90 transition-colors">
          {PlusIcon}
          Add Facility
        </button>
      </div>

      <div className="mb-6">
        <div className="relative flex-1 max-w-sm">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">{SearchIcon}</span>
          <input type="text" placeholder="Search facilities..." className="w-full rounded-xl border border-neutral-800 bg-[#090b0b] py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-neutral-500 focus:border-[#FA4616] focus:outline-none" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {facilities.map((fac) => (
          <div key={fac.id} className="rounded-2xl border border-neutral-800 bg-[#090b0b] p-6 hover:border-neutral-600 transition-colors">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-[#FA4616]/10 p-2.5 text-[#FA4616]">{BuildingIcon}</div>
                <div>
                  <div className="font-bold text-white">{fac.name}</div>
                  <div className="flex items-center gap-1 text-xs text-neutral-500">{MapPinIcon} {fac.location}</div>
                </div>
              </div>
              <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${fac.status === 'OPERATIONAL' ? 'bg-emerald-400/10 text-emerald-400' : 'bg-amber-400/10 text-amber-400'}`}>
                {fac.status}
              </span>
            </div>
            <div className="mt-4 flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1 text-neutral-400">{UsersIcon} {fac.capacity} capacity</div>
              <div className="flex items-center gap-1 text-neutral-400">{CalendarIcon} {fac.bookings} bookings</div>
            </div>
            <div className="mt-4 flex gap-2">
              <button className="flex-1 rounded-lg border border-neutral-800 px-3 py-1.5 text-xs text-white hover:border-neutral-600 transition-colors">View</button>
              <button className="flex-1 rounded-lg bg-[#FA4616] px-3 py-1.5 text-xs font-bold text-black hover:bg-[#FA4616]/90 transition-colors">Book</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Facilities;
