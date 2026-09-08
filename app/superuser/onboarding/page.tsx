'use client';

import { Suspense } from 'react';
import { Onboarding } from '@/components/hubs/superuser/Onboarding';
import SuperUserApiBoundary from '@/components/hubs/superuser/SuperUserApiBoundary';

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className="p-6 text-white">Loading Onboarding...</div>}>
      <SuperUserApiBoundary>
        <Onboarding />
      </SuperUserApiBoundary>
    </Suspense>
  );
}
