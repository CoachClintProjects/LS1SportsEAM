import Link from 'next/link';
import CoachOperatingSystem from '@/components/hubs/coach/CoachOperatingSystem';

const tools=[
 ['Automation','Create and manage coaching automations.','/coach/automation'],
 ['Analytics','Team and athlete operating insights.','/coach/analytics'],
 ['Communications','Messages, notices and team communication.','/coach/communications'],
 ['Season Agent','Build and manage the season plan.','/coach/season-agent'],
 ['Individualize','Athlete-specific training recommendations.','/coach/individualization-agent'],
 ['Workout Agent','Assemble evidence-backed workout proposals.','/coach/workout-agent'],
 ['Workout Composer','Create and edit coach-approved sessions.','/coach/workout'],
 ['Training Load','Monitor planned and actual training load.','/coach/load'],
 ['Debrief','Review outcomes and feed the next decision.','/coach/debrief'],
 ['Championship','Prepare championship strategy and readiness.','/coach/championship'],
 ['Meet-Day','Operate the live meet workflow.','/coach/meet-day'],
];

export default function CoachPage(){return <>
 <CoachOperatingSystem/>
 <section className="bg-[#050707] px-4 pb-8 text-white sm:px-6 lg:px-8">
  <div className="mx-auto max-w-[1500px] rounded-2xl border border-neutral-800 bg-[#0a0c0c] p-5 lg:p-6">
   <div className="mb-5">
    <div className="text-[10px] font-black uppercase tracking-[.18em] text-emerald-400">Coach Tools & Agents</div>
    <h2 className="mt-2 text-xl font-black">Plan, execute and develop your team</h2>
    <p className="mt-1 text-sm text-neutral-500">Open a specialist workspace when you need it. Coach remains the approval authority.</p>
   </div>
   <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
    {tools.map(([label,description,href])=><Link key={href} href={href} className="group flex min-h-28 items-start justify-between gap-4 rounded-2xl border border-neutral-800 bg-neutral-950/70 p-4 transition hover:-translate-y-0.5 hover:border-emerald-500/40 hover:bg-neutral-950">
     <div><div className="font-black text-white">{label}</div><div className="mt-2 text-xs leading-5 text-neutral-500">{description}</div></div>
     <span className="mt-0.5 text-xl text-neutral-600 transition group-hover:translate-x-1 group-hover:text-emerald-400">→</span>
    </Link>)}
   </div>
  </div>
 </section>
 </>}
