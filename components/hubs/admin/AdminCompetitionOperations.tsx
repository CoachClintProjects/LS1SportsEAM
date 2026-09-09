'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BellRing, CalendarDays, CheckCircle2, ChevronRight, MapPin, RefreshCw, ShipWheel, Trophy, Users, XCircle } from 'lucide-react';
import { authenticatedFetch } from '@/lib/client/authenticatedFetch';

type Row = Record<string, any>;

type Payload = {
  competitions: Row[];
  vendors: Row[];
  actor?: { canManageAttendance?: boolean; canManageLogistics?: boolean };
  generatedAt?: string;
  source?: string;
  error?: string;
};

function formatDate(value: unknown) {
  if (!value) return 'Date not set';
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
}
function personName(row: Row) {
  const person = row?.athlete?.person || {};
  return [person.preferred_name || person.first_name, person.last_name].filter(Boolean).join(' ') || 'Athlete';
}
function StatusPill({ value }: { value: string }) {
  const normalized = String(value || '').toLowerCase();
  const cls = ['going','confirmed','complete','required'].includes(normalized) ? 'ls1-status-success' : ['awaiting_response','unresolved','unknown','planned'].includes(normalized) ? 'ls1-status-warning' : ['not_going'].includes(normalized) ? 'ls1-status-danger' : 'ls1-status-info';
  return <span className={cls}>{String(value || 'unknown').replaceAll('_',' ')}</span>;
}
function MetricCard({ label, value, detail, tone }: { label: string; value: number; detail: string; tone: 'info'|'success'|'warning'|'danger' }) {
  const classes = { info: 'border-blue-500/35 bg-blue-500/10 text-blue-200', success: 'border-emerald-500/35 bg-emerald-500/10 text-emerald-200', warning: 'border-amber-500/35 bg-amber-500/10 text-amber-100', danger: 'border-red-500/35 bg-red-500/10 text-red-200' };
  return <div className={`rounded-2xl border p-5 ${classes[tone]}`}><div className="text-3xl font-black">{value}</div><div className="mt-1 text-sm font-black uppercase tracking-[.08em]">{label}</div><div className="mt-2 text-sm opacity-80">{detail}</div></div>;
}

