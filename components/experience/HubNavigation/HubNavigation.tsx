'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useHub } from '@/components/hubs/HubContext';
import { getNavigation, getSwitcherConfig, NavigationSection, SwitcherConfig } from './navigationDefinitions';

const ADMIN_FALLBACK: NavigationSection[] = [
  { id:'admin-main', label:'ADMIN', items:[
    { id:'command-center', label:'Command Center', href:'/admin' },
    { id:'organization', label:'Organization', href:'/admin?view=organization' },
    { id:'hierarchy', label:'Hierarchy', href:'/admin?view=hierarchy' },
  ]},
  { id:'team-manager', label:'TEAM MANAGER', items:[
    { id:'registrar', label:'Registrar', href:'/admin?view=registrar' }, { id:'rosters', label:'Rosters', href:'/admin?view=rosters' }, { id:'membership', label:'Membership', href:'/admin?view=membership' }, { id:'programs', label:'Programs', href:'/admin?view=programs' }, { id:'teams', label:'Teams', href:'/admin?view=teams' }, { id:'seasons', label:'Seasons', href:'/admin?view=seasons' },
  ]},
  { id:'finance', label:'FINANCE', items:[
    { id:'finance', label:'Financial Overview', href:'/admin?view=finance' }, { id:'billing', label:'Billing', href:'/admin?view=billing' }, { id:'invoices', label:'Invoices', href:'/admin?view=invoices' }, { id:'payments', label:'Payments', href:'/admin?view=payments' },
  ]},
  { id:'operations', label:'OPERATIONS', items:[
    { id:'facilities', label:'Facilities', href:'/admin?view=facilities' }, { id:'payroll', label:'Payroll', href:'/admin?view=payroll' }, { id:'imports', label:'Imports', href:'/admin?view=imports' }, { id:'compliance', label:'Compliance', href:'/admin?view=compliance' }, { id:'reporting', label:'Reporting', href:'/admin?view=reporting' },
  ]},
];

const FALLBACKS: Record<string, NavigationSection[]> = {
  superuser:[{id:'superuser-main',label:'SUPERUSER',items:[{id:'command-center',label:'Command Center',href:'/superuser'},{id:'onboarding',label:'Client Onboarding',href:'/superuser/onboarding'}]}],
  athlete:[{id:'athlete-main',label:'ATHLETE',items:[{id:'overview',label:'Overview',href:'/athlete'}]}],
  parent:[{id:'parent-main',label:'PARENT',items:[{id:'household',label:'Household Overview',href:'/parent'},{id:'schedule',label:'Schedules',href:'/parent?view=schedule'}]}],
  admin: ADMIN_FALLBACK,
};

const EMPTY_SWITCHER: SwitcherConfig={type:null,displayStyle:'none',defaultOption:'',options:[]};
function getQueryKey(hubId:string){if(hubId==='athlete')return'age';if(hubId==='official')return'official_role';return'switcher';}
function isItemActive(href:string|undefined,pathname:string,search:string){if(!href)return false;const origin=typeof window==='undefined'?'https://ls1sports.local':window.location.origin;const target=new URL(href,origin);if(target.pathname!==pathname)return false;const current=new URLSearchParams(search);const targetView=target.searchParams.get('view');if(targetView)return current.get('view')===targetView;if(target.search){for(const [key,value] of target.searchParams.entries())if(current.get(key)!==value)return false;return true;}return !current.get('view');}

