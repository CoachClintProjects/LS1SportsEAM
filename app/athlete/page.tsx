import React, { Suspense } from 'react';
import AthleteWorkspace from '@/components/hubs/athlete/AthleteWorkspace';

function AthleteLoading(){return <section className="rounded-2xl border border-neutral-800 bg-[#090b0b] p-6 lg:p-7"><div className="text-[9px] font-black uppercase tracking-[.25em] text-[#FA4616]">ATHLETE</div><h1 className="mt-2 text-3xl font-black text-white">Loading Athlete Passport</h1><p className="mt-2 text-xs text-neutral-500">Loading canonical athlete context…</p></section>}

export default function AthletePage(){return <Suspense fallback={<AthleteLoading/>}><AthleteWorkspace/></Suspense>}
