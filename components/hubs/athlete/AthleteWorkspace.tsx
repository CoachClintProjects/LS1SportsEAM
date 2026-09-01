'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, Award, CalendarDays, RefreshCw, Route, Target, Trophy, Users } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';

type Row = Record<string, any>;
type AthletePayload = {
  availableAthletes: Row[];
  athlete: Row | null;
  sports: Row[];
  teams: Row[];
  results: Row[];
  goals: Row[];
  development: Row[];
  metrics: Record<string, number>;
  generatedAt: string;
  source: string;
  projection: string;
  error?: string;
};

const VIEW_META: Record<string, { title: string; description: string }> = {
  overview: { title: 'Overview', description: 'What am I doing, how am I progressing, and what is next?' },
  passport: { title: 'Athlete Passport', description: 'One longitudinal athlete identity across sports, teams and organizations.' },
  chronometer: { title: 'Chronometer', description: 'A chronological lens across membership, development and performance.' },
  journey: { title: 'Athlete Journey', description: 'The athlete story built only from recorded evidence.' },
  development: { title: 'Development', description: 'Goals, assessments and longitudinal development evidence.' },
  stage: { title: 'Development Stage', description: 'Progressive experience context without creating a second athlete record.' },
  skills: { title: 'Skills', description: 'Skill evidence and development signals.' },
  goals: { title: 'Goals', description: 'Recorded development goals and their current status.' },
  trajectory: { title: 'Trajectory', description: 'Performance and development direction over time.' },
  performance: { title: 'Performance', description: 'Measured performance records from canonical sources.' },
  records: { title: 'Personal Records', description: 'Best known performances by event and course.' },
  standards: { title: 'Time Standards', description: 'Qualification and standard comparisons when standard data is connected.' },
  rankings: { title: 'Rankings', description: 'Rank and comparison evidence when ranking data is connected.' },
  analysis: { title: 'Competition Analysis', description: 'Competition-level performance evidence and context.' },
  'training-history': { title: 'Training History', description: 'Recorded athlete training activity.' },
  habits: { title: 'Training Habits', description: 'Patterns derived from recorded training evidence.' },
  readiness: { title: 'Readiness', description: 'Readiness and recovery signals when recorded.' },
  schedule: { title: 'Schedule', description: 'Upcoming athlete competition and calendar obligations.' },
  preparation: { title: 'Meet Preparation', description: 'Entries, preparation and decisions for upcoming competition.' },
  results: { title: 'Results', description: 'Canonical result history and source evidence.' },
};
const STAGES = ['Foundation', 'Development', 'Performance', 'Elite'];

