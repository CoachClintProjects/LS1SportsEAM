'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Award, CalendarDays, ChevronRight, Flag, MessageCircle, RefreshCw, Settings, Sparkles, Star, Target, Trophy, Users, X } from 'lucide-react';

type Row = Record<string, any>;
type Payload = { athlete: Row | null; teams: Row[]; results: Row[]; goals: Row[]; schedule: Row[]; badges: Row[]; challenges: Row[]; error?: string };

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

function AdventureButton({ icon: Icon, label, detail, onClick, tone = 'orange' }: { icon: any; label: string; detail: string; onClick: () => void; tone?: 'orange'|'cyan'|'violet'|'emerald' }) {
  const tones = {
    orange: 'from-orange-500/25 to-rose-500/10 border-orange-400/30 text-orange-200',
    cyan: 'from-cyan-500/25 to-blue-500/10 border-cyan-400/30 text-cyan-200',
    violet: 'from-violet-500/25 to-fuchsia-500/10 border-violet-400/30 text-violet-200',
    emerald: 'from-emerald-500/25 to-teal-500/10 border-emerald-400/30 text-emerald-200',
  };
  return <button onClick={onClick} className={`group flex min-h-32 flex-col items-center justify-center rounded-[1.75rem] border bg-gradient-to-br p-5 text-center shadow-lg transition hover:-translate-y-1 hover:scale-[1.02] ${tones[tone]}`}>
    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 transition group-hover:scale-110"><Icon className="h-7 w-7"/></div>
    <div className="mt-3 text-lg font-black text-white">{label}</div><div className="mt-1 text-xs leading-5 text-white/65">{detail}</div>
  </button>;
}

