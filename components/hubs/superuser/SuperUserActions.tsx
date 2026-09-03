'use client';
import { useState } from 'react';

type Kind='client'|'ticket'|'import';
export default function SuperUserActions({onRefresh}:{onRefresh:()=>Promise<void>}){
 const [kind,setKind]=useState<Kind|null>(null),[saving,setSaving]=useState(false),[message,setMessage]=useState(''),[file,setFile]=useState<File|null>(null);
 const [form,setForm]=useState<any>({sports:'SWIMMING',severity:'MEDIUM',source_system:'Hy-Tek',format:'HY3'});
 const set=(k:string,v:string)=>setForm((x:any)=>({...x,[k]:v}));
 async function save(){
  setSaving(true);setMessage('');
  try{
   if(kind==='import'){
    if(!file)throw new Error('Select the actual result export first.');
    const fd=new FormData();fd.append('file',file);fd.append('source_system',form.source_system);fd.append('format',form.format);
    const r=await fetch('/api/competition-import',{method:'POST',body:fd});const j=await r.json();if(!r.ok)throw new Error(j.error||'Upload failed');
   }else{
    const action=kind==='client'?'create-client':'create-ticket';
    const payload=kind==='client'?{action,client_name:form.client_name,primary_admin_email:form.primary_admin_email,sports:form.sports.split(',').map((x:string)=>x.trim()).filter(Boolean)}:{action,title:form.title,description:form.description,severity:form.severity};
    const r=await fetch('/api/superuser-command',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const j=await r.json();if(!r.ok)throw new Error(j.error||'Save failed');
   }
   setMessage('Saved to the live LS1SportsEAM database.');setKind(null);setFile(null);await onRefresh();
  }catch(e){setMessage(e instanceof Error?e.message:'Save failed')}finally{setSaving(false)}
 }
 return <div className="mb-5">
  <div className="flex flex-wrap gap-2">
   <button onClick={()=>setKind('client')} className="rounded-lg bg-emerald-400 px-3 py-2 text-xs font-black text-black">+ New Client</button>
   <button onClick={()=>setKind('import')} className="rounded-lg border border-neutral-800 px-3 py-2 text-xs font-bold text-white">Upload Live Results</button>
   <button onClick={()=>setKind('ticket')} className="rounded-lg border border-neutral-800 px-3 py-2 text-xs font-bold text-white">Create Support Ticket</button>
  </div>
  {message&&<div className="mt-3 rounded-lg border border-emerald-900/50 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-300">{message}</div>}
  {kind&&<div className="mt-3 rounded-2xl border border-neutral-800 bg-[#090b0b] p-5">
   <div className="text-sm font-black text-white">{kind==='client'?'New Client Onboarding':kind==='ticket'?'New Support Ticket':'Live Competition Result Ingestion'}</div>
   <div className="mt-4 space-y-3">
    {kind==='client'&&<><input required placeholder="Client / organization name" value={form.client_name||''} onChange={e=>set('client_name',e.target.value)} className="w-full rounded-lg border border-neutral-800 bg-black p-3 text-sm text-white"/><input placeholder="Primary admin email" value={form.primary_admin_email||''} onChange={e=>set('primary_admin_email',e.target.value)} className="w-full rounded-lg border border-neutral-800 bg-black p-3 text-sm text-white"/></>}
    {kind==='ticket'&&<><input placeholder="Ticket title" value={form.title||''} onChange={e=>set('title',e.target.value)} className="w-full rounded-lg border border-neutral-800 bg-black p-3 text-sm text-white"/><textarea placeholder="Issue description" value={form.description||''} onChange={e=>set('description',e.target.value)} className="min-h-24 w-full rounded-lg border border-neutral-800 bg-black p-3 text-sm text-white"/></>}
    {kind==='import'&&<><input type="file" accept=".csv,.json,.txt,.xml,.hy3,.cl2,.mdb,.zip" onChange={e=>setFile(e.target.files?.[0]||null)} className="w-full rounded-lg border border-neutral-800 bg-black p-3 text-sm text-white"/><input value={form.source_system} onChange={e=>set('source_system',e.target.value)} placeholder="Source system" className="w-full rounded-lg border border-neutral-800 bg-black p-3 text-sm text-white"/><input value={form.format} onChange={e=>set('format',e.target.value)} placeholder="Format" className="w-full rounded-lg border border-neutral-800 bg-black p-3 text-sm text-white"/><p className="text-xs text-neutral-500">This uses the real export: CSV/JSON/XML/TXT are staged immediately; HY3/CL2/MDB/binary files are registered with lineage and queued for their parser.</p></>}
   </div>
   <div className="mt-4 flex gap-2"><button onClick={()=>void save()} disabled={saving} className="rounded-lg bg-emerald-400 px-4 py-2 text-xs font-black text-black">{saving?'Saving…':'Save to live database'}</button><button onClick={()=>setKind(null)} className="rounded-lg border border-neutral-800 px-4 py-2 text-xs text-neutral-300">Cancel</button></div>
  </div>}
 </div>;
}