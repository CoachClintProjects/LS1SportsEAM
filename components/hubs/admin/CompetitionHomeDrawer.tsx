'use client';

import { useState } from 'react';
import { authenticatedFetch } from '@/lib/client/authenticatedFetch';

type Row = Record<string, any>;
type Detail = 'overview' | 'awaiting' | 'unassessed' | 'blocked' | 'entries' | 'finance';

export function CompetitionHomeDrawer({ item, data, role, onClose, onChanged }: {
  item: Row; data: Row; role: string; onClose: () => void; onChanged: () => Promise<void>;
}) {
  const [detail, setDetail] = useState<Detail>('overview');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const competitionId = item.event_type === 'competition' ? item.id : item.competition_id;
  const competition = (data.controls?.competitions || []).find((r: Row) => r.id === competitionId);
  const readiness = (data.competitionReadiness || []).find((r: Row) => r.competition_id === competitionId);
  const deadlines = (data.controls?.deadlines || []).filter((r: Row) => r.competition_id === competitionId);
  const eventIds = new Set((data.controls?.competitionEvents || []).filter((r: Row) => r.competition_id === competitionId).map((r: Row) => r.id));
  const entries = (data.controls?.competitionEntries || []).filter((r: Row) => eventIds.has(r.competition_event_id));
  const responses = (data.participationResponses || []).filter((r: Row) => r.competition_id === competitionId);
  const eligibility = (data.eligibility || []).filter((r: Row) => r.competition_id === competitionId);
  const athletes = new Map<string, Row>((data.athletes || []).map((r: Row) => [r.id, r]));
  const people = new Map<string, Row>((data.athletePeople || []).map((r: Row) => [r.id, r]));
  const latestEligibility = new Map<string, Row>();
  for (const row of eligibility) if (!latestEligibility.has(row.athlete_id)) latestEligibility.set(row.athlete_id, row);
  const candidateIds = [...new Set<string>([
    ...responses.map((r: Row) => r.athlete_id), ...entries.map((r: Row) => r.athlete_id), ...latestEligibility.keys(),
  ].filter(Boolean))];
  const awaiting = responses.filter((r: Row) => !r.response_status || r.response_status === 'awaiting_response');
  const blocked = candidateIds.filter(id => {
    const decision = latestEligibility.get(id);
    return ['blocked', 'ineligible', 'denied'].includes(String(decision?.status || '').toLowerCase()) ||
      entries.some((r: Row) => r.athlete_id === id && ['blocked', 'ineligible'].includes(String(r.eligibility_status || '').toLowerCase()));
  });
  const unassessed = candidateIds.filter(id => !latestEligibility.has(id));
  const entered = new Set(entries.filter((r: Row) => r.scratch_status !== 'scratched').map((r: Row) => r.athlete_id));
  const attendingWithoutEntry = responses.filter((r: Row) => ['attending', 'accepted', 'yes'].includes(String(r.response_status).toLowerCase()) && !entered.has(r.athlete_id));
  const linkedInvoices = (() => {
    const personIds = new Set(candidateIds.map(id => athletes.get(id)?.person_id).filter(Boolean));
    const members = data.familyData?.members || [];
    const familyIds = new Set(members.filter((r: Row) => personIds.has(r.person_id)).map((r: Row) => r.family_id));
    for (const member of members) if (familyIds.has(member.family_id)) personIds.add(member.person_id);
    return (data.invoices || []).filter((invoice: Row) => Number(invoice.balance_due) > 0 && personIds.has(invoice.customers?.person_id));
  })();
  const approvals = (data.approvals || []).filter((r: Row) => r.entity_id === competitionId && r.status === 'pending');

  function name(id: string) {
    const athlete = athletes.get(id), person = athlete && people.get(athlete.person_id);
    return person ? [person.preferred_name || person.first_name, person.last_name].filter(Boolean).join(' ') : athlete?.athlete_number || id;
  }
  async function act(action: Row) {
    setBusy(true); setError('');
    try {
      const response = await authenticatedFetch('/api/admin-command', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...action, role }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Action failed.');
      await onChanged();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Action failed.'); }
    finally { setBusy(false); }
  }
  const button = (count: number, label: string, next: Detail) => <button onClick={() => setDetail(next)} className="flex w-full items-center justify-between border-b border-neutral-700 py-3 text-left text-sm hover:text-blue-300"><span>{label}</span><strong>{count} →</strong></button>;

  return <div className="fixed inset-0 z-[140] bg-black/40" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <aside className="ml-auto h-full w-full max-w-3xl overflow-y-auto border-l border-neutral-700 bg-[#242529] text-neutral-100 shadow-2xl">
      <header className="sticky top-0 z-10 border-b border-neutral-700 bg-[#242529] px-7 py-5">
        <button onClick={onClose} className="float-right rounded border border-neutral-600 px-3 py-1 text-sm">Close</button>
        <div className="text-xs font-semibold text-neutral-400">Competition · {competition?.status || 'Status unavailable'}</div>
        <h2 className="mt-1 text-2xl font-bold">{competition?.name || item.title}</h2>
        <p className="mt-2 text-sm text-neutral-300">{competition?.starts_at ? new Date(competition.starts_at).toLocaleString() : 'Date not recorded'}{competition?.city ? ` · ${competition.city}` : ''}</p>
        <div className="mt-4 flex gap-2 text-sm"><button onClick={() => setDetail('overview')} className="font-semibold text-blue-300">Overview</button>{detail !== 'overview' && <span className="text-neutral-400">/ {detail.replaceAll('_', ' ')}</span>}</div>
      </header>
      <div className="space-y-6 p-7">
        {error && <div className="rounded border border-red-300 bg-red-950 p-3 text-sm text-red-200">{error}</div>}
        {detail === 'overview' ? <>
          <section><h3 className="mb-3 text-sm font-bold">State</h3><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[[readiness?.candidate_count || 0, 'Athletes in scope'], [readiness?.eligible_count || 0, 'Verified eligible'], [readiness?.entered_count || 0, 'Entered'], [readiness?.attending_count || 0, 'Attending']].map(([count, label]) => <div key={String(label)} className="rounded border border-neutral-700 p-3"><strong className="block text-xl">{count}</strong><span className="text-xs text-neutral-400">{label}</span></div>)}
          </div></section>
          <section className="rounded border border-neutral-700 p-4"><h3 className="font-bold">Exceptions</h3>
            {button(awaiting.length, 'Awaiting response', 'awaiting')}{button(unassessed.length, 'Eligibility not assessed', 'unassessed')}{button(blocked.length, 'Eligibility blocks', 'blocked')}{button(attendingWithoutEntry.length, 'Attending without entry', 'entries')}{data.authorization?.finance && button(linkedInvoices.length, 'Family-linked receivables', 'finance')}
          </section>
          <section className="rounded border border-neutral-700 p-4"><h3 className="font-bold">Decisions</h3><p className="mt-2 text-sm text-neutral-300">{approvals.length ? `${approvals.length} pending approval request${approvals.length === 1 ? '' : 's'} linked to this competition.` : 'No pending approval request is linked to this competition.'}</p></section>
          <section className="rounded border border-neutral-700 p-4"><h3 className="font-bold">Actions and deadlines</h3>
            {deadlines.map((deadline: Row) => <div key={deadline.id} className="mt-3 flex items-center justify-between gap-3 border-t border-neutral-700 pt-3 text-sm"><span>{deadline.name || deadline.deadline_type} · {deadline.due_at ? new Date(deadline.due_at).toLocaleString() : 'No due date'} · {deadline.status}</span>{deadline.status !== 'completed' && data.authorization?.competition && <button disabled={busy} onClick={() => act({ action: 'update-competition-deadline', id: deadline.id, changes: { status: 'completed' } })} className="shrink-0 rounded bg-[#145b91] px-3 py-2 font-semibold text-white disabled:opacity-50">Complete</button>}</div>)}
            {!deadlines.length && <p className="mt-2 text-sm text-neutral-400">No competition deadlines are recorded.</p>}
          </section>
        </> : detail === 'finance' ? <section><h3 className="font-bold">Family-linked receivables</h3><p className="mt-1 text-xs text-neutral-400">Balances linked through athlete or family person records. A balance alone does not establish an eligibility block.</p>{linkedInvoices.map((invoice: Row) => <div key={invoice.id} className="border-b border-neutral-700 py-3 text-sm"><strong>{invoice.invoice_number}</strong> · {invoice.customers?.display_name} · {invoice.currency} {invoice.balance_due}</div>)}{!linkedInvoices.length && <p className="mt-4 text-sm text-neutral-400">No linked outstanding receivables.</p>}</section> : <section><h3 className="font-bold">{detail === 'awaiting' ? 'Awaiting response' : detail === 'blocked' ? 'Eligibility blocks' : detail === 'entries' ? 'Attending without entry' : 'Eligibility not assessed'}</h3>
          {(detail === 'awaiting' ? awaiting.map((r: Row) => r.athlete_id) : detail === 'blocked' ? blocked : detail === 'entries' ? attendingWithoutEntry.map((r: Row) => r.athlete_id) : unassessed).map((id: string) => {
            const response = responses.find((r: Row) => r.athlete_id === id), decision = latestEligibility.get(id);
            return <div key={id} className="border-b border-neutral-700 py-4"><div className="font-semibold">{name(id)}</div><div className="mt-1 text-xs text-neutral-400">{decision ? `Eligibility: ${decision.status}${decision.reason ? ` · ${decision.reason}` : ''}` : 'No recorded competition eligibility decision'} · {response ? `Response: ${response.response_status}` : 'No participation response record'}</div>
              {detail === 'awaiting' && response && data.authorization?.communications && <button disabled={busy} onClick={() => act({ action: 'record-competition-reminder', ids: [response.id] })} className="mt-2 rounded border border-[#145b91] px-3 py-1.5 text-xs font-semibold text-blue-300 disabled:opacity-50">Record reminder</button>}
            </div>;
          })}
          {!(detail === 'awaiting' ? awaiting.length : detail === 'blocked' ? blocked.length : detail === 'entries' ? attendingWithoutEntry.length : unassessed.length) && <p className="mt-4 text-sm text-neutral-400">No records in this exception.</p>}
        </section>}
      </div>
    </aside>
  </div>;
}
