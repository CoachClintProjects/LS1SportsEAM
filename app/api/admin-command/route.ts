import { NextRequest,NextResponse } from 'next/server';
import { canUseAdminRoleContext,hasPermission,resolveAccess,serviceHeaders,type AccessContext } from '@/lib/server/accessControl';
import { supabaseServerConfig } from '@/lib/server/superuserAuth';
export const dynamic='force-dynamic'; export const revalidate=0;

async function rest(path:string,init:RequestInit={}){const {url}=supabaseServerConfig();const h=serviceHeaders();if(!url||!h)throw new Error('Supabase service credentials are not configured.');const response=await fetch(`${url}/rest/v1/${path}`,{...init,headers:{...h,Prefer:'return=representation',...(init.headers||{})},cache:'no-store'});const text=await response.text();if(!response.ok)throw new Error(`Canonical store returned ${response.status}: ${text.slice(0,300)}`);return text?JSON.parse(text):null;}
const deny=(status:number,error:string)=>NextResponse.json({error},{status});
const HPAC_TENANT='beb8f24e-fcd0-5dbe-ba1b-39c488ebaa4f';
const HPAC_ORG='c9032ebb-0507-5004-b1ad-0bca7cf3cc53';
const ROLE_PERMISSIONS:Record<string,Set<string>>={
 org_admin:new Set(['*']),
 team_manager:new Set(['admin_tasks.read','admin_tasks.create','admin_tasks.update','rosters.read','rosters.update','teams.read','teams.update','registrations.read','competition_entries.read','communications.read','communications.send','record.read','record.update']),
 registrar:new Set(['admin_tasks.read','admin_tasks.create','admin_tasks.update','registrations.read','registrations.approve','rosters.read','rosters.update','waivers.read','waivers.update','competition_entries.read','record.read','record.update','record.approve']),
 competition_manager:new Set(['admin_tasks.read','admin_tasks.create','admin_tasks.update','competition_entries.read','competition_entries.update','record.read','record.update','record.approve']),
 treasurer:new Set(['admin_tasks.read','admin_tasks.create','admin_tasks.update','finance.read','record.read','record.update','record.approve','record.export']),
 volunteer_coordinator:new Set(['admin_tasks.read','admin_tasks.create','admin_tasks.update','record.read','record.update','communications.read','communications.send']),
 communications_media:new Set(['admin_tasks.read','admin_tasks.create','admin_tasks.update','communications.read','communications.send','record.read','record.update']),
 fundraising_coordinator:new Set(['admin_tasks.read','admin_tasks.create','admin_tasks.update','finance.read','record.read','record.update','record.export']),
 facilities_equipment_manager:new Set(['admin_tasks.read','admin_tasks.create','admin_tasks.update','record.read','record.update'])
};
function roleHas(ctx:AccessContext,role:string,permission:string){if(!hasPermission(ctx,permission))return false;const p=ROLE_PERMISSIONS[role];return !!p&&(p.has('*')||p.has(permission));}

function tenantId(ctx:AccessContext){return ctx.person?.tenant_id||(ctx.isPlatformSuperUser?HPAC_TENANT:null);}
function organizationIds(ctx:AccessContext){if(ctx.isPlatformSuperUser)return [HPAC_ORG];return [...new Set(ctx.roles.map(r=>r.scope.organization_id).filter(Boolean))] as string[];}
function inFilter(ids:string[]){return ids.length?`in.(${ids.map(encodeURIComponent).join(',')})`:'';}
async function audit(ctx:AccessContext,tenant:string,action:string,entityType:string,entityId:string,beforeData:unknown,afterData:unknown,correlationId:string){await rest('audit_events',{method:'POST',body:JSON.stringify({tenant_id:tenant,actor_user_id:ctx.user.id,actor_person_id:ctx.person?.id||null,action,entity_type:entityType,entity_id:entityId,before_data:beforeData||null,after_data:afterData||null,correlation_id:correlationId,reason:'Admin operational action',privileged:ctx.isPlatformSuperUser})});}

