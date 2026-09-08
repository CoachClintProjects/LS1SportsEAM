'use client';

import { FormEvent, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Users } from 'lucide-react';

const TEAM_MANAGER_VIEWS = new Set(['team-manager','registrar','rosters','memberships','programs','teams','seasons']);

type Group = 'overview' | 'registrar' | 'rosters' | 'memberships' | 'programs' | 'teams' | 'seasons';

function Input({ name, label, required = false, type = 'text', placeholder = '' }: { name: string; label: string; required?: boolean; type?: string; placeholder?: string }) {
  return <label className="block text-[10px] font-bold uppercase tracking-[.12em] text-neutral-500">{label}<input name={name} required={required} type={type} placeholder={placeholder} className="mt-2 w-full rounded-lg border border-neutral-700 bg-black px-3 py-2.5 text-xs normal-case tracking-normal text-white outline-none focus:border-emerald-500/60" /></label>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="rounded-xl border border-neutral-800 bg-[#0d1010] p-4"><div className="mb-4 text-sm font-black text-white">{title}</div>{children}</div>;
}

export default function SuperUserTeamManagerActions({ view }: { view: string }) {
  const group = useMemo<Group | null>(() => {
    if (!TEAM_MANAGER_VIEWS.has(view)) return null;
    if (view === 'team-manager') return 'overview';
    return view as Group;
  }, [view]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  if (!group) return null;

  async function submit(event: FormEvent<HTMLFormElement>, action: string) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
      const response = await fetch('/api/superuser-team-manager-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error || 'Team Manager action failed.');
      setMessage(`${action.replaceAll('-', ' ')} completed and audited.`);
      event.currentTarget.reset();
      window.dispatchEvent(new CustomEvent('ls1sports:data-changed'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Team Manager action failed.');
    } finally {
      setBusy(false);
    }
  }

  const showPrograms = group === 'overview' || group === 'programs';
  const showSeasons = group === 'overview' || group === 'seasons';
  const showTeams = group === 'overview' || group === 'teams';
  const showMemberships = group === 'overview' || group === 'registrar' || group === 'memberships';
  const showRosters = group === 'overview' || group === 'registrar' || group === 'rosters';
  const primary = 'mt-4 w-full rounded-lg bg-emerald-400 px-3 py-2.5 text-xs font-black text-black disabled:opacity-50';
  const secondary = 'mt-4 w-full rounded-lg border border-neutral-700 px-3 py-2.5 text-xs font-black text-white disabled:opacity-50';

  return <section className="rounded-2xl border border-neutral-800 bg-[#090b0b] p-5 lg:p-6">
    <div className="flex items-start gap-3"><Users className="mt-0.5 h-5 w-5 text-emerald-400" /><div><div className="text-[9px] font-black uppercase tracking-[.2em] text-emerald-400">TEAM MANAGER CONTROL</div><h2 className="mt-1 text-xl font-black text-white">Canonical operating actions</h2><p className="mt-2 text-xs leading-5 text-neutral-500">Every change writes through the authenticated Super User server API and creates privileged audit evidence. Use the Reference Finder above for canonical IDs.</p></div></div>
    {error && <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-xs text-red-200"><AlertTriangle className="h-4 w-4" />{error}</div>}
    {message && <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-xs text-emerald-200"><CheckCircle2 className="h-4 w-4" />{message}</div>}

    <div className="mt-6 grid gap-5 xl:grid-cols-3">
      {showPrograms && <>
        <Section title="Create program"><form onSubmit={event => void submit(event, 'create-program')} className="space-y-3"><Input name="organization_id" label="Organization ID" required /><Input name="sport_id" label="Sport ID" /><Input name="code" label="Program code" required /><Input name="name" label="Program name" required /><Input name="program_type" label="Program type" /><Input name="status" label="Status" placeholder="active" /><button disabled={busy} className={primary}>Create program</button></form></Section>
        <Section title="Program lifecycle"><form onSubmit={event => void submit(event, 'set-program-status')} className="space-y-3"><Input name="id" label="Program ID" required /><Input name="status" label="Status" required /><button disabled={busy} className={secondary}>Apply program status</button></form></Section>
      </>}

      {showSeasons && <>
        <Section title="Create season"><form onSubmit={event => void submit(event, 'create-season')} className="space-y-3"><Input name="organization_id" label="Organization ID" required /><Input name="sport_id" label="Sport ID" /><Input name="code" label="Season code" required /><Input name="name" label="Season name" required /><Input name="starts_on" label="Starts on" type="date" /><Input name="ends_on" label="Ends on" type="date" /><Input name="status" label="Status" placeholder="planned" /><button disabled={busy} className={primary}>Create season</button></form></Section>
        <Section title="Season lifecycle"><form onSubmit={event => void submit(event, 'set-season-status')} className="space-y-3"><Input name="id" label="Season ID" required /><Input name="status" label="Status" required /><button disabled={busy} className={secondary}>Apply season status</button></form></Section>
      </>}

      {showTeams && <>
        <Section title="Create team"><form onSubmit={event => void submit(event, 'create-team')} className="space-y-3"><Input name="organization_id" label="Organization ID" required /><Input name="sport_id" label="Sport ID" /><Input name="program_id" label="Program ID" /><Input name="season_id" label="Season ID" /><Input name="code" label="Team code" required /><Input name="name" label="Team name" required /><Input name="competitive_level" label="Competitive level" /><Input name="status" label="Status" placeholder="active" /><button disabled={busy} className={primary}>Create team</button></form></Section>
        <Section title="Team lifecycle"><form onSubmit={event => void submit(event, 'set-team-status')} className="space-y-3"><Input name="id" label="Team ID" required /><Input name="status" label="Status" required /><button disabled={busy} className={secondary}>Apply team status</button></form></Section>
      </>}

      {showMemberships && <>
        <Section title="Create organization membership"><form onSubmit={event => void submit(event, 'create-membership')} className="space-y-3"><Input name="organization_id" label="Organization ID" required /><Input name="person_id" label="Person ID" required /><Input name="sport_id" label="Sport ID" /><Input name="membership_number" label="Membership number" /><Input name="membership_type" label="Membership type" /><Input name="starts_on" label="Starts on" type="date" /><Input name="ends_on" label="Ends on" type="date" /><Input name="governing_body_id" label="Governing body ID" /><Input name="status" label="Status" placeholder="active" /><button disabled={busy} className={primary}>Create membership</button></form></Section>
        <Section title="Membership lifecycle"><form onSubmit={event => void submit(event, 'set-membership-status')} className="space-y-3"><Input name="id" label="Membership ID" required /><Input name="status" label="Status" required /><button disabled={busy} className={secondary}>Apply membership status</button></form></Section>
      </>}

      {showRosters && <>
        <Section title="Add roster member"><form onSubmit={event => void submit(event, 'add-roster-member')} className="space-y-3"><Input name="team_id" label="Team ID" required /><Input name="athlete_id" label="Athlete ID" /><Input name="person_id" label="Person ID" /><Input name="membership_type" label="Membership type" required placeholder="athlete, staff…" /><Input name="starts_on" label="Starts on" type="date" /><Input name="ends_on" label="Ends on" type="date" /><Input name="jersey_number" label="Jersey / roster number" /><Input name="notes" label="Notes" /><Input name="status" label="Status" placeholder="active" /><button disabled={busy} className={primary}>Add roster member</button></form></Section>
        <Section title="Roster lifecycle"><form onSubmit={event => void submit(event, 'set-roster-status')} className="space-y-3"><Input name="id" label="Roster membership ID" required /><Input name="status" label="Status" required /><button disabled={busy} className={secondary}>Apply roster status</button></form></Section>
      </>}
    </div>
  </section>;
}
