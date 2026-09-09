'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search } from 'lucide-react';
import { authenticatedFetch } from '@/lib/client/authenticatedFetch';

type Row = Record<string, any>;
export type OperationalArea = 'organization' | 'facilities' | 'payroll' | 'compliance' | 'reporting';

const configs: Record<OperationalArea, { eyebrow: string; title: string; subtitle: string; empty: string; columns: Array<[string, string]>; relatedLabel?: string }> = {
  organization: { eyebrow: 'Organization', title: 'Organization Architecture', subtitle: 'Canonical organization hierarchy and operating entities', empty: 'No organization records are available for this tenant.', columns: [['name','Organization'],['organization_type','Type'],['code','Code'],['status','Status']] },
  facilities: { eyebrow: 'Facilities', title: 'Facility Management', subtitle: 'Facilities and booking activity from the live operations ledger', empty: 'No facilities have been configured yet.', columns: [['name','Facility'],['facility_type','Type'],['capacity','Capacity'],['timezone','Timezone'],['status','Status']], relatedLabel: 'Bookings' },
  payroll: { eyebrow: 'Payroll', title: 'Payroll Management', subtitle: 'Payroll runs and ledger totals from the live workforce accounting model', empty: 'No payroll runs exist yet. No payroll values are being fabricated.', columns: [['period_start','Period start'],['period_end','Period end'],['pay_date','Pay date'],['gross_total','Gross'],['net_total','Net'],['status','Status']], relatedLabel: 'Payroll lines' },
  compliance: { eyebrow: 'Compliance', title: 'Compliance & Safety', subtitle: 'Requirements and background-check evidence from the canonical compliance model', empty: 'No compliance requirements are configured.', columns: [['name','Requirement'],['applies_to_role','Role'],['severity','Severity'],['validity_days','Validity days']], relatedLabel: 'Background checks' },
  reporting: { eyebrow: 'Reporting', title: 'Reports & Analytics', subtitle: 'Report definitions and execution history from the live reporting model', empty: 'No report definitions exist yet. No sample reports are being shown.', columns: [['name','Report'],['report_type','Type'],['sensitivity','Sensitivity'],['status','Status']], relatedLabel: 'Report runs' },
};

function displayValue(key: string, value: unknown) {
  if (value === null || value === undefined || value === '') return '—';
  if (key.includes('total') && !Number.isNaN(Number(value))) return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(Number(value));
  if (key.includes('date') || key.endsWith('_at') || key.endsWith('_on') || key.startsWith('period_')) {
    const date = new Date(String(value));
    if (!Number.isNaN(date.getTime())) return date.toLocaleDateString();
  }
  return String(value).replaceAll('_', ' ');
}

export function AdminOperationalWorkspace({ area }: { area: OperationalArea }) {
  const config = configs[area];
  const [records, setRecords] = useState<Row[]>([]);
  const [related, setRelated] = useState<Row[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await authenticatedFetch(`/api/admin-operational-snapshot?area=${encodeURIComponent(area)}`, { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Unable to load Admin operational data.');
      setRecords(payload.records || []); setRelated(payload.related || []);
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to load Admin operational data.'); }
    finally { setLoading(false); }
  }, [area]);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return records;
    return records.filter((row) => Object.values(row).some((value) => String(value ?? '').toLowerCase().includes(q)));
  }, [records, search]);

  return <div className="p-6 text-white">
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div><div className="text-[9px] font-black uppercase tracking-[0.24em] text-[#FA4616]">{config.eyebrow}</div><h1 className="mt-1 text-2xl font-black">{config.title}</h1><p className="text-sm text-neutral-400">{config.subtitle}</p></div>
      <button onClick={() => void load()} className="flex items-center gap-2 rounded-xl border border-neutral-800 px-4 py-2 text-sm text-neutral-300 hover:border-neutral-600"><RefreshCw className="h-4 w-4"/>Refresh</button>
    </div>
    <div className="mb-4 grid gap-3 sm:grid-cols-2">
      <div className="rounded-xl border border-neutral-800 bg-[#090b0b] p-4"><div className="text-xs text-neutral-500">Canonical records</div><div className="text-2xl font-black">{records.length}</div></div>
      <div className="rounded-xl border border-neutral-800 bg-[#090b0b] p-4"><div className="text-xs text-neutral-500">{config.relatedLabel || 'Related records'}</div><div className="text-2xl font-black">{related.length}</div></div>
    </div>
    <div className="mb-4 max-w-md relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500"/><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder={`Search ${config.eyebrow.toLowerCase()}...`} className="w-full rounded-xl border border-neutral-800 bg-[#090b0b] py-2.5 pl-10 pr-4 text-sm outline-none focus:border-[#FA4616]"/></div>
    {error ? <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</div> :
    <div className="overflow-x-auto rounded-2xl border border-neutral-800 bg-[#090b0b]"><table className="w-full text-sm"><thead><tr className="border-b border-neutral-800 text-left text-[10px] uppercase tracking-wider text-neutral-500">{config.columns.map(([,label])=><th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody>
      {loading ? <tr><td colSpan={config.columns.length} className="px-4 py-10 text-center text-neutral-500">Loading live records…</td></tr> : filtered.length === 0 ? <tr><td colSpan={config.columns.length} className="px-4 py-10 text-center text-neutral-500">{search ? 'No records match this search.' : config.empty}</td></tr> : filtered.map((row)=><tr key={row.id} className="border-b border-neutral-800/50">{config.columns.map(([key])=><td key={key} className={key==='name' ? 'px-4 py-3 font-medium text-white' : 'px-4 py-3 text-neutral-400'}>{displayValue(key,row[key])}</td>)}</tr>)}
    </tbody></table></div>}
    <p className="mt-3 text-xs text-neutral-600">Live tenant-scoped data only. Empty states are intentional; this workspace does not substitute demo records.</p>
  </div>;
}
