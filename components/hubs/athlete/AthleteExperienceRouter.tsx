'use client';

import {useSearchParams} from 'next/navigation';
import FoundationAthleteHub from './FoundationAthleteHub';
import AthleteCapitalHub from './AthleteCapitalHub';
import AthleteExperienceFrame from './AthleteExperienceFrame';

export default function AthleteExperienceRouter(){
 const params=useSearchParams();
 const age=params.get('age')||'5-8';
 if(age==='5-8')return <FoundationAthleteHub/>;
 return <AthleteExperienceFrame age={age}><AthleteCapitalHub/></AthleteExperienceFrame>;
}
