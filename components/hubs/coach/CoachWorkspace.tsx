'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { authenticatedFetch } from '@/lib/client/authenticatedFetch';

type Runtime = {
  identity: { displayName: string; isSuperUser: boolean };
  context: {
    team: { id: string; name: string; competitive_level: string | null; status: string | null } | null;
    organization: { id: string; name: string; status: string | null } | null;
    season: { id: string; name: string; starts_on: string | null; ends_on: string | null; status: string | null } | null;
  };
  roster: Array<{ athleteId: string; athleteNumber: string | null; name: string; status: string; jerseyNumber: string | null }>;
  training: {
    plans: Array<{ id: string; name: string; plan_type: string | null; starts_on: string | null; ends_on: string | null; status: string | null }>;
    sessions: Array<{ id: string; title: string; session_type: string | null; total_load: number | null; total_distance: number | null; distance_unit: string | null }>;
  };
  attendance: {
    sessions: Array<{ id: string; session_date: string; start_time: string | null; end_time: string | null; session_type: string | null; status: string | null }>;
    records: Array<{ session_id: string; athlete_id: string; status: string }>;
  };
  competitions: Array<{ id: string; name: string; competition_type: string | null; starts_at: string | null; city: string | null; region: string | null; status: string | null }>;
  attention: Array<{ id: string; category: string; horizon: string; title: string; summary: string | null; severity: string; due_at: string | null; status: string }>;
  proposals: Array<{ id: string; agent_key: string; proposal_type: string; autonomy_level: string; status: string; created_at: string }>;
  metrics: { rosterSize: number; openAttention: number; pendingProposals: number; scheduledSessions: number; upcomingCompetitions: number };
};

type View = 'command' | 'squads' | 'rosters' | 'attendance' | 'training' | 'workouts' | 'deployment' | 'competition' | 'performance' | 'development' | 'deck';

const META: Record<View, { title: string; label: string; description: string }> = {
  command: { title: 'Coach Command Center', label: 'TODAY', description: 'What needs coaching judgment, what is scheduled, and what LS1 knows from canonical evidence.' },
  squads: { title: 'Squads', label: 'TEAM', description: 'The active team context and coaching population.' },
  rosters: { title: 'Rosters', label: 'ATHLETES', description: 'Active canonical athlete memberships for this team.' },
  attendance: { title: 'Attendance', label: 'EXECUTION', description: 'Real session attendance evidence.' },
  training: { title: 'Training Plans', label: 'PLAN', description: 'Canonical team training plans. Empty means no plan exists yet.' },
  workouts: { title: 'Workouts', label: 'DESIGN', description: 'Training sessions and workout evidence.' },
  deployment: { title: 'Training Deployment', label: 'DELIVER', description: 'Planned work versus delivered evidence.' },
  competition: { title: 'Competition Preparation', label: 'COMPETE', description: 'Upcoming canonical competition context.' },
  performance: { title: 'Performance', label: 'LEARN', description: 'Performance evidence without fabricated results.' },
  development: { title: 'Development', label: 'ATHLETE LOOP', description: 'Development grounded in roster, training and participation evidence.' },
  deck: { title: 'Deck Ledger', label: 'DECISIONS', description: 'Coach attention, AI proposals, judgment and accountability.' },
};

function getView(pathname: string): View {
  const segment = pathname.split('/').filter(Boolean)[1] || '';
  const supported: View[] = ['squads', 'rosters', 'attendance', 'training', 'workouts', 'deployment', 'competition', 'performance', 'development', 'deck'];
  return supported.includes(segment as View) ? (segment as View) : 'command';
}

