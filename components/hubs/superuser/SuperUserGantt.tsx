'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { authenticatedFetch } from '@/lib/client/authenticatedFetch';
import SuperUserVisualCommand from './SuperUserVisualCommand';

type Payload = {
  project?: { id:string; name:string; status:string; start_date?:string|null; target_date:string|null; description:string|null } | null;
  milestones: Array<{ id:string; code:string; name:string; domain:string; status:string; sort_order:number }>;
  tasks?: Array<{ id:string; parent_task_id?:string|null; milestone_id:string|null; code:string; name:string; description?:string|null; status:string; percent_complete:number|string; start_date?:string|null; target_date?:string|null; sort_order?:number; blocker?:string|null; evidence?:Record<string,unknown>|null }>;
  units?: Array<{ id:string; milestone_id:string|null; unit_key:string; unit_type:string; status:string; implementation_percent:number|string; operational_percent:number|string; validation_percent:number|string; evidence_source?:string|null; evidence_ref?:string|null; verified_at?:string|null; evidence?:Record<string,unknown>|null }>;
  generatedAt:string;
  source?:string;
  error?:string;
};

export default function SuperUserGantt() {
  const [data,setData]=useState<Payload|null>(null);
  const [error,setError]=useState('');
  const polling=useRef(true);

  const load=useCallback(async()=>{
    try {
      const response=await authenticatedFetch('/api/superuser-command',{cache:'no-store',credentials:'same-origin'});
      const payload=await response.json() as Payload;
      if(!response.ok||payload.error) throw new Error(payload.error||'Gantt data unavailable');
      setData(payload);
      setError('');
    } catch (e) {
      setError(e instanceof Error?e.message:'Gantt data unavailable');
    }
  },[]);

  useEffect(()=>{
    polling.current=true;
    void load();
    const tick=()=>{if(document.visibilityState==='visible'&&polling.current)void load()};
    const timer=window.setInterval(tick,15000);
    document.addEventListener('visibilitychange',tick);
    return()=>{polling.current=false;window.clearInterval(timer);document.removeEventListener('visibilitychange',tick)};
  },[load]);

  return <section aria-label="Master EAM ERP Project Gantt">
    {error&&<div className="mb-4 flex items-center gap-2 rounded-xl border border-red-900/60 bg-red-950/20 px-4 py-3 text-xs text-red-300"><AlertTriangle className="h-4 w-4"/>{error}</div>}
    <SuperUserVisualCommand data={data} requiredMilestoneIds={(data?.milestones??[]).map(m=>m.id)} excludedUnitIds={[]} onRefresh={load}/>
  </section>;
}
