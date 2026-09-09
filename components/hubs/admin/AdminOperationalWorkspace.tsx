'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { authenticatedFetch } from '@/lib/client/authenticatedFetch';

type Row = Record<string, any>;
export type OperationalArea = 'organization' | 'facilities' | 'payroll' | 'compliance' | 'reporting';

type Snapshot = { records: Row[]; related: Row[]; options?: Record<string, Row[]>; canWrite?: boolean; canManageRequirements?: boolean };
const configs: Record<OperationalArea, { eyebrow: string; title: string; subtitle: string; empty: string; columns: Array<[string, string]>; relatedLabel?: string }> = {
  organization: { eyebrow: 'Organization', title: 'Organization Architecture', subtitle: 'Canonical organization hierarchy and operating entities', empty: 'No organization records are available for this tenant.', columns: [['name','Organization'],['organization_type','Type'],['code','Code'],['status','Status']], relatedLabel: 'Sites / legal entities' },
  facilities: { eyebrow: 'Facilities', title: 'Facility Management', subtitle: 'Facilities and booking activity from the live operations ledger', empty: 'No facilities have been configured yet.', columns: [['name','Facility'],['facility_type','Type'],['capacity','Capacity'],['timezone','Timezone'],['status','Status']], relatedLabel: 'Bookings' },
  payroll: { eyebrow: 'Payroll', title: 'Payroll Management', subtitle: 'Governed payroll runs and ledger totals from the workforce accounting model', empty: 'No payroll runs exist yet. No payroll values are being fabricated.', columns: [['period_start','Period start'],['period_end','Period end'],['pay_date','Pay date'],['gross_total','Gross'],['net_total','Net'],['status','Status']], relatedLabel: 'Payroll lines' },
  compliance: { eyebrow: 'Compliance', title: 'Compliance & Safety', subtitle: 'Requirements and background-check evidence from the canonical compliance model', empty: 'No compliance requirements are configured.', columns: [['name','Requirement'],['applies_to_role','Role'],['severity','Severity'],['validity_days','Validity days']], relatedLabel: 'Background checks' },
  reporting: { eyebrow: 'Reporting', title: 'Reports & Analytics', subtitle: 'Report definitions and execution history from the live reporting model', empty: 'No report definitions exist yet. No sample reports are being shown.', columns: [['name','Report'],['report_type','Type'],['sensitivity','Sensitivity'],['status','Status']], relatedLabel: 'Report runs' },
};

function displayValue(key: string, value: unknown) {
  if (value === null || value === undefined || value === '') return '—';
  if (key.includes('total') && !Number.isNaN(Number(value))) return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(Number(value));
  if (key.includes('date') || key.endsWith('_at') || key.endsWith('_on') || key.startsWith('period_')) {
    const date = new Date(String(value)); if (!Number.isNaN(date.getTime())) return date.toLocaleDateString();
  }
  return String(value).replaceAll('_', ' ');
}
function personName(row: Row) { return `${row.first_name || ''} ${row.last_name || ''}`.trim() || row.email || row.id; }

const inputClass = 'w-full rounded-lg border border-neutral-800 bg-black px-3 py-2 text-sm text-white outline-none focus:border-[#FA4616]';
const labelClass = 'text-[10px] font-bold uppercase tracking-wider text-neutral-500';

