'use client';

import {useSearchParams} from 'next/navigation';
import FoundationAthleteHub from './FoundationAthleteHub';
import AthleteCapitalHub from './AthleteCapitalHub';
import AthleteExperienceFrame from './AthleteExperienceFrame';
import AthleteIntelligencePanel from './AthleteIntelligencePanel';
import AthleteMeetActions from './AthleteMeetActions';
import AthleteCompletionActions from './AthleteCompletionActions';

export default function AthleteExperienceRouter(){
 const params=useSearchParams();
 const age=params.get('age')||'5-8';
 if(age==='5-8')return <FoundationAthleteHub/>;
 return <AthleteExperienceFrame age={age}><div className="space-y-5"><AthleteMeetActions age={age}/><AthleteIntelligencePanel age={age}/><AthleteCompletionActions age={age}/><AthleteCapitalHub/></div></AthleteExperienceFrame>;
}