export async function GET(request:NextRequest){
 try{const ctx=await resolveAccess(request);if(!ctx)return deny(401,'Authentication required.');if(!ctx.allowedHubs.includes('admin'))return deny(403,'Admin access denied.');
  const roleName=(request.nextUrl.searchParams.get('role')||'org_admin').trim();if(!canUseAdminRoleContext(ctx,roleName))return deny(403,'Admin role context is not assigned or delegable for this user.');
  const canTasks=roleHas(ctx,roleName,'admin_tasks.read'),canFinance=roleHas(ctx,roleName,'finance.read'),canRoster=roleHas(ctx,roleName,'rosters.read');
  const tenant=tenantId(ctx),orgs=organizationIds(ctx); if(!tenant)return deny(403,'Canonical tenant context required.');
  const teamQuery=canRoster&&orgs.length?`teams?select=id&organization_id=${inFilter(orgs)}&status=eq.active`:null;
  const teams=teamQuery?await rest(teamQuery):[];
  const teamIds=(teams||[]).map((r:any)=>r.id);
  const [invoices,bills,tasks,athletes]=await Promise.all([
   canFinance?rest('invoices?select=id,invoice_number,invoice_date,due_date,total,balance_due,status&order=invoice_date.desc&limit=50'):[],
   canFinance?rest('vendor_bills?select=id,bill_number,bill_date,due_date,total,balance_due,status&order=bill_date.desc&limit=50'):[],
   canTasks?rest(`work_items?select=id,tenant_id,work_type,status,priority,payload&tenant_id=eq.${tenant}&status=neq.completed&order=id.desc&limit=50`):[],
   canRoster&&teamIds.length?rest(`team_memberships?select=athlete_id&team_id=${inFilter(teamIds)}&status=eq.active`):[],
  ]);
  const athleteCount=new Set((athletes||[]).map((r:any)=>r.athlete_id)).size;
  const arBalance=(invoices||[]).reduce((s:number,r:any)=>s+Number(r.balance_due||0),0),apBalance=(bills||[]).reduce((s:number,r:any)=>s+Number(r.balance_due||0),0);
  const pastDue=(invoices||[]).filter((r:any)=>r.due_date&&Number(r.balance_due||0)>0&&new Date(String(r.due_date)).getTime()<Date.now()).length;
  const orgAdmin=roleName==='org_admin'?await orgAdminSnapshot(ctx,tenant,orgs):null;
  const controls=await orgAdminControls(tenant,orgs);
  const enterprise=roleName==='org_admin'?await orgAdminEnterprise(orgs,tenant):null;
  const registrar=await registrarSnapshot(orgs);
  return NextResponse.json({invoices,vendorBills:bills,tasks,orgAdmin,controls,enterprise,registrar,metrics:{arBalance,apBalance,openInvoices:(invoices||[]).filter((r:any)=>Number(r.balance_due||0)>0).length,pastDue,activeAthletes:athleteCount,activeTeams:(teams||[]).length},generatedAt:new Date().toISOString(),source:'LS1SportsEAM canonical store',context:{tenantId:tenant,organizationIds:orgs,role:roleName},authorization:{finance:canFinance,tasks:canTasks,roster:canRoster}});
 }catch(error){return deny(500,error instanceof Error?error.message:'Admin command data unavailable.');}
}

