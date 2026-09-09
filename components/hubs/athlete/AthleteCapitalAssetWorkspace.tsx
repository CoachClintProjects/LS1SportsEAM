'use client';

import { useCallback, useEffect, useMemo, useState, type ElementType, type ReactNode } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  Activity, Award, BarChart3, BookOpen, CalendarDays, CheckCircle2, ChevronRight,
  ClipboardCheck, FileText, Flag, Gauge, HeartPulse, Medal, MessageCircle, NotebookPen,
  RefreshCw, Settings, ShieldCheck, Sparkles, Star, Target, Trophy, TrendingUp, UserCheck,
  Users, Waves, X,
} from 'lucide-react';

type Row = Record<string, any>;
type Payload = {
  athlete: Row | null;
  availableBands?: Row[];
  sports: Row[];
  teams: Row[];
  results: Row[];
  goals: Row[];
  development: Row[];
  schedule: Row[];
  badges: Row[];
  challenges: Row[];
  recruiting?: { cycles?: Row[]; outreachCount?: number };
  documents: Row[];
  metrics: Record<string, number>;
  error?: string;
};

type StageKey = '9-11' | '12-14' | '15-17' | '18+';
type Stage = {
  name: string;
  promise: string;
  headline: string;
  hero: string;
  accent: string;
  badge: string;
};

const STAGES: Record<StageKey, Stage> = {
  '9-11': {
    name: 'Development',
    promise: 'Explore · practice · improve',
    headline: 'Level up your sport.',
    hero: 'from-cyan-500/25 via-blue-500/10 to-[#080b12]',
    accent: 'text-cyan-300',
    badge: 'border-cyan-400/30 bg-cyan-400/10 text-cyan-200',
  },
  '12-14': {
    name: 'Growth',
    promise: 'Own · understand · progress',
    headline: 'Build your athlete identity.',
    hero: 'from-violet-500/25 via-fuchsia-500/10 to-[#0b0812]',
    accent: 'text-violet-300',
    badge: 'border-violet-400/30 bg-violet-400/10 text-violet-200',
  },
  '15-17': {
    name: 'Performance',
    promise: 'Prepare · perform · be seen',
    headline: 'Turn performance into opportunity.',
    hero: 'from-orange-500/25 via-rose-500/10 to-[#100907]',
    accent: 'text-orange-300',
    badge: 'border-orange-400/30 bg-orange-400/10 text-orange-200',
  },
  '18+': {
    name: 'Advanced',
    promise: 'Analyze · optimize · lead',
    headline: 'Run your performance career.',
    hero: 'from-emerald-500/25 via-teal-500/10 to-[#07100d]',
    accent: 'text-emerald-300',
    badge: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200',
  },
};

const VIEW_TITLES: Record<string, string> = {
  overview: 'Overview', passport: 'Athlete Passport', performance: 'Performance', training: 'Training',
  calendar: 'Calendar', competitions: 'Meets & Entries', development: 'Development', goals: 'Goals',
  journey: 'Athlete Journey', health: 'Health & Readiness', logbook: 'Logbook', documents: 'Documents',
  media: 'Media', recruiting: 'Recruiting', skills: 'Skills', achievements: 'Achievements',
  settings: 'Settings & Customize', feedback: 'Send Feedback',
};

function athleteView(pathname: string) {
  const value = pathname.split('/').filter(Boolean)[1] || 'overview';
  return VIEW_TITLES[value] ? value : 'overview';
}

function swimTime(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  const minutes = Math.floor(n / 60);
  const seconds = n - minutes * 60;
  return minutes ? `${minutes}:${seconds.toFixed(2).padStart(5, '0')}` : seconds.toFixed(2);
}

function dateLabel(value: unknown, includeTime = false) {
  if (!value) return 'Date TBD';
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return 'Date TBD';
  return d.toLocaleString('en-CA', includeTime
    ? { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }
    : { weekday: 'short', month: 'short', day: 'numeric' });
}

