import fs from 'node:fs';

const checks=[
 ['app/coach/page.tsx','CoachOperatingSystem'],
 ['components/hubs/coach/CoachOperatingSystem.tsx','Coach Attention Queue'],
 ['components/hubs/coach/CoachOperatingSystem.tsx','AI proposes. Coach reviews. ERP executes.'],
 ['components/hubs/coach/CoachOperatingSystem.tsx','Discovery candidates'],
 ['components/hubs/coach/CoachOperatingSystem.tsx','Coach Knowledge Network'],
 ['app/api/coach/route.ts','requireCoach'],
 ['app/api/coach/route.ts','swim_time_standards'],
 ['app/api/coach/route.ts','coach_attention_items'],
 ['app/api/coach/actions/route.ts','COACH_AGENT_PROPOSAL_REVIEWED'],
 ['app/api/coach/actions/route.ts','COACH_COMPETITION_CANDIDATE_REVIEWED'],
 ['lib/server/requireCoach.ts','coach_access_assignments'],
 ['supabase/migrations/20260910103000_build_coach_operating_system.sql','autonomy_level'],
 ['supabase/migrations/20260910103000_build_coach_operating_system.sql','coach_decision_log'],
];
let failed=0;
for(const [file,needle] of checks){
 if(!fs.existsSync(file)){console.error(`Coach lock failed: missing ${file}`);failed++;continue;}
 const content=fs.readFileSync(file,'utf8');
 if(!content.includes(needle)){console.error(`Coach lock failed: ${file} missing ${needle}`);failed++;}
}
if(failed)process.exit(1);
console.log(`Coach OS regression locks passed (${checks.length} assertions).`);
