'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, Award, CalendarDays, CheckCircle2, ChevronRight, Flag, RefreshCw, Route, ShieldCheck, Sparkles, Star, Target, Trophy, Users, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';

type Row = Record<string, any>;
type AthletePayload = {
  athlete: Row | null;
  availableBands: Row[];
  sports: Row[];
  teams: Row[];
  results: Row[];
  goals: Row[];
  development: Row[];
  schedule: Row[];
  metrics: Record<string, number>;
  reconciliation: Record<string, number>;
  generatedAt: string;
  source: string;
  projection: string;
  error?: string;
};

type StageConfig = {
  label: string;
  short: string;
  tone: string;
  intro: string;
  focus: string[];
  quests: string[];
};

const STAGES: Record<string, StageConfig> = {
  '5-8': {
    label: 'Ages 5–8', short: 'Foundation', tone: 'Play · learn · belong',
    intro: 'Swimming should feel exciting. This view keeps the athlete experience visual, simple and positive.',
    focus: ['Show up and have fun', 'Learn one skill at a time', 'Celebrate effort and courage'],
    quests: ['Pack my swim gear', 'Try one skill my coach gives me', 'Tell someone one thing I enjoyed'],
  },
  '9-11': {
    label: 'Ages 9–11', short: 'Development', tone: 'Explore · practice · improve',
    intro: 'Athletes begin to understand practice, goals and progress without turning development into a spreadsheet.',
    focus: ['Build consistent habits', 'Understand basic goals', 'Recognize progress'],
    quests: ['Choose today’s focus', 'Complete my practice goal', 'Record one thing I learned'],
  },
  '12-14': {
    label: 'Ages 12–14', short: 'Growth', tone: 'Own · understand · progress',
    intro: 'The athlete gets more ownership: training history, goals, results and development evidence become more visible.',
    focus: ['Own preparation', 'Connect training to performance', 'Build healthy routines'],
    quests: ['Review my goal', 'Prepare for the next session', 'Add a reflection after practice'],
  },
  '15-17': {
    label: 'Ages 15–17', short: 'Performance', tone: 'Prepare · perform · learn',
    intro: 'Performance analysis, trajectory and competition context layer in while the athlete remains protected as a minor.',
    focus: ['Use evidence to improve', 'Prepare independently', 'Understand longer-term trajectory'],
    quests: ['Review my next competition', 'Check my current development goal', 'Capture one performance learning'],
  },
  '18+': {
    label: '18+ / Advanced', short: 'Advanced', tone: 'Analyze · decide · lead',
    intro: 'The complete athlete intelligence experience: longitudinal performance, development, training and competition evidence.',
    focus: ['Own the complete athlete record', 'Use performance evidence', 'Plan long-term development'],
    quests: ['Review current priorities', 'Check performance evidence', 'Set the next development action'],
  },
};

const VIEW_META: Record<string, { title: string; description: string }> = {
  overview: { title: 'My Home', description: 'What matters now, what is next, and how am I progressing?' },
  passport: { title: 'My Athlete Passport', description: 'One athlete identity across teams, sports and seasons.' },
  chronometer: { title: 'My Timeline', description: 'A chronological view of recorded athlete evidence.' },
  journey: { title: 'My Journey', description: 'My development story built from recorded facts.' },
  development: { title: 'My Development', description: 'Goals, assessments and development evidence.' },
  stage: { title: 'My Stage', description: 'What this development stage means and what comes next.' },
  skills: { title: 'My Skills', description: 'Simple development focus without invented skill scores.' },
  goals: { title: 'My Goals', description: 'Recorded goals plus a simple demonstration focus.' },
  achievements: { title: 'Achievements', description: 'Positive milestones derived from real athlete evidence.' },
  trajectory: { title: 'My Trajectory', description: 'Direction over time when enough evidence exists.' },
  performance: { title: 'Performance', description: 'Canonical performance records only.' },
  records: { title: 'Personal Records', description: 'Best canonical performances by event.' },
  standards: { title: 'Time Standards', description: 'Qualification comparisons when standards are connected.' },
  rankings: { title: 'Rankings', description: 'Rank evidence when ranking data is connected.' },
  analysis: { title: 'Competition Analysis', description: 'Competition performance and context.' },
  'training-history': { title: 'Training History', description: 'Recorded athlete training evidence.' },
  habits: { title: 'Training Habits', description: 'Patterns only when sufficient training history exists.' },
  readiness: { title: 'Readiness', description: 'Readiness evidence when the organization records it.' },
  schedule: { title: 'My Schedule', description: 'Upcoming competition entries and obligations.' },
  preparation: { title: 'Meet Preparation', description: 'What is coming and what needs attention.' },
  results: { title: 'My Results', description: 'Canonical result history and source evidence.' },
};