export function AdminCompetitionOperations() {
  const [data,setData] = useState<Payload>({ competitions: [], vendors: [] });
  const [selectedId,setSelectedId] = useState<string>('');
  const [loading,setLoading] = useState(true);
  const [working,setWorking] = useState(false);
  const [message,setMessage] = useState('');
  const [error,setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await authenticatedFetch('/api/admin-competitions', { cache: 'no-store' });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Unable to load competition operations.');
      setData(json);
      setSelectedId(current => current && json.competitions.some((row: Row) => row.id === current) ? current : json.competitions[0]?.id || '');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load competition operations.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void load(); }, 15000); return () => window.clearInterval(timer); }, [load]);
  const selected = useMemo(() => data.competitions.find(row => row.id === selectedId) || data.competitions[0] || null, [data.competitions, selectedId]);

  async function act(body: Row, success: string) {
    if (!selected) return;
    setWorking(true); setMessage(''); setError('');
    try {
      const response = await authenticatedFetch('/api/admin-competitions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ competitionId: selected.id, ...body }) });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Action failed.');
      setMessage(success.replace('{delivered}', String(json.delivered ?? '')).replace('{created}', String(json.created ?? '')));
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Action failed.'); }
    finally { setWorking(false); }
  }

  return <main className="min-h-full bg-[#060707] p-5 text-white lg:p-7">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><div className="flex items-center gap-2 text-sm font-black uppercase tracking-[.16em] text-[#FA4616]"><Trophy className="h-5 w-5"/>Admin operations</div><h1 className="mt-2 text-3xl font-black">Competitions</h1><p className="mt-2 max-w-3xl text-base leading-7 text-neutral-300">A simple administrative bridge to the Competition Engine: who is eligible, who is going, who has not responded, and what event logistics are still unresolved.</p></div>
      <button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border border-neutral-700 px-4 py-3 text-sm font-black text-neutral-200 hover:bg-neutral-900"><RefreshCw className={`h-4 w-4 ${loading?'animate-spin':''}`}/>Refresh</button>
    </div>
    {error && <div className="mt-5 rounded-xl border border-red-500/35 bg-red-500/10 p-4 text-base text-red-100">{error}</div>}
    {message && <div className="mt-5 rounded-xl border border-emerald-500/35 bg-emerald-500/10 p-4 text-base text-emerald-100">{message}</div>}

    <div className="mt-6 grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="overflow-hidden rounded-2xl border border-neutral-800 bg-[#0b0d0d]">
        <div className="border-b border-neutral-800 px-4 py-4"><div className="text-base font-black">Upcoming competitions</div><div className="mt-1 text-sm text-neutral-400">{data.competitions.length} operational record{data.competitions.length===1?'':'s'}</div></div>
        <div className="divide-y divide-neutral-800">{data.competitions.map(row => <button key={row.id} type="button" onClick={() => setSelectedId(row.id)} className={`w-full p-4 text-left hover:bg-neutral-900 ${selected?.id===row.id?'bg-[#FA4616]/10':''}`}><div className="flex items-start gap-3"><CalendarDays className={`mt-0.5 h-5 w-5 shrink-0 ${selected?.id===row.id?'text-[#FA4616]':'text-neutral-500'}`}/><div className="min-w-0 flex-1"><div className="text-base font-black text-white">{row.name}</div><div className="mt-1 text-sm text-neutral-400">{formatDate(row.starts_at)}</div><div className="mt-2 flex items-center justify-between"><span className="text-sm text-neutral-500">{row.competition_type?.replaceAll('_',' ') || 'competition'}</span><ChevronRight className="h-4 w-4 text-neutral-600"/></div></div></div></button>)}{!loading && !data.competitions.length && <div className="p-6 text-base text-neutral-400">No upcoming competitions are in the operational calendar.</div>}</div>
      </aside>

      {selected && <section className="space-y-5">
        <div className="rounded-2xl border border-neutral-800 bg-[#0b0d0d] p-5 lg:p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="text-sm font-black uppercase tracking-[.12em] text-neutral-500">{selected.competition_type?.replaceAll('_',' ')}</div><h2 className="mt-1 text-2xl font-black">{selected.name}</h2><div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-base text-neutral-300"><span className="inline-flex items-center gap-2"><CalendarDays className="h-4 w-4"/>{formatDate(selected.starts_at)} – {formatDate(selected.ends_at)}</span>{(selected.city||selected.region)&&<span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4"/>{[selected.city,selected.region].filter(Boolean).join(', ')}</span>}</div></div><StatusPill value={selected.status}/></div></div>

        <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4"><MetricCard label="Eligible" value={selected.attendance?.eligible||0} detail="Authoritative eligibility evidence" tone="info"/><MetricCard label="Going" value={selected.attendance?.going||0} detail="Confirmed attendance" tone="success"/><MetricCard label="No response" value={selected.attendance?.awaiting||0} detail="Needs a simple response" tone="warning"/><MetricCard label="Not going" value={selected.attendance?.notGoing||0} detail="Declined attendance" tone="danger"/></div>

        <div className="grid gap-5 2xl:grid-cols-[1.1fr_.9fr]">
          <section className="overflow-hidden rounded-2xl border border-neutral-800 bg-[#0b0d0d]"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 px-5 py-4"><div><div className="text-lg font-black">Who is going?</div><div className="mt-1 text-sm text-neutral-400">Nothing more complicated than Going / Not Going / Awaiting response.</div></div>{data.actor?.canManageAttendance&&<div className="flex gap-2"><button disabled={working} onClick={() => void act({action:'sync-eligible'}, 'Eligibility synchronized. {created} response records created.')} className="rounded-lg border border-blue-500/35 bg-blue-500/10 px-3 py-2 text-sm font-black text-blue-100 disabled:opacity-50">Sync eligible</button><button disabled={working||!(selected.attendance?.awaiting>0)} onClick={() => void act({action:'send-reminders'}, '{delivered} in-app reminder(s) sent.')} className="inline-flex items-center gap-2 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-sm font-black text-amber-100 disabled:opacity-40"><BellRing className="h-4 w-4"/>Remind nonresponders</button></div>}</div>
            {selected.participation?.length ? <div className="divide-y divide-neutral-800">{selected.participation.map((row:Row)=><div key={row.id} className="flex flex-wrap items-center gap-3 px-5 py-4"><div className="min-w-[220px] flex-1"><div className="text-base font-black">{personName(row)}</div><div className="mt-1 text-sm text-neutral-500">{row.athlete?.person?.email || 'No email shown'}</div></div><StatusPill value={row.response_status}/>{data.actor?.canManageAttendance&&<div className="flex gap-2"><button disabled={working} onClick={()=>void act({action:'set-response',responseId:row.id,responseStatus:'going'},'Response updated.')} className="rounded-lg border border-emerald-500/30 px-3 py-2 text-sm font-bold text-emerald-200 hover:bg-emerald-500/10">Going</button><button disabled={working} onClick={()=>void act({action:'set-response',responseId:row.id,responseStatus:'not_going'},'Response updated.')} className="rounded-lg border border-red-500/30 px-3 py-2 text-sm font-bold text-red-200 hover:bg-red-500/10">Not going</button></div>}</div>)}</div> : <div className="p-6"><div className="text-base font-black">No attendance responses yet</div><p className="mt-2 text-base leading-7 text-neutral-400">Eligibility has not produced attendance-response records for this competition. LS1 will not invent athletes or qualification decisions.</p></div>}
          </section>

          <section className="overflow-hidden rounded-2xl border border-neutral-800 bg-[#0b0d0d]"><div className="border-b border-neutral-800 px-5 py-4"><div className="flex items-center gap-2 text-lg font-black"><ShipWheel className="h-5 w-5 text-cyan-300"/>Logistics</div><div className="mt-1 text-sm text-neutral-400">Unknown means we still need a decision. It does not mean the item is required.</div></div>
            {selected.logistics?.length ? <div className="divide-y divide-neutral-800">{selected.logistics.map((row:Row)=><div key={row.id} className="p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div className="text-base font-black">{row.label}</div><div className="flex gap-2"><StatusPill value={row.requirement_state}/><StatusPill value={row.fulfillment_status}/></div></div>{data.actor?.canManageLogistics&&<div className="mt-4 grid gap-3 sm:grid-cols-2"><label><span className="text-sm font-bold text-neutral-400">Requirement</span><select value={row.requirement_state} onChange={e=>void act({action:'update-logistics',requirementId:row.id,requirementState:e.target.value},'Logistics requirement updated.')} className="mt-1 w-full rounded-lg border border-neutral-700 bg-black px-3 py-2.5 text-base"><option value="unknown">Need decision</option><option value="required">Required</option><option value="not_required">Not required</option></select></label><label><span className="text-sm font-bold text-neutral-400">Fulfillment</span><select value={row.fulfillment_status} onChange={e=>void act({action:'update-logistics',requirementId:row.id,fulfillmentStatus:e.target.value},'Logistics status updated.')} className="mt-1 w-full rounded-lg border border-neutral-700 bg-black px-3 py-2.5 text-base"><option value="unresolved">Unresolved</option><option value="planned">Planned</option><option value="confirmed">Confirmed</option><option value="complete">Complete</option><option value="not_applicable">Not applicable</option></select></label></div>}{row.vendor?.name&&<div className="mt-3 text-sm text-neutral-300">Vendor: <b>{row.vendor.name}</b></div>}{row.notes&&<div className="mt-3 text-sm leading-6 text-neutral-500">{row.notes}</div>}</div>)}</div> : <div className="p-6 text-base text-neutral-400">No special logistics requirements are recorded for this competition.</div>}
          </section>
        </div>

        {(selected.deadlines?.length||selected.exceptions?.length) ? <div className="grid gap-5 lg:grid-cols-2"><section className="rounded-2xl border border-neutral-800 bg-[#0b0d0d] p-5"><div className="text-lg font-black">Deadlines</div><div className="mt-4 space-y-3">{selected.deadlines?.map((row:Row)=><div key={row.id} className="rounded-xl border border-neutral-800 p-4"><div className="flex items-center justify-between gap-3"><div className="text-base font-bold">{row.name}</div><StatusPill value={row.status}/></div><div className="mt-2 text-sm text-neutral-400">{formatDate(row.due_at)}</div></div>)}{!selected.deadlines?.length&&<div className="text-base text-neutral-400">No deadlines recorded.</div>}</div></section><section className="rounded-2xl border border-neutral-800 bg-[#0b0d0d] p-5"><div className="text-lg font-black">Exceptions</div><div className="mt-4 space-y-3">{selected.exceptions?.map((row:Row)=><div key={row.id} className="rounded-xl border border-red-500/25 bg-red-500/5 p-4"><div className="flex items-center gap-2 text-base font-black text-red-100"><AlertTriangle className="h-4 w-4"/>{row.problem}</div><div className="mt-2 text-sm text-red-200/70">{row.exception_code}</div></div>)}{!selected.exceptions?.length&&<div className="flex items-center gap-2 text-base text-emerald-200"><CheckCircle2 className="h-5 w-5"/>No open exceptions.</div>}</div></section></div> : null}
      </section>}
    </div>
    <div className="mt-5 text-sm text-neutral-600">{data.source}{data.generatedAt?` · refreshed ${new Date(data.generatedAt).toLocaleTimeString()}`:''}</div>
  </main>;
}

export default AdminCompetitionOperations;
