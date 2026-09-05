'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Database, RefreshCw, ShieldCheck, Workflow } from 'lucide-react';
import { getNavigation, NavigationSection } from '@/components/experience/HubNavigation/navigationDefinitions';

type Row = Record<string, any>;
type CommandPayload = { project: Row|null; milestones: Row[]; tasks: Row[]; raci: Row[]; counts: Record<string,number|null>; generatedAt:string; source?:string; error?:string };
type MetricRow = { table:string; label:string; count:number|null };
type ModulePayload = { view:string; label:string; metrics:MetricRow[]; generatedAt:string; source:string; error?:string };

const clientItems: Record<string,string> = {
 'all-clients':'All Clients','new-client':'New Client','onboarding-queue':'Onboarding Queue','active-clients':'Active Clients','client-exceptions':'At-Risk / Exceptions','client-updates':'Existing Client Updates',settings:'Platform / Site Settings','role-customization':'Role-Specific Customization'
};
const clientSections: Record<string,string> = {
 'all-clients':'CLIENT OPERATIONS','new-client':'CLIENT OPERATIONS','onboarding-queue':'CLIENT OPERATIONS','active-clients':'CLIENT OPERATIONS','client-exceptions':'CLIENT OPERATIONS','client-updates':'CLIENT OPERATIONS',settings:'SETTINGS & CUSTOMIZATION','role-customization':'SETTINGS & CUSTOMIZATION'
};

const descriptions: Record<string,string> = {
 platform:'Tenant, sport, localization, rules, configuration and platform reference control.',
 organizations:'Organization hierarchy, sites, governing-body relationships and legal operating structure.',
 people:'Canonical person identity, families, users, external IDs and duplicate resolution.',
 'team-manager':'Organizations, teams, rosters, memberships, programs, seasons, staff, groups and team communications.',
 athletes:'Athlete master records, sport participation, longitudinal development and performance intelligence.',
 'financial-overview':'Enterprise financial position across billing, revenue, payments, expenses, budgets and accounting.',
 'general-ledger':'Chart of accounts, ledgers, journal control, postings and fiscal periods.',
 receivables:'Customer balances, invoices, receipts, allocations and AR adjustments.',
 payables:'Vendor obligations, bills and controlled outgoing payments.',
 revenue:'Revenue lifecycle from invoicing through receipts, credits and refunds.',
 costs:'Operating expense, purchasing and cost-center visibility.',
 budgets:'Budget ownership and budget-line control across the enterprise.',
 forecasting:'Forward-looking financial planning using budget and historical metric evidence.',
 profitability:'Revenue and cost performance by profit-center and financial dimension.',
 'cash-flow':'Bank account, transaction, receipt and disbursement visibility.',
 facilities:'Facility, site, booking and closure readiness.',
 assets:'Asset inventory, condition, meter history and fixed-asset lifecycle.',
 maintenance:'Maintenance work orders, labor, material and condition evidence.',
 resources:'Resource and inventory availability across operating locations.',
 identity:'One-person/one-identity control across application access and external identities.',
 roles:'Role definitions, assignments and privilege governance.',
 permissions:'Permission catalogue and role-permission enforcement.',
 raci:'Responsible, Accountable, Consulted and Informed implementation authority.',
 delegation:'Controlled delegation through role assignments, approvals and workflow.',
 sod:'Segregation-of-duties conflict visibility across roles and permissions.',
 'privileged-access':'Elevated-access posture and security-event visibility.',
 compliance:'SafeSport, safeguarding, credentials, background checks and compliance requirements.',
 'data-governance':'Data quality, lineage, canonical locking and duplicate resolution.',
 privacy:'Consent, privacy requests, media permission and sovereignty controls.',
 retention:'Retention policy, document lifecycle and legal/audit preservation.',
 audit:'Immutable operational, security, lineage and record-version evidence.',
 procurement:'Purchase request, approval, vendor and purchase-order lifecycle.',
 payroll:'Payroll run and line-item control tied to staff assignments.',
 workflow:'Workflow definitions, instances, tasks, approvals and work items.',
 integrations:'Connection health, execution runs, mappings, event log and dead-letter handling.',
 imports:'Controlled ingestion, staging, validation, reconciliation and exception handling.',
 reporting:'Report definitions, executions, dashboards and metric publication.',
 agents:'AI agent registry, tools, policies, runs and governed actions.',
 automation:'Automation definitions, steps, executions and run evidence.',
 alerts:'Operational alerts spanning notifications, security, data quality and integrations.',
 insights:'Evidence-derived operational intelligence and AI-supported recommendations.',
 product:'Feature/project implementation evidence, milestones, units, dependencies and release work.',
 deployments:'Release readiness and deployment evidence tied to implementation tasks and audit.',
 'system-health':'Platform metric, integration, security and data-quality health.',
 knowledge:'Knowledge items, SOPs and controlled document versions.',
 'all-clients':'Platform-level tenant and organization portfolio with onboarding state.',
 'new-client':'Formal 12-step provisioning workflow: tenant → organization → sports → primary admin → security → configuration → data → migration → validation → review → activation → handoff.',
 'onboarding-queue':'All in-flight client implementations, step state, migration jobs and validation exceptions.',
 'active-clients':'Activated tenants and organizations handed into normal client administration.',
 'client-exceptions':'Cross-client onboarding, data, integration and security exceptions requiring SuperUser attention.',
 'client-updates':'Existing-client roster/data updates through staging, compare, validation, human review and approved application.',
 settings:'Site-wide platform defaults and configuration controls.',
 'role-customization':'Role-specific workspace, navigation and behavior overrides without duplicating identities.'
};

