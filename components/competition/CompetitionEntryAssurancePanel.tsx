'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Mail, Phone, RefreshCw, ShieldCheck } from 'lucide-react';
import { authenticatedFetch } from '@/lib/client/authenticatedFetch';

type Row = Record<string, any>;

type Props = {
  competitionId: string;
  mode?: 'admin' | 'coach';
};

function personName(row: Row) {
  const person = row?.response?.athlete?.person || {};
  return [person.preferred_name || person.first_name, person.last_name].filter(Boolean).join(' ') || 'Athlete';
}

function statusTone(value: string) {
  if (['verified','cleared','going'].includes(value)) return 'ls1-status-success';
  if (['submitted','prepared','awaiting_response','manual_override'].includes(value)) return 'ls1-status-warning';
  if (['rejected','not_going','not_cleared'].includes(value)) return 'ls1-status-danger';
  return 'ls1-status-info';
}

export function CompetitionEntryAssurancePanel({ competitionId, mode = 'admin' }: Props) {
  const [data,setData] = useState<Row | null>(null);
  const [loading,setLoading] = useState(true);
  const [working,setWorking] = useState(false);
  const [error,setError] = useState('');
  const [message,setMessage] = useState('');

  const load = useCallback(async () => {
    if (!competitionId) return;
    setLoading(true); setError('');
    try {
      const response = await authenticatedFetch(`/api/admin-competition-assurance?competitionId=${encodeURIComponent(competitionId)}`, { cache: 'no-store' });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Unable to load entry assurance.');
      setData(json);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load entry assurance.'); }
    finally { setLoading(false); }
  }, [competitionId]);

  useEffect(() => { void load(); }, [load]);

  async function act(body: Row, success: string) {
    setWorking(true); setError(''); setMessage('');
    try {
      const response = await authenticatedFetch('/api/admin-competition-assurance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ competitionId, ...body }) });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Entry assurance action failed.');
      setMessage(success.replace('{created}', String(json.created ?? '')).replace('{delivered}', String(json.delivered ?? '')));
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Entry assurance action failed.'); }
    finally { setWorking(false); }
  }

  const rows = data?.rows || [];
  const critical = useMemo(() => rows.filter((row: Row) => row.issue?.severity === 'critical'), [rows]);
  const noResponse = useMemo(() => rows.filter((row: Row) => row.eligible && (!row.response || row.response.response_status === 'awaiting_response')), [rows]);

  if (loading && !data) return <section className="rounded-2xl border border-neutral-800 bg-[#0b0d0d] p-5 text-base text-neutral-400"><RefreshCw className="mr-2 inline h-4 w-4 animate-spin"/>Loading entry assurance…</section>;

  return <section className="overflow-hidden rounded-2xl border border-neutral-800 bg-[#0b0d0d]">
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-neutral-800 p-5">
      <div>
        <div className="flex items-center gap-2 text-lg font-black"><ShieldCheck className="h-5 w-5 text-emerald-300"/>Competition Commitment & Entry Assurance</div>
        <p className="mt-2 max-w-4xl text-base leading-7 text-neutral-300">Going is intent. Entered is preparation. Submitted is transmission. Verified is authoritative evidence. Only Verified can become Cleared.</p>
      </div>
      <button disabled={working} onClick={() => void act({ action: 'reconcile' }, 'Reconciled competition entry assurance. {created} new athlete record(s) created.')} className="rounded-xl border border-blue-500/35 bg-blue-500/10 px-4 py-2.5 text-sm font-black text-blue-100 disabled:opacity-50">Reconcile now</button>
    </div>

    {error && <div className="m-5 rounded-xl border border-red-500/35 bg-red-500/10 p-4 text-base text-red-100">{error}</div>}
    {message && <div className="m-5 rounded-xl border border-emerald-500/35 bg-emerald-500/10 p-4 text-base text-emerald-100">{message}</div>}

    <div className="grid grid-cols-2 gap-2 p-5 md:grid-cols-3 xl:grid-cols-6">
      {[
        ['Going', data?.metrics?.going || 0, 'Intent received'],
        ['Prepared', data?.metrics?.prepared || 0, 'Entry exists in LS1'],
        ['Submitted', data?.metrics?.submitted || 0, 'Transmission recorded'],
        ['Verified', data?.metrics?.verified || 0, 'Authoritative evidence'],
        ['Cleared', data?.metrics?.cleared || 0, 'Safe to communicate'],
        ['Critical', data?.metrics?.critical || 0, 'Must be resolved'],
      ].map(([label,value,detail]) => <div key={String(label)} className={`rounded-xl border p-4 ${label==='Critical'&&Number(value)>0?'border-red-500/40 bg-red-500/10':'border-neutral-800 bg-[#111313]'}`}><div className="text-2xl font-black">{value}</div><div className="mt-1 text-sm font-black">{label}</div><div className="mt-1 text-sm text-neutral-500">{detail}</div></div>)}
    </div>

    {critical.length > 0 && <div className="mx-5 mb-5 rounded-2xl border border-red-500/35 bg-red-500/8 p-5"><div className="flex items-center gap-2 text-lg font-black text-red-100"><AlertTriangle className="h-5 w-5"/>{critical.length} athlete{critical.length===1?'':'s'} not cleared</div><div className="mt-3 space-y-2">{critical.map((row: Row) => <div key={row.athleteId} className="rounded-xl border border-red-500/20 bg-black/20 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="text-base font-black">{personName(row)}</div><div className="mt-1 text-sm text-red-200/80">{row.issue?.message}</div></div><span className="ls1-status-danger">{row.issue?.code?.replaceAll('_',' ')}</span></div></div>)}</div></div>}

    <div className="grid gap-5 p-5 pt-0 2xl:grid-cols-[1.2fr_.8fr]">
      <div className="overflow-hidden rounded-2xl border border-neutral-800">
        <div className="border-b border-neutral-800 p-4"><div className="text-lg font-black">Athlete reconciliation</div><div className="mt-1 text-sm text-neutral-400">No green clearance without evidence.</div></div>
        {rows.length ? <div className="divide-y divide-neutral-800">{rows.map((row: Row) => {
          const person = row.response?.athlete?.person || {};
          const entryState = row.assurance?.entry_state || (row.hasPreparedEntries ? 'prepared' : 'not_prepared');
          const clearance = row.assurance?.clearance_state || 'not_cleared';
          return <div key={row.athleteId} className="p-4"><div className="flex flex-wrap items-start gap-3"><div className="min-w-[240px] flex-1"><div className="text-base font-black">{personName(row)}</div><div className="mt-1 flex flex-wrap gap-3 text-sm text-neutral-500">{person.email&&<span className="inline-flex items-center gap-1"><Mail className="h-3.5 w-3.5"/>{person.email}</span>}{person.phone&&<span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5"/>{person.phone}</span>}</div></div><span className={statusTone(row.response?.response_status || 'awaiting_response')}>{String(row.response?.response_status || 'awaiting_response').replaceAll('_',' ')}</span><span className={statusTone(entryState)}>{entryState.replaceAll('_',' ')}</span><span className={statusTone(clearance)}>{clearance.replaceAll('_',' ')}</span></div><div className="mt-2 text-sm text-neutral-500">{row.eventEntryCount || 0} prepared event entr{row.eventEntryCount===1?'y':'ies'} detected.</div></div>;
        })}</div> : <div className="p-5 text-base text-neutral-400">No eligible/response/entry records are available yet.</div>}
      </div>

      <div className="rounded-2xl border border-neutral-800 p-4">
        <div className="text-lg font-black">Nonresponse follow-up</div>
        <div className="mt-1 text-sm leading-6 text-neutral-400">{noResponse.length} eligible athlete{noResponse.length===1?'':'s'} still need a response.</div>
        <button disabled={working || noResponse.length===0} onClick={() => void act({ action: 'remind-nonresponders' }, '{delivered} in-app reminder(s) accepted. External email/SMS/phone remain unconnected and are not reported as sent.')} className="mt-4 w-full rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm font-black text-amber-100 disabled:opacity-40">Follow up with nonresponders</button>
        <div className="mt-4 rounded-xl border border-neutral-800 bg-black/20 p-4 text-sm leading-6 text-neutral-400"><b className="text-white">Communication rule:</b> sent ≠ delivered ≠ read ≠ Going ≠ Entered ≠ Verified. LS1 stores those states separately.</div>
        {mode==='coach' && <div className="mt-3 rounded-xl border border-blue-500/25 bg-blue-500/5 p-4 text-sm text-blue-100">Coach mode uses the same assurance record and evidence chain; it does not create a second truth.</div>}
      </div>
    </div>

    {critical.length===0 && rows.length>0 && <div className="mx-5 mb-5 flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4 text-base text-emerald-100"><CheckCircle2 className="h-5 w-5"/>No critical commitment/entry mismatch is currently detected.</div>}
  </section>;
}

export default CompetitionEntryAssurancePanel;
