import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd(),failures=[];
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const exists=rel=>fs.existsSync(path.join(root,rel));
const fail=message=>failures.push(message);

const workspace='components/hubs/admin/AdminWorkspace.tsx';
const command='components/hubs/admin/CommandCenter.tsx';
const data='components/hubs/admin/AdminDataWorkspaces.tsx';
const finance='components/hubs/admin/FinanceAccounting.tsx';
const financeApi='app/api/admin-finance/route.ts';
const teamActions='components/hubs/admin/AdminMasterDataActions.tsx';
const teamWorkspaces='components/hubs/admin/AdminTeamDataWorkspaces.tsx';
const teamApi='app/api/admin-team-master/route.ts';
const registrar='components/hubs/admin/RegistrarValidation.tsx';
const registrarApi='app/api/admin-registrar/route.ts';
const competitionUi='components/hubs/admin/AdminCompetitionOperations.tsx';
const assuranceUi='components/competition/CompetitionEntryAssurancePanel.tsx';
const competitionApi='app/api/admin-competitions/route.ts';
const assuranceApi='app/api/admin-competition-assurance/route.ts';
const adminApi='app/api/admin-command/route.ts';
const relationship='components/hubs/admin/RelationshipDirectory.tsx';
const records='components/records/ThreeColumnRecordWorkspace.tsx';
const operational='components/hubs/admin/AdminOperationalWorkspace.tsx';
const operationalApi='app/api/admin-operational-snapshot/route.ts';
const operationalWrappers=['components/hubs/admin/OrganizationArchitecture.tsx','components/hubs/admin/Facilities.tsx','components/hubs/admin/Payroll.tsx','components/hubs/admin/Compliance.tsx','components/hubs/admin/Reporting.tsx'];
const globals='app/globals.css';
const migrationCompetition='supabase/migrations/20260909084000_build_admin_competition_operations.sql';
const migrationDigest='supabase/migrations/20260909084500_surface_competitions_in_admin_daily_digest.sql';
const migrationAssurance='supabase/migrations/20260909090000_build_competition_entry_assurance.sql';

for(const rel of [workspace,command,data,finance,financeApi,teamActions,teamWorkspaces,teamApi,registrar,registrarApi,competitionUi,assuranceUi,competitionApi,assuranceApi,adminApi,relationship,records,operational,operationalApi,...operationalWrappers,globals,migrationCompetition,migrationDigest,migrationAssurance]) if(!exists(rel)) fail(`${rel}: required Admin regression-lock target is missing.`);