function ShellCard({ icon: Icon, eyebrow, title, value, detail, onClick, children, className = '' }: {
  icon: ElementType; eyebrow: string; title: string; value?: ReactNode; detail?: string; onClick?: () => void; children?: ReactNode; className?: string;
}) {
  const content = <>
    <div className="flex items-start justify-between gap-4">
      <div><div className="text-[10px] font-black uppercase tracking-[.18em] text-neutral-500">{eyebrow}</div><div className="mt-1 text-lg font-black text-white">{title}</div></div>
      <div className="rounded-2xl bg-white/5 p-3 text-white"><Icon className="h-5 w-5"/></div>
    </div>
    {value !== undefined && <div className="mt-5 text-3xl font-black text-white">{value}</div>}
    {detail && <div className="mt-2 text-sm leading-6 text-neutral-400">{detail}</div>}
    {children}
    {onClick && <div className="mt-5 flex items-center gap-1 text-xs font-black text-white/70">Explore <ChevronRight className="h-3.5 w-3.5"/></div>}
  </>;
  const classes = `rounded-[1.6rem] border border-white/10 bg-white/[.035] p-5 text-left shadow-[0_20px_80px_rgba(0,0,0,.18)] transition ${onClick ? 'hover:-translate-y-1 hover:border-white/25 hover:bg-white/[.06]' : ''} ${className}`;
  return onClick ? <button type="button" onClick={onClick} className={`w-full ${classes}`}>{content}</button> : <section className={classes}>{content}</section>;
}

