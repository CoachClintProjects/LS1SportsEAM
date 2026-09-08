'use client';

import { useEffect, useState } from 'react';
import { Check, Copy, Search } from 'lucide-react';

const TYPES = [
  ['people','People'],['organizations','Organizations'],['legal_entities','Legal entities'],['facilities','Facilities'],['assets','Assets'],
  ['chart_of_accounts','GL accounts'],['accounting_ledgers','Ledgers'],['customers','Customers'],['invoices','Invoices'],['vendors','Vendors'],['vendor_bills','Vendor bills'],['budgets','Budgets'],['cost_centers','Cost centers'],['profit_centers','Profit centers'],
  ['teams','Teams'],['athletes','Athletes'],['competitions','Competitions'],['competition_events','Competition events'],['competition_entries','Competition entries'],['competition_results','Competition results'],
  ['roles','Roles'],['permissions','Permissions'],['platform_project_tasks','Project tasks'],['platform_milestone_units','Implementation units'],['workflow_definitions','Workflow definitions'],['workflow_tasks','Workflow tasks'],['purchase_requests','Purchase requests'],['purchase_orders','Purchase orders'],['payroll_runs','Payroll runs'],['ai_agents','AI agents'],
] as const;

type Option = { id: string; label: string; data: Record<string, unknown> };

export default function SuperUserReferenceFinder() {
  const [open,setOpen]=useState(false),[table,setTable]=useState('people'),[query,setQuery]=useState(''),[options,setOptions]=useState<Option[]>([]),[loading,setLoading]=useState(false),[copied,setCopied]=useState('');
  useEffect(()=>{if(!open)return;const controller=new AbortController();const timer=window.setTimeout(async()=>{setLoading(true);try{const response=await fetch(`/api/superuser-reference?table=${encodeURIComponent(table)}&q=${encodeURIComponent(query.trim())}`,{cache:'no-store',signal:controller.signal});const json=await response.json().catch(()=>({}));if(response.ok)setOptions(Array.isArray(json.options)?json.options:[]);else setOptions([])}catch(error){if((error as Error).name!=='AbortError')setOptions([])}finally{setLoading(false)}},200);return()=>{window.clearTimeout(timer);controller.abort()}},[open,table,query]);
  async function copy(id:string){await navigator.clipboard.writeText(id);setCopied(id);window.setTimeout(()=>setCopied(current=>current===id?'':current),1400)}
  return <section className="rounded-2xl border border-neutral-800 bg-[#090b0b]">
    <button type="button" onClick={()=>setOpen(value=>!value)} className="flex w-full items-center justify-between gap-4 p-4 text-left"><div><div className="text-[9px] font-black uppercase tracking-[.18em] text-emerald-400">CANONICAL REFERENCE FINDER</div><div className="mt-1 text-xs text-neutral-400">Find a record by name/code and copy its canonical ID into privileged workflows.</div></div><div className="text-xs font-black text-white">{open?'Close':'Open'}</div></button>
    {open&&<div className="border-t border-neutral-800 p-4"><div className="grid gap-3 md:grid-cols-[220px_1fr]"><select value={table} onChange={event=>{setTable(event.target.value);setOptions([])}} className="rounded-lg border border-neutral-700 bg-black px-3 py-2.5 text-xs text-white">{TYPES.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select><div className="flex items-center rounded-lg border border-neutral-700 bg-black px-3"><Search className="mr-2 h-4 w-4 text-neutral-500"/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search by name, code, status…" className="w-full bg-transparent py-2.5 text-xs text-white outline-none placeholder:text-neutral-600"/></div></div><div className="mt-3 max-h-72 overflow-y-auto rounded-lg border border-neutral-800">{loading?<div className="p-4 text-xs text-neutral-500">Searching canonical records…</div>:options.length?options.map(option=><div key={option.id} className="flex items-center gap-3 border-b border-neutral-900 px-3 py-3 last:border-0"><div className="min-w-0 flex-1"><div className="truncate text-xs font-bold text-white">{option.label}</div><div className="mt-1 truncate font-mono text-[10px] text-neutral-600">{option.id}</div></div><button type="button" onClick={()=>void copy(option.id)} className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-700 px-2.5 py-2 text-[10px] font-black text-neutral-300 hover:text-white">{copied===option.id?<Check className="h-3.5 w-3.5"/>:<Copy className="h-3.5 w-3.5"/>}{copied===option.id?'Copied':'Copy ID'}</button></div>):<div className="p-4 text-xs text-neutral-500">No matching records.</div>}</div></div>}
  </section>;
}
