import { Suspense } from 'react';
import AthleteWorkspace from '@/components/hubs/athlete/AthleteWorkspace';

export default function AthletePage() {
  return (
    <Suspense fallback={<div className="p-6 text-white">Loading Athlete World…</div>}>
      <AthleteWorkspace />
    </Suspense>
  );
}
