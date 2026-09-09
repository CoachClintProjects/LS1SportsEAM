'use client';

import { useSearchParams } from 'next/navigation';
import YoungAthleteAdventure from './YoungAthleteAdventure';
import AthleteCapitalHub from './AthleteCapitalHub';

export default function AthleteExperienceRouter() {
  const params = useSearchParams();
  const age = params.get('age') || '5-8';
  return age === '5-8' ? <YoungAthleteAdventure /> : <AthleteCapitalHub />;
}
