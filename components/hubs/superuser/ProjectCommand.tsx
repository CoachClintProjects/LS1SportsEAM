'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Users, ShieldCheck, CalendarDays } from 'lucide-react';

type Task = { id: string; code: string; name: string; description: string | null; status: string; percent_complete: number; start_date: string | null; target_date: string | null; sort_order: number; blocker: string | null };
type Raci = { id: string; task_id: string | null; responsibility: 'R'|'A'|'C'|'I'; person_id: string | null; role_id: string | null; notes: string | null };
type Payload = { project: { id: string; name: string; status: string; start_date: string|null; target_date: string|null } | null; tasks: Task[]; raci: Raci[]; generatedAt: string; error?: string };

const groups: Array<{label:string; codes:string[]}> = [
  { label: 'Foundation & Governance', codes: ['DB-FOUNDATION','SECURITY-RLS','COMPLIANCE'] },
  { label: 'Core Product', codes: ['DATA-ONBOARDING','SUPERUSER','ATHLETE','TEAM-MANAGER','COMPETITION'] },
  { label: 'Enterprise Services', codes: ['FINANCE','INTEGRATIONS','AI-AUTOMATION'] },
  { label: 'Release', codes: ['TEST-RELEASE'] },
];

function pct(task: Task) { return Math.max(0, Math.min(100, Number(task.percent_complete) || 0)); }
function dateLabel(value: string|null) { return value ? new Date(`${value}T00:00:00`).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}) : 'TBD'; }

