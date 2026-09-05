'use client';

import { useState } from 'react';
import { renderIconSync } from '@/lib/icons';

interface Certification {
  id: string;
  name: string;
  coach: string;
  issued: string;
  expires: string;
  status: string;
}

export function Compliance() {
  const [certs] = useState<Certification[]>([
    { id: 'CERT-001', name: 'SafeSport', coach: 'Sarah Johnson', issued: '2025-01-15', expires: '2026-01-15', status: 'ACTIVE' },
    { id: 'CERT-002', name: 'Lifeguard Certification', coach: 'Mike Wilson', issued: '2024-06-10', expires: '2025-06-10', status: 'EXPIRING' },
    { id: 'CERT-003', name: 'CPR/AED', coach: 'Lisa Brown', issued: '2025-03-20', expires: '2026-03-20', status: 'ACTIVE' },
  ]);

  const ShieldIcon = renderIconSync('shield');
  const CheckCircle2Icon = renderIconSync('check-circle-2');
  const AlertTriangleIcon = renderIconSync('alert-triangle');
  const SearchIcon = renderIconSync('search');
  const PlusIcon = renderIconSync('plus');

  return (
    <div className="p-6 text-white">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="text-[9px] font-black uppercase tracking-[0.24em] text-[#FA4616]">🛡️ Compliance</div>
          <h1 className="mt-1 text-2xl font-black text-white">Compliance & Safety</h1>
          <p className="text-sm text-neutral-400">Track certifications, background checks, and safety</p>
        </div>
        <button className="flex items-center gap-2 rounded-xl bg-[#FA4616] px-4 py-2 text-sm font-bold text-black hover:bg-[#FA4616]/90 transition-colors">
          {PlusIcon}
          Add Certification
        </button>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-neutral-800 bg-[#090b0b] p-4">
          <div className="flex items-center gap-2 text-neutral-500 text-xs">{CheckCircle2Icon} Active Certs</div>
          <div className="text-2xl font-black text-white">18</div>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-[#090b0b] p-4">
          <div className="flex items-center gap-2 text-neutral-500 text-xs">{AlertTriangleIcon} Expiring Soon</div>
          <div className="text-2xl font-black text-white">3</div>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-[#090b0b] p-4">
          <div className="flex items-center gap-2 text-neutral-500 text-xs">{ShieldIcon} Background Checks</div>
          <div className="text-2xl font-black text-white">24</div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-neutral-800 bg-[#090b0b]">
        <div className="flex items-center justify-between border-b border-neutral-800 p-4">
          <div className="relative flex-1 max-w-sm">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">{SearchIcon}</span>
            <input type="text" placeholder="Search certifications..." className="w-full rounded-lg border border-neutral-800 bg-black py-2 pl-10 pr-4 text-sm text-white placeholder:text-neutral-500 focus:border-[#FA4616] focus:outline-none" />
          </div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-800 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              <th className="px-4 py-3">Certification</th>
              <th className="px-4 py-3">Coach</th>
              <th className="px-4 py-3">Issued</th>
              <th className="px-4 py-3">Expires</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {certs.map((cert) => (
              <tr key={cert.id} className="border-b border-neutral-800/50 hover:bg-neutral-800/30 transition-colors">
                <td className="px-4 py-3 font-medium text-white">{cert.name}</td>
                <td className="px-4 py-3 text-neutral-400">{cert.coach}</td>
                <td className="px-4 py-3 text-neutral-400">{new Date(cert.issued).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-neutral-400">{new Date(cert.expires).toLocaleDateString()}</td>
                <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${cert.status === 'ACTIVE' ? 'bg-emerald-400/10 text-emerald-400' : 'bg-amber-400/10 text-amber-400'}`}>{cert.status}</span></td>
                <td className="px-4 py-3 text-right">
                  <button className="rounded-lg px-3 py-1 text-xs font-bold text-[#FA4616] hover:bg-[#FA4616]/10 transition-colors">Review</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Compliance;
