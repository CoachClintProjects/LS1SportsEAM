'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Award, CalendarDays, ChevronRight, Flag, RefreshCw, Sparkles, Star, Target, Trophy, Users, X } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import AthleteWorkspace from './AthleteWorkspace';

type Row = Record<string, any>;
type Payload = {
  athlete: Row | null;
  teams: Row[];
  results: Row[];
  goals: Row[];
  schedule: Row[];
  badges: Row[];
  challenges: Row[];
  error?: string;
};

const dateLabel = (value: unknown) => {
  if (!value) return 'Date coming soon';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return 'Date coming soon';
  return date.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });
};

const shortTime = (value: unknown) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  const minutes = Math.floor(n / 60);
  const seconds = n - minutes * 60;
  return minutes ? `${minutes}:${seconds.toFixed(2).padStart(5, '0')}` : seconds.toFixed(2);
};

function AdventureButton({ icon: Icon, label, detail, onClick }: { icon: any; label: string; detail: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="group flex min-h-28 flex-col items-center justify-center rounded-3xl border border-neutral-800 bg-[#111414] p-5 text-center transition hover:-translate-y-1 hover:border-[#FA4616]/60 hover:bg-[#171a1a]">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FA4616]/15 text-[#FA4616] transition group-hover:scale-110">
        <Icon className="h-6 w-6" />
      </div>
      <div className="mt-3 text-base font-black text-white">{label}</div>
      <div className="mt-1 text-xs leading-5 text-neutral-500">{detail}</div>
    </button>
  );
}