const operatingLanes: Record<string,string[]> = {
 'team-manager':['Organization architecture','Teams & rosters','Membership lifecycle','Programs & seasons','Staff & groups','Two-way communications'],
 'new-client':['01 Client / Tenant','02 Organization','03 Sport(s)','04 Primary Organization Admin','05 Security & Roles','06 Configuration','07 Data Sources','08 Import / Migration','09 Validation','10 Client Review','11 Activation','12 Handoff'],
 'client-updates':['Stage incoming source','Compare with canonical roster','Classify new / changed / transfer / departure / duplicate','Validate','Human review','Apply approved changes'],
 settings:['Brand & presentation','Platform behavior','Locale / currency / timezone','Feature defaults','Communication defaults','Data policy defaults'],
 'role-customization':['Role workspace defaults','Navigation visibility','Dashboard defaults','Operational scope','Notification preferences','Permission-safe personalization'],
 deployments:['Release candidate','Build / typecheck','Environment configuration','Deployment','Smoke validation','Release evidence'],
 'system-health':['Database','API / runtime','Integrations','Security','Data quality','Automation'],
 agents:['Registry','Permission policy','Tool access','Human approval gates','Execution','Audit'],
 compliance:['SafeSport','Safeguarding','Credentials','Background checks','Consent / waivers','Exceptions'],
 imports:['Source receipt','Staging','Validation','Identity resolution','Reconciliation','Canonical apply'],
 procurement:['Request','Approval','Purchase order','Receipt','Invoice / match','Financial posting'],
 workflow:['Definition','Trigger','Assignment','Approval','Execution','Audit'],
};

function Panel({children,className=''}:{children:React.ReactNode;className?:string}){return <section className={`rounded-2xl border border-neutral-800 bg-[#090b0b] p-6 ${className}`}>{children}</section>}
function Metric({label,value,detail}:{label:string;value:React.ReactNode;detail:string}){return <div className="rounded-xl border border-neutral-800 bg-[#0d1010] p-4"><div className="text-[8px] font-black uppercase tracking-[.18em] text-neutral-500">{label}</div><div className="mt-2 text-2xl font-black text-white">{value}</div><div className="mt-1 text-[10px] leading-4 text-neutral-500">{detail}</div></div>}

