'use client';

import Link from 'next/link';
import {useEffect,useMemo,useState,type ReactNode} from 'react';
import {CalendarDays,CheckCircle2,Clock3,Flag,MapPin,Medal,NotebookPen,ShieldCheck,Sparkles,Target,Trophy} from 'lucide-react';
import {authenticatedFetch} from '@/lib/client/authenticatedFetch';

type Row=Record<string,any>;
type Experience={state?:'training-day'|'meet-prep'|'race-day'|'post-race';entries?:Row[];results?:Row[];training?:Row[];reflections?:Row[];error?:string};

function when(v:unknown){if(!v)return'Time TBD';const d=new Date(String(v));if(Number.isNaN(d.getTime()))return'Time TBD';return d.toLocaleString('en-CA',{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}
function swimTime(v:unknown){const n=Number(v);if(!Number.isFinite(n))return'—';const m=Math.floor(n/60),s=n-m*60;return m?`${m}:${s.toFixed(2).padStart(5,'0')}`:s.toFixed(2)}
function statusLabel(v:unknown){const s=String(v||'').trim();return s?s.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()):'Not recorded'}

export default function AthleteExperienceFrame({age,children}:{age:string;children:ReactNode}){
 const[data,setData]=useState<Experience|null>(null);
 useEffect(()=>{let active=true;(async()=>{try{const r=await authenticatedFetch(`/api/athlete/experience?age=${encodeURIComponent(age)}`,{cache:'no-store'});const j=await r.json();if(active&&r.ok)setData(j)}catch{if(active)setData(null)}})();return()=>{active=false}},[age]);
 const entries=data?.entries||[],results=data?.results||[];
 const next=useMemo(()=>entries.find(e=>e.competition?.startsAt&&new Date(e.competition.startsAt).getTime()>=Date.now()-43200000)||entries[0],[entries]);
 const recent=results[0];const state=data?.state||'training-day';
 const palette=state==='race-day'?'from-rose-500/35 via-orange-500/25 to-fuchsia-600/20 border-rose-300/30':state==='meet-prep'?'from-cyan-500/30 via-blue-500/20 to-violet-600/20 border-cyan-300/25':state==='post-race'?'from-emerald-500/30 via-teal-500/20 to-cyan-600/20 border-emerald-300/25':'from-violet-500/25 via-indigo-500/15 to-cyan-600/15 border-violet-300/20';
 const title=state==='race-day'?'Race Day Mode':state==='meet-prep'?'My Meet is getting close':state==='post-race'?'Race complete. Build the next step.':'Today is a development day';
 const detail=state==='race-day'?'LS1 is prioritizing the competition information that matters to you right now.':state==='meet-prep'?'Entries, eligibility, session timing and meet preparation now move to the front.':state==='post-race'?'Your result becomes part of your permanent performance story, then the focus shifts to learning and progression.':'Coach connection, training, goals and the next meaningful action stay in front.';
 return <div className="space-y-5">
  <section className={`overflow-hidden rounded-[2rem] border bg-gradient-to-br ${palette} p-5 shadow-[0_30px_100px_rgba(0,0,0,.20)] sm:p-6`}>
   <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
    <div className="max-w-3xl"><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.2em] text-white/60"><Sparkles className="h-4 w-4"/>My LS1 · primary experience</div><h2 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">{title}</h2><p className="mt-2 text-sm leading-6 text-white/65">{detail}</p></div>
    <div className="flex flex-wrap gap-2"><span className="rounded-full border border-white/15 bg-black/20 px-3 py-1.5 text-xs font-black text-white/80">{statusLabel(state)}</span>{next?.competition?.name&&<span className="rounded-full border border-white/15 bg-black/20 px-3 py-1.5 text-xs font-black text-white/80">{next.competition.name}</span>}</div>
   </div>
   {state==='race-day'&&next&&<div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><Mini icon={Flag} label="Event" value={next.event?.name||next.event?.code||'Event TBD'}/><Mini icon={Clock3} label="When" value={when(next.heat?.startAt||next.session?.startsAt||next.competition?.startsAt)}/><Mini icon={Medal} label="Heat / Lane" value={next.heat?.number||next.seeding?.heat_no||next.lane?.number?`H${next.heat?.number||next.seeding?.heat_no||'—'} · L${next.lane?.number||next.seeding?.lane_no||'—'}`:'Not seeded yet'}/><Mini icon={CheckCircle2} label="Check-in" value={statusLabel(next.checkin?.status)}/><Mini icon={ShieldCheck} label="Eligibility" value={statusLabel(next.eligibilityStatus)}/></div>}
   {state==='meet-prep'&&next&&<div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Mini icon={CalendarDays} label="Competition" value={next.competition?.name||'Meet'}/><Mini icon={Clock3} label="Starts" value={when(next.competition?.startsAt)}/><Mini icon={ShieldCheck} label="Eligibility" value={statusLabel(next.eligibilityStatus)}/><Mini icon={MapPin} label="Location" value={[next.competition?.city,next.competition?.region].filter(Boolean).join(', ')||'Location TBD'}/></div>}
   {state==='post-race'&&recent&&<div className="mt-5 grid gap-3 sm:grid-cols-3"><Mini icon={Trophy} label="Latest result" value={swimTime(recent.resultValue)}/><Mini icon={Medal} label="Place" value={recent.rank?`#${recent.rank}`:'Not recorded'}/><Mini icon={ShieldCheck} label="Evidence" value={statusLabel(recent.validationStatus)}/></div>}
   {state==='training-day'&&<div className="mt-5 grid gap-3 sm:grid-cols-3"><Mini icon={Target} label="Focus" value="Next meaningful action"/><Mini icon={NotebookPen} label="Logbook" value={`${data?.reflections?.length||0} recent reflections`}/><Mini icon={CalendarDays} label="Next meet" value={next?.competition?.name||'Nothing scheduled yet'}/></div>}
   <div className="mt-5 flex flex-wrap gap-2">{(state==='race-day'||state==='meet-prep')&&<Link href={`/athlete/competitions?age=${encodeURIComponent(age)}`} className="rounded-xl bg-white px-4 py-2.5 text-xs font-black text-black">Open My Meet</Link>}<Link href={`/athlete/logbook?age=${encodeURIComponent(age)}`} className="rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-xs font-black text-white">Open Logbook</Link></div>
  </section>
  {children}
 </div>
}

function Mini({icon:Icon,label,value}:{icon:any;label:string;value:string}){return <div className="rounded-2xl border border-white/10 bg-black/20 p-4"><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.16em] text-white/45"><Icon className="h-4 w-4"/>{label}</div><div className="mt-2 text-sm font-black text-white">{value}</div></div>}