export function AdminOperationalWorkspace({ area }: { area: OperationalArea }) {
  const config = configs[area];
  const [snapshot, setSnapshot] = useState<Snapshot>({ records: [], related: [], options: {} });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState<Row>({});
  const [action, setAction] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await authenticatedFetch(`/api/admin-operational-snapshot?area=${encodeURIComponent(area)}`, { cache: 'no-store' });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error || 'Unable to load Admin operational data.');
      setSnapshot({ records: payload.records || [], related: payload.related || [], options: payload.options || {}, canWrite: Boolean(payload.canWrite), canManageRequirements: Boolean(payload.canManageRequirements) });
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to load Admin operational data.'); }
    finally { setLoading(false); }
  }, [area]);

  useEffect(() => { setAction(''); setForm({}); void load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase(); if (!q) return snapshot.records;
    return snapshot.records.filter((row) => Object.values(row).some((value) => String(value ?? '').toLowerCase().includes(q)));
  }, [snapshot.records, search]);

  const submit = async () => {
    if (!action) return;
    setSaving(true); setError(''); setSuccess('');
    try {
      const response = await authenticatedFetch('/api/admin-operational-snapshot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ area, action, ...form }) });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error || 'Admin action failed.');
      setSuccess(payload.summary ? `${payload.summary.report}: ${payload.summary.row_count} live rows processed.` : 'Saved. Audit evidence recorded.');
      setForm({}); await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Admin action failed.'); }
    finally { setSaving(false); }
  };

  const options = snapshot.options || {};
  const actionOptions: Array<[string,string]> = area === 'organization' ? [['create-organization','Add organization'],['create-site','Add site'],['create-legal-entity','Add legal entity']]
    : area === 'facilities' ? [['create-facility','Add facility'],['create-booking','Book facility']]
    : area === 'payroll' ? [['create-payroll-run','Create payroll run'],['add-payroll-line','Add payroll line'],['set-payroll-status','Advance payroll lifecycle']]
    : area === 'compliance' ? [...(snapshot.canManageRequirements ? [['create-compliance-requirement','Add platform requirement'] as [string,string]] : []),['create-background-check','Start background check'],['set-background-check-status','Complete / review background check']]
    : [['create-report-definition','Create report'],['run-report','Run report']];

  const field = (name: string, label: string, type = 'text', placeholder = '') => <label className="block"><span className={labelClass}>{label}</span><input type={type} value={form[name] ?? ''} placeholder={placeholder} onChange={(e)=>setForm((f)=>({ ...f, [name]: e.target.value }))} className={inputClass}/></label>;
  const select = (name: string, label: string, rows: Row[], getLabel: (row:Row)=>string) => <label className="block"><span className={labelClass}>{label}</span><select value={form[name] ?? ''} onChange={(e)=>setForm((f)=>({ ...f, [name]: e.target.value }))} className={inputClass}><option value="">Select…</option>{rows.map((row)=><option key={row.id} value={row.id}>{getLabel(row)}</option>)}</select></label>;
  const staticSelect = (name:string,label:string,values:string[]) => <label className="block"><span className={labelClass}>{label}</span><select value={form[name] ?? ''} onChange={(e)=>setForm((f)=>({ ...f, [name]:e.target.value }))} className={inputClass}><option value="">Select…</option>{values.map((v)=><option key={v} value={v}>{v.replaceAll('_',' ')}</option>)}</select></label>;

  const actionFields = () => {
    if (action === 'create-organization') return <>{field('code','Code')}{field('name','Name')}{field('legal_name','Legal name')}{field('organization_type','Type','text','club, association, program…')}{select('parent_organization_id','Parent organization',snapshot.records,(r)=>r.name)}</>;
    if (action === 'create-site') return <>{select('organization_id','Organization',snapshot.records,(r)=>r.name)}{field('code','Site code')}{field('name','Site name')}{field('city','City')}{field('region','Province / state')}{field('timezone','Timezone','text','America/Edmonton')}</>;
    if (action === 'create-legal-entity') return <>{select('organization_id','Organization',snapshot.records,(r)=>r.name)}{field('legal_name','Legal name')}{field('registration_number','Registration #')}{field('country_code','Country','text','CA')}{field('base_currency','Currency','text','CAD')}</>;
    if (action === 'create-facility') return <>{select('site_id','Site',options.sites || [],(r)=>r.name)}{field('code','Facility code')}{field('name','Facility name')}{field('facility_type','Facility type')}{field('capacity','Capacity','number')}{field('timezone','Timezone','text','America/Edmonton')}</>;
    if (action === 'create-booking') return <>{select('facility_id','Facility',snapshot.records,(r)=>r.name)}{select('team_id','Team (optional)',options.teams || [],(r)=>r.name)}{field('starts_at','Starts','datetime-local')}{field('ends_at','Ends','datetime-local')}</>;
    if (action === 'create-payroll-run') return <>{select('legal_entity_id','Legal entity',options.legalEntities || [],(r)=>r.legal_name)}{field('period_start','Period start','date')}{field('period_end','Period end','date')}{field('pay_date','Pay date','date')}</>;
    if (action === 'add-payroll-line') return <>{select('payroll_run_id','Payroll run',snapshot.records,(r)=>`${r.period_start} → ${r.period_end} · ${r.status}`)}{select('person_id','Staff / person',options.people || [],personName)}{field('earnings','Earnings','number')}{field('deductions','Deductions','number')}</>;
    if (action === 'set-payroll-status') return <>{select('id','Payroll run',snapshot.records,(r)=>`${r.period_start} → ${r.period_end} · ${r.status}`)}{staticSelect('status','New status',['approved','paid','draft'])}{field('reason','Reason')}</>;
    if (action === 'create-compliance-requirement') return <>{field('code','Requirement code')}{field('name','Requirement name')}{field('applies_to_role','Applies to role')}{staticSelect('severity','Severity',['required','warning','advisory'])}{field('validity_days','Validity days','number')}<label className="flex items-center gap-2 text-sm text-neutral-300"><input type="checkbox" checked={Boolean(form.applies_to_minor)} onChange={(e)=>setForm((f)=>({ ...f, applies_to_minor:e.target.checked }))}/>Applies to minors</label></>;
    if (action === 'create-background-check') return <>{select('person_id','Person',options.people || [],personName)}{field('check_type','Check type','text','vulnerable-sector, criminal-record…')}{field('provider','Provider')}{field('reference_number','Reference #')}{field('expires_on','Expires','date')}</>;
    if (action === 'set-background-check-status') return <>{select('id','Background check',snapshot.related,(r)=>`${r.check_type} · ${r.status} · ${r.person_id}`)}{staticSelect('status','Status',['clear','review','failed','expired','pending'])}{field('result_classification','Result classification')}{field('reason','Reason')}</>;
    if (action === 'create-report-definition') return <>{field('code','Report code')}{field('name','Report name')}{staticSelect('report_type','Data domain',['membership','finance','compliance','teams','facilities'])}{staticSelect('sensitivity','Sensitivity',['standard','internal','restricted'])}</>;
    if (action === 'run-report') return <>{select('report_id','Report',snapshot.records,(r)=>`${r.name} · ${r.report_type}`)}</>;
    return null;
  };

  return <div className="p-6 text-white">
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div><div className="text-[9px] font-black uppercase tracking-[0.24em] text-[#FA4616]">{config.eyebrow}</div><h1 className="mt-1 text-2xl font-black">{config.title}</h1><p className="text-sm text-neutral-400">{config.subtitle}</p></div>
      <button onClick={() => void load()} className="flex items-center gap-2 rounded-xl border border-neutral-800 px-4 py-2 text-sm text-neutral-300 hover:border-neutral-600"><RefreshCw className="h-4 w-4"/>Refresh</button>
    </div>

    <div className="mb-4 grid gap-3 sm:grid-cols-2">
      <div className="rounded-xl border border-neutral-800 bg-[#090b0b] p-4"><div className="text-xs text-neutral-500">Canonical records</div><div className="text-2xl font-black">{snapshot.records.length}</div></div>
      <div className="rounded-xl border border-neutral-800 bg-[#090b0b] p-4"><div className="text-xs text-neutral-500">{config.relatedLabel || 'Related records'}</div><div className="text-2xl font-black">{snapshot.related.length}</div></div>
    </div>

    {snapshot.canWrite && <div className="mb-5 rounded-2xl border border-neutral-800 bg-[#090b0b] p-4">
      <div className="mb-3 flex items-center gap-2"><Plus className="h-4 w-4 text-[#FA4616]"/><div className="text-sm font-bold">Operational action</div><span className="ml-auto flex items-center gap-1 text-[10px] text-neutral-500"><ShieldCheck className="h-3.5 w-3.5"/>RLS + audit controlled</span></div>
      <div className="mb-3"><select value={action} onChange={(e)=>{setAction(e.target.value);setForm({});setSuccess('');setError('')}} className={inputClass}><option value="">Choose an action…</option>{actionOptions.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></div>
      {action && <><div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{actionFields()}</div><button disabled={saving} onClick={()=>void submit()} className="mt-4 rounded-lg bg-[#FA4616] px-4 py-2 text-sm font-black text-black disabled:opacity-50">{saving?'Saving…':'Save & audit'}</button></>}
    </div>}

    {success && <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">{success}</div>}
    {error && <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>}

    <div className="mb-4 max-w-md relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500"/><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder={`Search ${config.eyebrow.toLowerCase()}...`} className="w-full rounded-xl border border-neutral-800 bg-[#090b0b] py-2.5 pl-10 pr-4 text-sm outline-none focus:border-[#FA4616]"/></div>
    <div className="overflow-x-auto rounded-2xl border border-neutral-800 bg-[#090b0b]"><table className="w-full text-sm"><thead><tr className="border-b border-neutral-800 text-left text-[10px] uppercase tracking-wider text-neutral-500">{config.columns.map(([,label])=><th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody>
      {loading ? <tr><td colSpan={config.columns.length} className="px-4 py-10 text-center text-neutral-500">Loading live records…</td></tr> : filtered.length === 0 ? <tr><td colSpan={config.columns.length} className="px-4 py-10 text-center text-neutral-500">{search ? 'No records match this search.' : config.empty}</td></tr> : filtered.map((row)=><tr key={row.id} className="border-b border-neutral-800/50">{config.columns.map(([key])=><td key={key} className={key==='name' ? 'px-4 py-3 font-medium text-white' : 'px-4 py-3 text-neutral-400'}>{displayValue(key,row[key])}</td>)}</tr>)}
    </tbody></table></div>
    <p className="mt-3 text-xs text-neutral-600">Live tenant-scoped data only. Mutations use the signed-in Admin identity, database RLS and privileged audit events.</p>
  </div>;
}