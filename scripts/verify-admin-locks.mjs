import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd(),failures=[];
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const exists=rel=>fs.existsSync(path.join(root,rel));
const fail=message=>failures.push(message);

const workspace='components/hubs/admin/AdminWorkspace.tsx';
const command='components/hubs/admin/CommandCenter.tsx';
const data='components/hubs/admin/AdminDataWorkspaces.tsx';
const competitionUi='components/hubs/admin/AdminCompetitionOperations.tsx';
const competitionApi='app/api/admin-competitions/route.ts';
const adminApi='app/api/admin-command/route.ts';
const relationship='components/hubs/admin/RelationshipDirectory.tsx';
const records='components/records/ThreeColumnRecordWorkspace.tsx';
const globals='app/globals.css';
const migrationCompetition='supabase/migrations/20260909084000_build_admin_competition_operations.sql';
const migrationDigest='supabase/migrations/20260909084500_surface_competitions_in_admin_daily_digest.sql';

for(const rel of [workspace,command,data,competitionUi,competitionApi,adminApi,relationship,records,globals,migrationCompetition,migrationDigest]) if(!exists(rel)) fail(`${rel}: required Admin regression-lock target is missing.`);

if(exists(workspace)){
  const src=read(workspace);
  if(!src.includes('AdminCompetitionOperations')) fail(`${workspace}: competition operations workspace is not registered.`);
  if(!src.includes('MembershipView')||!src.includes('TeamsView')) fail(`${workspace}: canonical Membership/Teams Admin workspaces are missing.`);
}
if(exists(command)){
  const src=read(command);
  if(src.includes('New Task')) fail(`${command}: generic New Task UI must not return to the Admin daily digest.`);
  if(!src.includes('Action Center: What Should I Do Today?')) fail(`${command}: Admin action-center contract is missing.`);
  if(!src.includes('15000')) fail(`${command}: Admin daily digest must retain visible operational refresh behavior.`);
}
if(exists(competitionApi)){
  const src=read(competitionApi);
  for(const marker of ['requireAdmin(request)','writeAdminAuditEvent','competition_participation_responses','competition_logistics_requirements','send-reminders','set-response','update-logistics']) if(!src.includes(marker)) fail(`${competitionApi}: required competition operations marker ${marker} is missing.`);
  if(src.includes('SERVICE_ROLE')||src.includes('service_role')) fail(`${competitionApi}: service-role authority must never be used for Admin competition operations.`);
}
if(exists(adminApi)){
  const src=read(adminApi);
  if(!src.includes('requireAdmin(request)')||!src.includes('adminRest')) fail(`${adminApi}: Admin Command Center must remain caller-JWT/RLS authorized.`);
  if(src.includes('SUPABASE_SERVICE_ROLE_KEY')) fail(`${adminApi}: Admin Command Center must not use the service-role key.`);
}
if(exists(competitionUi)){
  const src=read(competitionUi);
  for(const marker of ['Who is going?','awaiting_response','Remind nonresponders','Logistics','Sync eligible']) if(!src.includes(marker)) fail(`${competitionUi}: simple competition operations contract ${marker} is missing.`);
  if(!src.includes('15')||!src.includes('15000')) fail(`${competitionUi}: competition operations must retain live visible-tab refresh.`);
}
if(exists(globals)){
  const src=read(globals);
  if(!src.includes('--ls1-success')||!src.includes('--ls1-warning')||!src.includes('--ls1-danger')||!src.includes('--ls1-info')||!src.includes('--ls1-ai')) fail(`${globals}: LS1 semantic color language is incomplete.`);
}
if(exists(migrationCompetition)){
  const src=read(migrationCompetition);
  for(const marker of ['competition_participation_responses','competition_logistics_requirements','2026 Open Water Banana Slug Splash','2026 HPAC Festivus Winterfest','Competitions']) if(!src.includes(marker)) fail(`${migrationCompetition}: canonical Admin competition migration is missing ${marker}.`);
}
if(exists(migrationDigest)){
  const src=read(migrationDigest);
  if(!src.includes('calendar_events')||!src.includes('review_competitions')) fail(`${migrationDigest}: competition daily-digest surfacing lock is incomplete.`);
}

if(failures.length){console.error('\nLS1Sports Admin regression locks FAILED:\n');failures.forEach((message,index)=>console.error(`${index+1}. ${message}`));process.exit(1)}
console.log('LS1Sports Admin regression locks passed.');