async function orgAdminSnapshot(ctx:AccessContext,tenant:string,orgs:string[]){
 if(!orgs.length)return {organizations:[],sites:[],programs:[],seasons:[],teams:[],people:[],assignments:[],roles:[],audit:[]};
 const orgFilter=inFilter(orgs);
 const [organizations,sites,programs,seasons,teams,people,assignments,roles,auditRows]=await Promise.all([
  rest(`organizations?select=id,parent_organization_id,code,name,legal_name,organization_type,status&tenant_id=eq.${tenant}&id=${orgFilter}&order=name.asc`),
  rest(`sites?select=id,organization_id,code,name,address_line1,city,region,postal_code,country_code,timezone,status&organization_id=${orgFilter}&order=name.asc`),
  rest(`programs?select=id,organization_id,sport_id,code,name,program_type,status&organization_id=${orgFilter}&order=name.asc`),
  rest(`seasons?select=id,organization_id,sport_id,code,name,starts_on,ends_on,status&organization_id=${orgFilter}&order=starts_on.desc`),
  rest(`teams?select=id,organization_id,sport_id,program_id,season_id,code,name,competitive_level,status&organization_id=${orgFilter}&order=name.asc`),
  rest(`people?select=id,first_name,last_name,preferred_name,email,phone,status,privacy_classification&tenant_id=eq.${tenant}&order=last_name.asc,first_name.asc&limit=500`),
  rest(`role_assignments?select=id,person_id,role_definition_id,organization_id,sport_id,site_id,team_id,program_id,competition_id,starts_at,ends_at,status,metadata,created_at&tenant_id=eq.${tenant}&organization_id=${orgFilter}&order=created_at.desc&limit=500`),
  rest('role_definitions?select=id,code,name,description,privilege_level,role_type,config,is_active&is_active=eq.true&order=privilege_level.desc'),
  hasPermission(ctx,'audit.read')?rest(`audit_events?select=id,actor_person_id,action,entity_type,entity_id,occurred_at,correlation_id,reason&tenant_id=eq.${tenant}&order=occurred_at.desc&limit=100`):[]
 ]);
 return {organizations,sites,programs,seasons,teams,people,assignments,roles:(roles||[]).filter((r:any)=>!r.config?.platform_only&&Number(r.privilege_level)<=ctx.maxDelegablePrivilege),audit:auditRows};
}

async function orgAdminControls(tenant:string,orgs:string[]){
 if(!orgs.length)return {requirements:[],credentials:[],backgroundChecks:[],safeSport:[],waivers:[],memberships:[],dataQualityIssues:[],duplicateCandidates:[],competitions:[]};
 const orgFilter=inFilter(orgs);
 const [requirements,credentials,backgroundChecks,safeSport,waivers,memberships,dataQualityIssues,duplicateCandidates,competitions]=await Promise.all([
  rest('compliance_requirements?select=id,code,name,applies_to_role,applies_to_minor,severity,validity_days,rule_definition&order=name.asc'),
  rest('credentials?select=id,person_id,requirement_id,credential_type,issuer,issued_on,expires_on,status,verification_status,verified_at&limit=500'),
  rest('background_checks?select=id,person_id,check_type,provider,submitted_at,completed_at,expires_on,status,result_classification&limit=500'),
  rest('safesport_records?select=id,person_id,governing_body_id,certification_type,completed_on,expires_on,status,source,verified_at&limit=500'),
  rest(`waivers?select=id,organization_id,code,name,version,required_for,effective_from,effective_to,status&organization_id=${orgFilter}&limit=500`),
  rest(`memberships?select=id,organization_id,person_id,membership_number,membership_type,starts_on,ends_on,status&organization_id=${orgFilter}&limit=500`),
  rest(`data_quality_issues?select=id,entity_type,entity_id,severity,status,detected_at,resolved_at,details&tenant_id=eq.${tenant}&status=neq.resolved&order=detected_at.desc&limit=200`),
  rest(`duplicate_candidates?select=id,entity_type,left_entity_id,right_entity_id,confidence,match_reason,status,resolved_at&tenant_id=eq.${tenant}&status=neq.resolved&limit=200`),
  rest(`competitions?select=id,organization_id,name,competition_type,starts_at,ends_at,timezone,city,region,country_code,status,sanction_number,venue_facility_id&organization_id=${orgFilter}&order=starts_at.desc&limit=200`)
 ]);
 return {requirements,credentials,backgroundChecks,safeSport,waivers,memberships,dataQualityIssues,duplicateCandidates,competitions};
}

async function registrarSnapshot(orgs:string[]){
 if(!orgs.length)return {registrations:[],memberships:[],teamMemberships:[],athletes:[]};const orgFilter=inFilter(orgs);
 const registrations=await rest(`registrations?select=*&organization_id=${orgFilter}&order=submitted_at.desc&limit=500`);
 const memberships=await rest(`memberships?select=*&organization_id=${orgFilter}&limit=500`);
 const teams=await rest(`teams?select=id&organization_id=${orgFilter}&limit=500`);const teamIds=teams.map((x:any)=>x.id);
 const teamMemberships=teamIds.length?await rest(`team_memberships?select=*&team_id=${inFilter(teamIds)}&limit=500`):[];
 const athleteIds=[...new Set([...registrations.map((x:any)=>x.athlete_id),...teamMemberships.map((x:any)=>x.athlete_id)].filter(Boolean))];
 const athletes=athleteIds.length?await rest(`athletes?select=*&id=${inFilter(athleteIds)}&limit=500`):[];
 return {registrations,memberships,teamMemberships,athletes};
}