if(exists(workspace)){
  const src=read(workspace);
  if(!src.includes('AdminCompetitionOperations')) fail(`${workspace}: competition operations workspace is not registered.`);
  if(!src.includes("from './AdminTeamDataWorkspaces'")) fail(`${workspace}: governed Membership/Programs/Teams/Seasons workspaces are not wired.`);
}
if(exists(command)){
  const src=read(command);
  if(src.includes('New Task')) fail(`${command}: generic New Task UI must not return to the Admin daily digest.`);
  if(!src.includes('Action Center: What Should I Do Today?')) fail(`${command}: Admin action-center contract is missing.`);
  if(!src.includes('15000')) fail(`${command}: Admin daily digest must retain visible operational refresh behavior.`);
}
if(exists(data)){
  const src=read(data);
  for(const forbidden of ['demoInvoices','demoPayments','DEMO-1001','Demo Event Safety Vendor','HPAC Family Account']) if(src.includes(forbidden)) fail(`${data}: fabricated finance fallback ${forbidden} must not return.`);
  for(const marker of ['No invoices yet','No payments yet','No billing accounts yet','will not display fabricated financial activity']) if(!src.includes(marker)) fail(`${data}: truthful finance zero-state marker ${marker} is missing.`);
}
if(exists(finance)){
  const src=read(finance);
  for(const forbidden of ['Smith Family','Jones Family','Wilson Family','Brown Family','$42,890','$12,340']) if(src.includes(forbidden)) fail(`${finance}: fabricated finance overview ${forbidden} must not return.`);
  for(const marker of ['/api/admin-finance','No fabricated finance activity is displayed','Save & audit']) if(!src.includes(marker)) fail(`${finance}: governed live finance marker ${marker} is missing.`);
}
if(exists(financeApi)){
  const src=read(financeApi);
  for(const marker of ['requireAdmin(request)','writeAdminAuditEvent','create-customer','create-billing-account','create-invoice','record-payment','set-invoice-status','billing_accounts','balance_due']) if(!src.includes(marker)) fail(`${financeApi}: governed finance lifecycle ${marker} is missing.`);
  if(src.includes('SERVICE_ROLE')||src.includes('service_role')) fail(`${financeApi}: Admin finance must remain caller-JWT/RLS authorized.`);
}
if(exists(teamActions)){
  const src=read(teamActions);
  for(const marker of ['/api/admin-team-master','Save & audit','create-program','create-team','create-season','create-membership']) if(!src.includes(marker)) fail(`${teamActions}: governed Team Engine action ${marker} is missing.`);
}
if(exists(teamWorkspaces)){
  const src=read(teamWorkspaces);
  for(const marker of ['AdminMasterDataActions','ProgramsDirectory','TeamsDirectory','SeasonsDirectory','MembershipDirectory']) if(!src.includes(marker)) fail(`${teamWorkspaces}: governed Team Engine workspace marker ${marker} is missing.`);
}
if(exists(teamApi)){
  const src=read(teamApi);
  for(const marker of ['requireAdmin(request)','writeAdminAuditEvent','create-program','create-season','set-season-status','create-team','set-team-status','create-membership','set-membership-status']) if(!src.includes(marker)) fail(`${teamApi}: governed Team Engine lifecycle ${marker} is missing.`);
  if(src.includes('SERVICE_ROLE')||src.includes('service_role')) fail(`${teamApi}: Admin Team Engine master data must remain caller-JWT/RLS authorized.`);
}
if(exists(registrar)){
  const src=read(registrar);
  for(const marker of ['/api/admin-registrar','Approve','Reject','Decision reason']) if(!src.includes(marker)) fail(`${registrar}: operational Registrar marker ${marker} is missing.`);
}
if(exists(registrarApi)){
  const src=read(registrarApi);
  for(const marker of ['requireAdmin(request)','writeAdminAuditEvent','REGISTRATION_APPROVED','REGISTRATION_REJECTED','approved_at','admin_decision_reason']) if(!src.includes(marker)) fail(`${registrarApi}: governed Registrar lifecycle ${marker} is missing.`);
  if(src.includes('SERVICE_ROLE')||src.includes('service_role')) fail(`${registrarApi}: Registrar must remain caller-JWT/RLS authorized.`);
}
if(exists(operational)){
  const src=read(operational);
  for(const marker of ['Live tenant-scoped data only','Save & audit','RLS + audit controlled','No payroll runs exist yet','No sample reports are being shown']) if(!src.includes(marker)) fail(`${operational}: operational workspace contract ${marker} is missing.`);
}
if(exists(operationalApi)){
  const src=read(operationalApi);
  for(const marker of ['requireAdmin(request)','writeAdminAuditEvent','create-organization','create-site','create-facility','create-booking','create-payroll-run','add-payroll-line','set-payroll-status','create-background-check','set-background-check-status','create-report-definition','run-report']) if(!src.includes(marker)) fail(`${operationalApi}: governed Admin lifecycle ${marker} is missing.`);
  if(src.includes('SERVICE_ROLE')||src.includes('service_role')) fail(`${operationalApi}: operational workflows must remain caller-JWT/RLS authorized.`);
}
for(const rel of operationalWrappers) if(exists(rel)){
  const src=read(rel);
  for(const forbidden of ['Sarah Johnson','Mike Wilson','Lisa Brown','Competition Pool','Training Pool','Monthly Athlete Report','Financial Summary Q3','Halifax Aquatics Club']) if(src.includes(forbidden)) fail(`${rel}: fabricated Admin record ${forbidden} must not return.`);
  if(!src.includes('AdminOperationalWorkspace')) fail(`${rel}: workspace must use the canonical live operational renderer.`);
}
if(exists(competitionApi)){
  const src=read(competitionApi);
  for(const marker of ['requireAdmin(request)','writeAdminAuditEvent','competition_participation_responses','competition_logistics_requirements','send-reminders','set-response','update-logistics']) if(!src.includes(marker)) fail(`${competitionApi}: required competition operations marker ${marker} is missing.`);
  if(src.includes('SERVICE_ROLE')||src.includes('service_role')) fail(`${competitionApi}: service-role authority must never be used for Admin competition operations.`);
}
if(exists(assuranceApi)){
  const src=read(assuranceApi);
  for(const marker of ['GOING_NOT_PREPARED','GOING_NOT_SUBMITTED','SUBMITTED_NOT_VERIFIED','DECLINED_BUT_ENTRY_EXISTS','ENTRY_WITHOUT_COMMITMENT','competition_entry_assurance','competition_communication_attempts','reconcile','set-entry-state','manual-override','remind-nonresponders']) if(!src.includes(marker)) fail(`${assuranceApi}: entry assurance control ${marker} is missing.`);
  if(!src.includes("entryState === 'verified'")||!src.includes('verificationMethod')) fail(`${assuranceApi}: verified entry must require authoritative verification evidence.`);
  if(src.includes('SERVICE_ROLE')||src.includes('service_role')) fail(`${assuranceApi}: service-role authority must never be used for entry assurance.`);
}
if(exists(adminApi)){
  const src=read(adminApi);
  if(!src.includes('requireAdmin(request)')||!src.includes('adminRest')) fail(`${adminApi}: Admin Command Center must remain caller-JWT/RLS authorized.`);
  if(src.includes('SUPABASE_SERVICE_ROLE_KEY')) fail(`${adminApi}: Admin Command Center must not use the service-role key.`);
}
if(exists(competitionUi)){
  const src=read(competitionUi);
  for(const marker of ['CompetitionEntryAssurancePanel','Eligible athlete response','awaiting_response','Remind nonresponders','Logistics','Sync eligible']) if(!src.includes(marker)) fail(`${competitionUi}: competition operations contract ${marker} is missing.`);
  if(!src.includes('15000')) fail(`${competitionUi}: competition operations must retain live visible-tab refresh.`);
}
if(exists(assuranceUi)){
  const src=read(assuranceUi);
  for(const marker of ['Going is intent','Only Verified can become Cleared','No green clearance without evidence','sent ≠ delivered ≠ read ≠ Going ≠ Entered ≠ Verified','mode?: \'admin\' | \'coach\'']) if(!src.includes(marker)) fail(`${assuranceUi}: reusable Admin/Coach assurance rule ${marker} is missing.`);
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
if(exists(migrationAssurance)){
  const src=read(migrationAssurance);
  for(const marker of ['competition_entry_assurance','competition_communication_attempts','clearance_state','manual_override_reason','verification_method']) if(!src.includes(marker)) fail(`${migrationAssurance}: assurance data control ${marker} is missing.`);
  if(!src.includes("clearance_state <> 'cleared' or entry_state = 'verified'")) fail(`${migrationAssurance}: database must prevent cleared status without verified entry.`);
}

if(failures.length){console.error('\nLS1Sports Admin regression locks FAILED:\n');failures.forEach((message,index)=>console.error(`${index+1}. ${message}`));process.exit(1)}
console.log('LS1Sports Admin regression locks passed.');
