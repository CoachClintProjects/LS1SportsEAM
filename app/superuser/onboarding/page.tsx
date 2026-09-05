'use client';

import { Suspense } from 'react';
import { Onboarding } from '@/components/hubs/superuser/Onboarding';

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className="text-white p-6">Loading Onboarding...</div>}>
      <Onboarding />
    </Suspense>
  );
}
