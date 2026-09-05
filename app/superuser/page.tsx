'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import ProjectCommand from '@/components/hubs/superuser/ProjectCommand';
import SuperUserModuleWorkspace from '@/components/hubs/superuser/SuperUserModuleWorkspace';

const projectControlViews = new Set(['command-center', 'project-map', 'milestones', 'metrics']);

function SuperUserLoading() {
  return <section className="rounded-2xl border border-neutral-800 bg-[#090b0b] p-6 lg:p-7">
    <div className="text-[9px] font-black uppercase tracking-[.25em] text-emerald-400">SUPERUSER</div>
    <h1 className="mt-2 text-3xl font-black text-white">Loading workspace</h1>
    <p className="mt-2 text-xs text-neutral-500">Loading the live control surface…</p>
  </section>;
}

function RoutedWorkspace() {
  const searchParams = useSearchParams();
  const view = searchParams.get('view') ?? 'command-center';
  const validView = view || 'command-center';
  
  // If view is empty or invalid, default to command-center
  if (!validView || validView === '') {
    return <ProjectCommand />;
  }
  
  return projectControlViews.has(validView) 
    ? <ProjectCommand /> 
    : <SuperUserModuleWorkspace view={validView} />;
}

export default function SuperUserPage() {
  return (
    <Suspense fallback={<SuperUserLoading />}>
      <RoutedWorkspace />
    </Suspense>
  );
}