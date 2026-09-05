'use client';

import { Suspense } from 'react';
import AthleteWorkspace from '@/components/hubs/athlete/AthleteWorkspace';

export default function AthletePage() {
  return (
    <Suspense fallback={<div className="text-white p-6">Loading Athlete Hub...</div>}>
      <AthleteWorkspace />
    </Suspense>
  );
}