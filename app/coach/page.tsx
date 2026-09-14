'use client';

import { Suspense } from 'react';
import CoachWorkspace from '@/components/hubs/coach/CoachWorkspace';

// Canonical Coach Engine entry point. Deep routes share the same runtime workspace.
export default function CoachPage() {
  return (
    <Suspense fallback={<div className="h-full bg-[#050807] p-6 text-sm text-white/60">Loading Coach Engine…</div>}>
      <CoachWorkspace />
    </Suspense>
  );
}