export function HubNavigation(){
 const pathname=usePathname();const searchParams=useSearchParams();const search=searchParams.toString();const router=useRouter();const{activeHubId,currentHub}=useHub();
 const fallback=useMemo(()=>FALLBACKS[activeHubId]||[{id:`${activeHubId}-main`,label:activeHubId.toUpperCase(),items:[]}],[activeHubId]);
 const[sections,setSections]=useState<NavigationSection[]>(fallback);const[switcherConfig,setSwitcherConfig]=useState<SwitcherConfig>(EMPTY_SWITCHER);const[switcherValue,setSwitcherValue]=useState('');const[refreshing,setRefreshing]=useState(false);
 useEffect(()=>{let cancelled=false;async function initializeHub(){const config=await getSwitcherConfig(activeHubId);if(cancelled)return;setSwitcherConfig(config);const queryKey=getQueryKey(activeHubId);const urlValue=searchParams.get(queryKey);const nextValue=urlValue&&config.options.some(o=>o.id===urlValue)?urlValue:config.defaultOption||config.options[0]?.id||'';setSwitcherValue(nextValue);setSections(activeHubId==='admin'?ADMIN_FALLBACK:fallback);}void initializeHub();return()=>{cancelled=true};},[activeHubId,fallback,search]);
 useEffect(()=>{let cancelled=false;async function loadNavigation(){setRefreshing(true);try{const result=await getNavigation(activeHubId,switcherValue);if(cancelled)return;if(activeHubId==='admin'){setSections(result.length>1?result:ADMIN_FALLBACK);}else setSections(result.length?result:fallback);}catch(error){console.error('[HubNavigation] navigation load failed',{activeHubId,error});if(!cancelled)setSections(activeHubId==='admin'?ADMIN_FALLBACK:fallback);}finally{if(!cancelled)setRefreshing(false)}}void loadNavigation();return()=>{cancelled=true};},[activeHubId,fallback,switcherValue]);
 function handleSwitch(value:string){setSwitcherValue(value);if(typeof window==='undefined')return;const queryKey=getQueryKey(activeHubId);const query=new URLSearchParams(search);query.set(queryKey,value);router.replace(`${pathname}?${query.toString()}`,{scroll:false});}
 const activeItem=useMemo(()=>{for(const section of sections)for(const item of section.items)if(isItemActive(item.href,pathname,search))return item.id;return'';},[pathname,search,sections]);
 function hrefFor(itemHref?:string){if(!itemHref)return'#';const origin=typeof window==='undefined'?'https://ls1sports.local':window.location.origin;const target=new URL(itemHref,origin);if(activeHubId==='athlete'&&switcherValue)target.searchParams.set('age',switcherValue);return`${target.pathname}${target.search}`;}
 const showSwitcher=activeHubId!=='admin'&&switcherConfig.displayStyle!=='none'&&switcherConfig.options.length>0;const switcherLabel=switcherConfig.type==='age'?'Demonstrate athlete experience':switcherConfig.type==='official_role'?'Select official role':'Select option';
 return <nav className="flex h-full w-full flex-col bg-[#080909]">
  <div className="shrink-0 border-b border-neutral-800/80 px-5 py-5"><div className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#FA4616]">{currentHub.codeLane}</div><div className="mt-1.5 truncate text-[16px] font-black text-white">{currentHub.name}</div><div className="mt-1.5 line-clamp-3 text-[11px] leading-4 text-neutral-600">{currentHub.description}</div>
  {showSwitcher&&<div className="mt-5 rounded-xl border border-neutral-800 bg-[#0d1010] p-3"><div className="mb-2 flex items-center justify-between gap-2 text-[9px] font-black uppercase tracking-[.18em] text-[#FA4616]"><span>{switcherLabel}</span>{refreshing&&<span className="text-neutral-700">updating</span>}</div><div className="space-y-1">{switcherConfig.options.map(option=><label key={option.id} className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] ${switcherValue===option.id?'bg-[#FA4616]/10 text-white':'text-neutral-500 hover:text-neutral-300'}`}><input type="radio" name={`switcher-${activeHubId}`} checked={switcherValue===option.id} onChange={()=>handleSwitch(option.id)} className="accent-[#FA4616]"/><span>{option.label}</span></label>)}</div></div>}</div>
  <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">{sections.map(section=><div key={section.id} className="mb-5"><div className="mb-1.5 px-3 text-[9px] font-bold tracking-[0.2em] text-neutral-700">{section.label}</div><div className="space-y-0.5">{section.items.map(item=>{const href=hrefFor(item.href);return <Link key={item.id} href={href} scroll={false} onClick={()=>{if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('ls1sports:navigation',{detail:item.id}))}} className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-[13px] transition-colors ${activeItem===item.id?'bg-[#FA4616]/10 text-[#FA4616]':'text-neutral-400 hover:bg-neutral-900 hover:text-white'}`}><span className="min-w-0 flex-1 truncate text-left">{item.label}</span>{activeItem===item.id&&<span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#FA4616]"/>}</Link>})}</div></div>)}</div>
  <div className="shrink-0 border-t border-neutral-800/80 px-4 py-3"><div className="flex items-center justify-between"><span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-neutral-700">LS1SPORTS OS</span><span className="h-1.5 w-1.5 rounded-full bg-emerald-500"/></div></div>
 </nav>;
}
export default HubNavigation;
