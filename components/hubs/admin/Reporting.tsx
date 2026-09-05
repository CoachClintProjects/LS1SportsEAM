'use client';

import { useState } from 'react';
import { renderIconSync } from '@/lib/icons';

interface Report {
  id: string;
  name: string;
  type: string;
  generated: string;
  status: string;
}

export function Reporting() {
  const [reports] = useState<Report[]>([
    { id: 'RPT-001', name: 'Monthly Athlete Report', type: 'Athlete', generated: '2026-09-01', status: 'READY' },
    { id: 'RPT-002', name: 'Financial Summary Q3', type: 'Finance', generated: '2026-08-30', status: 'READY' },
    { id: 'RPT-003', name: 'Registration Analytics', type: 'Registration', generated: '2026-08-28', status: 'PROCESSING' },
  ]);

  const BarChart3Icon = renderIconSync('bar-chart-3');
  const DownloadIcon = renderIconSync('download');
  const PlusIcon = renderIconSync('plus');
  const ClockIcon = renderIconSync('clock');
  const CheckCircle2Icon = renderIconSync('check-circle-2');

  return (
    <div className="p-6 text-white">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="text-[9px] font-black uppercase tracking-[0.24em] text-[#FA4616]">📊 Reporting</div>
          <h1 className="mt-1 text-2xl font-black text-white">Reports & Analytics</h1>
          <p className="text-sm text-neutral-400">Generate and export reports</p>
        </div>
        <button className="flex items-center gap-2 rounded-xl bg-[#FA4616] px-4 py-2 text-sm font-bold text-black hover:bg-[#FA4616]/90 transition-colors">
          {PlusIcon}
          New Report
        </button>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-neutral-800 bg-[#090b0b] p-4">
          <div className="flex items-center gap-2 text-neutral-500 text-xs">{BarChart3Icon} Available Reports</div>
          <div className="text-2xl font-black text-white">12</div>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-[#090b0b] p-4">
          <div className="flex items-center gap-2 text-neutral-500 text-xs">{CheckCircle2Icon} Ready</div>
          <div className="text-2xl font-black text-white">8</div>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-[#090b0b] p-4">
          <div className="flex items-center gap-2 text-neutral-500 text-xs">{ClockIcon} Processing</div>
          <div className="text-2xl font-black text-white">4</div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-neutral-800 bg-[#090b0b]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-800 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              <th className="px-4 py-3">Report</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Generated</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((rpt) => (
              <tr key={rpt.id} className="border-b border-neutral-800/50 hover:bg-neutral-800/30 transition-colors">
                <td className="px-4 py-3 font-medium text-white">{rpt.name}</td>
                <td className="px-4 py-3 text-neutral-400">{rpt.type}</td>
                <td className="px-4 py-3 text-neutral-400">{new Date(rpt.generated).toLocaleDateString()}</td>
                <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${rpt.status === 'READY' ? 'bg-emerald-400/10 text-emerald-400' : 'bg-amber-400/10 text-amber-400'}`}>{rpt.status}</span></td>
                <td className="px-4 py-3 text-right">
                  <button className="mr-2 rounded-lg px-3 py-1 text-xs font-bold text-[#FA4616] hover:bg-[#FA4616]/10 transition-colors">View</button>
                  <button className="rounded-lg px-3 py-1 text-xs font-bold text-neutral-400 hover:bg-neutral-800 hover:text-white transition-colors">{DownloadIcon}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Reporting;
