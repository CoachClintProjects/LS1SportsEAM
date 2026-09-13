'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, RefreshCw, Route } from 'lucide-react';
import { authenticatedFetch } from '@/lib/client/authenticatedFetch';

type Row = Record<string, any>;
type Payload = { plans: Row[]; participants: Row[]; generated_at?: string; error?: string };
const empty: Payload = { plans: [], participants: [] };
const when = (value: unknown) => value ? new Date(String(value)).toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

export function AdminURWSTravelWorkspace() {
  const [data, setData] = useState<Payload>(empty);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [participantId, setParticipantId] = useState('');
  const [reasonCode, setReasonCode] = useState('withdrawal');
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await authenticatedFetch('/api/admin-urws-travel', { cache: 'no-store' });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Unable to load travel exception context.');
      const next: Payload = { ...empty, ...json };
      setData(next);
      setSelectedPlanId(current => current && next.plans.some(p => p.id === current) ? current : (next.plans[0]?.id || ''));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load travel exception context.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  const selectedPlan = useMemo(() => data.plans.find(p => p.id === selectedPlanId) || null, [data.plans, selectedPlanId]);
  const participants = useMemo(() => data.participants.filter(p => p.travel_plan_id === selectedPlanId), [data.participants, selectedPlanId]);
  useEffect(() => { setParticipantId(current => current && participants.some(p => p.id === current) ? current : (participants[0]?.id || '')); }, [participants]);

  async function requestException() {
    if (!participantId || summary.trim().length < 8) {
      setError('Select a travel participant and provide a factual operational summary.');
      return;
    }
    setWorking(true);
    setError('');
    setNotice('');
    try {
      const response = await authenticatedFetch('/api/admin-urws-travel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request-exception', travel_participant_id: participantId, reason_code: reasonCode, summary: summary.trim() }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Travel exception request failed.');
      setNotice(json.case_id ? 'Travel exception routed into a canonical URWS case.' : 'Travel exception event recorded for URWS processing.');
      setSummary('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Travel exception request failed.');
    } finally {
      setWorking(false);
    }
  }

  return <main className="min-h-full bg-[#060707] p-5 text-white lg:p-7">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2 text-sm font-black uppercase tracking-[.16em] text-[#FA4616]"><Route className="h-5 w-5"/>URWS Travel</div><h1 className="mt-2 text-3xl font-black">Travel Commitment Exceptions</h1><p className="mt-2 max-w-4xl text-sm leading-6 text-neutral-300">Operational travel exceptions route into the shared URWS policy/evidence/authority workflow. This does not invent a financial commitment: money is recorded only when canonical cost evidence exists.</p></div><button onClick={()=>void load()} className="inline-flex items-center gap-2 rounded-xl border border-neutral-700 px-4 py-3 text-sm font-black"><RefreshCw className={`h-4 w-4 ${loading?'animate-spin':''}`}/>Refresh</button></div>
    {error&&<div className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-100">{error}</div>}{notice&&<div className="mt-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-100">{notice}</div>}
    <div className="mt-6 grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]"><aside className="overflow-hidden rounded-2xl border border-neutral-800 bg-[#0b0d0d]"><div className="border-b border-neutral-800 p-4"><div className="font-black">Travel plans</div><div className="mt-1 text-sm text-neutral-500">{data.plans.length} canonical plan{data.plans.length===1?'':'s'}</div></div>{data.plans.map(plan=><button key={plan.id} onClick={()=>setSelectedPlanId(plan.id)} className={`w-full border-b border-neutral-800 p-4 text-left hover:bg-neutral-900 ${selectedPlanId===plan.id?'bg-[#FA4616]/10':''}`}><div className="font-black">{plan.name}</div><div className="mt-1 text-xs text-neutral-500">{when(plan.starts_at)} · {String(plan.status||'unknown').replaceAll('_',' ')}</div></button>)}{!loading&&!data.plans.length&&<div className="p-6 text-sm text-neutral-500">No travel plans exist. LS1 will not invent one.</div>}</aside>
      {selectedPlan?<section className="space-y-5"><section className="rounded-2xl border border-neutral-800 bg-[#0b0d0d] p-5"><div className="text-xs font-black uppercase tracking-wide text-neutral-500">Selected travel plan</div><h2 className="mt-2 text-xl font-black">{selectedPlan.name}</h2><div className="mt-2 text-sm text-neutral-400">{[selectedPlan.destination_city,selectedPlan.destination_region,selectedPlan.destination_country].filter(Boolean).join(', ')||'Destination not recorded'} · {when(selectedPlan.starts_at)} → {when(selectedPlan.ends_at)}</div></section>
        <section className="rounded-2xl border border-neutral-800 bg-[#0b0d0d] p-5"><div className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-[#FA4616]"/><h3 className="text-lg font-black">Request an operational exception</h3></div><p className="mt-2 text-sm text-neutral-400">Use factual operational language only. Restricted medical or safeguarding detail belongs in its dedicated controlled workflow.</p><div className="mt-5 grid gap-4 lg:grid-cols-2"><label className="text-sm font-bold">Participant<select value={participantId} onChange={e=>setParticipantId(e.target.value)} className="mt-2 w-full rounded-xl border border-neutral-700 bg-black p-3"><option value="">Select participant</option>{participants.map(p=><option key={p.id} value={p.id}>{p.display_name||'Unnamed participant'} · {String(p.role_code||'participant').replaceAll('_',' ')}{p.guardian_required?' · guardian required':''}</option>)}</select></label><label className="text-sm font-bold">Reason<select value={reasonCode} onChange={e=>setReasonCode(e.target.value)} className="mt-2 w-full rounded-xl border border-neutral-700 bg-black p-3">{['withdrawal','schedule_conflict','guardian_issue','transport_issue','eligibility_issue','financial_question','other'].map(value=><option key={value} value={value}>{value.replaceAll('_',' ')}</option>)}</select></label><label className="text-sm font-bold lg:col-span-2">Factual operational summary<textarea value={summary} onChange={e=>setSummary(e.target.value)} placeholder="What changed and what operational review is needed?" className="mt-2 min-h-28 w-full rounded-xl border border-neutral-700 bg-black p-3"/></label></div><div className="mt-4 flex justify-end"><button disabled={working||!participantId||summary.trim().length<8} onClick={()=>void requestException()} className="rounded-xl bg-[#FA4616] px-5 py-3 text-sm font-black text-black disabled:opacity-40">Route through URWS</button></div></section>
        <section className="rounded-2xl border border-neutral-800 bg-[#0b0d0d] p-5"><h3 className="text-lg font-black">Participants</h3><div className="mt-4 grid gap-3 md:grid-cols-2">{participants.map(p=><div key={p.id} className="rounded-xl border border-neutral-800 p-4"><div className="font-black">{p.display_name||'Unnamed participant'}</div><div className="mt-1 text-sm text-neutral-500">{String(p.role_code||'participant').replaceAll('_',' ')} · {String(p.status||'unknown').replaceAll('_',' ')}</div>{p.guardian_required&&<div className="mt-2 text-xs font-black uppercase tracking-wide text-amber-300">Guardian required</div>}</div>)}{!participants.length&&<div className="text-sm text-neutral-500">No participants are recorded for this travel plan.</div>}</div></section>
      </section>:<section className="rounded-2xl border border-neutral-800 bg-[#0b0d0d] p-10 text-center text-neutral-500">Select a travel plan.</section>}</div>
  </main>;
}
export default AdminURWSTravelWorkspace;
