'use client';

import { useSearchParams } from 'next/navigation';
import FoundationAthleteHub from './FoundationAthleteHub';
import AthleteCapitalHub from './AthleteCapitalHub';

export default function AthleteExperienceRouter() {
  const params = useSearchParams();
  const age = params.get('age') || '5-8';
  return age === '5-8' ? <FoundationAthleteHub /> : <AthleteCapitalHub />;
}