async function orgAdminEnterprise(orgs:string[],tenant:string){
 const orgFilter=inFilter(orgs); if(!orgFilter)return {facilities:[],vendors:[],externalOrganizations:[],payrollRuns:[],imports:[],facilityBookings:[]};
 const [sites,teams,legalEntities,vendors,externalOrganizations,imports]=await Promise.all([
  rest(`sites?select=id&organization_id=${orgFilter}&limit=500`),
  rest(`teams?select=id&organization_id=${orgFilter}&limit=500`),
  rest(`legal_entities?select=id&organization_id=${orgFilter}&limit=100`),
  rest(`vendors?select=*&organization_id=${orgFilter}&limit=200`),
  rest(`organizations?select=id,parent_organization_id,code,name,legal_name,organization_type,status&tenant_id=eq.${tenant}&id=not.${orgFilter}&limit=200`),
  rest(`import_jobs?select=*&tenant_id=eq.${tenant}&order=started_at.desc&limit=100`)
 ]);
 const siteIds=sites.map((x:any)=>x.id),teamIds=teams.map((x:any)=>x.id),legalEntityIds=legalEntities.map((x:any)=>x.id);
 const facilities=siteIds.length?await rest(`facilities?select=*&site_id=${inFilter(siteIds)}&limit=200`):[];
 const facilityIds=facilities.map((x:any)=>x.id);
 const payrollRuns=legalEntityIds.length?await rest(`payroll_runs?select=*&legal_entity_id=${inFilter(legalEntityIds)}&limit=100`):[];
 const bookingFilters=[] as string[];if(facilityIds.length)bookingFilters.push(`facility_id.${inFilter(facilityIds)}`);if(teamIds.length)bookingFilters.push(`team_id.${inFilter(teamIds)}`);
 const facilityBookings=bookingFilters.length?await rest(`facility_bookings?select=*&or=(${bookingFilters.join(',')})&order=starts_at.desc&limit=500`):[];
 return {facilities,vendors,externalOrganizations,payrollRuns,imports,facilityBookings};
}

