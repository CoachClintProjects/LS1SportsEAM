'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let supabase: SupabaseClient | null = null;
function getSupabaseClient() { if (supabase) return supabase; if (typeof window === 'undefined') throw new Error('Supabase browser client is unavailable during server prerender.'); const url=process.env.NEXT_PUBLIC_SUPABASE_URL; const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; if(!url||!key) throw new Error('Supabase browser configuration is missing.'); supabase=createClient(url,key); return supabase; }

import { CommandCenter } from './CommandCenter';
import { OrganizationArchitecture } from './OrganizationArchitecture';
import { TeamManager } from './TeamManager';
import { RegistrarValidation } from './RegistrarValidation';
import { FinanceAccounting } from './FinanceAccounting';
import { Facilities } from './Facilities';
import { Payroll } from './Payroll';
import { Imports } from './Imports';
import { Compliance } from './Compliance';
import { Reporting } from './Reporting';
import { VendorDirectory, ExternalOrganizationDirectory } from './RelationshipDirectory';
import { RostersView,BillingView,InvoicesView,PaymentsView } from './AdminDataWorkspaces';
import { MembershipView,ProgramsView,TeamsView,SeasonsView } from './AdminTeamDataWorkspaces';
import { AdminCompetitionOperations } from './AdminCompetitionOperations';
import { AdminURWSWorkspace } from './AdminURWSWorkspace';
import { AdminURWSExecutionWorkspace } from './AdminURWSExecutionWorkspace';

const componentRegistry: Record<string, React.ComponentType> = { CommandCenter,OrganizationArchitecture,TeamManager,RegistrarValidation,RostersView,MembershipView,ProgramsView,TeamsView,SeasonsView,FinanceAccounting,BillingView,InvoicesView,PaymentsView,Facilities,VendorDirectory,ExternalOrganizationDirectory,Payroll,Imports,Compliance,Reporting,AdminCompetitionOperations,AdminURWSWorkspace,AdminURWSExecutionWorkspace };
const FallbackComponent=({componentName}:{componentName?:string})=><div className="flex h-full items-center justify-center p-12"><div className="text-center"><div className="text-2xl font-black text-white">Admin Workspace</div><p className="mt-2 text-sm text-neutral-500">{componentName?`Component "${componentName}" is being built.`:'This workspace is being built.'}</p></div></div>;

export function AdminWorkspace(){
 const searchParams=useSearchParams(); const[activeView,setActiveView]=useState<string|null>(null); const[ActiveComponent,setActiveComponent]=useState<React.ComponentType|null>(null); const[loading,setLoading]=useState(true);
 useEffect(()=>{const view=searchParams.get('view');if(view){setActiveView(view);return}const loadDefaultView=async()=>{try{const client=getSupabaseClient();const{data}=await client.from('hub_navigation').select('nav_id').eq('hub_id','admin').eq('label','Command Center').single();setActiveView(data?.nav_id||'command-center')}catch{setActiveView('command-center')}};void loadDefaultView()},[searchParams]);
 useEffect(()=>{if(!activeView)return;const loadComponent=async()=>{setLoading(true);try{const client=getSupabaseClient();let{data}=await client.from('hub_navigation').select('component,label').eq('hub_id','admin').eq('nav_id',activeView).maybeSingle();if(!data){const byPath=await client.from('hub_navigation').select('component,label').eq('hub_id','admin').eq('path',`/admin?view=${activeView}`).maybeSingle();data=byPath.data}if(data?.component){const Component=componentRegistry[data.component];setActiveComponent(()=>Component||(()=> <FallbackComponent componentName={data?.component||undefined}/>))}else if(data?.label){const label=data.label;setActiveComponent(()=>()=> <div className="p-6 text-white"><h1 className="text-2xl font-black">{label}</h1><p className="mt-2 text-neutral-400">Select an item from this section.</p></div>)}else setActiveComponent(()=>()=> <FallbackComponent/>)}catch(error){console.error('Unable to load Admin workspace component:',error);setActiveComponent(()=>()=> <FallbackComponent/>)}finally{setLoading(false)}};void loadComponent()},[activeView]);
 if(loading)return <div className="flex h-full items-center justify-center p-12"><div className="text-sm text-neutral-500">Loading...</div></div>;const ComponentToRender=ActiveComponent||FallbackComponent;return <div className="min-h-full w-full"><ComponentToRender/></div>
}
export default AdminWorkspace;