export default function YoungAthleteAdventure() {
  const pathname = usePathname();
  const view = pathname.split('/').filter(Boolean)[1] || 'overview';
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
      setData(payload); setError('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Athlete data unavailable'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);
  const schedule = data?.schedule || [], challenges = data?.challenges || [], badges = data?.badges || [], results = data?.results || [], teams = data?.teams || [];
  const mission = challenges[0], latest = results[0], next = schedule[0];
  const progress = Math.min(100, Math.max(0, Number(mission?.progress || 0) * 20));
  const days = useMemo(() => { const start = new Date(); start.setHours(0,0,0,0); return Array.from({ length: 14 }, (_, index) => { const date = new Date(start); date.setDate(start.getDate()+index); const events = schedule.filter(item => item.competition?.startsAt && new Date(item.competition.startsAt).toDateString() === date.toDateString()); return { date, events }; }); }, [schedule]);

  if (!data && loading) return <main className="p-8 text-neutral-400">Loading your adventure…</main>;
  if (!data) return <main className="p-8 text-red-300">{error || 'Athlete data unavailable'}</main>;

  const hero = <section className="relative overflow-hidden rounded-[2.2rem] border border-orange-300/30 bg-[radial-gradient(circle_at_15%_20%,rgba(34,211,238,.25),transparent_24%),radial-gradient(circle_at_80%_20%,rgba(168,85,247,.28),transparent_24%),radial-gradient(circle_at_75%_85%,rgba(16,185,129,.22),transparent_25%),linear-gradient(135deg,#2b1733,#111827_55%,#10251f)] p-6 lg:p-8 shadow-[0_25px_100px_rgba(0,0,0,.35)]">
    <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full border-[20px] border-yellow-300/10"/><div className="absolute bottom-6 right-24 text-6xl opacity-20">★</div>
    <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between"><div><div className="text-xs font-black uppercase tracking-[.2em] text-yellow-200">My LS1 Adventure · Foundation</div><h1 className="mt-2 text-4xl font-black text-white lg:text-6xl">{view === 'overview' ? 'Ready to play?' : view === 'calendar' ? 'My Adventure Calendar' : view === 'competitions' ? 'My Race Days' : view === 'achievements' ? 'My Stars & Wins' : view === 'settings' ? 'Make It Mine' : 'Help Build LS1'}</h1><p className="mt-3 max-w-2xl text-base font-semibold leading-7 text-white/70">Fun first. One clear thing at a time. Your real sports world, made exciting.</p></div><div className="flex items-center gap-3"><div className="rounded-2xl border border-yellow-300/20 bg-yellow-300/10 px-5 py-3 text-center"><div className="text-3xl font-black text-yellow-200">{badges.length}</div><div className="text-[10px] font-black uppercase tracking-wider text-yellow-100/60">Stars earned</div></div><button onClick={() => void load()} className="rounded-2xl border border-white/15 bg-white/10 p-4 text-white"><RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`}/></button></div></div>
  </section>;

  const calendar = <section className="rounded-[2rem] border border-cyan-300/20 bg-gradient-to-br from-cyan-500/12 to-blue-500/5 p-5 lg:p-6"><div className="flex items-center gap-3"><CalendarDays className="h-7 w-7 text-cyan-200"/><div><div className="text-xs font-black uppercase tracking-[.16em] text-cyan-200">Adventure calendar</div><h2 className="text-2xl font-black text-white">What’s coming?</h2></div></div><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">{days.map(({ date, events }) => <button key={date.toISOString()} onClick={() => setDrawer({ kind:'day', date:date.toISOString(), items:events })} className={`min-h-28 rounded-2xl border p-3 text-left transition hover:-translate-y-1 ${events.length ? 'border-yellow-300/40 bg-yellow-300/15' : 'border-white/10 bg-white/5'}`}><div className="text-[10px] font-black uppercase tracking-wider text-white/45">{date.toLocaleDateString('en-CA',{weekday:'short'})}</div><div className="mt-1 text-2xl font-black text-white">{date.getDate()}</div><div className="mt-3 text-xs font-black text-yellow-200">{events.length ? `${events.length} adventure${events.length===1?'':'s'}` : 'Free day'}</div></button>)}</div></section>;

  const raceDays = <section className="rounded-[2rem] border border-violet-300/20 bg-gradient-to-br from-violet-500/12 to-fuchsia-500/5 p-5 lg:p-6"><div className="flex items-center gap-3"><Trophy className="h-7 w-7 text-violet-200"/><h2 className="text-2xl font-black text-white">My race days</h2></div><div className="mt-4 space-y-3">{schedule.length ? schedule.slice(0,10).map((item,index)=><button key={item.entryId||index} onClick={()=>setDrawer({kind:'race',...item})} className="flex w-full items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition hover:border-violet-300/35"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-400/15 text-violet-200"><Flag className="h-6 w-6"/></div><div className="min-w-0 flex-1"><div className="truncate text-base font-black text-white">{item.competition?.name||'Competition'}</div><div className="mt-1 text-sm text-white/55">{item.event?.name||item.event?.code||'Event'} · {dateLabel(item.competition?.startsAt)}</div></div><ChevronRight className="h-5 w-5 text-white/30"/></button>) : <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-sm text-white/45">No race days are connected yet.</div>}</div></section>;

  let content;
  if (view === 'calendar') content = calendar;
  else if (view === 'competitions') content = <div className="space-y-5">{raceDays}{calendar}</div>;
  else if (view === 'achievements') content = <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{badges.length ? badges.map((badge,index)=><AdventureButton key={badge.id||index} icon={Award} label={badge.name||'Star'} detail={badge.description||'A real recorded win'} tone={index%3===0?'orange':index%3===1?'cyan':'violet'} onClick={()=>setDrawer({kind:'star',...badge})}/>) : <div className="sm:col-span-2 lg:col-span-3 rounded-3xl border border-dashed border-white/15 p-10 text-center text-white/45">No stars earned yet — when you earn one, it will show here.</div>}</div>;
  else if (view === 'settings') content = <div className="grid gap-5 md:grid-cols-2"><AdventureButton icon={Settings} label="Colors & style" detail="More customization is coming as we learn what young athletes love." tone="violet" onClick={()=>setDrawer({kind:'customize',description:'Foundation customization is intentionally simple and parent-aware.'})}/><AdventureButton icon={Users} label="My grown-up" detail="Guardian access and permissions will live here when the onboarding authority workflow is connected." tone="cyan" onClick={()=>setDrawer({kind:'guardian',description:'Athlete Hub access for minors will be guardian-authorized.'})}/></div>;
  else if (view === 'feedback') content = <section className="rounded-[2rem] border border-emerald-300/20 bg-gradient-to-br from-emerald-500/15 to-teal-500/5 p-6"><div className="flex items-center gap-3"><MessageCircle className="h-7 w-7 text-emerald-200"/><h2 className="text-2xl font-black text-white">What do you think?</h2></div><p className="mt-3 text-white/60">We want real kids and athletes to help us make LS1 better. Feedback storage is not connected yet, so this does not pretend to send anything.</p><div className="mt-5 grid grid-cols-3 gap-3"><button disabled className="rounded-3xl bg-white/10 p-5 text-4xl">😍</button><button disabled className="rounded-3xl bg-white/10 p-5 text-4xl">🙂</button><button disabled className="rounded-3xl bg-white/10 p-5 text-4xl">🤔</button></div></section>;
  else content = <div className="space-y-6"><section className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]"><button onClick={()=>setDrawer({kind:'mission',...mission})} className="min-h-64 rounded-[2rem] border border-orange-300/30 bg-gradient-to-br from-orange-500/20 via-rose-500/10 to-transparent p-6 text-left transition hover:-translate-y-1"><div className="flex items-center gap-3 text-orange-200"><Target className="h-7 w-7"/><span className="text-sm font-black uppercase tracking-[.16em]">Today’s mission</span></div><div className="mt-5 text-3xl font-black text-white">{mission?.name||'No mission yet'}</div><p className="mt-3 max-w-2xl text-base leading-7 text-white/65">{mission?.description||'Your coach can add your next fun challenge here.'}</p><div className="mt-7 h-4 overflow-hidden rounded-full bg-black/30"><div className="h-full rounded-full bg-gradient-to-r from-yellow-300 via-orange-400 to-pink-400" style={{width:`${progress}%`}}/></div></button><button onClick={()=>setDrawer({kind:'next',items:schedule})} className="min-h-64 rounded-[2rem] border border-cyan-300/25 bg-gradient-to-br from-cyan-500/20 via-blue-500/10 to-transparent p-6 text-left transition hover:-translate-y-1"><div className="flex items-center gap-3 text-cyan-200"><Flag className="h-7 w-7"/><span className="text-sm font-black uppercase tracking-[.16em]">Next adventure</span></div><div className="mt-5 text-2xl font-black text-white">{next?.competition?.name||'No race day yet'}</div><div className="mt-2 text-lg font-bold text-white/65">{next?.event?.name||next?.event?.code||'Your next event will appear here'}</div><div className="mt-5 inline-flex rounded-full bg-cyan-300/15 px-4 py-2 text-sm font-black text-cyan-100">{next?dateLabel(next.competition?.startsAt):'Nothing scheduled yet'}</div></button></section>{calendar}<section className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">{raceDays}<div className="rounded-[2rem] border border-emerald-300/20 bg-gradient-to-br from-emerald-500/10 to-teal-500/5 p-5 lg:p-6"><div className="flex items-center gap-3"><Sparkles className="h-6 w-6 text-yellow-200"/><h2 className="text-2xl font-black text-white">My game buttons</h2></div><div className="mt-5 grid grid-cols-2 gap-3"><AdventureButton icon={Award} label="My stars" detail={badges.length?`${badges.length} earned`:'Wins appear here'} tone="orange" onClick={()=>setDrawer({kind:'badges',items:badges})}/><AdventureButton icon={Users} label="My team" detail={teams[0]?.name||'Team info'} tone="cyan" onClick={()=>setDrawer({kind:'team',...teams[0]})}/><AdventureButton icon={Trophy} label="My swims" detail={latest?shortTime(latest.resultValue):'Race results'} tone="violet" onClick={()=>setDrawer({kind:'results',items:results})}/><AdventureButton icon={Star} label="My goal" detail="One simple goal" tone="emerald" onClick={()=>setDrawer({kind:'goal',...(data.goals?.[0]||{})})}/></div></div></section></div>;

  return <main className="mx-auto max-w-[1500px] space-y-6 p-4 lg:p-7">{hero}{error&&<div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>}{content}{drawer&&<div className="fixed inset-0 z-50 bg-black/75" onClick={()=>setDrawer(null)}><aside className="absolute right-0 top-0 h-full w-full max-w-lg overflow-y-auto border-l border-white/10 bg-[#090b10] p-6" onClick={event=>event.stopPropagation()}><div className="flex items-start justify-between gap-4"><div><div className="text-xs font-black uppercase tracking-[.16em] text-yellow-200">My adventure</div><h2 className="mt-2 text-2xl font-black capitalize text-white">{String(drawer.kind||'details').replaceAll('-',' ')}</h2></div><button onClick={()=>setDrawer(null)} className="rounded-xl border border-white/10 p-2"><X className="h-5 w-5 text-white/70"/></button></div><div className="mt-6 space-y-3">{Array.isArray(drawer.items)?(drawer.items.length?drawer.items.map((item:Row,index:number)=><div key={item.id||item.entryId||index} className="rounded-2xl border border-white/10 bg-white/5 p-4"><div className="font-black text-white">{item.competition?.name||item.name||item.title||item.event?.name||`Adventure ${index+1}`}</div><div className="mt-1 text-sm text-white/55">{item.event?.name||item.event?.code||item.description||item.status||''}</div>{item.competition?.startsAt&&<div className="mt-2 text-xs font-bold text-cyan-200">{dateLabel(item.competition.startsAt)}</div>}</div>):<div className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-white/45">Nothing here yet.</div>):<div className="rounded-2xl border border-white/10 bg-white/5 p-5"><div className="text-xl font-black text-white">{drawer.competition?.name||drawer.name||drawer.title||drawer.event?.name||'Adventure detail'}</div><div className="mt-2 text-sm leading-6 text-white/55">{drawer.event?.name||drawer.event?.code||drawer.description||drawer.status||'Your details will appear here.'}</div>{drawer.competition?.startsAt&&<div className="mt-3 text-sm font-black text-cyan-200">{dateLabel(drawer.competition.startsAt)}</div>}</div>}</div></aside></div>}</main>;
}