function ProgressBar({ value, label }: { value: number; label?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return <div>{label && <div className="mb-2 flex justify-between text-xs font-bold text-neutral-400"><span>{label}</span><span>{Math.round(pct)}%</span></div>}<div className="h-2.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-violet-400 to-orange-400" style={{ width: `${pct}%` }}/></div></div>;
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="rounded-2xl border border-dashed border-white/15 bg-black/20 p-7 text-center"><div className="font-black text-white">{title}</div><div className="mt-2 text-sm leading-6 text-neutral-500">{detail}</div></div>;
}

export default function AthleteCapitalAssetWorkspace() {
  const pathname = usePathname();
  const params = useSearchParams();
  const requested = params.get('age') || '9-11';
  const age = (requested in STAGES ? requested : '9-11') as StageKey;
  const stage = STAGES[age];
  const view = athleteView(pathname);
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [drawer, setDrawer] = useState<Row | null>(null);
  const [selectedSport, setSelectedSport] = useState('');
  const [logbookEnabled, setLogbookEnabled] = useState(true);
  const [diaryEnabled, setDiaryEnabled] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/athlete?age=${encodeURIComponent(age)}`, { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok || payload.error) throw new Error(payload.error || 'Athlete data unavailable');
      setData(payload);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Athlete data unavailable');
    } finally {
      setLoading(false);
    }
  }, [age]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    try {
      const storedLogbook = window.localStorage.getItem('ls1-athlete-logbook');
      const storedDiary = window.localStorage.getItem('ls1-athlete-diary');
      if (storedLogbook !== null) setLogbookEnabled(storedLogbook === 'true');
      if (storedDiary !== null) setDiaryEnabled(storedDiary === 'true');
    } catch { /* browser preference storage is optional */ }
  }, []);
  useEffect(() => { try { window.localStorage.setItem('ls1-athlete-logbook', String(logbookEnabled)); } catch {} }, [logbookEnabled]);
  useEffect(() => { try { window.localStorage.setItem('ls1-athlete-diary', String(diaryEnabled)); } catch {} }, [diaryEnabled]);

  const results = data?.results || [];
  const schedule = data?.schedule || [];
  const goals = data?.goals || [];
  const badges = data?.badges || [];
  const challenges = data?.challenges || [];
  const metrics = data?.metrics || {};
  const sports = data?.sports || [];
  const athlete = data?.athlete;
  const activeGoal = goals.find(goal => String(goal.status || '').toLowerCase() !== 'completed') || goals[0];
  const nextMeet = schedule[0];
  const latest = results[0];

  useEffect(() => {
    if (!selectedSport && sports.length) setSelectedSport(String(sports[0].id || sports[0].code || sports[0].name || 'sport'));
  }, [sports, selectedSport]);

  const pbs = useMemo(() => {
    const best = new Map<string, Row>();
    for (const result of results) {
      const key = String(result.event?.code || result.event?.name || result.id);
      const n = Number(result.resultValue);
      const old = best.get(key);
      if (Number.isFinite(n) && (!old || n < Number(old.resultValue))) best.set(key, result);
    }
    return [...best.values()];
  }, [results]);

  const recentImprovement = useMemo(() => {
    if (results.length < 2) return null;
    const first = Number(results[0]?.resultValue), second = Number(results[1]?.resultValue);
    return Number.isFinite(first) && Number.isFinite(second) ? second - first : null;
  }, [results]);

  if (!data && loading) return <main className="p-8 text-neutral-400">Loading Athlete World…</main>;
  if (!data) return <main className="p-8 text-red-300">{error || 'Athlete data unavailable'}</main>;

  const open = (kind: string, payload: Row = {}) => setDrawer({ kind, ...payload });
  const stageBadge = <span className={`rounded-full border px-3 py-1 text-xs font-black ${stage.badge}`}>{stage.name} · {age}</span>;

  const coachBanner = <button type="button" onClick={() => open('coach-message')} className="w-full overflow-hidden rounded-[1.6rem] border border-sky-400/20 bg-gradient-to-r from-sky-500/20 via-indigo-500/15 to-fuchsia-500/15 p-5 text-left transition hover:border-sky-300/40">
    <div className="flex items-center gap-4"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-400/15 text-sky-200"><MessageCircle className="h-6 w-6"/></div><div className="min-w-0 flex-1"><div className="text-[10px] font-black uppercase tracking-[.18em] text-sky-200">Coach connection</div><div className="mt-1 font-black text-white">No direct coach message is connected yet.</div><div className="mt-1 text-xs text-neutral-300">When coach-to-athlete communication is connected, the newest message will live here.</div></div><ChevronRight className="h-5 w-5 text-white/50"/></div>
  </button>;

  function Overview() {
    if (age === '9-11') return <div className="space-y-5">
      {coachBanner}
      <div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
        <ShellCard icon={Sparkles} eyebrow="My level-up mission" title={challenges[0]?.name || 'Your next challenge'} detail={challenges[0]?.description || 'No challenge is connected yet.'} onClick={() => open('challenge', challenges[0] || {})} className="bg-gradient-to-br from-cyan-500/15 to-blue-500/5"><div className="mt-5"><ProgressBar value={Math.min(100, Number(challenges[0]?.progress || 0) * 20)} label="Mission progress"/></div></ShellCard>
        <ShellCard icon={CalendarDays} eyebrow="Coming up" title={nextMeet?.competition?.name || 'No meet scheduled'} detail={nextMeet ? `${nextMeet.event?.name || nextMeet.event?.code || 'Event'} · ${dateLabel(nextMeet.competition?.startsAt)}` : 'Your next meet will show here.'} onClick={() => open('schedule', { items: schedule })} className="bg-gradient-to-br from-violet-500/15 to-fuchsia-500/5"/>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ShellCard icon={Medal} eyebrow="Achievements" title="My collection" value={badges.length} detail="Earned achievements from recorded evidence." onClick={() => open('badges', { items: badges })}/>
        <ShellCard icon={Trophy} eyebrow="Fastest swims" title={pbs[0]?.event?.name || 'Personal bests'} value={pbs[0] ? swimTime(pbs[0].resultValue) : '—'} detail={`${pbs.length} event bests`} onClick={() => open('pbs', { items: pbs })}/>
        <ShellCard icon={Target} eyebrow="My goal" title={activeGoal?.title || 'No goal yet'} detail={activeGoal?.description || 'A development goal can be added when athlete self-service is authorized.'} onClick={() => open('goal', activeGoal || {})}/>
        <ShellCard icon={Users} eyebrow="My team" title={data.teams?.[0]?.name || 'Team'} detail={data.teams?.[0]?.organization || 'No active team connected'} onClick={() => open('team', data.teams?.[0] || {})}/>
      </div>
    </div>;

    if (age === '12-14') return <div className="space-y-5">
      {coachBanner}
      <div className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
        <ShellCard icon={TrendingUp} eyebrow="My performance journey" title={pbs[0]?.event?.name || 'Build your PB board'} value={pbs[0] ? swimTime(pbs[0].resultValue) : '—'} detail={recentImprovement !== null ? `${Math.abs(recentImprovement).toFixed(2)}s ${recentImprovement > 0 ? 'faster than the previous recorded swim' : 'change from previous recorded swim'}` : 'Your verified race history becomes your personal progression story.'} onClick={() => open('performance-history', { items: results, pbs })} className="bg-gradient-to-br from-violet-500/20 via-fuchsia-500/8 to-transparent"/>
        <ShellCard icon={Flag} eyebrow="Qualification chase" title="Next standard" value="—" detail="No verified standards comparison is connected yet. LS1 will not invent the gap." onClick={() => open('standards')}/>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ShellCard icon={CalendarDays} eyebrow="Next meet" title={nextMeet?.competition?.name || 'No meet scheduled'} detail={nextMeet ? dateLabel(nextMeet.competition?.startsAt, true) : 'Meet calendar is empty.'} onClick={() => open('schedule', { items: schedule })}/>
        <ShellCard icon={ClipboardCheck} eyebrow="My entries" title={`${schedule.length} upcoming`} detail="See entered events now; athlete event-request workflow will be permission-aware." onClick={() => open('entries', { items: schedule })}/>
        <ShellCard icon={Target} eyebrow="Goal ownership" title={activeGoal?.title || 'No active goal'} detail={activeGoal?.description || 'Set the next performance target when self-service is enabled.'} onClick={() => open('goal', activeGoal || {})}/>
        <ShellCard icon={NotebookPen} eyebrow="My logbook" title={logbookEnabled ? 'Logbook on' : 'Logbook off'} detail="Training and race reflections become part of your development story." onClick={() => open('logbook-settings')}/>
      </div>
    </div>;

    if (age === '15-17') return <div className="space-y-5">
      {coachBanner}
      <div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
        <ShellCard icon={Gauge} eyebrow="Performance cockpit" title={pbs[0]?.event?.name || 'Performance board'} value={pbs[0] ? swimTime(pbs[0].resultValue) : '—'} detail={`${metrics.officialResults || results.length} verified result records · ${pbs.length} event bests`} onClick={() => open('performance-history', { items: results, pbs })} className="bg-gradient-to-br from-orange-500/20 via-rose-500/8 to-transparent"/>
        <ShellCard icon={UserCheck} eyebrow="Recruiting" title={data.recruiting?.cycles?.[0]?.name || 'Recruiting Passport'} value={`${data.recruiting?.outreachCount || 0} outreach`} detail="Recruiting is part of the Performance overview—not buried in a menu." onClick={() => open('recruiting', { ...(data.recruiting || {}) })} className="bg-gradient-to-br from-fuchsia-500/15 to-violet-500/5"/>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ShellCard icon={Flag} eyebrow="Qualification" title="Standards & eligibility" value="—" detail="Verified standard matching is not connected yet." onClick={() => open('standards')}/>
        <ShellCard icon={Trophy} eyebrow="Rankings" title="Where I stand" value={latest?.rank ? `#${latest.rank}` : '—'} detail={latest?.rank ? 'Latest competition placing; not a regional ranking.' : 'Ranking engine is not connected yet.'} onClick={() => open('rankings')}/>
        <ShellCard icon={CalendarDays} eyebrow="Next meet" title={nextMeet?.competition?.name || 'No meet scheduled'} detail={nextMeet ? `${nextMeet.event?.name || 'Event'} · ${dateLabel(nextMeet.competition?.startsAt)}` : 'Nothing upcoming.'} onClick={() => open('entries', { items: schedule })}/>
        <ShellCard icon={Activity} eyebrow="Training evidence" title={`${metrics.trainingSessions || 0} sessions`} detail={`${metrics.attendanceRecords || 0} attendance records`} onClick={() => open('training', { metrics })}/>
      </div>
    </div>;

    return <div className="space-y-5">
      {coachBanner}
      <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
        <ShellCard icon={BarChart3} eyebrow="Season performance" title="Performance trajectory" value={pbs[0] ? swimTime(pbs[0].resultValue) : '—'} detail={`${pbs.length} event bests · ${metrics.officialResults || results.length} verified results`} onClick={() => open('performance-history', { items: results, pbs })} className="bg-gradient-to-br from-emerald-500/20 via-teal-500/8 to-transparent"/>
        <ShellCard icon={ShieldCheck} eyebrow="Athlete capital asset" title="My Athlete Passport" value={`${data.teams?.length || 0} team${data.teams?.length === 1 ? '' : 's'}`} detail="Identity, sport, results, documents and development history remain attached to one athlete record." onClick={() => open('passport', { athlete, sports, teams: data.teams })}/>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ShellCard icon={Flag} eyebrow="Competition strategy" title={nextMeet?.competition?.name || 'Season calendar'} detail={nextMeet ? dateLabel(nextMeet.competition?.startsAt, true) : 'No upcoming meet.'} onClick={() => open('entries', { items: schedule })}/>
        <ShellCard icon={Gauge} eyebrow="Optimization" title="Standards & targets" value="—" detail="No verified standards comparison connected yet." onClick={() => open('standards')}/>
        <ShellCard icon={Activity} eyebrow="Training system" title={`${metrics.trainingSessions || 0} sessions`} detail={`${metrics.assessments || 0} assessments · ${metrics.attendanceRecords || 0} attendance`} onClick={() => open('training', { metrics })}/>
        <ShellCard icon={UserCheck} eyebrow="Career & recruiting" title={data.recruiting?.cycles?.[0]?.name || 'Career record'} detail={`${data.recruiting?.outreachCount || 0} recorded outreach actions`} onClick={() => open('recruiting', { ...(data.recruiting || {}) })}/>
      </div>
    </div>;
  }

  function CalendarView() {
    return <div className="space-y-5"><ShellCard icon={CalendarDays} eyebrow="Athlete calendar" title="What’s coming" detail="Your connected meet entries are shown below. Practices and training sessions will appear as their schedules are connected."><div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{schedule.length ? schedule.map((item, index) => <button type="button" key={item.entryId || index} onClick={() => open('race', item)} className="rounded-2xl border border-white/10 bg-black/20 p-4 text-left hover:border-white/25"><div className="text-xs font-black uppercase tracking-wider text-neutral-500">{dateLabel(item.competition?.startsAt)}</div><div className="mt-2 font-black text-white">{item.competition?.name || 'Competition'}</div><div className="mt-1 text-sm text-neutral-400">{item.event?.name || item.event?.code || 'Event'}</div></button>) : <div className="sm:col-span-2 xl:col-span-3"><EmptyState title="No scheduled events" detail="No athlete-specific competition entries are connected right now."/></div>}</div></ShellCard></div>;
  }

  function CompetitionView() {
    return <div className="space-y-5"><div className="grid gap-4 lg:grid-cols-3"><ShellCard icon={ClipboardCheck} eyebrow="Upcoming entries" title="Entered events" value={schedule.length} detail="These are canonical upcoming competition entries."/><ShellCard icon={CheckCircle2} eyebrow="Eligibility" title="Eligible events" value="—" detail="Eligibility calculation is not connected yet; no eligible event is being guessed."/><ShellCard icon={Trophy} eyebrow="Race intelligence" title="PBs available" value={pbs.length} detail="Use PBs and verified standards to make entry decisions once eligibility is connected."/></div><ShellCard icon={Flag} eyebrow="Meets" title="My upcoming race days"><div className="mt-5 space-y-3">{schedule.length ? schedule.map((item, index) => <button type="button" key={item.entryId || index} onClick={() => open('entry', item)} className="flex w-full items-center gap-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-left hover:border-white/25"><div className="rounded-xl bg-orange-400/10 p-3 text-orange-300"><Flag className="h-5 w-5"/></div><div className="min-w-0 flex-1"><div className="font-black text-white">{item.competition?.name || 'Competition'}</div><div className="mt-1 text-sm text-neutral-400">{item.event?.name || item.event?.code || 'Event'} · {dateLabel(item.competition?.startsAt)}</div></div><span className="rounded-full border border-white/10 px-3 py-1 text-xs font-black text-neutral-300">{item.entryStatus || 'entered'}</span></button>) : <EmptyState title="No upcoming entries" detail="There are no competition entries connected for this athlete."/>}</div></ShellCard></div>;
  }

  function ResultsView() {
    return <div className="space-y-5"><div className="grid gap-4 lg:grid-cols-3"><ShellCard icon={Trophy} eyebrow="Personal bests" title="PB board" value={pbs.length} detail="Fastest canonical result per event."/><ShellCard icon={Activity} eyebrow="Race history" title="Verified results" value={results.length} detail="Canonical competition results in this Athlete projection."/><ShellCard icon={TrendingUp} eyebrow="Latest movement" title="Progress" value={recentImprovement === null ? '—' : `${Math.abs(recentImprovement).toFixed(2)}s`} detail="Simple latest-result comparison; event-matched progression charts are next."/></div><ShellCard icon={BarChart3} eyebrow="Times" title="My fastest swims"><div className="mt-5 grid gap-3 md:grid-cols-2">{pbs.length ? pbs.map((result, index) => <button type="button" key={result.id || index} onClick={() => open('result', result)} className="rounded-2xl border border-white/10 bg-black/20 p-4 text-left hover:border-white/25"><div className="flex justify-between gap-4"><div><div className="font-black text-white">{result.event?.name || result.event?.code || 'Event'}</div><div className="mt-1 text-xs text-neutral-500">{result.competition || 'Competition'} · {dateLabel(result.recordedAt)}</div></div><div className="text-2xl font-black text-white">{swimTime(result.resultValue)}</div></div></button>) : <div className="md:col-span-2"><EmptyState title="No PBs yet" detail="No canonical results are connected for this athlete."/></div>}</div></ShellCard></div>;
  }

  function GoalsView() {
    return <div className="space-y-5"><ShellCard icon={Target} eyebrow="Goal board" title="What am I chasing?"><div className="mt-5 grid gap-3 md:grid-cols-2">{goals.length ? goals.map(goal => <button type="button" key={goal.id} onClick={() => open('goal', goal)} className="rounded-2xl border border-white/10 bg-black/20 p-4 text-left hover:border-white/25"><div className="font-black text-white">{goal.title}</div><div className="mt-2 text-sm text-neutral-400">{goal.description || 'No description'}</div><div className="mt-3 text-xs font-black uppercase tracking-wider text-neutral-500">{goal.status || 'open'}{goal.dueOn ? ` · due ${goal.dueOn}` : ''}</div></button>) : <div className="md:col-span-2"><EmptyState title="No goals yet" detail="Goal writeback exists in the prototype, but authenticated athlete authorization must be completed before we expose it as safe self-service."/></div>}</div></ShellCard></div>;
  }

  function LogbookView() {
    return <div className="space-y-5"><div className="grid gap-4 lg:grid-cols-2"><ShellCard icon={NotebookPen} eyebrow="Athlete logbook" title={logbookEnabled ? 'Logbook is on' : 'Logbook is off'} detail="Sport-focused training and race reflections. The browser preference is real; canonical athlete writeback remains gated until self-service authorization is complete." onClick={() => setLogbookEnabled(value => !value)}/><ShellCard icon={BookOpen} eyebrow="Personal diary" title={diaryEnabled ? 'Diary preference on' : 'Diary preference off'} detail="Private journaling needs explicit visibility and guardian/privacy rules before LS1 stores entries." onClick={() => setDiaryEnabled(value => !value)}/></div>{logbookEnabled && <ShellCard icon={NotebookPen} eyebrow="Reflection" title="Add a training or race note" detail="Entry submission is intentionally disabled until authenticated athlete ownership is enforced."><textarea disabled placeholder="Logbook writeback will activate after Athlete self-service security is certified." className="mt-5 min-h-40 w-full rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-neutral-500 outline-none"/></ShellCard>}</div>;
  }

  function RecruitingView() {
    const cycles = data.recruiting?.cycles || [];
    return <div className="space-y-5"><div className="grid gap-4 lg:grid-cols-3"><ShellCard icon={UserCheck} eyebrow="Recruiting passport" title="Active cycles" value={cycles.length} detail="Recruiting cycles connected to this athlete."/><ShellCard icon={MessageCircle} eyebrow="Outreach" title="Recorded actions" value={data.recruiting?.outreachCount || 0} detail="Only recorded outreach is counted."/><ShellCard icon={ShieldCheck} eyebrow="Verified evidence" title="Athlete record" value={`${results.length} results`} detail="Recruiting should pull from verified Athlete evidence, not duplicated profile claims."/></div><ShellCard icon={UserCheck} eyebrow="Opportunity" title="My recruiting activity"><div className="mt-5 space-y-3">{cycles.length ? cycles.map(cycle => <button type="button" key={cycle.id} onClick={() => open('recruiting-cycle', cycle)} className="w-full rounded-2xl border border-white/10 bg-black/20 p-4 text-left hover:border-white/25"><div className="font-black text-white">{cycle.name || 'Recruiting cycle'}</div><div className="mt-1 text-sm text-neutral-400">{cycle.status || 'Status not set'}</div></button>) : <EmptyState title="No recruiting cycle" detail="No recruiting cycle is connected to this athlete yet."/>}</div></ShellCard></div>;
  }

  function GenericView() {
    if (view === 'calendar') return <CalendarView/>;
    if (view === 'competitions') return <CompetitionView/>;
    if (view === 'performance' || view === 'development' || view === 'journey' || view === 'skills') return <ResultsView/>;
    if (view === 'goals') return <GoalsView/>;
    if (view === 'logbook') return <LogbookView/>;
    if (view === 'recruiting') return <RecruitingView/>;
    if (view === 'achievements') return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{badges.length ? badges.map(badge => <ShellCard key={badge.id} icon={Award} eyebrow="Achievement" title={badge.name || 'Achievement'} detail={badge.description || (badge.awardedAt ? `Earned ${dateLabel(badge.awardedAt)}` : 'Recorded achievement')} onClick={() => open('badge', badge)}/>) : <div className="md:col-span-2 xl:col-span-3"><EmptyState title="No achievements yet" detail="Achievements appear only when supported by recorded evidence."/></div>}</div>;
    if (view === 'documents') return <div className="space-y-4">{data.documents?.length ? data.documents.map(document => <ShellCard key={document.id} icon={FileText} eyebrow="Athlete vault" title={document.title || 'Document'} detail={`${document.classification || 'restricted'} · ${document.verificationStatus || 'unverified'}`} onClick={() => open('document', document)}/>) : <EmptyState title="No documents" detail="No athlete documents are connected."/>}</div>;
    if (view === 'training') return <div className="grid gap-4 md:grid-cols-3"><ShellCard icon={Activity} eyebrow="Training" title="Sessions" value={metrics.trainingSessions || 0}/><ShellCard icon={CheckCircle2} eyebrow="Attendance" title="Records" value={metrics.attendanceRecords || 0}/><ShellCard icon={BarChart3} eyebrow="Development" title="Assessments" value={metrics.assessments || 0}/></div>;
    if (view === 'passport') return <div className="grid gap-4 md:grid-cols-2"><ShellCard icon={ShieldCheck} eyebrow="Canonical athlete" title={athlete?.name || 'Athlete'} detail={`Athlete record · ${athlete?.stage || stage.name}`}/><ShellCard icon={Waves} eyebrow="Sports" title="My sports" value={sports.length} detail={sports.map(s => s.name).filter(Boolean).join(' · ') || 'No sport connected'}/><ShellCard icon={Users} eyebrow="Teams" title="Current memberships" value={data.teams?.length || 0}/><ShellCard icon={Trophy} eyebrow="Evidence" title="Verified results" value={results.length}/></div>;
    if (view === 'health') return <div className="grid gap-4 md:grid-cols-2"><ShellCard icon={HeartPulse} eyebrow="Health & readiness" title="Readiness data" value="—" detail="No athlete readiness signal is connected to this projection; LS1 is not fabricating one."/><ShellCard icon={ShieldCheck} eyebrow="Privacy" title="Protected athlete information" detail="Health information requires explicit permissions and visibility rules."/></div>;
    if (view === 'media') return <EmptyState title="No athlete media connected" detail="Media should be evidence-backed and permission-aware, especially for minors."/>;
    if (view === 'settings') return <div className="space-y-4"><ShellCard icon={Settings} eyebrow="Customize" title="My Athlete Hub" detail="These two display preferences persist in this browser while the canonical Athlete Preferences service is being connected."><div className="mt-5 space-y-3"><button type="button" onClick={() => setLogbookEnabled(v => !v)} className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-black/20 p-4 text-left"><div><div className="font-black text-white">Athlete logbook</div><div className="mt-1 text-xs text-neutral-500">Training and race reflections</div></div><span className={`rounded-full px-3 py-1 text-xs font-black ${logbookEnabled ? 'bg-emerald-400/15 text-emerald-300' : 'bg-white/5 text-neutral-500'}`}>{logbookEnabled ? 'ON' : 'OFF'}</span></button><button type="button" onClick={() => setDiaryEnabled(v => !v)} className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-black/20 p-4 text-left"><div><div className="font-black text-white">Personal diary</div><div className="mt-1 text-xs text-neutral-500">Preference only; storage remains disabled pending privacy rules</div></div><span className={`rounded-full px-3 py-1 text-xs font-black ${diaryEnabled ? 'bg-violet-400/15 text-violet-300' : 'bg-white/5 text-neutral-500'}`}>{diaryEnabled ? 'ON' : 'OFF'}</span></button></div></ShellCard></div>;
    if (view === 'feedback') return <ShellCard icon={MessageCircle} eyebrow="Athlete voice" title="Help build LS1" detail="We want real athlete feedback by age and sport. Submission storage is not connected yet, so this form will not pretend to send anything."><textarea disabled placeholder="Feedback submission will activate when the Athlete feedback endpoint is connected." className="mt-5 min-h-40 w-full rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-neutral-500"/></ShellCard>;
    return <Overview/>;
  }

  return <main className="mx-auto max-w-[1600px] space-y-5 p-4 lg:p-7">
    <section className={`overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br ${stage.hero} p-6 lg:p-8`}>
      <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
        <div>{stageBadge}<div className="mt-4 text-xs font-black uppercase tracking-[.22em] text-white/50">Athlete capital asset · {stage.promise}</div><h1 className="mt-2 text-3xl font-black text-white lg:text-5xl">{view === 'overview' ? stage.headline : VIEW_TITLES[view]}</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-300">{view === 'overview' ? 'Everything here should help you understand what happened, what is next, and what you can do about it.' : `Your ${VIEW_TITLES[view].toLowerCase()} stays connected to the same canonical Athlete record.`}</p></div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3"><span className="mr-3 text-[10px] font-black uppercase tracking-wider text-neutral-500">Sport</span><select value={selectedSport} onChange={event => setSelectedSport(event.target.value)} className="bg-transparent text-sm font-black text-white outline-none">{sports.length ? sports.map((sport, index) => <option key={sport.id || index} value={String(sport.id || sport.code || sport.name || index)} className="bg-neutral-950">{sport.name || sport.code || `Sport ${index + 1}`}</option>) : <option value="" className="bg-neutral-950">No sport connected</option>}</select></label>
          <button type="button" onClick={() => void load()} className="rounded-2xl border border-white/10 bg-black/25 p-4 text-white/70" aria-label="Refresh Athlete Hub"><RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`}/></button>
        </div>
      </div>
    </section>
    {error && <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>}
    <GenericView/>
    {drawer && <div className="fixed inset-0 z-[90] bg-black/75 backdrop-blur-sm" onClick={() => setDrawer(null)}><aside className="absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto border-l border-white/10 bg-[#080a0d] p-6" onClick={event => event.stopPropagation()}><div className="flex items-start justify-between gap-4"><div><div className={`text-[10px] font-black uppercase tracking-[.18em] ${stage.accent}`}>{stage.name} Athlete</div><h2 className="mt-2 text-2xl font-black capitalize text-white">{String(drawer.kind || 'detail').replaceAll('-', ' ')}</h2></div><button type="button" onClick={() => setDrawer(null)} className="rounded-xl border border-white/10 p-2 text-neutral-400"><X className="h-5 w-5"/></button></div><div className="mt-6 space-y-3">{Array.isArray(drawer.items) ? drawer.items.length ? drawer.items.map((item: Row, index: number) => <div key={item.id || item.entryId || index} className="rounded-2xl border border-white/10 bg-white/[.035] p-4"><div className="font-black text-white">{item.competition?.name || item.name || item.title || item.event?.name || `Record ${index + 1}`}</div><div className="mt-1 text-sm text-neutral-400">{item.event?.name || item.event?.code || item.description || item.status || item.entryStatus || ''}</div>{item.resultValue !== undefined && <div className="mt-3 text-2xl font-black text-white">{swimTime(item.resultValue)}</div>}{item.competition?.startsAt && <div className="mt-2 text-xs font-bold text-neutral-500">{dateLabel(item.competition.startsAt, true)}</div>}</div>) : <EmptyState title="Nothing connected yet" detail="This Athlete record has no data for this view."/> : <div className="rounded-2xl border border-white/10 bg-white/[.035] p-5"><div className="text-xl font-black text-white">{drawer.competition?.name || drawer.name || drawer.title || drawer.event?.name || 'Athlete detail'}</div><div className="mt-2 text-sm leading-6 text-neutral-400">{drawer.event?.name || drawer.event?.code || drawer.description || drawer.status || (drawer.kind === 'coach-message' ? 'Coach-to-athlete messages are not yet part of the Athlete projection.' : 'No additional connected detail.')}</div>{drawer.resultValue !== undefined && <div className="mt-4 text-3xl font-black text-white">{swimTime(drawer.resultValue)}</div>}</div>}</div></aside></div>}
  </main>;
}
