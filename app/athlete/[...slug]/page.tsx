'use client';

import { Suspense } from 'react';
import AthleteExperienceRouter from '@/components/hubs/athlete/AthleteExperienceRouter';

export default function AthleteRoute() {
  return (
    <Suspense fallback={<div className="p-6 text-white">Loading Athlete Hub...</div>}>
      <AthleteExperienceRouter />
    </Suspense>
  );
}
