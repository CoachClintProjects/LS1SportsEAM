import React, { Suspense } from 'react';
import ProjectCommand from '@/components/hubs/superuser/ProjectCommand';
import SuperUserModuleWorkspace from '@/components/hubs/superuser/SuperUserModuleWorkspace';

const commandViews = new Set(['command-center', 'project-map', 'milestones', 'metrics', 'platform', 'organizations', 'people', 'team-manager', 'athletes', 'financial-overview', 'general-ledger', 'facilities', 'assets', 'maintenance', 'identity', 'roles', 'permissions', 'compliance', 'data-governance', 'privacy', 'audit', 'procurement', 'payroll', 'workflow', 'integrations', 'imports', 'reporting', 'agents', 'automation', 'alerts', 'insights', 'product', 'deployments', 'system-health', 'knowledge']);

function SuperUserLoading() {
  return <section className="rounded-2xl border border-neutral-800 bg-[#090b0b] p-6 lg:p-7">
    <div className="text-[9px] font-black uppercase tracking-[.25em] text-emerald-400">SUPERUSER</div>
    <h1 className="mt-2 text-3xl font-black text-white">Loading workspace</h1>
    <p className="mt-2 text-xs text-neutral-500">Loading the live control surface…</p>
  </section>;
}

function RoutedWorkspace() {
  const params = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search);
  const view = params.get('view') ?? 'command-center';
  return commandViews.has(view) ? <ProjectCommand /> : <SuperUserModuleWorkspace view={view} />;
}

export default function SuperUserPage() {
  return <Suspense fallback={<SuperUserLoading />}><RoutedWorkspace /></Suspense>;
}