function dateLabel(value?: string | null) {
  if (!value) return 'Not scheduled';
  const parsed = new Date(value.length === 10 ? `${value}T12:00:00Z` : value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric', year: 'numeric' }).format(parsed);
}

function Empty({ title, body }: { title: string; body: string }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-6"><div className="text-sm font-semibold text-white">{title}</div><p className="mt-2 max-w-3xl text-sm leading-6 text-white/50">{body}</p></div>;
}

function Stat({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return <div className="rounded-2xl border border-white/10 bg-[#0a0e0c] p-4"><div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-300/70">{label}</div><div className="mt-2 text-3xl font-semibold text-white">{value}</div><div className="mt-1 text-xs text-white/40">{detail}</div></div>;
}

async function requestRuntime(teamId: string | null) {
  const path = teamId ? `/api/coach/runtime?team=${encodeURIComponent(teamId)}` : '/api/coach/runtime';
  try {
    return await authenticatedFetch(path, { cache: 'no-store', credentials: 'same-origin' });
  } catch {
    return fetch(path, { cache: 'no-store', credentials: 'same-origin' });
  }
}

export default function CoachWorkspace() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view = getView(pathname);
  const meta = META[view];
  const [runtime, setRuntime] = useState<Runtime | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await requestRuntime(searchParams.get('team'));
      const payload = (await response.json().catch(() => null)) as Runtime | { error?: string } | null;
      if (!response.ok || !payload || 'error' in payload) {
        throw new Error(payload && 'error' in payload && payload.error ? payload.error : `Coach runtime returned ${response.status}.`);
      }
      setRuntime(payload);
    } catch (err) {
      setRuntime(null);
      setError(err instanceof Error ? err.message : 'Coach runtime unavailable.');
    } finally {
      setLoading(false);
    }
  }, [searchParams]);

  useEffect(() => { void refresh(); }, [refresh]);

  const attendanceCounts = useMemo(() => {
    const map = new Map<string, { present: number; absent: number; other: number }>();
    for (const record of runtime?.attendance.records || []) {
      const current = map.get(record.session_id) || { present: 0, absent: 0, other: 0 };
      const status = record.status.toLowerCase();
      if (['present', 'checked_in', 'attended'].includes(status)) current.present += 1;
      else if (['absent', 'no_show'].includes(status)) current.absent += 1;
      else current.other += 1;
      map.set(record.session_id, current);
    }
    return map;
  }, [runtime]);

  if (loading) return <div className="h-full overflow-auto bg-[#050807] p-6 text-sm text-white/55">Loading canonical Coach runtime…</div>;

  if (error) {
    return <div className="h-full overflow-auto bg-[#050807] p-6 text-white"><div className="mx-auto max-w-5xl rounded-2xl border border-rose-400/20 bg-rose-400/5 p-6"><div className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-300">Coach runtime blocked</div><h1 className="mt-2 text-2xl font-semibold">Authorized Coach context could not be established.</h1><p className="mt-3 text-sm text-white/60">{error}</p><button type="button" onClick={() => void refresh()} className="mt-5 rounded-lg border border-white/15 px-4 py-2 text-sm hover:bg-white/5">Retry</button></div></div>;
  }

  if (!runtime) return null;
  const team = runtime.context.team;
  const organization = runtime.context.organization;
  const today = new Date().toISOString().slice(0, 10);
  const upcomingSessions = runtime.attendance.sessions.filter((session) => session.session_date >= today).sort((a, b) => a.session_date.localeCompare(b.session_date));
  const upcomingCompetitions = runtime.competitions.filter((competition) => !competition.starts_at || new Date(competition.starts_at).getTime() >= Date.now());

  return <div className="h-full overflow-auto bg-[#050807] text-white"><div className="mx-auto max-w-[1500px] p-5 md:p-7">
    <header className="mb-6 flex flex-col gap-4 border-b border-white/10 pb-6 xl:flex-row xl:items-end xl:justify-between">
      <div><div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-300/70">{meta.label} · COACH ENGINE</div><h1 className="mt-2 text-3xl font-semibold tracking-tight">{meta.title}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-white/50">{meta.description}</p></div>
      <div className="rounded-xl border border-white/10 bg-white/[0.025] px-4 py-3 text-right"><div className="text-sm font-medium">{team?.name || 'No team context'}</div><div className="mt-1 text-xs text-white/40">{organization?.name || 'No organization'}{runtime.context.season?.name ? ` · ${runtime.context.season.name}` : ''}</div><div className="mt-1 text-[11px] text-emerald-300/60">Canonical data · {runtime.identity.displayName}{runtime.identity.isSuperUser ? ' · SuperUser' : ''}</div></div>
    </header>

    {!team ? <Empty title="No active team context" body="LS1 will not create a synthetic squad. Assign this coach to a real team, or use an authorized SuperUser team context." /> : <>
      {view === 'command' && <div className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><Stat label="Roster" value={runtime.metrics.rosterSize} detail="active athletes" /><Stat label="Attention" value={runtime.metrics.openAttention} detail="open coach items" /><Stat label="AI proposals" value={runtime.metrics.pendingProposals} detail="awaiting review" /><Stat label="Sessions" value={runtime.metrics.scheduledSessions} detail="scheduled from today" /><Stat label="Competitions" value={runtime.metrics.upcomingCompetitions} detail="upcoming" /></div>
        <div className="grid gap-5 xl:grid-cols-2">
          <section className="rounded-2xl border border-white/10 bg-[#0a0e0c] p-5"><h2 className="font-semibold">Needs coaching judgment</h2><div className="mt-4 space-y-3">{runtime.attention.length ? runtime.attention.slice(0, 8).map((item) => <div key={item.id} className="rounded-xl border border-white/10 p-4"><div className="text-[10px] uppercase tracking-wider text-amber-200">{item.severity} · {item.category} · {item.horizon}</div><div className="mt-2 text-sm font-medium">{item.title}</div>{item.summary && <div className="mt-1 text-sm text-white/45">{item.summary}</div>}</div>) : <Empty title="No open Coach attention items" body="Overwatch has not generated a real canonical exception or decision request for this context yet." />}</div></section>
          <section className="rounded-2xl border border-white/10 bg-[#0a0e0c] p-5"><h2 className="font-semibold">AI / Overwatch proposals</h2><div className="mt-4 space-y-3">{runtime.proposals.length ? runtime.proposals.slice(0, 8).map((proposal) => <div key={proposal.id} className="rounded-xl border border-white/10 p-4"><div className="text-[10px] uppercase tracking-wider text-emerald-300/60">{proposal.agent_key} · {proposal.autonomy_level}</div><div className="mt-2 text-sm font-medium">{proposal.proposal_type}</div><div className="mt-1 text-xs text-white/40">{proposal.status} · human review remains required</div></div>) : <Empty title="No proposals awaiting review" body="Nothing is generated just to populate this panel." />}</div></section>
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <section className="rounded-2xl border border-white/10 bg-[#0a0e0c] p-5"><h2 className="font-semibold">Next training</h2><div className="mt-4 space-y-2">{upcomingSessions.length ? upcomingSessions.slice(0, 5).map((session) => <div key={session.id} className="flex items-center justify-between rounded-xl border border-white/10 px-4 py-3"><div><div className="text-sm font-medium">{session.session_type || 'Training session'}</div><div className="text-xs text-white/40">{session.start_time || 'Time not set'} · {session.status || 'planned'}</div></div><div className="text-sm text-white/60">{dateLabel(session.session_date)}</div></div>) : <Empty title="No training scheduled" body="Canonical training/attendance data is empty for the current context." />}</div></section>
          <section className="rounded-2xl border border-white/10 bg-[#0a0e0c] p-5"><h2 className="font-semibold">Next competition</h2><div className="mt-4 space-y-2">{upcomingCompetitions.length ? upcomingCompetitions.slice(0, 5).map((competition) => <div key={competition.id} className="flex items-center justify-between rounded-xl border border-white/10 px-4 py-3"><div><div className="text-sm font-medium">{competition.name}</div><div className="text-xs text-white/40">{[competition.city, competition.region].filter(Boolean).join(', ') || competition.competition_type || 'Competition'}</div></div><div className="text-sm text-white/60">{dateLabel(competition.starts_at)}</div></div>) : <Empty title="No upcoming competitions" body="No canonical competition is currently available for this organization." />}</div></section>
        </div>
      </div>}

      {view === 'squads' && <div className="grid gap-4 lg:grid-cols-3"><Stat label="Team" value={team.name} detail="active canonical squad" /><Stat label="Roster" value={runtime.roster.length} detail="active memberships" /><Stat label="Level" value={team.competitive_level || 'Not set'} detail="canonical team level" /><div className="lg:col-span-3"><Empty title="Coach team context is authorization-bound" body="Team switching uses explicit Coach access assignments. SuperUsers can inspect canonical teams without inventing coach assignments." /></div></div>}

      {view === 'rosters' && (runtime.roster.length ? <div className="overflow-hidden rounded-2xl border border-white/10"><div className="grid grid-cols-[minmax(0,1fr)_140px_120px] gap-3 border-b border-white/10 bg-white/[0.035] px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-white/40"><div>Athlete</div><div>LS1 athlete #</div><div>Status</div></div>{runtime.roster.map((athlete) => <div key={athlete.athleteId} className="grid grid-cols-[minmax(0,1fr)_140px_120px] gap-3 border-b border-white/[0.06] px-4 py-3 last:border-b-0"><div><div className="text-sm font-medium">{athlete.name}</div>{athlete.jerseyNumber && <div className="text-xs text-white/35">Roster # {athlete.jerseyNumber}</div>}</div><div className="text-sm text-white/55">{athlete.athleteNumber || '—'}</div><div className="text-sm capitalize text-emerald-200/70">{athlete.status}</div></div>)}</div> : <Empty title="No active roster" body="This team has no active athlete memberships." />)}

      {view === 'attendance' && (runtime.attendance.sessions.length ? <div className="space-y-3">{runtime.attendance.sessions.map((session) => { const counts = attendanceCounts.get(session.id); return <div key={session.id} className="grid gap-3 rounded-2xl border border-white/10 bg-[#0a0e0c] p-4 md:grid-cols-[180px_1fr_auto]"><div><div className="text-sm font-medium">{dateLabel(session.session_date)}</div><div className="text-xs text-white/40">{session.start_time || 'Time not set'}</div></div><div><div className="text-sm">{session.session_type || 'Team session'}</div><div className="text-xs text-white/40">{session.status || 'planned'}</div></div><div className="text-xs text-white/50">{counts ? `${counts.present} present · ${counts.absent} absent${counts.other ? ` · ${counts.other} other` : ''}` : 'No attendance recorded'}</div></div>; })}</div> : <Empty title="No attendance sessions" body="Attendance will populate from real team operations; historical attendance is not synthesized." />)}

      {view === 'training' && (runtime.training.plans.length ? <div className="grid gap-4 lg:grid-cols-2">{runtime.training.plans.map((plan) => <div key={plan.id} className="rounded-2xl border border-white/10 bg-[#0a0e0c] p-5"><div className="text-[10px] uppercase tracking-wider text-emerald-300/60">{plan.plan_type || 'training plan'} · {plan.status || 'draft'}</div><div className="mt-2 text-lg font-semibold">{plan.name}</div><div className="mt-3 text-sm text-white/45">{dateLabel(plan.starts_on)} → {dateLabel(plan.ends_on)}</div></div>)}</div> : <Empty title="No training plan exists yet" body="This is a truthful production empty state. AI may propose plans later, but operational plans require coach review." />)}

      {view === 'workouts' && (runtime.training.sessions.length ? <div className="space-y-3">{runtime.training.sessions.map((session) => <div key={session.id} className="rounded-2xl border border-white/10 bg-[#0a0e0c] p-5"><div className="text-[10px] uppercase tracking-wider text-emerald-300/60">{session.session_type || 'workout'}</div><div className="mt-1 font-semibold">{session.title}</div><div className="mt-2 text-sm text-white/45">{session.total_distance ?? '—'} {session.distance_unit || ''} · load {session.total_load ?? '—'}</div></div>)}</div> : <Empty title="No workout sessions exist yet" body="Session design will build from canonical training_sessions and coach_session_blocks, not demo sets." />)}

      {view === 'deployment' && <div className="grid gap-4 lg:grid-cols-3"><Stat label="Scheduled" value={runtime.metrics.scheduledSessions} detail="future attendance sessions" /><Stat label="Workouts" value={runtime.training.sessions.length} detail="training session records" /><Stat label="Attendance" value={runtime.attendance.records.length} detail="athlete evidence records" /><div className="lg:col-span-3"><Empty title="Deployment integrity" body="A workout only counts as deployed when it connects to a real session and can produce execution evidence." /></div></div>}

      {view === 'competition' && (runtime.competitions.length ? <div className="space-y-3">{runtime.competitions.map((competition) => <div key={competition.id} className="grid gap-3 rounded-2xl border border-white/10 bg-[#0a0e0c] p-5 md:grid-cols-[minmax(0,1fr)_180px_120px]"><div><div className="font-semibold">{competition.name}</div><div className="text-xs text-white/40">{competition.competition_type || 'Competition'} · {[competition.city, competition.region].filter(Boolean).join(', ') || 'Location not set'}</div></div><div className="text-sm text-white/55">{dateLabel(competition.starts_at)}</div><div className="text-sm capitalize text-white/55">{competition.status || 'planned'}</div></div>)}</div> : <Empty title="No canonical competitions" body="Competition preparation consumes the canonical competition domain instead of creating Coach-only meet data." />)}

      {view === 'performance' && <Empty title="Performance results are not populated yet" body="Canonical competition results are empty in this environment, so the Coach Hub does not display fabricated PBs, rankings, or trends." />}
      {view === 'development' && <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-3"><Stat label="Athletes" value={runtime.roster.length} detail="development population" /><Stat label="Training" value={runtime.training.sessions.length} detail="session evidence" /><Stat label="Attendance" value={runtime.attendance.records.length} detail="participation evidence" /></div><Empty title="Development is evidence-driven" body="The next layer will connect athlete logs, session modifications, competition outcomes, reflections and coach notes. Until observations exist, LS1 will not invent a development score." /></div>}
      {view === 'deck' && <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-2"><Stat label="Open attention" value={runtime.attention.length} detail="items needing response" /><Stat label="Agent proposals" value={runtime.proposals.length} detail="approval queue" /></div><Empty title="Decision ledger foundation is ready" body="The database already includes coach_decision_log and proposal review fields. Approval actions can write the coach decision and preserve the before/after rationale." /></div>}
    </>}
  </div></div>;
}