function YoungAthleteAdventure() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [drawer, setDrawer] = useState<Row | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/athlete?age=5-8', { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok || payload.error) throw new Error(payload.error || 'Athlete data unavailable');
      setData(payload);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Athlete data unavailable');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const schedule = data?.schedule || [];
  const challenges = data?.challenges || [];
  const badges = data?.badges || [];
  const results = data?.results || [];
  const teams = data?.teams || [];
  const mission = challenges[0];
  const latest = results[0];
  const next = schedule[0];
  const progress = Math.min(100, Math.max(0, Number(mission?.progress || 0) * 20));

  const days = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return Array.from({ length: 14 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const events = schedule.filter((item) => {
        const raw = item.competition?.startsAt;
        return raw && new Date(raw).toDateString() === date.toDateString();
      });
      return { date, events };
    });
  }, [schedule]);

  if (!data && loading) return <main className="p-8 text-neutral-400">Loading your adventure…</main>;
  if (!data) return <main className="p-8 text-red-300">{error || 'Athlete data unavailable'}</main>;

  return (
    <main className="mx-auto max-w-[1500px] space-y-6 p-4 lg:p-7">
      <section className="relative overflow-hidden rounded-[2rem] border border-[#FA4616]/35 bg-[radial-gradient(circle_at_top_left,rgba(250,70,22,.22),transparent_38%),linear-gradient(135deg,#151818,#090b0b)] p-6 lg:p-8">
        <div className="absolute -right-8 -top-8 h-36 w-36 rounded-full border-[18px] border-[#FA4616]/10" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-[.2em] text-[#FA4616]">My LS1 Adventure</div>
            <h1 className="mt-2 text-3xl font-black text-white lg:text-5xl">Ready to play?</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-neutral-300">One mission. One next adventure. Lots of wins.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-neutral-700 bg-black/30 px-5 py-3 text-center">
              <div className="text-2xl font-black text-white">{badges.length}</div>
              <div className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Stars earned</div>
            </div>
            <button onClick={() => void load()} className="rounded-2xl border border-neutral-700 bg-black/30 p-4 text-neutral-300" aria-label="Refresh athlete adventure">
              <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </section>

      {error && <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>}

      <section className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
        <button onClick={() => setDrawer({ kind: 'mission', ...mission })} className="min-h-64 rounded-[2rem] border border-[#FA4616]/45 bg-[#161313] p-6 text-left transition hover:-translate-y-1">
          <div className="flex items-center gap-3 text-[#FA4616]"><Target className="h-7 w-7"/><span className="text-sm font-black uppercase tracking-[.16em]">Today’s mission</span></div>
          <div className="mt-5 text-3xl font-black text-white">{mission?.name || 'No mission yet'}</div>
          <p className="mt-3 max-w-2xl text-base leading-7 text-neutral-300">{mission?.description || 'Your coach can add your next fun challenge here.'}</p>
          <div className="mt-7 h-4 overflow-hidden rounded-full bg-black/50"><div className="h-full rounded-full bg-[#FA4616]" style={{ width: `${progress}%` }} /></div>
          <div className="mt-2 text-xs font-bold text-neutral-500">{mission ? `${progress}% of this mission` : 'Ready for your first mission'}</div>
        </button>

        <button onClick={() => setDrawer({ kind: 'next', items: schedule })} className="min-h-64 rounded-[2rem] border border-neutral-800 bg-[#101313] p-6 text-left transition hover:-translate-y-1 hover:border-[#FA4616]/40">
          <div className="flex items-center gap-3 text-[#FA4616]"><Flag className="h-7 w-7"/><span className="text-sm font-black uppercase tracking-[.16em]">Next adventure</span></div>
          <div className="mt-5 text-2xl font-black text-white">{next?.competition?.name || 'No race day yet'}</div>
          <div className="mt-2 text-lg font-bold text-neutral-300">{next?.event?.name || next?.event?.code || 'Your next event will appear here'}</div>
          <div className="mt-5 inline-flex rounded-full bg-[#FA4616]/10 px-4 py-2 text-sm font-black text-[#FA4616]">{next ? dateLabel(next.competition?.startsAt) : 'Nothing scheduled yet'}</div>
        </button>
      </section>

      <section className="rounded-[2rem] border border-neutral-800 bg-[#0c0f0f] p-5 lg:p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-xs font-black uppercase tracking-[.16em] text-[#FA4616]">Adventure calendar</div>
            <h2 className="mt-1 text-2xl font-black text-white">What’s coming?</h2>
          </div>
          <CalendarDays className="h-7 w-7 text-neutral-600" />
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {days.map(({ date, events }) => (
            <button key={date.toISOString()} onClick={() => setDrawer({ kind: 'day', date: date.toISOString(), items: events })} className={`min-h-28 rounded-2xl border p-3 text-left ${events.length ? 'border-[#FA4616]/45 bg-[#FA4616]/10' : 'border-neutral-800 bg-[#111414]'}`}>
              <div className="text-[10px] font-black uppercase tracking-wider text-neutral-500">{date.toLocaleDateString('en-CA', { weekday: 'short' })}</div>
              <div className="mt-1 text-2xl font-black text-white">{date.getDate()}</div>
              <div className="mt-3 text-xs font-bold text-[#FA4616]">{events.length ? `${events.length} adventure${events.length === 1 ? '' : 's'}` : 'Free day'}</div>
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
        <div className="rounded-[2rem] border border-neutral-800 bg-[#0c0f0f] p-5 lg:p-6">
          <div className="flex items-center gap-3"><Trophy className="h-6 w-6 text-[#FA4616]"/><h2 className="text-2xl font-black text-white">My race days</h2></div>
          <div className="mt-4 space-y-3">
            {schedule.length ? schedule.slice(0, 8).map((item, index) => (
              <button key={item.entryId || index} onClick={() => setDrawer({ kind: 'race', ...item })} className="flex w-full items-center gap-4 rounded-2xl border border-neutral-800 bg-[#111414] p-4 text-left hover:border-[#FA4616]/45">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#FA4616]/12 text-[#FA4616]"><Flag className="h-6 w-6"/></div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-base font-black text-white">{item.competition?.name || 'Competition'}</div>
                  <div className="mt-1 text-sm text-neutral-400">{item.event?.name || item.event?.code || 'Event'} · {dateLabel(item.competition?.startsAt)}</div>
                </div>
                <ChevronRight className="h-5 w-5 text-neutral-600" />
              </button>
            )) : <div className="rounded-2xl border border-dashed border-neutral-700 p-8 text-center text-sm text-neutral-500">No race days are connected yet.</div>}
          </div>
        </div>

        <div className="rounded-[2rem] border border-neutral-800 bg-[#0c0f0f] p-5 lg:p-6">
          <div className="flex items-center gap-3"><Sparkles className="h-6 w-6 text-[#FA4616]"/><h2 className="text-2xl font-black text-white">My game buttons</h2></div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <AdventureButton icon={Award} label="My stars" detail={badges.length ? `${badges.length} earned` : 'Wins appear here'} onClick={() => setDrawer({ kind: 'badges', items: badges })} />
            <AdventureButton icon={Users} label="My team" detail={teams[0]?.name || 'Team info'} onClick={() => setDrawer({ kind: 'team', ...teams[0] })} />
            <AdventureButton icon={Trophy} label="My swims" detail={latest ? shortTime(latest.resultValue) : 'Race results'} onClick={() => setDrawer({ kind: 'results', items: results })} />
            <AdventureButton icon={Star} label="My goal" detail="One simple goal" onClick={() => setDrawer({ kind: 'goal', ...(data.goals?.[0] || {}) })} />
          </div>
        </div>
      </section>

      {drawer && <div className="fixed inset-0 z-50 bg-black/75" onClick={() => setDrawer(null)}>
        <aside className="absolute right-0 top-0 h-full w-full max-w-lg overflow-y-auto border-l border-neutral-800 bg-[#090b0b] p-6" onClick={(event) => event.stopPropagation()}>
          <div className="flex items-start justify-between gap-4">
            <div><div className="text-xs font-black uppercase tracking-[.16em] text-[#FA4616]">My adventure</div><h2 className="mt-2 text-2xl font-black capitalize text-white">{String(drawer.kind || 'details').replaceAll('-', ' ')}</h2></div>
            <button onClick={() => setDrawer(null)} className="rounded-xl border border-neutral-700 p-2"><X className="h-5 w-5 text-neutral-300"/></button>
          </div>
          <div className="mt-6 space-y-3">
            {Array.isArray(drawer.items) ? (drawer.items.length ? drawer.items.map((item: Row, index: number) => <div key={item.id || item.entryId || index} className="rounded-2xl border border-neutral-800 bg-[#111414] p-4"><div className="font-black text-white">{item.competition?.name || item.name || item.title || item.event?.name || `Adventure ${index + 1}`}</div><div className="mt-1 text-sm text-neutral-400">{item.event?.name || item.event?.code || item.description || item.status || ''}</div>{item.competition?.startsAt && <div className="mt-2 text-xs font-bold text-[#FA4616]">{dateLabel(item.competition.startsAt)}</div>}</div>) : <div className="rounded-2xl border border-dashed border-neutral-700 p-8 text-center text-neutral-500">Nothing here yet.</div>) : <div className="rounded-2xl border border-neutral-800 bg-[#111414] p-5"><div className="text-xl font-black text-white">{drawer.competition?.name || drawer.name || drawer.title || drawer.event?.name || 'Adventure detail'}</div><div className="mt-2 text-sm leading-6 text-neutral-400">{drawer.event?.name || drawer.event?.code || drawer.description || drawer.status || 'Your details will appear here.'}</div>{drawer.competition?.startsAt && <div className="mt-3 text-sm font-black text-[#FA4616]">{dateLabel(drawer.competition.startsAt)}</div>}</div>}
          </div>
        </aside>
      </div>}
    </main>
  );
}

export default function AthleteExperienceRouter() {
  const params = useSearchParams();
  const age = params.get('age') || '5-8';
  return age === '5-8' ? <YoungAthleteAdventure /> : <AthleteWorkspace />;
}
