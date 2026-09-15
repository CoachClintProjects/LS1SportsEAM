'use client';

import { useMemo, useState } from 'react';
import { renderIconSync } from '@/lib/icons';

type Organization = { id:string; name:string; legalName:string; type:string; location:string; status:string; teamName:string };

const HPAC: Organization = {
  id:'c9032ebb-0507-5004-b1ad-0bca7cf3cc53',
  name:'High Performance Aquatic Club',
  legalName:'High Performance Aquatic Club',
  type:'Club',
  location:'Corpus Christi, Texas',
  status:'ACTIVE',
  teamName:'Banana Slugs',
};

export function OrganizationArchitecture(){
 const[orgs,setOrgs]=useState<Organization[]>([HPAC]);const[query,setQuery]=useState('');const[selected,setSelected]=useState<Organization|null>(null);const[mode,setMode]=useState<'view'|'edit'|'add'|null>(null);const[draft,setDraft]=useState<Organization>(HPAC);
 const Building2Icon=renderIconSync('building2'),UsersIcon=renderIconSync('users'),MapPinIcon=renderIconSync('map-pin'),PlusIcon=renderIconSync('plus'),SearchIcon=renderIconSync('search');
 const visible=useMemo(()=>orgs.filter(o=>`${o.name} ${o.teamName} ${o.location}`.toLowerCase().includes(query.toLowerCase())),[orgs,query]);
 function openView(org:Organization){setSelected(org);setDraft(org);setMode('view');}
 function openEdit(org:Organization){setSelected(org);setDraft(org);setMode('edit');}
 function openAdd(){const fresh={id:`new-${Date.now()}`,name:'',legalName:'',type:'Club',location:'',status:'ACTIVE',teamName:''};setSelected(null);setDraft(fresh);setMode('add');}
 function save(){if(!draft.name.trim())return;if(mode==='add')setOrgs(prev=>[...prev,draft]);else setOrgs(prev=>prev.map(o=>o.id===draft.id?draft:o));setSelected(draft);setMode('view');}
 return <div className="p-6 text-white">
  <div className="mb-6 flex items-center justify-between"><div><div className="text-[9px] font-black uppercase tracking-[0.24em] text-[#FA4616]">🏢 Organization</div><h1 className="mt-1 text-2xl font-black">Organization Architecture</h1><p className="text-sm text-neutral-400">Manage organization identity and structure</p></div><button onClick={openAdd} className="flex items-center gap-2 rounded-xl bg-[#FA4616] px-4 py-2 text-sm font-bold text-black">{PlusIcon} Add Organization</button></div>
  <div className="mb-6"><div className="relative max-w-sm"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">{SearchIcon}</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search organizations..." className="w-full rounded-xl border border-neutral-800 bg-[#090b0b] py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-neutral-500 focus:border-[#FA4616] focus:outline-none"/></div></div>
  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{visible.map(org=><div key={org.id} className="rounded-2xl border border-neutral-800 bg-[#090b0b] p-6"><div className="flex items-start justify-between"><div className="flex items-center gap-3"><div className="rounded-lg bg-[#FA4616]/10 p-2.5 text-[#FA4616]">{Building2Icon}</div><div><div className="font-bold">{org.name}</div><div className="mt-0.5 text-xs font-semibold text-neutral-300">{org.teamName}</div><div className="flex items-center gap-1 text-xs text-neutral-500">{MapPinIcon} {org.location}</div></div></div><span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs font-bold text-emerald-400">{org.status}</span></div><div className="mt-3 flex items-center gap-1 text-xs text-neutral-500">{UsersIcon} {org.type}</div><div className="mt-4 flex gap-2"><button onClick={()=>openView(org)} className="flex-1 rounded-lg border border-neutral-800 px-3 py-1.5 text-xs text-white hover:border-neutral-600">View</button><button onClick={()=>openEdit(org)} className="flex-1 rounded-lg bg-[#FA4616] px-3 py-1.5 text-xs font-bold text-black">Edit</button></div></div>)}</div>
  {mode&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6" onMouseDown={e=>{if(e.target===e.currentTarget)setMode(null)}}><div className="w-full max-w-xl rounded-2xl border border-neutral-700 bg-[#0b0d0d] p-6 shadow-2xl"><div className="flex items-center justify-between"><div><div className="text-xs font-black uppercase tracking-[.2em] text-[#FA4616]">{mode==='add'?'Add Organization':mode==='edit'?'Edit Organization':'Organization Details'}</div><h2 className="mt-1 text-xl font-black">{draft.name||'New Organization'}</h2></div><button onClick={()=>setMode(null)} className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm">Close</button></div>
   {mode==='view'?<div className="mt-6 grid gap-4 text-sm"><div><span className="text-neutral-500">Organization</span><div className="font-bold">{draft.name}</div></div><div><span className="text-neutral-500">Team identity</span><div className="font-bold">{draft.teamName}</div></div><div><span className="text-neutral-500">Location</span><div className="font-bold">{draft.location}</div></div><div><span className="text-neutral-500">Type / Status</span><div className="font-bold">{draft.type} · {draft.status}</div></div><button onClick={()=>setMode('edit')} className="mt-2 rounded-lg bg-[#FA4616] px-4 py-2 font-bold text-black">Edit Organization</button></div>:<div className="mt-6 grid gap-4"><label className="text-xs text-neutral-400">Organization name<input value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})} className="mt-1 w-full rounded-lg border border-neutral-700 bg-black px-3 py-2 text-sm text-white"/></label><label className="text-xs text-neutral-400">Team identity<input value={draft.teamName} onChange={e=>setDraft({...draft,teamName:e.target.value})} className="mt-1 w-full rounded-lg border border-neutral-700 bg-black px-3 py-2 text-sm text-white"/></label><label className="text-xs text-neutral-400">Location<input value={draft.location} onChange={e=>setDraft({...draft,location:e.target.value})} className="mt-1 w-full rounded-lg border border-neutral-700 bg-black px-3 py-2 text-sm text-white"/></label><div className="flex justify-end gap-2"><button onClick={()=>setMode(null)} className="rounded-lg border border-neutral-700 px-4 py-2 text-sm">Cancel</button><button onClick={save} className="rounded-lg bg-[#FA4616] px-4 py-2 text-sm font-bold text-black">Save</button></div><p className="text-[11px] text-amber-400">UAT note: this editor updates the current screen state only. Canonical database writes are not yet connected, so it does not pretend that a database save occurred.</p></div>}
  </div></div>}
 </div>;
}
export default OrganizationArchitecture;