function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-neutral-800 bg-[#090b0b] p-5 ${className}`}>{children}</section>;
}
function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-dashed border-neutral-800 bg-[#0b0d0d] p-5 text-xs leading-5 text-neutral-500">{children}</div>;
}
function Metric({ label, value, detail }: { label: string; value: React.ReactNode; detail: string }) {
  return <div className="rounded-xl border border-neutral-800 bg-[#0d1010] p-4"><div className="text-[8px] font-black uppercase tracking-[.18em] text-neutral-500">{label}</div><div className="mt-2 text-2xl font-black text-white">{value}</div><div className="mt-1 text-[10px] text-neutral-500">{detail}</div></div>;
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
  const athleteParam = params.get('athlete');
  const [data, setData] = useState<AthletePayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [experience, setExperience] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const suffix = athleteParam ? `?athlete=${encodeURIComponent(athleteParam)}` : '';
      const response = await fetch(`/api/athlete${suffix}`, { cache: 'no-store' });
      const payload = (await response.json()) as AthletePayload;
      setData(payload);
    } finally {
      setLoading(false);
    }
  }, [athleteParam]);

  useEffect(() => { void load(); const timer = window.setInterval(() => void load(), 20000); return () => window.clearInterval(timer); }, [load]);
  useEffect(() => { const stage = data?.athlete?.stage as string | undefined; if (stage && !experience) setExperience(stage); }, [data, experience]);

  const athlete = data?.athlete ?? null;
  const metrics: Record<string, number> = data?.metrics ?? {};
  const sportsLabel = (data?.sports ?? []).map((sport: Row) => String(sport.name ?? '')).filter(Boolean).join(', ') || 'No sport context';
  const teamsLabel = (data?.teams ?? []).map((team: Row) => String(team.name ?? '')).filter(Boolean).join(', ') || 'No team context';
  const meta = VIEW_META[view] ?? { title: 'Athlete', description: 'Living athlete passport.' };

  const personalRecords = useMemo<Row[]>(() => {
    const best = new Map<string, Row>();
    for (const result of data?.results ?? []) {
      const key = `${String(result.event_code ?? '')}|${String(result.course_code ?? '')}`;
      const current = best.get(key);
      if (!current || Number(result.result_value) < Number(current.result_value)) best.set(key, result);
    }
    return Array.from(best.values());
  }, [data]);

  function selectAthlete(athleteNumber: string) {
    const next = new URLSearchParams(params.toString());
    next.set('athlete', athleteNumber);
    next.set('view', view);
    router.push(`/athlete?${next.toString()}`, { scroll: false });
  }

  const resultList = (data?.results ?? []).length > 0 ? (
    <div className="space-y-2">{(data?.results ?? []).map((result: Row) => <div key={String(result.id)} className="grid gap-2 rounded-xl border border-neutral-800 bg-[#0d1010] p-4 sm:grid-cols-[1fr_auto] sm:items-center"><div><div className="text-sm font-bold text-white">{String(result.context?.distance ?? '')}{String(result.course_code ?? '')} {String(result.context?.stroke ?? result.event_code ?? '')}</div><div className="mt-1 text-[10px] text-neutral-500">{String(result.competition ?? result.context?.meet_name ?? 'Competition source')} · {result.is_official ? 'official' : 'unverified'}</div></div><div className="text-xl font-black text-white">{formatTime(result.result_value)}</div></div>)}</div>
  ) : <Empty>No canonical performance records are connected for this athlete yet.</Empty>;

  function renderView(): React.ReactNode {
    if (view === 'overview') return <><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Teams" value={metrics.teams ?? 0} detail="Active canonical memberships"/><Metric label="Official results" value={metrics.officialResults ?? 0} detail="Validated performance records"/><Metric label="Goals" value={metrics.goals ?? 0} detail="Recorded development goals"/><Metric label="Quality issues" value={metrics.dataQualityIssues ?? 0} detail="Open identity/data exceptions"/></div><div className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]"><Panel><div className="flex items-center gap-2"><Trophy className="h-4 w-4 text-[#FA4616]"/><h3 className="font-black text-white">Recent results</h3></div><div className="mt-4">{resultList}</div></Panel><Panel><div className="flex items-center gap-2"><Users className="h-4 w-4 text-[#FA4616]"/><h3 className="font-black text-white">Current context</h3></div><div className="mt-4 space-y-3">{(data?.teams ?? []).map((team: Row) => <div key={String(team.id)} className="rounded-xl border border-neutral-800 bg-[#0d1010] p-4"><div className="font-bold text-white">{String(team.name)}</div><div className="mt-1 text-xs text-neutral-500">{String(team.organization ?? '')} · {String(team.program ?? '')} · {String(team.season ?? '')}</div></div>)}</div></Panel></div></>;
    if (view === 'passport') return <div className="grid gap-6 lg:grid-cols-2"><Panel><h3 className="font-black text-white">Canonical identity</h3><div className="mt-4 grid gap-3 sm:grid-cols-2"><Metric label="Athlete ID" value={String(athlete?.athleteNumber ?? '—')} detail="Stable athlete-facing identifier"/><Metric label="Status" value={String(athlete?.status ?? '—')} detail="Canonical athlete status"/><Metric label="Stage" value={String(athlete?.stage ?? '—')} detail="Derived experience stage"/><Metric label="Sports" value={(data?.sports ?? []).length} detail={sportsLabel}/></div></Panel><Panel><h3 className="font-black text-white">Associations</h3><div className="mt-4 space-y-3">{(data?.teams ?? []).map((team: Row) => <div key={String(team.id)} className="rounded-xl border border-neutral-800 bg-[#0d1010] p-4"><div className="font-bold text-white">{String(team.name)}</div><div className="mt-1 text-xs text-neutral-500">{String(team.organization ?? '')} · {String(team.program ?? '')} · {String(team.season ?? '')}</div></div>)}</div></Panel></div>;
    if (view === 'chronometer' || view === 'journey') return <Panel><div className="flex items-center gap-2"><Route className="h-4 w-4 text-[#FA4616]"/><h3 className="font-black text-white">Recorded timeline</h3></div><div className="mt-4">{resultList}</div></Panel>;
    if (view === 'development' || view === 'goals') return <div className="grid gap-6 lg:grid-cols-2"><Panel><div className="flex items-center gap-2"><Target className="h-4 w-4 text-[#FA4616]"/><h3 className="font-black text-white">Goals</h3></div><div className="mt-4 space-y-2">{(data?.goals ?? []).length ? (data?.goals ?? []).map((goal: Row) => <div key={String(goal.id)} className="rounded-xl border border-neutral-800 bg-[#0d1010] p-4"><div className="font-bold text-white">{String(goal.title)}</div><div className="mt-1 text-xs text-neutral-500">{String(goal.status ?? '')} · due {String(goal.due_on ?? 'not set')}</div></div>) : <Empty>No development goals have been recorded for this athlete.</Empty>}</div></Panel><Panel><h3 className="font-black text-white">Assessments</h3><div className="mt-4">{(data?.development ?? []).length ? (data?.development ?? []).map((assessment: Row) => <div key={String(assessment.id)} className="mb-2 rounded-xl border border-neutral-800 bg-[#0d1010] p-4"><div className="font-bold text-white">{String(assessment.assessment_type)}</div><div className="mt-1 text-xs text-neutral-500">{String(assessment.assessed_at ?? '')}</div></div>) : <Empty>No development assessment has been recorded yet.</Empty>}</div></Panel></div>;
    if (view === 'stage') return <Panel><div className="grid gap-3 md:grid-cols-4">{STAGES.map((stage) => <div key={stage} className={`rounded-xl border p-5 ${athlete?.stage === stage ? 'border-[#FA4616] bg-[#FA4616]/10' : 'border-neutral-800 bg-[#0d1010]'}`}><div className="text-sm font-black text-white">{stage}</div></div>)}</div></Panel>;
    if (view === 'skills') return <Panel><Empty>Skill-specific evidence has not yet been recorded. This workspace does not manufacture skill scores.</Empty></Panel>;
    if (view === 'trajectory' || view === 'performance' || view === 'results' || view === 'analysis') return <Panel><div className="flex items-center gap-2"><Activity className="h-4 w-4 text-[#FA4616]"/><h3 className="font-black text-white">Canonical performance evidence</h3></div><div className="mt-4">{resultList}</div></Panel>;
    if (view === 'records') return <Panel><div className="flex items-center gap-2"><Award className="h-4 w-4 text-[#FA4616]"/><h3 className="font-black text-white">Personal records</h3></div><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{personalRecords.length ? personalRecords.map((result: Row) => <Metric key={`${String(result.event_code)}-${String(result.course_code)}`} label={String(result.event_code)} value={formatTime(result.result_value)} detail={`${String(result.course_code ?? '')} · ${String(result.competition ?? result.context?.meet_name ?? 'source record')}`}/>) : <Empty>No personal-record evidence is available yet.</Empty>}</div></Panel>;
    if (view === 'standards' || view === 'rankings') return <Panel><Empty>{meta.title} data is not yet connected for this athlete. This surface remains blank rather than inventing qualification or ranking status.</Empty></Panel>;
    if (view === 'training-history' || view === 'habits' || view === 'readiness') return <Panel><div className="grid gap-3 md:grid-cols-3"><Metric label="Training records" value={metrics.trainingSessions ?? 0} detail="Canonical athlete training logs"/><Metric label="Readiness records" value="—" detail="No readiness evidence connected"/><Metric label="Derived habits" value="—" detail="Requires sufficient training history"/></div></Panel>;
    if (view === 'schedule' || view === 'preparation') return <Panel><div className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-[#FA4616]"/><h3 className="font-black text-white">{meta.title}</h3></div><div className="mt-4"><Empty>No athlete-specific upcoming competition or entry records are connected yet.</Empty></div></Panel>;
    return <Panel><Empty>This athlete workspace has no recorded domain evidence yet.</Empty></Panel>;
  }

  return <div className="min-h-full w-full bg-[#050707] p-6 lg:p-8">
    <Panel><div className="flex flex-wrap items-start justify-between gap-5"><div><div className="text-[9px] font-black uppercase tracking-[.25em] text-[#FA4616]">ATHLETE IDENTITY</div><h1 className="mt-2 text-3xl font-black text-white">{String(athlete?.name ?? 'Athlete Passport')}</h1><div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-neutral-400"><span>{String(athlete?.athleteNumber ?? '—')}</span><span>{athlete ? `${String(athlete.age)} years` : '—'}</span><span>{sportsLabel}</span><span>{teamsLabel}</span></div></div><div className="flex flex-wrap gap-2"><select value={String(athlete?.athleteNumber ?? '')} onChange={(event) => selectAthlete(event.target.value)} className="rounded-xl border border-neutral-800 bg-[#0d1010] px-3 py-2 text-xs text-white outline-none">{(data?.availableAthletes ?? []).map((option: Row) => <option key={String(option.athlete_number)} value={String(option.athlete_number)}>{String(option.name)} · {String(option.athlete_number)}</option>)}</select><button type="button" onClick={() => void load()} className="rounded-xl border border-neutral-800 p-3 text-neutral-400 hover:text-white" aria-label="Refresh"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}/></button></div></div><div className="mt-5 flex flex-wrap gap-2">{STAGES.map((stage) => <button type="button" key={stage} onClick={() => setExperience(stage)} className={`rounded-full border px-3 py-1.5 text-[10px] font-bold ${experience === stage ? 'border-[#FA4616] bg-[#FA4616]/10 text-white' : 'border-neutral-800 text-neutral-500'}`}>{stage}</button>)}</div><div className="mt-3 text-[10px] text-neutral-600">Experience preview: {experience || String(athlete?.stage ?? '—')} · canonical stage: {String(athlete?.stage ?? '—')} · projection: {String(data?.projection ?? '—')}</div></Panel>
    {data?.error ? <div className="mt-4 flex items-center gap-2 rounded-xl border border-amber-900/60 bg-amber-950/20 px-4 py-3 text-xs text-amber-300"><AlertTriangle className="h-4 w-4"/>{data.error}</div> : null}
    <div className="mt-6"><div className="mb-4"><div className="text-[9px] font-black uppercase tracking-[.25em] text-neutral-600">{view.toUpperCase().replaceAll('-', ' ')}</div><h2 className="mt-1 text-2xl font-black text-white">{meta.title}</h2><p className="mt-1 text-xs text-neutral-500">{meta.description}</p></div><div className="space-y-6">{renderView()}</div></div>
    <div className="mt-6 text-[9px] text-neutral-700">Last refreshed {data ? new Date(data.generatedAt).toLocaleString() : '—'} · {data?.source ?? 'LS1SportsEAM Supabase'} · adult-only public test projection</div>
  </div>;
}
