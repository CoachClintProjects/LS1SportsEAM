import fs from 'node:fs';
const migration=fs.readFileSync('supabase/migrations/20260913163500_build_urws_registration_bridge.sql','utf8');
const checks=[
 ['registration event bridge','urws_registration_event_bridge'],
 ['registration requirement bridge','urws_registration_requirement_bridge'],
 ['exception event','registration.exception.requested'],
 ['requirement failure event','registration.requirement.failed'],
 ['resolution event','registration.exception.resolved'],
 ['registration case type','registration_exception'],
 ['canonical outbox','platform_event_outbox'],
 ['case resolver','urws_registration_case_resolver']
];
const failures=checks.filter(([,needle])=>!migration.includes(needle));
if(failures.length){console.error('URWS registration regression locks FAILED:\n'+failures.map(([name])=>'- '+name).join('\n'));process.exit(1);}
console.log(`URWS registration regression locks passed (${checks.length} assertions).`);
