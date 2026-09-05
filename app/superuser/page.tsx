'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import ProjectCommand from '@/components/hubs/superuser/ProjectCommand';
import SuperUserModuleWorkspace from '@/components/hubs/superuser/SuperUserModuleWorkspace';

const COMMAND_VIEWS = new Set(['command-center', 'project-map', 'milestones', 'metrics']);

function LoadingWorkspace() {
  return (
    <section className="rounded-2xl border border-neutral-800 bg-[#090b0b] p-6 lg:p-7">
      <div className="text-[9px] font-black uppercase tracking-[.25em] text-emerald-400">SUPERUSER</div>
      <h1 className="mt-2 text-3xl font-black text-white">Loading workspace</h1>
      <p className="mt-2 text-xs text-neutral-500">Preparing the LS1Sports operating control surface…</p>
    </section>
  );
}

function SuperUserRouter() {
  const searchParams = useSearchParams();
  const requestedView = searchParams.get('view');
  const view = requestedView?.trim() || 'command-center';

  if (COMMAND_VIEWS.has(view)) {
    return <ProjectCommand />;
  }

  return <SuperUserModuleWorkspace view={view} />;
}

export default function SuperUserPage() {
  return (
    <Suspense fallback={<LoadingWorkspace />}>
      <SuperUserRouter />
    </Suspense>
  );
}
