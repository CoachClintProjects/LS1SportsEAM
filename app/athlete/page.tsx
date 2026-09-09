'use client';

import { Suspense } from 'react';
import AthleteExperienceRouter from '@/components/hubs/athlete/AthleteExperienceRouter';

export default function AthletePage() {
  return (
    <Suspense fallback={<div className="text-white p-6">Loading Athlete Hub...</div>}>
      <AthleteExperienceRouter />
    </Suspense>
  );
}
