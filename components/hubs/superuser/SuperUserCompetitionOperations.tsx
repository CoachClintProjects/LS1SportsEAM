'use client';

import { FormEvent, useState } from 'react';
import { AlertTriangle, CheckCircle2, Medal } from 'lucide-react';

const VIEWS = new Set([
  'competition-officials',
  'competition-timing',
  'competition-results',
  'competition-seeding',
  'competition-records',
  'competition-publication',
  'competition',
]);

function Input({ name, label, required = false, type = 'text', placeholder = '' }: { name: string; label: string; required?: boolean; type?: string; placeholder?: string }) {
  return <label className="block text-[10px] font-bold uppercase tracking-[.12em] text-neutral-500">{label}<input name={name} required={required} type={type} placeholder={placeholder} className="mt-2 w-full rounded-lg border border-neutral-700 bg-black px-3 py-2.5 text-xs normal-case tracking-normal text-white outline-none focus:border-emerald-500/60" /></label>;
}
function Json({ name, label, placeholder = '{}' }: { name: string; label: string; placeholder?: string }) {
  return <label className="block text-[10px] font-bold uppercase tracking-[.12em] text-neutral-500">{label}<textarea name={name} rows={4} placeholder={placeholder} className="mt-2 w-full rounded-lg border border-neutral-700 bg-black px-3 py-2.5 font-mono text-[11px] normal-case tracking-normal text-white outline-none focus:border-emerald-500/60" /></label>;
}

