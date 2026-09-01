import React, { Suspense } from 'react';
import ProjectCommand from '@/components/hubs/superuser/ProjectCommand';

function SuperUserLoading() {
  return (
    <section className="rounded-2xl border border-neutral-800 bg-[#090b0b] p-6 lg:p-7">
      <div className="text-[9px] font-black uppercase tracking-[.25em] text-emerald-400">COMMAND</div>
      <h1 className="mt-2 text-3xl font-black text-white">Command Center</h1>
      <p className="mt-2 text-xs text-neutral-500">Loading live implementation state…</p>
    </section>
  );
}

export default function SuperUserPage() {
  return (
    <Suspense fallback={<SuperUserLoading />}>
      <ProjectCommand />
    </Suspense>
  );
}
