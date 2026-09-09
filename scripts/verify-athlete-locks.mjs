import fs from 'node:fs';
const failures=[];const read=p=>fs.existsSync(p)?fs.readFileSync(p,'utf8'):'';
const router=read('components/hubs/athlete/AthleteExperienceRouter.tsx');
const frame=read('components/hubs/athlete/AthleteExperienceFrame.tsx');
const api=read('app/api/athlete/experience/route.ts');
const actions=read('app/api/athlete/actions/route.ts');
for(const [file,source] of [['components/hubs/athlete/AthleteExperienceRouter.tsx',router],['components/hubs/athlete/AthleteExperienceFrame.tsx',frame],['app/api/athlete/experience/route.ts',api],['app/api/athlete/actions/route.ts',actions]])if(!source)failures.push(`${file}: missing Athlete Experience contract.`);
for(const marker of['AthleteExperienceFrame','FoundationAthleteHub','AthleteCapitalHub'])if(!router.includes(marker))failures.push(`Athlete router missing ${marker}.`);
for(const marker of['race-day','meet-prep','post-race','training-day','Open My Meet','Heat / Lane','Eligibility','Check-in'])if(!frame.includes(marker))failures.push(`Athlete experience frame missing ${marker}.`);
for(const marker of['requireAthlete','competition_entries','competition_checkins','competition_seeding_assignments','swim_lanes','swim_heats','competition_results','training_athlete_logs','athlete_reflections'])if(!api.includes(marker))failures.push(`Athlete experience API missing canonical source ${marker}.`);
for(const banned of['fake standard','mock heat','demo lane','Math.random(','fabricated'])if(frame.toLowerCase().includes(banned.toLowerCase())||api.toLowerCase().includes(banned.toLowerCase()))failures.push(`Athlete Experience contains prohibited fabricated-data marker ${banned}.`);
for(const marker of['create_goal','create_reflection','update_challenge','Athletes may only change their own Athlete record.'])if(!actions.includes(marker))failures.push(`Athlete writeback contract missing ${marker}.`);
if(failures.length){console.error('\nLS1Sports Athlete locks FAILED:\n');failures.forEach((f,i)=>console.error(`${i+1}. ${f}`));process.exit(1)}
console.log('LS1Sports Athlete Experience locks passed.');
