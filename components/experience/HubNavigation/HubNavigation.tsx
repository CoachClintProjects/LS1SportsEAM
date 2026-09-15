'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useHub } from '@/components/hubs/HubContext';
import { getNavigation, getSwitcherConfig, NavigationSection, SwitcherConfig } from './navigationDefinitions';

const FALLBACKS: Record<string, NavigationSection[]> = {
 coach:[{id:'coach-main',label:'COACH',items:[
  {id:'coach-command',label:'Command Center',href:'/coach'},{id:'coach-squads',label:'Squads',href:'/coach/squads'},{id:'coach-rosters',label:'Rosters',href:'/coach/rosters'},{id:'coach-attendance',label:'Attendance',href:'/coach/attendance'},{id:'coach-training',label:'Training Plans',href:'/coach/training'},{id:'coach-workouts',label:'Workouts',href:'/coach/workouts'},{id:'coach-deployment',label:'Training Deployment',href:'/coach/deployment'},{id:'coach-competition',label:'Competition Prep',href:'/coach/competition'},{id:'coach-performance',label:'Performance',href:'/coach/performance'},{id:'coach-development',label:'Development',href:'/coach/development'},{id:'coach-deck',label:'Deck Ledger',href:'/coach/deck'},{id:'coach-community',label:'Community',href:'/coach/community'},{id:'coach-library',label:'Drill Library',href:'/coach/library'},{id:'coach-video-analysis',label:'Stroke Analysis',href:'/coach/video-analysis'}]}],
 superuser:[{id:'superuser-command',label:'COMMAND',items:[{id:'command-center',label:'Command Center',href:'/superuser'},{id:'deployments',label:'Release Certification',href:'/superuser?view=deployments'}]}],
 athlete:[{id:'athlete-main',label:'ATHLETE',items:[{id:'overview',label:'Overview',href:'/athlete'}]}],
 parent:[{id:'parent-main',label:'PARENT',items:[{id:'household',label:'Household Overview',href:'/parent'},{id:'schedule',label:'Schedules',href:'/parent?view=schedule'}]}],
 admin:[{id:'admin-main',label:'ADMIN',items:[{id:'command-center',label:'Command Center',href:'/admin'}]}]
};
const EMPTY_SWITCHER:SwitcherConfig={type:null,displayStyle:'none',defaultOption:'',options:[]};
function getQueryKey(h:string){return h==='athlete'?'age':h==='admin'?'role':h==='official'?'official_role':'switcher'}
function isItemActive(href:string|undefined,pathname:string,search:string){if(!href)return false;const target=new URL(href,typeof window==='undefined'?'https://ls1sports.local':window.location.origin);if(target.pathname!==pathname)return false;const current=new URLSearchParams(search),view=target.searchParams.get('view');if(view)return current.get('view')===view;if(target.search){for(const[k,v]of target.searchParams.entries())if(current.get(k)!==v)return false;return true}return !current.get('view')}
export function HubNavigation(){
 const pathname=usePathname(),searchParams=useSearchParams(),search=searchParams.toString(),router=useRouter(),{activeHubId,currentHub}=useHub();
 const fallback=useMemo(()=>FALLBACKS[activeHubId]||[{id:`${activeHubId}-main`,label:activeHubId.toUpperCase(),items:[]}],[activeHubId]);
 const[sections,setSections]=useState<NavigationSection[]>(fallback),[switcherConfig,setSwitcherConfig]=useState<SwitcherConfig>(EMPTY_SWITCHER),[switcherValue,setSwitcherValue]=useState(''),[refreshing,setRefreshing]=useState(false);const loaded=useRef<string|null>(null);
 useEffect(()=>{loaded.current=null;setSections(fallback)},[activeHubId,fallback]);
 useEffect(()=>{let c=false;(async()=>{const config=await getSwitcherConfig(activeHubId);if(c)return;setSwitcherConfig(config);const key=getQueryKey(activeHubId),url=searchParams.get(key);setSwitcherValue(url&&config.options.some(o=>o.id===url)?url:config.defaultOption||config.options[0]?.id||'')})();return()=>{c=true}},[activeHubId,searchParams]);
 useEffect(()=>{let c=false;(async()=>{setRefreshing(true);try{const result=await getNavigation(activeHubId,switcherValue);if(!c&&result.length){setSections(result);loaded.current=activeHubId}else if(!c&&loaded.current!==activeHubId)setSections(fallback)}catch(e){console.error('[HubNavigation] navigation load failed',{activeHubId,e});if(!c&&loaded.current!==activeHubId)setSections(fallback)}finally{if(!c)setRefreshing(false)}})();return()=>{c=true}},[activeHubId,fallback,switcherValue]);
 function handleSwitch(value:string){setSwitcherValue(value);if(typeof window==='undefined')return;const q=new URLSearchParams(search),key=getQueryKey(activeHubId);q.set(key,value);if(activeHubId==='athlete'||activeHubId==='admin')q.delete('switcher');router.replace(`${pathname}?${q.toString()}`,{scroll:false})}
 const activeItem=useMemo(()=>{for(const s of sections)for(const i of s.items)if(isItemActive(i.href,pathname,search))return i.id;return''},[pathname,search,sections]);
 function hrefFor(href?:string){if(!href)return'#';const t=new URL(href,typeof window==='undefined'?'https://ls1sports.local':window.location.origin);if(activeHubId==='athlete'&&switcherValue)t.searchParams.set('age',switcherValue);if(activeHubId==='admin'&&switcherValue)t.searchParams.set('role',switcherValue);if(activeHubId==='official'&&switcherValue)t.searchParams.set('official_role',switcherValue);return`${t.pathname}${t.search}`}
 const showSwitcher=switcherConfig.displayStyle!=='none'&&switcherConfig.options.length>0;
 return <nav className="flex h-full w-full flex-col bg-[#080909]">
  <div className="shrink-0 border-b border-neutral-800/80 px-5 py-5"><div className="text-[9px] font-bold uppercase tracking-[0.24em] text-[#FA4616]">{currentHub.codeLane}</div><div className="mt-1.5 truncate text-[15px] font-black text-white">{currentHub.name}</div><div className="mt-1.5 line-clamp-3 text-[10px] leading-4 text-neutral-600">{currentHub.description}</div>{showSwitcher&&<div className="mt-4 space-y-1">{switcherConfig.options.map(o=><label key={o.id} className="flex items-center gap-2 text-[10px] text-neutral-500"><input type="radio" checked={switcherValue===o.id} onChange={()=>handleSwitch(o.id)}/>{o.label}</label>)}</div>}</div>
  <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">{sections.map(s=><section key={s.id} className="mb-5"><div className="mb-2 px-2 text-[8px] font-black uppercase tracking-[.2em] text-neutral-700">{s.label}</div><div className="space-y-1">{s.items.map(i=><Link key={i.id} href={hrefFor(i.href)} className={`block rounded-lg px-3 py-2 text-[11px] font-bold transition ${activeItem===i.id?'bg-[#FA4616]/10 text-[#FA4616]':'text-neutral-500 hover:bg-neutral-900 hover:text-neutral-200'}`}>{i.label}</Link>)}</div></section>)}</div>
  <div className="shrink-0 border-t border-neutral-800/80 px-4 py-3"><div className="flex items-center justify-between text-[7px] font-black uppercase tracking-[.2em] text-neutral-700"><span>LS1Sports OS</span><span className="h-1.5 w-1.5 rounded-full bg-emerald-500"/></div></div>
 </nav>
}