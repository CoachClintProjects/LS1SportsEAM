'use client';
import { useRouter } from 'next/navigation';
import { Bell,Database,FileClock,GitBranch,Settings,ShieldCheck,Users } from 'lucide-react';
const items=[
 {title:'Users & Access',description:'Client users, multiple security roles, scopes and engine access.',icon:Users,view:'users-access',active:true},
 {title:'Admin Engine Configuration',description:'Organization-level defaults and operating rules for the Admin engine.',icon:Settings,active:false},
 {title:'Workflows & Approvals',description:'Approval paths, lifecycle rules, escalation and human authority gates.',icon:GitBranch,active:false},
 {title:'Communications',description:'Administrative notifications, templates, delivery defaults and escalation channels.',icon:Bell,active:false},
 {title:'Data & Integrations',description:'Imports, mappings, canonical data controls and connected systems.',icon:Database,active:false},
 {title:'Audit & Governance',description:'Privileged changes, access history, approvals and governance evidence.',icon:FileClock,active:false},
];
export function AdminSettings(){const router=useRouter();return <div className="min-h-full bg-[#080909] p-6 text-white"><div className="flex items-start justify-between"><div><div className="text-[10px] font-black uppercase tracking-[.22em] text-[#FA4616]">Admin Control Plane</div><h1 className="mt-2 text-2xl font-black">Settings</h1><p className="mt-2 max-w-3xl text-sm text-neutral-400">Configuration is contextual to the Admin engine and constrained by the signed-in user's effective security profile.</p></div><ShieldCheck className="h-7 w-7 text-[#FA4616]"/></div><div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{items.map(({title,description,icon:Icon,view,active})=><button key={title} disabled={!active} onClick={()=>view&&router.push(`/admin?view=${view}`)} className={`rounded-xl border p-5 text-left ${active?'border-neutral-800 bg-[#0d0f0f] hover:border-[#FA4616]/50':'cursor-not-allowed border-neutral-900 bg-[#0a0b0b] opacity-55'}`}><Icon className="h-5 w-5 text-[#FA4616]"/><div className="mt-4 text-sm font-black">{title}</div><div className="mt-2 text-xs leading-5 text-neutral-500">{description}</div><div className="mt-4 text-[9px] font-black uppercase tracking-[.16em] text-neutral-600">{active?'Operational':'Not yet connected'}</div></button>)}</div></div>}
export default AdminSettings;