function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-neutral-800 bg-[#090b0b] p-5 ${className}`}>{children}</section>;
}
function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-dashed border-neutral-800 bg-[#0b0d0d] p-5 text-xs leading-5 text-neutral-500">{children}</div>;
}
function Metric({ label, value, detail }: { label: string; value: React.ReactNode; detail: string }) {
  return <div className="rounded-xl border border-neutral-800 bg-[#0d1010] p-4"><div className="text-[8px] font-black uppercase tracking-[.18em] text-neutral-500">{label}</div><div className="mt-2 text-2xl font-black text-white">{value}</div><div className="mt-1 text-[10px] leading-4 text-neutral-500">{detail}</div></div>;
}
function formatTime(value: unknown) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds)) return '—';
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds - minutes * 60;
  return minutes > 0 ? `${minutes}:${remainder.toFixed(2).padStart(5, '0')}` : remainder.toFixed(2);
}

export default function AthleteWorkspace() {
  const router = useRouter();
  const params = useSearchParams();
  const view = params.get('view') ?? 'overview';
  const ageBand = STAGES[params.get('age') ?? '5-8'] ? (params.get('age') ?? '5-8') : '5-8';
  const stage = STAGES[ageBand];
  const [data, setData] = useState<AthletePayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [drawer, setDrawer] = useState<Row | null>(null);
  const [questDone, setQuestDone] = useState<boolean[]>([false, false, false]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/athlete?age=${encodeURIComponent(ageBand)}`, { cache: 'no-store' });
      const payload = (await response.json()) as AthletePayload;
      setData(payload);
      if (!response.ok || payload.error) setError(payload.error ?? 'Athlete data unavailable');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Athlete data unavailable');
    } finally {
      setLoading(false);
    }
  }, [ageBand]);

  useEffect(() => { void load(); const timer = window.setInterval(() => void load(), 30000); return () => window.clearInterval(timer); }, [load]);
  useEffect(() => {
    const key = `ls1-athlete-quest-${ageBand}`;
    try { const stored = window.localStorage.getItem(key); setQuestDone(stored ? JSON.parse(stored) : [false, false, false]); } catch { setQuestDone([false, false, false]); }
  }, [ageBand]);

  const athlete = data?.athlete ?? null;
  const metrics = data?.metrics ?? {};
  const sportsLabel = (data?.sports ?? []).map((sport: Row) => String(sport.name ?? '')).filter(Boolean).join(', ') || 'Swimming';
  const teamsLabel = (data?.teams ?? []).map((team: Row) => String(team.name ?? '')).filter(Boolean).join(', ') || 'No active team';
  const meta = VIEW_META[view] ?? VIEW_META.overview;

  const personalRecords = useMemo<Row[]>(() => {
    const best = new Map<string, Row>();
    for (const result of data?.results ?? []) {
      const key = String(result.event?.code ?? result.event?.name ?? 'event');
      const current = best.get(key);
      if (!current || Number(result.resultValue) < Number(current.resultValue)) best.set(key, result);
    }
    return Array.from(best.values());
  }, [data?.results]);

  function changeBand(nextBand: string) {
    const next = new URLSearchParams(params.toString());
    next.set('age', nextBand);
    next.set('view', 'overview');
    router.push(`/athlete?${next.toString()}`, { scroll: false });
  }

  function toggleQuest(index: number) {
    const next = questDone.map((done, i) => i === index ? !done : done);
    setQuestDone(next);
    try { window.localStorage.setItem(`ls1-athlete-quest-${ageBand}`, JSON.stringify(next)); } catch { /* browser storage unavailable */ }
  }

  const resultList = (data?.results ?? []).length ? <div className="space-y-2">{(data?.results ?? []).map((result: Row) => (
    <button key={String(result.id)} onClick={() => setDrawer({ kind: 'result', ...result })} className="grid w-full gap-2 rounded-xl border border-neutral-800 bg-[#0d1010] p-4 text-left hover:border-neutral-600 sm:grid-cols-[1fr_auto] sm:items-center">
      <div><div className="text-sm font-bold text-white">{String(result.event?.name ?? result.event?.code ?? 'Competition result')}</div><div className="mt-1 text-[10px] text-neutral-500">{String(result.competition ?? 'Competition')} · {String(result.validationStatus ?? result.status ?? 'recorded')}</div></div>
      <div className="text-xl font-black text-white">{formatTime(result.resultValue)}</div>
    </button>
  ))}</div> : <Empty>No canonical performance records are connected for this athlete yet. Historical meet ingestion remains outstanding; no times are invented here.</Empty>;

  const teamCards = (data?.teams ?? []).length ? <div className="space-y-2">{(data?.teams ?? []).map((team: Row) => (
    <button key={String(team.id)} onClick={() => setDrawer({ kind: 'team', ...team })} className="w-full rounded-xl border border-neutral-800 bg-[#0d1010] p-4 text-left hover:border-neutral-600">
      <div className="flex items-center justify-between gap-3"><div><div className="font-bold text-white">{String(team.name)}</div><div className="mt-1 text-xs text-neutral-500">{String(team.organization ?? '')} · {String(team.sport ?? '')}</div></div><ChevronRight className="h-4 w-4 text-neutral-600"/></div>
    </button>
  ))}</div> : <Empty>No active team membership is connected.</Empty>;

  const achievements = [
    { earned: Number(metrics.teams ?? 0) > 0, name: 'Team Member', detail: 'Active canonical team membership' },
    { earned: Number(metrics.goals ?? 0) > 0, name: 'Goal Setter', detail: 'At least one recorded development goal' },
    { earned: Number(metrics.attendanceRecords ?? 0) > 0, name: 'Showed Up', detail: 'Attendance evidence exists' },
    { earned: Number(metrics.officialResults ?? 0) > 0, name: 'Competition Ready', detail: 'Canonical result evidence exists' },
  ];

  function renderOverview() {
    if (ageBand === '5-8') return <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
        <Panel className="overflow-hidden"><div className="flex items-center gap-2 text-[#FA4616]"><Sparkles className="h-5 w-5"/><span className="text-[10px] font-black uppercase tracking-[.2em]">Today’s Quest</span></div><h2 className="mt-3 text-2xl font-black text-white">Three little wins</h2><p className="mt-2 text-sm leading-6 text-neutral-400">Simple demo actions stay in this browser only. They are not written into the canonical athlete record.</p><div className="mt-5 space-y-2">{stage.quests.map((quest, i) => <button key={quest} onClick={() => toggleQuest(i)} className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left ${questDone[i] ? 'border-emerald-800 bg-emerald-950/20' : 'border-neutral-800 bg-[#0d1010]'}`}><span className={`flex h-8 w-8 items-center justify-center rounded-full ${questDone[i] ? 'bg-emerald-500 text-black' : 'bg-neutral-900 text-neutral-500'}`}>{questDone[i] ? <CheckCircle2 className="h-5 w-5"/> : <Star className="h-4 w-4"/>}</span><span className="font-bold text-white">{quest}</span></button>)}</div></Panel>
        <Panel><div className="flex items-center gap-2"><Users className="h-5 w-5 text-[#FA4616]"/><h3 className="font-black text-white">My Team</h3></div><div className="mt-4">{teamCards}</div></Panel>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{achievements.map(item => <div key={item.name} className={`rounded-2xl border p-5 ${item.earned ? 'border-[#FA4616]/50 bg-[#FA4616]/10' : 'border-neutral-800 bg-[#090b0b]'}`}><Award className={`h-6 w-6 ${item.earned ? 'text-[#FA4616]' : 'text-neutral-700'}`}/><div className="mt-3 font-black text-white">{item.name}</div><div className="mt-1 text-xs leading-5 text-neutral-500">{item.detail}</div></div>)}</div>
    </div>;

    return <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Active teams" value={metrics.teams ?? 0} detail="Canonical memberships"/><Metric label="Goals" value={metrics.goals ?? 0} detail="Recorded development goals"/><Metric label="Training records" value={metrics.trainingSessions ?? 0} detail="Connected athlete training logs"/><Metric label="Official results" value={metrics.officialResults ?? 0} detail="Canonical performance evidence"/></div>
      <div className="grid gap-6 xl:grid-cols-[1.1fr_.9fr]"><Panel><div className="flex items-center gap-2"><Target className="h-5 w-5 text-[#FA4616]"/><h3 className="font-black text-white">Current focus</h3></div><div className="mt-4 grid gap-3">{stage.focus.map(item => <div key={item} className="flex items-center gap-3 rounded-xl border border-neutral-800 bg-[#0d1010] p-4"><CheckCircle2 className="h-4 w-4 text-neutral-600"/><span className="text-sm font-bold text-white">{item}</span></div>)}</div></Panel><Panel><div className="flex items-center gap-2"><Users className="h-5 w-5 text-[#FA4616]"/><h3 className="font-black text-white">Current team context</h3></div><div className="mt-4">{teamCards}</div></Panel></div>
      {(ageBand === '15-17' || ageBand === '18+') && <Panel><div className="flex items-center gap-2"><Activity className="h-5 w-5 text-[#FA4616]"/><h3 className="font-black text-white">Recent performance</h3></div><div className="mt-4">{resultList}</div></Panel>}
    </div>;
  }

  function renderView(): React.ReactNode {
    if (view === 'overview') return renderOverview();
    if (view === 'passport') return <div className="grid gap-6 lg:grid-cols-2"><Panel><h3 className="font-black text-white">Athlete identity</h3><div className="mt-4 grid gap-3 sm:grid-cols-2"><Metric label="Demo identity" value={String(athlete?.athleteNumber ?? '—')} detail="Sanitized live-record projection"/><Metric label="Age" value={athlete?.age ?? '—'} detail={stage.label}/><Metric label="Stage" value={String(athlete?.stage ?? stage.short)} detail={stage.tone}/><Metric label="Privacy" value={String(athlete?.privacyLevel ?? '—')} detail="Minor-safe server projection"/></div></Panel><Panel><h3 className="font-black text-white">Associations</h3><div className="mt-4">{teamCards}</div></Panel></div>;
    if (view === 'chronometer' || view === 'journey') return <div className="grid gap-6 xl:grid-cols-[.8fr_1.2fr]"><Panel><div className="flex items-center gap-2"><Route className="h-5 w-5 text-[#FA4616]"/><h3 className="font-black text-white">Journey context</h3></div><div className="mt-4 space-y-3"><Metric label="Stage" value={stage.short} detail={stage.tone}/><Metric label="Teams" value={metrics.teams ?? 0} detail="Active memberships"/><Metric label="Assessments" value={metrics.assessments ?? 0} detail="Recorded development assessments"/></div></Panel><Panel><h3 className="font-black text-white">Recorded timeline</h3><div className="mt-4">{resultList}</div></Panel></div>;
    if (view === 'development' || view === 'goals') return <div className="grid gap-6 lg:grid-cols-2"><Panel><div className="flex items-center gap-2"><Target className="h-5 w-5 text-[#FA4616]"/><h3 className="font-black text-white">Goals</h3></div><div className="mt-4 space-y-2">{(data?.goals ?? []).length ? data!.goals.map((goal: Row) => <button key={String(goal.id)} onClick={() => setDrawer({kind:'goal',...goal})} className="w-full rounded-xl border border-neutral-800 bg-[#0d1010] p-4 text-left hover:border-neutral-600"><div className="font-bold text-white">{String(goal.title)}</div><div className="mt-1 text-xs text-neutral-500">{String(goal.status ?? '')} · due {String(goal.dueOn ?? 'not set')}</div></button>) : <Empty>No canonical development goals are recorded yet. The demonstration quest remains browser-only until athlete-authenticated write workflows are enabled.</Empty>}</div></Panel><Panel><h3 className="font-black text-white">Assessments</h3><div className="mt-4 space-y-2">{(data?.development ?? []).length ? data!.development.map((assessment: Row) => <div key={String(assessment.id)} className="rounded-xl border border-neutral-800 bg-[#0d1010] p-4"><div className="font-bold text-white">{String(assessment.assessmentType)}</div><div className="mt-1 text-xs text-neutral-500">{String(assessment.assessedAt ?? '')}</div></div>) : <Empty>No development assessment has been recorded yet.</Empty>}</div></Panel></div>;
    if (view === 'stage' || view === 'skills') return <div className="grid gap-6 lg:grid-cols-[.9fr_1.1fr]"><Panel><div className="text-[9px] font-black uppercase tracking-[.2em] text-[#FA4616]">{stage.label}</div><h3 className="mt-2 text-2xl font-black text-white">{stage.short}</h3><p className="mt-3 text-sm leading-6 text-neutral-400">{stage.intro}</p></Panel><Panel><h3 className="font-black text-white">What matters now</h3><div className="mt-4 space-y-2">{stage.focus.map(item => <div key={item} className="flex items-center gap-3 rounded-xl border border-neutral-800 bg-[#0d1010] p-4"><Flag className="h-4 w-4 text-[#FA4616]"/><span className="text-sm font-bold text-white">{item}</span></div>)}</div></Panel></div>;
    if (view === 'achievements') return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{achievements.map(item => <Panel key={item.name} className={item.earned ? 'border-[#FA4616]/50' : ''}><Award className={`h-7 w-7 ${item.earned ? 'text-[#FA4616]' : 'text-neutral-700'}`}/><div className="mt-4 font-black text-white">{item.name}</div><div className="mt-1 text-xs leading-5 text-neutral-500">{item.detail}</div><div className="mt-3 text-[9px] font-black uppercase tracking-[.18em] text-neutral-600">{item.earned ? 'Earned from live evidence' : 'Not earned yet'}</div></Panel>)}</div>;
    if (view === 'trajectory' || view === 'performance' || view === 'results' || view === 'analysis') return <Panel><div className="flex items-center gap-2"><Activity className="h-5 w-5 text-[#FA4616]"/><h3 className="font-black text-white">Canonical performance evidence</h3></div><div className="mt-4">{resultList}</div></Panel>;
    if (view === 'records') return <Panel><div className="flex items-center gap-2"><Trophy className="h-5 w-5 text-[#FA4616]"/><h3 className="font-black text-white">Personal records</h3></div><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{personalRecords.length ? personalRecords.map(result => <Metric key={String(result.id)} label={String(result.event?.name ?? result.event?.code ?? 'Event')} value={formatTime(result.resultValue)} detail={String(result.competition ?? 'Canonical result')}/>) : <Empty>No canonical results are connected yet, so no personal records are calculated.</Empty>}</div></Panel>;
    if (view === 'standards' || view === 'rankings') return <Panel><Empty>{meta.title} is intentionally blank until standards/ranking source data is connected. The hub will not manufacture qualification or ranking status.</Empty></Panel>;
    if (view === 'training-history' || view === 'habits' || view === 'readiness') return <div className="grid gap-3 md:grid-cols-3"><Metric label="Training records" value={metrics.trainingSessions ?? 0} detail="Canonical training-athlete logs"/><Metric label="Attendance records" value={metrics.attendanceRecords ?? 0} detail="Recorded attendance evidence"/><Metric label="Derived readiness" value="—" detail="Requires a defined readiness data source"/></div>;
    if (view === 'schedule' || view === 'preparation') return <Panel><div className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-[#FA4616]"/><h3 className="font-black text-white">Upcoming competition</h3></div><div className="mt-4 space-y-2">{(data?.schedule ?? []).length ? data!.schedule.map((entry: Row) => <button key={String(entry.entryId)} onClick={() => setDrawer({kind:'schedule',...entry})} className="w-full rounded-xl border border-neutral-800 bg-[#0d1010] p-4 text-left hover:border-neutral-600"><div className="font-bold text-white">{String(entry.competition?.name ?? 'Competition')}</div><div className="mt-1 text-xs text-neutral-500">{String(entry.event?.name ?? entry.event?.code ?? 'Event')} · {String(entry.entryStatus ?? '')}</div></button>) : <Empty>No athlete-specific upcoming competition entries are connected.</Empty>}</div></Panel>;
    return <Panel><Empty>This athlete surface has no connected domain evidence yet.</Empty></Panel>;
  }

  return <div className="min-h-full w-full bg-[#050707] p-6 lg:p-8">
    <div className="mb-5 flex flex-wrap items-start justify-between gap-4"><div><div className="text-[9px] font-black uppercase tracking-[.25em] text-[#FA4616]">ATHLETE · {stage.label}</div><h1 className="mt-2 text-3xl font-black text-white">{meta.title}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-500">{meta.description}</p></div><button onClick={() => void load()} disabled={loading} className="flex items-center gap-2 rounded-xl border border-neutral-800 px-3 py-2 text-xs text-neutral-300 hover:text-white"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}/>Refresh live data</button></div>

    {error && <Panel className="mb-5 border-red-900/50"><div className="flex gap-3 text-sm text-red-300"><AlertTriangle className="h-5 w-5 shrink-0"/><div>{error}</div></div></Panel>}

    <Panel className="mb-6"><div className="flex flex-wrap items-start justify-between gap-5"><div><div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-400"/><span className="text-[9px] font-black uppercase tracking-[.2em] text-emerald-400">LIVE SANITIZED DEMONSTRATION</span></div><h2 className="mt-2 text-xl font-black text-white">{String(athlete?.name ?? 'Athlete experience')}</h2><div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-neutral-400"><span>{athlete ? `${String(athlete.age)} years` : '—'}</span><span>{sportsLabel}</span><span>{teamsLabel}</span><span>{stage.tone}</span></div></div><div className="flex flex-wrap gap-2">{(data?.availableBands ?? []).map((band: Row) => <button key={String(band.id)} onClick={() => changeBand(String(band.id))} className={`rounded-full border px-3 py-2 text-[10px] font-bold ${String(band.id) === ageBand ? 'border-[#FA4616] bg-[#FA4616]/10 text-white' : 'border-neutral-800 text-neutral-500 hover:text-white'}`}>{String(band.label)} · {String(band.count)}</button>)}</div></div></Panel>

    {renderView()}

    <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="HPAC source rows" value={data?.reconciliation?.stagingRows ?? '—'} detail="Imported roster source rows"/><Metric label="Distinct roster profiles" value={data?.reconciliation?.distinctProfileKeys ?? '—'} detail="Name + birthdate profile keys"/><Metric label="Canonical athletes" value={data?.reconciliation?.canonicalAthletes ?? '—'} detail="Current canonical athlete records"/><Metric label="Duplicate source rows" value={data?.reconciliation?.duplicateProfileRows ?? '—'} detail="Explains 234 source rows → 229 athletes"/></div>

    {drawer && <div className="fixed inset-0 z-50 bg-black/70" onClick={() => setDrawer(null)}><aside className="absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto border-l border-neutral-800 bg-[#090b0b] p-6" onClick={e => e.stopPropagation()}><div className="flex items-center justify-between"><div><div className="text-[9px] font-black uppercase tracking-[.2em] text-[#FA4616]">ATHLETE EVIDENCE</div><h3 className="mt-2 text-xl font-black text-white">{String(drawer.name ?? drawer.title ?? drawer.competition?.name ?? drawer.event?.name ?? 'Record detail')}</h3></div><button onClick={() => setDrawer(null)} className="rounded-lg border border-neutral-800 p-2 text-neutral-400 hover:text-white"><X className="h-4 w-4"/></button></div><div className="mt-6 space-y-3">{Object.entries(drawer).filter(([key,value]) => key !== 'kind' && key !== 'id' && value !== null && value !== undefined && typeof value !== 'object').map(([key,value]) => <div key={key} className="rounded-xl border border-neutral-800 bg-[#0d1010] p-4"><div className="text-[8px] font-black uppercase tracking-[.18em] text-neutral-600">{key.replaceAll(/([A-Z])/g,' $1').replaceAll('_',' ')}</div><div className="mt-2 text-sm font-bold text-white">{String(value)}</div></div>)}</div><div className="mt-6 rounded-xl border border-neutral-800 bg-[#0d1010] p-4 text-xs leading-5 text-neutral-500">This drawer shows only fields returned by the sanitized live Athlete projection. Sensitive roster identity and medical/contact data are deliberately excluded.</div></aside></div>}
  </div>;
}
