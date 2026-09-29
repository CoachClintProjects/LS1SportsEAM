'use client';
import {useEffect,useState} from 'react';import{useRouter,useSearchParams}from'next/navigation';import{authenticatedFetch}from'@/lib/client/authenticatedFetch';
import{CommandCenter}from'./CommandCenter';import{PlanningScheduler}from'./PlanningScheduler';import{OrganizationArchitecture}from'./OrganizationArchitecture';import{TeamManager}from'./TeamManager';import{RegistrarValidation}from'./RegistrarValidation';import{FinanceAccounting}from'./FinanceAccounting';import{Facilities}from'./Facilities';import{Payroll}from'./Payroll';import{Imports}from'./Imports';import{Compliance}from'./Compliance';import{Reporting}from'./Reporting';import{AdminCompetitionOperations}from'./AdminCompetitionOperations';import{CommunicationsOperations}from'./CommunicationsOperations';import{VolunteerOperations}from'./VolunteerOperations';import{FundraisingOperations}from'./FundraisingOperations';import{FamilyOperations}from'./FamilyOperations';import{VendorDirectory}from'./VendorDirectory';import{ExternalOrganizationDirectory}from'./ExternalOrganizationDirectory';
const registry:Record<string,React.ComponentType<{role?:string}>>={CommandCenter,CommunicationsOperations,VolunteerOperations,FundraisingOperations,FamilyOperations,PlanningScheduler,OrganizationArchitecture,TeamManager,RegistrarValidation,FinanceAccounting,Facilities,Payroll,Imports,Compliance,Reporting,AdminCompetitionOperations,VendorDirectory,ExternalOrganizationDirectory,RostersView:TeamManager,MembershipView:RegistrarValidation,ProgramsView:OrganizationArchitecture,TeamsView:OrganizationArchitecture,SeasonsView:OrganizationArchitecture,BillingView:FinanceAccounting,InvoicesView:FinanceAccounting,PaymentsView:FinanceAccounting};
const Fallback=({message='Admin workspace unavailable.'}:{message?:string})=><div className="flex h-full items-center justify-center p-12"><div className="text-center"><div className="text-2xl font-black text-white">Admin Workspace</div><p className="mt-2 text-sm text-neutral-500">{message}</p></div></div>;
type OrganizationOption = {id:string;tenant_id:string;name:string;code:string};
export function AdminWorkspace(){
 const searchParams=useSearchParams(),router=useRouter(),role=searchParams.get('role')||'org_admin';
 const[Component,setComponent]=useState<React.ComponentType<{role?:string}>|null>(null);
 const[loading,setLoading]=useState(true),[switcher,setSwitcher]=useState<any[]>([]),[error,setError]=useState('');
 const[contextLoaded,setContextLoaded]=useState(false),[organizations,setOrganizations]=useState<OrganizationOption[]>([]);
 const[userId,setUserId]=useState(''),[selectedOrganization,setSelectedOrganization]=useState(''),[selectionRequired,setSelectionRequired]=useState(false);
 useEffect(()=>{let cancelled=false;async function loadContext(){try{
  const response=await authenticatedFetch('/api/admin-context',{cache:'no-store'}),body=await response.json();
  if(!response.ok)throw new Error(body.error||'Admin context unavailable.');
  const options=(body.organizations||[]) as OrganizationOption[],stored=sessionStorage.getItem(`ls1-admin-organization:${body.userId}`)||'';
  const selected=options.some(x=>x.id===stored)?stored:'';
  if(stored&&!selected)sessionStorage.removeItem(`ls1-admin-organization:${body.userId}`);
  if(!cancelled){setUserId(body.userId);setOrganizations(options);setSelectionRequired(body.selectionRequired);setSelectedOrganization(selected);setContextLoaded(true);}
 }catch(e){if(!cancelled){setError(e instanceof Error?e.message:'Admin context unavailable.');setContextLoaded(true);setLoading(false);}}}void loadContext();return()=>{cancelled=true}},[]);
 useEffect(()=>{if(!contextLoaded||selectionRequired&&!selectedOrganization)return;let cancelled=false;async function load(){setLoading(true);setError('');try{
  let view=searchParams.get('view');const nav=await authenticatedFetch(`/api/admin-navigation?role=${encodeURIComponent(role)}`,{cache:'no-store'});
  if(!nav.ok)throw new Error('Admin navigation unavailable.');const j=await nav.json();if(!cancelled)setSwitcher(j.switcher||[]);
  if(!view)view=(j.rows||[]).find((x:any)=>x.label==='Command Center')?.nav_id||'';
  if(!view)throw new Error('No authorized Admin workspace is available.');
  const response=await authenticatedFetch(`/api/admin-workspace?view=${encodeURIComponent(view)}&role=${encodeURIComponent(role)}`,{cache:'no-store'});
  const json=await response.json();if(!response.ok)throw new Error(json.error||'Admin workspace unavailable.');
  const name=json.view?.component||'',C=registry[name];if(!C)throw new Error(`Operational component "${name||json.view?.label||view}" is not implemented.`);
  if(!cancelled)setComponent(()=>C);
 }catch(e){if(!cancelled){setComponent(null);setError(e instanceof Error?e.message:'Admin workspace unavailable.')}}finally{if(!cancelled)setLoading(false)}}void load();return()=>{cancelled=true}},[searchParams,role,contextLoaded,selectionRequired,selectedOrganization]);
 if(!contextLoaded||loading&&(!selectionRequired||selectedOrganization))return <div className="flex h-full items-center justify-center p-12 text-sm text-neutral-500">Loading authorized workspace…</div>;
 if(error)return <Fallback message={error}/>;
 if(selectionRequired&&!selectedOrganization)return <div className="mx-auto max-w-lg p-8 text-white"><h1 className="text-2xl font-black">Select an organization</h1><p className="mt-2 text-sm text-neutral-400">Choose the canonical organization whose Admin work you are opening.</p><div className="mt-5 space-y-2">{organizations.map(org=><button key={org.id} onClick={()=>{sessionStorage.setItem(`ls1-admin-organization:${userId}`,org.id);setSelectedOrganization(org.id);}} className="block w-full rounded-lg border border-neutral-700 p-4 text-left hover:border-[#FA4616]">{org.name} <span className="text-neutral-500">{org.code}</span></button>)}</div>{!organizations.length&&<p className="mt-4 text-sm text-red-300">No canonical organization is available.</p>}</div>;
 if(!Component)return <Fallback message="Admin workspace unavailable."/>;
 const C=Component;
 return <div className="min-h-full w-full">{selectionRequired&&<div className="border-b border-neutral-800 bg-[#070808] px-5 py-2 text-xs text-neutral-300">Organization: {organizations.find(x=>x.id===selectedOrganization)?.name}<button onClick={()=>{sessionStorage.removeItem(`ls1-admin-organization:${userId}`);setSelectedOrganization('');setComponent(null);}} className="ml-4 text-[#FA4616]">Change</button></div>}<div className="border-b border-neutral-800 bg-[#070808] px-5 py-3"><div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Admin role context">{switcher.map((x:any)=><button key={x.option_id} role="radio" aria-checked={x.role_name===role} onClick={()=>router.push(`/admin?role=${encodeURIComponent(x.role_name)}`)} className={x.role_name===role?'rounded-full bg-[#FA4616] px-3 py-1.5 text-xs font-black text-black':'rounded-full border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300'}>{x.display_name}</button>)}</div></div><C role={role}/></div>;
}
export default AdminWorkspace;
