import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd(), failures=[];
const read=(rel)=>fs.readFileSync(path.join(root,rel),'utf8');
const exists=(rel)=>fs.existsSync(path.join(root,rel));
const fail=(m)=>failures.push(m);

const files={
  requireAdmin:'lib/server/requireAdmin.ts',
  operationalApi:'app/api/admin-operational-snapshot/route.ts',
  operationalUi:'components/hubs/admin/AdminOperationalWorkspace.tsx',
  financeApi:'app/api/admin-finance/route.ts',
  teamApi:'app/api/admin-team-master/route.ts',
  registrarApi:'app/api/admin-registrar/route.ts',
  policies:'supabase/migrations/20260909171409_authorize_admin_operational_writes.sql',
  roles:'supabase/migrations/20260909171813_seed_admin_operational_roles.sql',
  helperUsage:'supabase/migrations/20260909172013_grant_authenticated_app_helper_usage.sql',
};
for(const rel of Object.values(files)) if(!exists(rel)) fail(`${rel}: Admin authority lock target is missing.`);

if(exists(files.requireAdmin)){
  const s=read(files.requireAdmin);
  for(const marker of ['REGISTRAR','TREASURER','OPERATIONS_ADMIN','COMPLIANCE_ADMIN','REPORTING_ADMIN','TEAM_ENGINE_ADMIN']) if(!s.includes(marker)) fail(`${files.requireAdmin}: role mapping ${marker} is missing.`);
  if(s.includes('SERVICE_ROLE')||s.includes('service_role')) fail(`${files.requireAdmin}: Admin identity verification must not use service-role authority.`);
}
if(exists(files.policies)){
  const s=read(files.policies);
  for(const marker of ['sites_admin_scope','facilities_admin_scope','payroll_runs_admin_scope','background_checks_admin_scope','report_runs_admin_scope','customers_admin_scope','billing_accounts_admin_scope','invoices_admin_write_scope','payments_admin_scope','programs_admin_scope','seasons_admin_scope','teams_admin_write_scope','memberships_admin_scope','registrations_admin_write_scope','app.current_tenant_ids()']) if(!s.includes(marker)) fail(`${files.policies}: tenant-scoped Admin RLS policy ${marker} is missing.`);
  if(s.includes('using (true)')||s.includes('with check (true)')) fail(`${files.policies}: unrestricted authenticated Admin write policy detected.`);
}
if(exists(files.roles)){
  const s=read(files.roles);
  for(const marker of ['REGISTRAR','TREASURER','OPERATIONS_ADMIN','COMPLIANCE_ADMIN','REPORTING_ADMIN','TEAM_ENGINE_ADMIN']) if(!s.includes(marker)) fail(`${files.roles}: canonical Admin role ${marker} is missing.`);
}
if(exists(files.helperUsage)){
  const s=read(files.helperUsage);
  for(const marker of ['grant usage on schema app to authenticated','app.current_person_id()','app.current_tenant_ids()','app.has_admin_role(text[])','app.is_admin()','app.is_superuser()']) if(!s.includes(marker)) fail(`${files.helperUsage}: authenticated helper grant ${marker} is missing.`);
}
if(exists(files.operationalApi)){
  const s=read(files.operationalApi);
  for(const marker of ['requested_by: actor.personId','Legal entity, payroll period start and end are required','Compliance requirement definitions are platform-level and require SuperUser authority','canManageRequirements: actor.isSuperUser']) if(!s.includes(marker)) fail(`${files.operationalApi}: operational authority fix ${marker} is missing.`);
  if(s.includes('requested_by: actor.userId')) fail(`${files.operationalApi}: report runs must reference person identity, not Auth user identity.`);
}
if(exists(files.operationalUi)){
  const s=read(files.operationalUi);
  for(const marker of ['canManageRequirements','Add platform requirement',"select('legal_entity_id','Legal entity'"]) if(!s.includes(marker)) fail(`${files.operationalUi}: UI authority marker ${marker} is missing.`);
}
for(const rel of [files.financeApi,files.teamApi,files.registrarApi]) if(exists(rel)){
  const s=read(rel);
  if(!s.includes('requireAdmin(request)')||!s.includes('writeAdminAuditEvent')) fail(`${rel}: caller identity and audit enforcement must remain present.`);
  if(s.includes('SERVICE_ROLE')||s.includes('service_role')) fail(`${rel}: service-role authority is forbidden in Admin operational APIs.`);
}

if(failures.length){console.error('\nLS1Sports Admin authority regression locks FAILED:\n');failures.forEach((m,i)=>console.error(`${i+1}. ${m}`));process.exit(1)}
console.log('LS1Sports Admin authority regression locks passed.');
