'use client';

import { useCallback,useEffect,useMemo,useState } from 'react';
import { RefreshCw,ShieldCheck,UserCog,WalletCards } from 'lucide-react';
import { authenticatedFetch } from '@/lib/client/authenticatedFetch';

type Row=Record<string,any>;
type Snapshot={organization:Row;people:Row[];grants:Row[];rules:Row[]};
type Payload={organizations:Row[];snapshot:Snapshot|null;error?:string};
const actions=[
 {key:'decide',label:'Decide cases',detail:'Propose, second-approve and execute governed case decisions.'},
 {key:'approve_financial_remedy',label:'Approve remedies',detail:'Authorize refunds, credits, waivers and other financial remedies.'},
 {key:'execute_financial_remedy',label:'Execute remedies',detail:'Move an approved remedy into canonical financial execution.'},
] as const;

export function AdminURWSAuthorityWorkspace(){
 const[data,setData]=useState<Payload>({organizations:[],snapshot:null});
 const[selectedOrg,setSelectedOrg]=useState('');
 const[loading,setLoading]=useState(true),[working,setWorking]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const[requiresSecond,setRequiresSecond]=useState(false),[threshold,setThreshold]=useState(''),[currency,setCurrency]=useState('CAD');

 const load=useCallback(async(orgId?:string)=>{
  setLoading(true);setError('');
  try{
   const q=orgId?`?organization_id=${encodeURIComponent(orgId)}`:'';
   const r=await authenticatedFetch(`/api/admin-urws-authority${q}`,{cache:'no-store'});const j=await r.json();
   if(!r.ok)throw new Error(j.error||'Unable to load URWS authority.');
   setData(j);
   const nextOrg=orgId||j.snapshot?.organization?.id||j.organizations?.[0]?.id||'';setSelectedOrg(String(nextOrg));
   const orgDecisionRule=(j.snapshot?.rules||[]).find((x:Row)=>x.organization_id&&x.action==='decide_case');
   setRequiresSecond(Boolean(orgDecisionRule?.requires_second_approval));
   setThreshold(orgDecisionRule?.min_financial_amount==null?'':String(orgDecisionRule.min_financial_amount));
   setCurrency(String(orgDecisionRule?.currency||'CAD'));
  }catch(e){setError(e instanceof Error?e.message:'Unable to load URWS authority.')}finally{setLoading(false)}
 },[]);
 useEffect(()=>{void load()},[load]);

 async function post(body:Row,success:string){
  setWorking(true);setError('');setNotice('');
  try{const r=await authenticatedFetch('/api/admin-urws-authority',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const j=await r.json();if(!r.ok)throw new Error(j.error||'Authority change failed.');setNotice(success);await load(selectedOrg)}
  catch(e){setError(e instanceof Error?e.message:'Authority change failed.')}finally{setWorking(false)}
 }

 const snap=data.snapshot;
 const activeGrant=useCallback((personId:string,action:string)=>Boolean((snap?.grants||[]).find(g=>g.person_id===personId&&g.action===action&&g.status==='active'&&(!g.valid_until||new Date(g.valid_until).getTime()>=Date.now()))),[snap]);
 const decisionRule=useMemo(()=>snap?.rules?.find(r=>r.organization_id&&r.action==='decide_case')||snap?.rules?.find(r=>!r.organization_id&&r.action==='decide_case'),[snap]);

 return <main className="min-h-full bg-[#060707] p-5 text-white lg:p-7">
  <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2 text-sm font-black uppercase tracking-[.16em] text-[#FA4616]"><UserCog className="h-5 w-5"/>URWS Authority Control</div><h1 className="mt-2 text-3xl font-black">Who may decide, approve, and execute</h1><p className="mt-2 max-w-4xl text-sm leading-6 text-neutral-300">Roles open the Admin workspace; explicit authority grants control consequential URWS actions. No operator receives authority automatically.</p></div><button onClick={()=>void load(selectedOrg)} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-neutral-700 px-4 py-3 text-sm font-black"><RefreshCw className={`h-4 w-4 ${loading?'animate-spin':''}`}/>Refresh</button></div>
  {error&&<div className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-100">{error}</div>}
  {notice&&<div className="mt-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-100">{notice}</div>}

  <section className="mt-6 rounded-2xl border border-neutral-800 bg-[#0b0d0d] p-5"><label className="text-xs font-black uppercase tracking-wide text-neutral-500">Organization<select value={selectedOrg} onChange={e=>{setSelectedOrg(e.target.value);void load(e.target.value)}} className="mt-2 w-full max-w-xl rounded-xl border border-neutral-700 bg-black p-3 text-sm text-white">{data.organizations.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label></section>

  {snap&&<div className="mt-5 space-y-5">
   <section className="rounded-2xl border border-neutral-800 bg-[#0b0d0d] p-5"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 text-[#FA4616]"/><div><h2 className="text-lg font-black">Decision approval policy</h2><p className="mt-1 text-sm leading-6 text-neutral-400">Choose whether governed case decisions need a second independently authorized person. A blank threshold applies the rule to every financial amount; a threshold applies it at and above that amount.</p></div></div><div className="mt-5 grid gap-4 md:grid-cols-3"><label className="text-sm font-bold">Second approval<select value={requiresSecond?'yes':'no'} onChange={e=>setRequiresSecond(e.target.value==='yes')} className="mt-2 w-full rounded-xl border border-neutral-700 bg-black p-3"><option value="no">Not required</option><option value="yes">Required</option></select></label><label className="text-sm font-bold">Financial threshold<input value={threshold} onChange={e=>setThreshold(e.target.value)} inputMode="decimal" placeholder="Blank = all amounts" className="mt-2 w-full rounded-xl border border-neutral-700 bg-black p-3"/></label><label className="text-sm font-bold">Currency<input value={currency} onChange={e=>setCurrency(e.target.value.toUpperCase().slice(0,3))} maxLength={3} className="mt-2 w-full rounded-xl border border-neutral-700 bg-black p-3 uppercase"/></label></div><div className="mt-4 flex flex-wrap items-center justify-between gap-3"><div className="text-xs text-neutral-500">Effective source: <b className="text-neutral-300">{decisionRule?.scope||'none'}</b>{decisionRule?.organization_id?' · organization override':' · global fallback'}</div><button disabled={working} onClick={()=>void post({action:'set-decision-policy',organization_id:selectedOrg,requires_second_approval:requiresSecond,min_financial_amount:threshold,currency},'Decision approval policy updated.')} className="rounded-xl bg-[#FA4616] px-5 py-3 text-sm font-black text-black disabled:opacity-40">Save approval policy</button></div></section>

   <section className="rounded-2xl border border-neutral-800 bg-[#0b0d0d] p-5"><div className="flex items-start gap-3"><WalletCards className="mt-0.5 h-5 w-5 text-[#FA4616]"/><div><h2 className="text-lg font-black">Operator authority grants</h2><p className="mt-1 text-sm leading-6 text-neutral-400">Only real people with an active role assignment in this organization appear here. Grant only the authority they need; revocation takes effect at the database boundary.</p></div></div>
    <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[860px] border-collapse text-sm"><thead><tr className="border-b border-neutral-800 text-left text-[11px] font-black uppercase tracking-wide text-neutral-500"><th className="p-3">Operator</th>{actions.map(a=><th key={a.key} className="p-3">{a.label}</th>)}</tr></thead><tbody>{snap.people.map(person=><tr key={person.person_id} className="border-b border-neutral-900 align-top"><td className="p-3"><div className="font-black">{person.display_name}</div><div className="mt-1 text-xs text-neutral-500">{Array.isArray(person.roles)?person.roles.join(' · '):''}</div></td>{actions.map(a=>{const enabled=activeGrant(person.person_id,a.key);return <td key={a.key} className="p-3"><button disabled={working} onClick={()=>void post({action:'set-grant',organization_id:selectedOrg,person_id:person.person_id,authority_action:a.key,enabled:!enabled},`${a.label} authority ${enabled?'revoked':'granted'} for ${person.display_name}.`)} className={`rounded-lg border px-3 py-2 text-xs font-black ${enabled?'border-emerald-500/30 bg-emerald-500/10 text-emerald-100':'border-neutral-700 bg-neutral-950 text-neutral-300'}`}>{enabled?'Granted · revoke':'Not granted · grant'}</button><div className="mt-2 max-w-52 text-xs leading-5 text-neutral-600">{a.detail}</div></td>})}</tr>)}{!snap.people.length&&<tr><td colSpan={4} className="p-8 text-center text-neutral-500">No active organization operators are available for authority assignment.</td></tr>}</tbody></table></div>
   </section>

   <section className="rounded-2xl border border-neutral-800 bg-[#0b0d0d] p-5"><h2 className="text-lg font-black">Authority evidence</h2><div className="mt-4 grid gap-3 md:grid-cols-3"><div className="rounded-xl border border-neutral-800 p-4"><div className="text-xs font-black uppercase tracking-wide text-neutral-500">Active grants</div><div className="mt-2 text-2xl font-black">{snap.grants.filter(g=>g.status==='active').length}</div></div><div className="rounded-xl border border-neutral-800 p-4"><div className="text-xs font-black uppercase tracking-wide text-neutral-500">Eligible operators</div><div className="mt-2 text-2xl font-black">{snap.people.length}</div></div><div className="rounded-xl border border-neutral-800 p-4"><div className="text-xs font-black uppercase tracking-wide text-neutral-500">Effective rules</div><div className="mt-2 text-2xl font-black">{snap.rules.length}</div></div></div><p className="mt-4 text-xs leading-5 text-neutral-500">These are canonical database records. Zero means no authority has been granted; it is not a demo or inferred permission.</p></section>
  </div>}
 </main>
}

export default AdminURWSAuthorityWorkspace;