export default function SuperUserCompetitionOperations({ view }: { view: string }) {
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [message,setMessage] = useState('');
  if (!VIEWS.has(view)) return null;

  async function submit(event: FormEvent<HTMLFormElement>, action: string) {
    event.preventDefault();
    setBusy(true); setError(''); setMessage('');
    try {
      const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
      const response = await fetch('/api/superuser-competition-operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error || 'Competition operation failed.');
      setMessage(`${action.replaceAll('-', ' ')} completed and audited.`);
      event.currentTarget.reset();
      window.dispatchEvent(new CustomEvent('ls1sports:data-changed'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Competition operation failed.');
    } finally {
      setBusy(false);
    }
  }

  const card = 'rounded-xl border border-neutral-800 bg-[#0d1010] p-4';
  const primary = 'mt-4 w-full rounded-lg bg-emerald-400 px-3 py-2.5 text-xs font-black text-black disabled:opacity-50';
  const secondary = 'mt-4 w-full rounded-lg border border-neutral-700 px-3 py-2.5 text-xs font-black text-white disabled:opacity-50';

  return <section className="rounded-2xl border border-neutral-800 bg-[#090b0b] p-5 lg:p-6">
    <div className="flex items-start gap-3"><Medal className="mt-0.5 h-5 w-5 text-emerald-400"/><div><div className="text-[9px] font-black uppercase tracking-[.2em] text-emerald-400">COMPETITION OPERATIONS</div><h2 className="mt-1 text-xl font-black text-white">Officials, timing, scoring, advancement, records & awards</h2><p className="mt-2 max-w-4xl text-xs leading-5 text-neutral-500">These workflows complete the authoritative LS1Sports competition chain. Records, canonical scores and awards are gated by LS1 canonical results and approved external verification evidence.</p></div></div>
    {error && <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-xs text-red-200"><AlertTriangle className="h-4 w-4"/>{error}</div>}
    {message && <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-xs text-emerald-200"><CheckCircle2 className="h-4 w-4"/>{message}</div>}

    <div className="mt-6 grid gap-5 xl:grid-cols-3">
      <form onSubmit={e=>void submit(e,'create-official-requirement')} className={card}><div className="mb-4 text-sm font-black text-white">Official requirement</div><Input name="competition_id" label="Competition ID" required/><Input name="session_id" label="Session ID"/><Input name="role_code" label="Role code" required/><Input name="required_count" label="Required count" type="number" placeholder="1"/><Input name="ruleset_id" label="Ruleset ID"/><Json name="credential_requirements" label="Credential requirements JSON"/><button disabled={busy} className={primary}>Create requirement</button></form>
      <form onSubmit={e=>void submit(e,'assign-official')} className={card}><div className="mb-4 text-sm font-black text-white">Assign official</div><Input name="competition_id" label="Competition ID" required/><Input name="session_id" label="Session ID"/><Input name="requirement_id" label="Requirement ID"/><Input name="person_id" label="Official person ID" required/><Input name="role_code" label="Role code" required/><Json name="credential_snapshot" label="Credential snapshot JSON"/><button disabled={busy} className={primary}>Assign official</button></form>
      <form onSubmit={e=>void submit(e,'set-official-duty-status')} className={card}><div className="mb-4 text-sm font-black text-white">Official duty lifecycle</div><Input name="id" label="Assignment ID" required/><Input name="status" label="Status" required placeholder="checked_in / checked_out"/><button disabled={busy} className={secondary}>Apply duty status</button></form>

      <form onSubmit={e=>void submit(e,'create-timing-session')} className={card}><div className="mb-4 text-sm font-black text-white">Timing session</div><Input name="competition_id" label="Competition ID" required/><Input name="session_id" label="Competition session ID"/><Input name="timing_system_id" label="Timing system ID"/><Input name="source_system_id" label="Source system ID"/><Input name="external_session_key" label="External session key"/><Json name="configuration" label="Configuration JSON"/><button disabled={busy} className={primary}>Initialize timing session</button></form>
      <form onSubmit={e=>void submit(e,'set-timing-session-status')} className={card}><div className="mb-4 text-sm font-black text-white">Timing-session lifecycle</div><Input name="id" label="Timing session ID" required/><Input name="status" label="Status" required placeholder="open / closed / failed"/><button disabled={busy} className={secondary}>Apply timing status</button></form>
      <form onSubmit={e=>void submit(e,'record-timing-message')} className={card}><div className="mb-4 text-sm font-black text-white">Timing evidence</div><Input name="timing_session_id" label="Timing session ID" required/><Input name="event_id" label="Event ID"/><Input name="heat_no" label="Heat" type="number"/><Input name="lane_no" label="Lane" type="number"/><Input name="message_type" label="Message type" required/><Input name="source_record_key" label="Source record key"/><Input name="validation_status" label="Validation status" placeholder="pending"/><Json name="raw_payload" label="Raw payload JSON"/><Json name="normalized_payload" label="Normalized payload JSON"/><button disabled={busy} className={primary}>Record timing message</button></form>

      <form onSubmit={e=>void submit(e,'create-scoring-rule')} className={card}><div className="mb-4 text-sm font-black text-white">Scoring rule</div><Input name="ruleset_id" label="Ruleset ID" required/><Input name="scoring_code" label="Scoring code" required/><Input name="name" label="Name" required/><Input name="applies_to" label="Applies to"/><Input name="priority" label="Priority" type="number" placeholder="100"/><Json name="configuration" label="Scoring configuration JSON"/><button disabled={busy} className={primary}>Create scoring rule</button></form>
      <form onSubmit={e=>void submit(e,'create-score-snapshot')} className={card}><div className="mb-4 text-sm font-black text-white">Score snapshot</div><Input name="competition_id" label="Competition ID" required/><Input name="session_id" label="Session ID"/><Input name="snapshot_no" label="Snapshot number" type="number"/><Input name="scoring_rule_id" label="Scoring rule ID"/><Input name="scope_type" label="Scope type" placeholder="competition"/><Json name="scores" label="Scores JSON"/><button disabled={busy} className={primary}>Create non-canonical snapshot</button></form>
      <form onSubmit={e=>void submit(e,'promote-score-snapshot')} className={card}><div className="mb-4 text-sm font-black text-white">Canonical score promotion</div><Input name="id" label="Score snapshot ID" required/><button disabled={busy} className={secondary}>Promote after verification</button></form>

      <form onSubmit={e=>void submit(e,'record-advancement-decision')} className={card}><div className="mb-4 text-sm font-black text-white">Advancement decision</div><Input name="competition_id" label="Competition ID" required/><Input name="competition_event_id" label="Event ID"/><Input name="source_round_id" label="Source round ID"/><Input name="target_round_id" label="Target round ID"/><Input name="athlete_id" label="Athlete ID"/><Input name="team_id" label="Team ID"/><Input name="entry_id" label="Entry ID"/><Input name="decision" label="Decision" required/><Input name="rank" label="Rank" type="number"/><Input name="qualification_basis" label="Qualification basis"/><Json name="evidence" label="Advancement evidence JSON"/><button disabled={busy} className={primary}>Record advancement</button></form>

      <form onSubmit={e=>void submit(e,'create-record-book')} className={card}><div className="mb-4 text-sm font-black text-white">Record book</div><Input name="organization_id" label="Organization ID"/><Input name="sport_id" label="Sport ID"/><Input name="governing_body_id" label="Governing body ID"/><Input name="code" label="Code" required/><Input name="name" label="Name" required/><Input name="scope_type" label="Scope type" required/><Json name="configuration" label="Record-book configuration"/><button disabled={busy} className={primary}>Create record book</button></form>
      <form onSubmit={e=>void submit(e,'create-record-claim')} className={card}><div className="mb-4 text-sm font-black text-white">Record claim</div><Input name="competition_id" label="Competition ID" required/><Input name="competition_result_id" label="Canonical result ID" required/><Input name="record_type" label="Record type" required/><Input name="record_scope" label="Record scope"/><Input name="record_code" label="Record code"/><Input name="prior_value" label="Prior value" type="number"/><Input name="new_value" label="New value" type="number"/><Input name="unit" label="Unit"/><Json name="evidence" label="Record evidence JSON"/><button disabled={busy} className={primary}>Create gated claim</button></form>
      <form onSubmit={e=>void submit(e,'verify-record-claim')} className={card}><div className="mb-4 text-sm font-black text-white">Verify record claim</div><Input name="id" label="Record claim ID" required/><Input name="record_book_id" label="Record book ID" required/><Input name="event_definition_id" label="Event definition ID"/><Input name="course_code" label="Course code"/><Input name="effective_from" label="Effective from" type="date"/><button disabled={busy} className={secondary}>Verify & create official record</button></form>

      <form onSubmit={e=>void submit(e,'create-award-program')} className={card}><div className="mb-4 text-sm font-black text-white">Award program</div><Input name="competition_id" label="Competition ID" required/><Input name="code" label="Code" required/><Input name="name" label="Name" required/><Input name="award_type" label="Award type" required/><Json name="rule_definition" label="Award rules JSON"/><button disabled={busy} className={primary}>Create award program</button></form>
      <form onSubmit={e=>void submit(e,'create-award')} className={card}><div className="mb-4 text-sm font-black text-white">Competition award</div><Input name="competition_id" label="Competition ID" required/><Input name="competition_event_id" label="Event ID"/><Input name="competition_result_id" label="Canonical result ID"/><Input name="athlete_id" label="Athlete ID"/><Input name="team_id" label="Team ID"/><Input name="award_code" label="Award code" required/><Input name="award_name" label="Award name" required/><Input name="place" label="Place" type="number"/><Json name="metadata" label="Award metadata JSON"/><button disabled={busy} className={primary}>Create provisional award</button></form>
      <form onSubmit={e=>void submit(e,'finalize-award')} className={card}><div className="mb-4 text-sm font-black text-white">Finalize award</div><Input name="id" label="Award ID" required/><button disabled={busy} className={secondary}>Finalize after proof gates</button></form>
    </div>
  </section>;
}