export default function ProjectCommand() {
  const [data,setData] = useState<Payload|null>(null);
  const [open,setOpen] = useState<string|null>(null);
  const [showRaci,setShowRaci] = useState(false);

  useEffect(() => {
    let cancelled=false;
    fetch('/api/superuser-command',{cache:'no-store'}).then(r=>r.json()).then((v:Payload)=>{if(!cancelled)setData(v)}).catch(()=>{if(!cancelled)setData({project:null,tasks:[],raci:[],generatedAt:new Date().toISOString(),error:'Command data unavailable'})});
    return ()=>{cancelled=true};
  },[]);

  const taskMap = useMemo(()=>new Map((data?.tasks??[]).map(t=>[t.code,t])),[data]);
  const overall = useMemo(()=>{const tasks=data?.tasks??[]; return tasks.length?Math.round(tasks.reduce((a,t)=>a+pct(t),0)/tasks.length):0},[data]);
  const raciFor = (taskId:string) => (data?.raci??[]).filter(r=>r.task_id===taskId);

  return <section className="rounded-2xl border border-neutral-800 bg-[#090b0b] p-6 lg:p-7">
    <div className="flex flex-wrap items-end justify-between gap-5">
      <div>
        <div className="text-[9px] font-black uppercase tracking-[0.24em] text-emerald-400">Master implementation control</div>
        <h2 className="mt-2 text-2xl font-black text-white">LS1Sports EAM / ERP Project Command</h2>
        <p className="mt-2 max-w-3xl text-xs leading-5 text-neutral-500">The implementation roadmap is the first SuperUser surface. Workstreams, progress and governance are records—not decorative dashboard values.</p>
      </div>
      <div className="flex items-center gap-4 rounded-xl border border-neutral-800 bg-[#0d1010] px-5 py-4">
        <div><div className="text-[8px] font-black uppercase tracking-[0.18em] text-neutral-600">Portfolio progress</div><div className="mt-1 text-3xl font-black text-white">{overall}%</div></div>
        <div className="w-36"><div className="h-2 overflow-hidden rounded-full bg-neutral-800"><div className="h-full rounded-full bg-emerald-400" style={{width:`${overall}%`}}/></div><div className="mt-2 text-[8px] uppercase tracking-[0.12em] text-neutral-600">Live project records</div></div>
      </div>
    </div>

    {data?.error && <div className="mt-4 rounded-xl border border-amber-900/50 bg-amber-950/20 px-4 py-3 text-xs text-amber-300">{data.error}</div>}

    <div className="mt-6 overflow-x-auto rounded-xl border border-neutral-800 bg-[#060808] p-4">
      <div className="min-w-[920px]">
        <div className="grid grid-cols-[260px_120px_1fr_150px] gap-4 border-b border-neutral-800 px-3 pb-3 text-[8px] font-black uppercase tracking-[0.18em] text-neutral-600"><span>Workstream</span><span>Status</span><span>Timeline / progress</span><span>Target</span></div>
        <div className="mt-2 space-y-1">
          {groups.flatMap(g=>g.codes.map(code=>taskMap.get(code))).filter(Boolean).map((task)=>{const t=task as Task; const isOpen=open===t.id; return <React.Fragment key={t.id}>
            <button type="button" onClick={()=>setOpen(isOpen?null:t.id)} className="grid w-full grid-cols-[260px_120px_1fr_150px] items-center gap-4 rounded-lg px-3 py-3 text-left hover:bg-[#0d1010]">
              <span className="flex items-center gap-2 text-sm font-bold text-white">{isOpen?<ChevronDown className="h-4 w-4 text-neutral-500"/>:<ChevronRight className="h-4 w-4 text-neutral-500"/>}{t.name}</span>
              <span className="text-[9px] font-black uppercase tracking-[0.12em] text-neutral-500">{t.status}</span>
              <span><span className="mb-2 block h-2 rounded-full bg-neutral-800"><span className="block h-full rounded-full bg-emerald-400" style={{width:`${pct(t)}%`}}/></span><span className="text-[9px] text-neutral-600">{pct(t)}% complete</span></span>
              <span className="flex items-center gap-2 text-[10px] text-neutral-500"><CalendarDays className="h-3 w-3"/>{dateLabel(t.target_date)}</span>
            </button>
            {isOpen && <div className="mx-3 mb-2 rounded-xl border border-neutral-800 bg-[#0b0e0e] p-4"><p className="text-xs leading-5 text-neutral-400">{t.description}</p>{t.blocker&&<p className="mt-3 text-xs text-amber-300">Blocker: {t.blocker}</p>}<div className="mt-4 flex flex-wrap gap-2">{raciFor(t.id).map(r=><span key={r.id} className="rounded-md border border-neutral-700 px-2 py-1 text-[9px] font-black text-neutral-300">{r.responsibility} · {r.person_id??'Unassigned'}</span>)}</div></div>}
          </React.Fragment>})}
        </div>
      </div>
    </div>

    <div className="mt-5 border-t border-neutral-800 pt-5">
      <button type="button" onClick={()=>setShowRaci(!showRaci)} className="flex w-full items-center justify-between rounded-xl border border-neutral-800 bg-[#0d1010] px-4 py-4 text-left hover:bg-[#111414]"><span className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-emerald-400"/><span><span className="block text-sm font-black text-white">RACI implementation governance</span><span className="mt-1 block text-[9px] uppercase tracking-[0.14em] text-neutral-600">Responsible · Accountable · Consulted · Informed</span></span></span>{showRaci?<ChevronDown className="h-4 w-4 text-neutral-500"/>:<ChevronRight className="h-4 w-4 text-neutral-500"/>}</button>
      {showRaci&&<div className="mt-3 overflow-x-auto rounded-xl border border-neutral-800"><table className="min-w-[760px] w-full text-left"><thead><tr className="border-b border-neutral-800 text-[8px] uppercase tracking-[0.16em] text-neutral-600"><th className="px-4 py-3">Workstream</th><th className="px-4 py-3">R</th><th className="px-4 py-3">A</th><th className="px-4 py-3">C</th><th className="px-4 py-3">I</th></tr></thead><tbody>{(data?.tasks??[]).map(t=>{const rows=raciFor(t.id); const by=(x:string)=>rows.filter(r=>r.responsibility===x).map(r=>r.person_id??r.role_id??'Unassigned').join(', ')||'Unassigned'; return <tr key={t.id} className="border-b border-neutral-900 text-xs"><td className="px-4 py-3 font-bold text-white">{t.name}</td><td className="px-4 py-3 text-neutral-400">{by('R')}</td><td className="px-4 py-3 text-neutral-400">{by('A')}</td><td className="px-4 py-3 text-neutral-400">{by('C')}</td><td className="px-4 py-3 text-neutral-400">{by('I')}</td></tr>})}</tbody></table></div>}
    </div>
    <div className="mt-4 flex items-center gap-2 text-[8px] uppercase tracking-[0.14em] text-neutral-600"><Users className="h-3 w-3"/>Governance assignments remain unassigned until real people/roles are provisioned; the UI never invents ownership.</div>
  </section>;
}
