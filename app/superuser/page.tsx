'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import ProjectCommand from '@/components/hubs/superuser/ProjectCommand';
import SuperUserModuleWorkspace from '@/components/hubs/superuser/SuperUserModuleWorkspace';

const projectControlViews = new Set(['command-center', 'project-map', 'milestones', 'metrics']);

function SuperUserLoading() {
  return (
    <section className="rounded-2xl border border-neutral-800 bg-[#090b0b] p-6 lg:p-7">
      <div className="text-[9px] font-black uppercase tracking-[.25em] text-emerald-400">SUPERUSER</div>
      <h1 className="mt-2 text-3xl font-black text-white">Loading workspace</h1>
      <p className="mt-2 text-xs text-neutral-500">Loading the live control surface…</p>
    </section>
  );
}

// =============================================================================
// ROUTED WORKSPACE - With proper error handling
// =============================================================================

function RoutedWorkspace() {
  const searchParams = useSearchParams();
  const view = searchParams?.get('view') ?? 'command-center';
  const validView = view || 'command-center';
  
  // Log for debugging
  console.log('[SuperUser] View parameter:', validView);
  
  // Simple guard - if view is empty, default to command-center
  if (!validView || validView === '') {
    return <ProjectCommand />;
  }
  
  try {
    if (projectControlViews.has(validView)) {
      return <ProjectCommand />;
    } else {
      return <SuperUserModuleWorkspace view={validView} />;
    }
  } catch (error) {
    console.error('[SuperUser] Error rendering workspace:', error);
    // Fallback to ProjectCommand on error
    return <ProjectCommand />;
  }
}

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function SuperUserPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Prevent hydration mismatch
  if (!mounted) {
    return <SuperUserLoading />;
  }

  return (
    <Suspense fallback={<SuperUserLoading />}>
      <RoutedWorkspace />
    </Suspense>
  );
}