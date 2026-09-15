'use client';

import {useEffect,useState} from 'react';
import Link from 'next/link';
import {authenticatedFetch} from '@/lib/client/authenticatedFetch';

type Payload={roster:any[];today:{calendar:any[];attendanceSessions:any[]};attention:{counts:{now:number;soon:number;watch:number;fyi:number}};training:{plans:any[];sessions:any[]};development:{goals:any[]};competition:{upcoming:any[];candidates:any[];standardsAvailable:number;rankingsAvailable:number};agents:{proposals:any[]}};
const fmt=(v?:string)=>v?new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',year:'numeric'}).format(new Date(v)):'Date pending';

export default function CoachDecisionBrief(){
 const[data,setData]=useState<Payload|null>(null);
 useEffect(()=>{let live=true;authenticatedFetch('/api/coach',{cache:'no-store',credentials:'same-origin'}).then(r=>r.json()).then(j=>{if(live&&!j.error)setData(j)}).catch(()=>{});return()=>{live=false}},[]);
 if(!data)return null;
 const meet=data.competition.upcoming?.[0];
 const exceptions=(data.attention.counts.now||0)+(data.attention.counts.soon||0);
 const pending=(data.agents.proposals||[]).filter((p:any)=>['proposed','pending','review','pending_review'].includes(String(p.status||'').toLowerCase())).length;
 const nextSession=(data.training.sessions||[]).find((s:any)=>new Date(s.starts_at||s.start_time||s.scheduled_at||0).getTime()>=Date.now());
 return <section className="mx-auto max-w-[1500px] px-4 pt-5 sm:px-6 lg:px-8">
  <div className="rounded-[24px] border border-neutral-800 bg-[#090c0b] p-5 lg:p-6">
   <div className="flex flex-wrap items-end justify-between gap-4"><div><div className="text-[10px] font-black uppercase tracking-[.18em] text-emerald-400">Coach Decision Brief</div><h2 className="mt-2 text-2xl font-black text-white">What matters next</h2><p className="mt-1 text-sm text-neutral-400">Real team state, upcoming decisions and work that can move today.</p></div><div className="text-right text-xs text-neutral-500">{data.roster.length} active athletes · {exceptions} near-term exceptions · {pending} agent proposals</div></div>
   <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
    <Link href="/coach/competition" className="rounded-2xl border border-neutral-700 bg-neutral-950 p-5 transition hover:border-emerald-500/50"><div className="text-[10px] font-black uppercase tracking-[.15em] text-emerald-400">Next meet</div><div className="mt-2 text-xl font-black text-white">{meet?.name||'No upcoming meet'}</div><div className="mt-2 text-sm text-neutral-400">{meet?fmt(meet.starts_at):'Nothing scheduled in canonical competition data.'}</div>{meet&&<div className="mt-4 text-xs font-bold text-white">Open meet package →</div>}</Link>
    <Link href="/coach/training" className="rounded-2xl border border-neutral-700 bg-neutral-950 p-5 transition hover:border-emerald-500/50"><div className="text-[10px] font-black uppercase tracking-[.15em] text-emerald-400">Next training</div><div className="mt-2 text-xl font-black text-white">{nextSession?.name||nextSession?.title||'No future session loaded'}</div><div className="mt-2 text-sm text-neutral-400">{nextSession?fmt(nextSession.starts_at||nextSession.start_time||nextSession.scheduled_at):`${data.training.plans.length} training plan${data.training.plans.length===1?'':'s'} in scope`}</div><div className="mt-4 text-xs font-bold text-white">Open training →</div></Link>
    <Link href="/coach/ai" className="rounded-2xl border border-neutral-700 bg-neutral-950 p-5 transition hover:border-emerald-500/50"><div className="text-[10px] font-black uppercase tracking-[.15em] text-emerald-400">Needs Coach</div><div className="mt-2 text-3xl font-black text-white">{exceptions}</div><div className="mt-2 text-sm text-neutral-400">NOW + SOON exceptions requiring attention.</div><div className="mt-4 text-xs font-bold text-white">Review exceptions →</div></Link>
    <Link href="/coach/development" className="rounded-2xl border border-neutral-700 bg-neutral-950 p-5 transition hover:border-emerald-500/50"><div className="text-[10px] font-black uppercase tracking-[.15em] text-emerald-400">Athlete development</div><div className="mt-2 text-3xl font-black text-white">{data.development.goals.length}</div><div className="mt-2 text-sm text-neutral-400">Canonical development goals currently in scope.</div><div className="mt-4 text-xs font-bold text-white">Open development →</div></Link>
   </div>
   {meet&&<div className="mt-4 grid gap-3 rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4 sm:grid-cols-4"><div><div className="text-[9px] font-black uppercase tracking-[.14em] text-neutral-500">Meet Agent foundation</div><div className="mt-1 font-bold text-white">{meet.name}</div></div><div><div className="text-[9px] font-black uppercase tracking-[.14em] text-neutral-500">Candidate records</div><div className="mt-1 text-xl font-black text-white">{data.competition.candidates.length}</div></div><div><div className="text-[9px] font-black uppercase tracking-[.14em] text-neutral-500">Standards available</div><div className="mt-1 text-xl font-black text-white">{data.competition.standardsAvailable}</div></div><div><div className="text-[9px] font-black uppercase tracking-[.14em] text-neutral-500">Rankings available</div><div className="mt-1 text-xl font-black text-white">{data.competition.rankingsAvailable}</div></div></div>}
  </div>
 </section>
}