export async function POST(request:NextRequest){
 try{const ctx=await resolveAccess(request);if(!ctx)return deny(401,'Authentication required.');if(!ctx.allowedHubs.includes('admin'))return deny(403,'Admin access denied.');
  const body=await request.json();const action=String(body.action||''),roleName=String(body.role||'org_admin').trim(),tenant=tenantId(ctx);if(!canUseAdminRoleContext(ctx,roleName))return deny(403,'Admin role context is not assigned or delegable for this user.');if(!tenant)return deny(403,'Canonical tenant context required.');const correlationId=crypto.randomUUID();
  if(action==='update-master-record'){
   if(roleName!=='org_admin'||!roleHas(ctx,roleName,'record.update'))return deny(403,'Organization master record update denied.');
   const entity=String(body.entity||''),id=String(body.id||''),changes=body.changes&&typeof body.changes==='object'?body.changes:{};
   const specs:Record<string,{table:string,fields:string[],scope:'tenant'|'organization'}>={organization:{table:'organizations',fields:['name','legal_name','organization_type','status'],scope:'tenant'},person:{table:'people',fields:['first_name','last_name','preferred_name','email','phone','status','privacy_classification'],scope:'tenant'},site:{table:'sites',fields:['code','name','address_line1','city','region','postal_code','country_code','timezone','status'],scope:'organization'},program:{table:'programs',fields:['code','name','program_type','status'],scope:'organization'},season:{table:'seasons',fields:['code','name','starts_on','ends_on','status'],scope:'organization'},team:{table:'teams',fields:['code','name','competitive_level','status'],scope:'organization'}};
   const spec=specs[entity];if(!spec||!id)return deny(400,'Supported entity and record ID are required.');const allowed=Object.fromEntries(Object.entries(changes).filter(([k])=>spec.fields.includes(k)));if(!Object.keys(allowed).length)return deny(400,'No supported changes supplied.');
   const scope=spec.scope==='tenant'?`tenant_id=eq.${tenant}`:`organization_id=${inFilter(organizationIds(ctx))}`;const existing=await rest(`${spec.table}?select=*&id=eq.${encodeURIComponent(id)}&${scope}&limit=1`);if(!existing?.length)return deny(404,'Record not found in authorized scope.');
   const row=await rest(`${spec.table}?id=eq.${encodeURIComponent(id)}&${scope}`,{method:'PATCH',body:JSON.stringify(allowed)});if(!row?.length)return deny(409,'Record changed before update.');await audit(ctx,tenant,`${entity}.updated`,entity,id,existing[0],row[0],correlationId);return NextResponse.json({ok:true,row:row[0],correlationId});
  }
  if(action==='archive-master-record'){
   if(roleName!=='org_admin'||!roleHas(ctx,roleName,'record.archive'))return deny(403,'Organization master record archive denied.');const entity=String(body.entity||''),id=String(body.id||'');const specs:Record<string,{table:string,scope:'tenant'|'organization'}>={organization:{table:'organizations',scope:'tenant'},person:{table:'people',scope:'tenant'},site:{table:'sites',scope:'organization'},program:{table:'programs',scope:'organization'},season:{table:'seasons',scope:'organization'},team:{table:'teams',scope:'organization'}};const spec=specs[entity];if(!spec||!id)return deny(400,'Supported entity and record ID are required.');if(entity==='organization')return deny(409,'Root organization archival requires a dedicated governance workflow.');
   const scope=spec.scope==='tenant'?`tenant_id=eq.${tenant}`:`organization_id=${inFilter(organizationIds(ctx))}`;const existing=await rest(`${spec.table}?select=*&id=eq.${encodeURIComponent(id)}&${scope}&limit=1`);if(!existing?.length)return deny(404,'Record not found in authorized scope.');if(existing[0].status==='archived'||existing[0].status==='inactive')return NextResponse.json({ok:true,row:existing[0],correlationId,idempotent:true});const nextStatus=entity==='person'?'inactive':'archived';
   const row=await rest(`${spec.table}?id=eq.${encodeURIComponent(id)}&${scope}`,{method:'PATCH',body:JSON.stringify({status:nextStatus})});if(!row?.length)return deny(409,'Record changed before archive.');await audit(ctx,tenant,`${entity}.archived`,entity,id,existing[0],row[0],correlationId);return NextResponse.json({ok:true,row:row[0],correlationId});
  }
  if(action==='assign-role'){
   if(roleName!=='org_admin')return deny(403,'Role assignment requires Organization Administrator context.');
   if(!roleHas(ctx,roleName,'role_assignments.manage'))return deny(403,'Role assignment denied.');
   const personId=String(body.personId||''),roleDefinitionId=String(body.roleDefinitionId||''),organizationId=String(body.organizationId||'');
   if(!personId||!roleDefinitionId||!organizationId)return deny(400,'Person, role and organization are required.');
   if(!organizationIds(ctx).includes(organizationId))return deny(403,'Organization scope denied.');
   const roleRows=await rest(`role_definitions?select=id,code,name,privilege_level,config,is_active&id=eq.${encodeURIComponent(roleDefinitionId)}&is_active=eq.true&limit=1`);
   if(!roleRows?.length)return deny(404,'Role not found.'); const role=roleRows[0];
   if(role.config?.platform_only||Number(role.privilege_level)>ctx.maxDelegablePrivilege)return deny(403,'Role exceeds delegable authority.');
   const people=await rest(`people?select=id,tenant_id,first_name,last_name,email&id=eq.${encodeURIComponent(personId)}&tenant_id=eq.${tenant}&limit=1`);
   if(!people?.length)return deny(404,'Person not found in tenant.');
   const existing=await rest(`role_assignments?select=*&tenant_id=eq.${tenant}&person_id=eq.${encodeURIComponent(personId)}&role_definition_id=eq.${encodeURIComponent(roleDefinitionId)}&organization_id=eq.${encodeURIComponent(organizationId)}&status=eq.active&limit=1`);
   if(existing?.length)return NextResponse.json({ok:true,row:existing[0],correlationId,idempotent:true});
   const row=await rest('role_assignments',{method:'POST',body:JSON.stringify({tenant_id:tenant,person_id:personId,role_definition_id:roleDefinitionId,organization_id:organizationId,status:'active',granted_by:ctx.person?.id||null,metadata:{assigned_by:ctx.user.id,correlation_id:correlationId}})});
   const created=row?.[0];if(!created)throw new Error('Role assignment returned no record.');
   await audit(ctx,tenant,'role_assignment.created','role_assignment',created.id,null,created,correlationId);
   return NextResponse.json({ok:true,row:created,correlationId});
  }
  if(action==='revoke-role'){
   if(roleName!=='org_admin')return deny(403,'Role revocation requires Organization Administrator context.');
   if(!roleHas(ctx,roleName,'role_assignments.manage'))return deny(403,'Role revocation denied.');
   const id=String(body.id||'');if(!id)return deny(400,'Role assignment ID is required.');
   const existing=await rest(`role_assignments?select=*&id=eq.${encodeURIComponent(id)}&tenant_id=eq.${tenant}&limit=1`);
   if(!existing?.length)return deny(404,'Role assignment not found.');
   if(!organizationIds(ctx).includes(existing[0].organization_id))return deny(403,'Organization scope denied.');
   if(existing[0].person_id===ctx.person?.id&&existing[0].role_definition_id===ctx.roles.find(r=>r.code==='ORGANIZATION_ADMIN')?.id)return deny(409,'Organization Administrator cannot revoke their own active authority.');
   if(existing[0].status!=='active')return NextResponse.json({ok:true,row:existing[0],correlationId,idempotent:true});
   const row=await rest(`role_assignments?id=eq.${encodeURIComponent(id)}&tenant_id=eq.${tenant}&status=eq.active`,{method:'PATCH',body:JSON.stringify({status:'revoked',ends_at:new Date().toISOString(),metadata:{...(existing[0].metadata||{}),revoked_by:ctx.user.id,correlation_id:correlationId}})});
   if(!row?.length)return deny(409,'Role assignment changed before revocation.');
   await audit(ctx,tenant,'role_assignment.revoked','role_assignment',id,existing[0],row[0],correlationId);
   return NextResponse.json({ok:true,row:row[0],correlationId});
  }
  if(action==='create-task'){if(!roleHas(ctx,roleName,'admin_tasks.create'))return deny(403,'Task creation denied.');const title=String(body.title||'').trim();if(!title)return deny(400,'Task title is required.');const row=await rest('work_items',{method:'POST',body:JSON.stringify({tenant_id:tenant,work_type:'ADMIN_TASK',status:'open',priority:body.priority||'normal',payload:{title,description:body.description||null,created_from:'admin_command_center',created_by:ctx.user.id,correlation_id:correlationId}})});const created=row?.[0];if(!created)throw new Error('Canonical task creation returned no record.');await audit(ctx,tenant,'admin_task.created','work_item',created.id,null,created,correlationId);return NextResponse.json({ok:true,row:created,correlationId});}
  if(action==='complete-task'){if(!roleHas(ctx,roleName,'admin_tasks.update'))return deny(403,'Task update denied.');const id=String(body.id||'');if(!id)return deny(400,'Task ID is required.');const existing=await rest(`work_items?select=*&id=eq.${encodeURIComponent(id)}&tenant_id=eq.${tenant}&limit=1`);if(!existing?.length)return deny(404,'Task not found in authorized scope.');if(existing[0].status==='completed')return NextResponse.json({ok:true,row:existing[0],correlationId,idempotent:true});const row=await rest(`work_items?id=eq.${encodeURIComponent(id)}&tenant_id=eq.${tenant}&status=neq.completed`,{method:'PATCH',body:JSON.stringify({status:'completed'})});if(!row?.length)return deny(409,'Task changed before completion. Refresh and retry.');await audit(ctx,tenant,'admin_task.completed','work_item',id,existing[0],row[0],correlationId);return NextResponse.json({ok:true,row:row[0],correlationId});}
  return deny(400,'Unsupported Admin action.');
 }catch(error){return deny(400,error instanceof Error?error.message:'Admin action failed.');}
}