export default function SuperUserModuleWorkspace({view}:{view:string}){
 const [moduleData,setModuleData]=useState<ModulePayload|null>(null);
 const [command,setCommand]=useState<CommandPayload|null>(null);
 const [loading,setLoading]=useState(false);
 const [item,setItem]=useState<{id:string;label:string;section:string;sectionId:string;icon:string}>({id:view,label:view,section:'SUPERUSER',sectionId:'default',icon:'activity'});

 // Load navigation item asynchronously
 useEffect(() => {
   const loadNavItem = async () => {
     try {
       const navSections = await getNavigation('superuser');
       for (const section of navSections) {
         const found = section.items.find(x => x.id === view);
         if (found) {
           setItem({
             id: found.id,
             label: found.label,
             section: section.label,
             sectionId: section.id,
             icon: found.icon || 'activity'
           });
           return;
         }
       }
       // Fallback
       setItem({
         id: view,
         label: clientItems[view] ?? view,
         section: clientSections[view] ?? 'SUPERUSER',
         sectionId: view.startsWith('client') || ['all-clients','new-client','onboarding-queue','active-clients'].includes(view) ? 'client-operations' : 'configuration',
         icon: 'activity'
       });
     } catch (error) {
       console.error('Error loading navigation:', error);
       // Fallback
       setItem({
         id: view,
         label: clientItems[view] ?? view,
         section: clientSections[view] ?? 'SUPERUSER',
         sectionId: view.startsWith('client') || ['all-clients','new-client','onboarding-queue','active-clients'].includes(view) ? 'client-operations' : 'configuration',
         icon: 'activity'
       });
     }
   };
   loadNavItem();
 }, [view]);

 const load=async()=>{setLoading(true);try{const [m,c]=await Promise.all([fetch(`/api/superuser-module?view=${encodeURIComponent(view)}`,{cache:'no-store'}),fetch('/api/superuser-command',{cache:'no-store'})]);setModuleData(await m.json());setCommand(await c.json())}finally{setLoading(false)}};
 useEffect(()=>{void load();const timer=window.setInterval(()=>void load(),15000);return()=>window.clearInterval(timer)},[view]);

 const relatedTasks=useMemo(()=>{const words=(descriptions[view]??item.label).toLowerCase().split(/\W+/).filter(w=>w.length>4);return (command?.tasks??[]).filter(t=>{const text=`${t.code??''} ${t.name??''} ${t.description??''}`.toLowerCase();return words.some(w=>text.includes(w))}).slice(0,8)},[command?.tasks,item.label,view]);
 const lanes=operatingLanes[view]??(moduleData?.metrics??[]).map(m=>m.label).slice(0,6);
 const isClientOps=['all-clients','new-client','onboarding-queue','active-clients','client-exceptions','client-updates'].includes(view);
 const isSettings=['settings','role-customization'].includes(view);

 return <div className="space-y-6">
  <Panel><div className="flex flex-wrap items-start justify-between gap-5"><div><div className="text-[9px] font-black uppercase tracking-[.25em] text-emerald-400">{item.section}</div><h1 className="mt-2 text-3xl font-black text-white">{item.label}</h1><p className="mt-2 max-w-4xl text-xs leading-5 text-neutral-400">{descriptions[view]??'Live SuperUser operating surface.'}</p></div><button onClick={()=>void load()} className="rounded-xl border border-neutral-800 p-3 text-neutral-400 hover:text-white" aria-label="Refresh"><RefreshCw className={`h-4 w-4 ${loading?'animate-spin':''}`}/></button></div></Panel>
  {(moduleData?.error||command?.error)&&<div className="flex items-center gap-2 rounded-xl border border-amber-900/60 bg-amber-950/20 px-4 py-3 text-xs text-amber-300"><AlertTriangle className="h-4 w-4"/>{moduleData?.error??command?.error}</div>}
  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{(moduleData?.metrics??[]).slice(0,8).map(metric=><Metric key={metric.table} label={metric.label} value={metric.count??'—'} detail={`Live ${metric.table} records`}/>)}</div>
  <div className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
   <Panel><div className="flex items-center gap-2"><Workflow className="h-4 w-4 text-emerald-400"/><div><div className="text-[9px] font-black uppercase tracking-[.18em] text-neutral-500">Operating model</div><h2 className="text-xl font-black text-white">{isClientOps?'Client lifecycle':isSettings?'Configuration scope':'Control lanes'}</h2></div></div><div className="mt-5 grid gap-3 sm:grid-cols-2">{lanes.map((lane,index)=><div key={lane} className="rounded-xl border border-neutral-800 bg-[#0d1010] p-4"><div className="text-[8px] font-black uppercase tracking-[.15em] text-neutral-600">{String(index+1).padStart(2,'0')}</div><div className="mt-2 text-sm font-bold text-white">{lane}</div></div>)}</div></Panel>
   <Panel><div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-400"/><div><div className="text-[9px] font-black uppercase tracking-[.18em] text-neutral-500">Control posture</div><h2 className="text-xl font-black text-white">Live evidence</h2></div></div><div className="mt-5 space-y-3"><div className="rounded-xl border border-neutral-800 bg-[#0d1010] p-4 text-xs leading-5 text-neutral-400"><span className="font-bold text-white">Source:</span> {moduleData?.source??'LS1SportsEAM Supabase'}</div><div className="rounded-xl border border-neutral-800 bg-[#0d1010] p-4 text-xs leading-5 text-neutral-400"><span className="font-bold text-white">Refresh:</span> {moduleData?new Date(moduleData.generatedAt).toLocaleString():'—'}</div><div className="rounded-xl border border-neutral-800 bg-[#0d1010] p-4 text-xs leading-5 text-neutral-400"><span className="font-bold text-white">Security:</span> service-role access stays server-side; the browser receives only the domain telemetry needed by this workspace.</div></div></Panel>
  </div>
  <Panel><div className="flex items-center gap-2"><Activity className="h-4 w-4 text-emerald-400"/><div><div className="text-[9px] font-black uppercase tracking-[.18em] text-neutral-500">Implementation</div><h2 className="text-xl font-black text-white">Related build evidence</h2></div></div><div className="mt-5 space-y-2">{relatedTasks.length?relatedTasks.map(task=><div key={task.id} className="grid gap-2 rounded-xl border border-neutral-800 bg-[#0d1010] p-4 sm:grid-cols-[1fr_auto] sm:items-center"><div><div className="text-sm font-bold text-white">{task.code} · {task.name}</div><div className="mt-1 text-[10px] text-neutral-500">{task.status}{task.blocker?` · blocker: ${task.blocker}`:''}</div></div><div className="text-xl font-black text-white">{task.percent_complete??0}%</div></div>):<div className="rounded-xl border border-neutral-800 bg-[#0d1010] p-4 text-xs text-neutral-500">No implementation task is mapped specifically to this domain yet. Domain telemetry above remains live; implementation evidence will appear when its project units are mapped.</div>}</div></Panel>
  {view==='new-client'&&<Panel><div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400"/><div><div className="text-[9px] font-black uppercase tracking-[.18em] text-neutral-500">Provisioning</div><h2 className="text-xl font-black text-white">New-client workflow foundation is installed</h2></div></div><p className="mt-3 text-xs leading-5 text-neutral-400">The database now contains dedicated onboarding cases and 12-step onboarding records. Write actions remain intentionally gated until authenticated SuperUser identity is wired; client provisioning must never be an anonymous service-role mutation.</p></Panel>}
 </div>;
}