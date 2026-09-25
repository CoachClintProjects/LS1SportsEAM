import { NextRequest,NextResponse } from 'next/server';
import { canUseAdminRoleContext,hasPermission,resolveAccess,serviceHeaders,type AccessContext } from '@/lib/server/accessControl';
import { supabaseServerConfig } from '@/lib/server/superuserAuth';
export const dynamic='force-dynamic'; export const revalidate=0;

async function rest(path:string,init:RequestInit={}){const {url}=supabaseServerConfig();const h=serviceHeaders();if(!url||!h)throw new Error('Supabase service credentials are not configured.');const response=await fetch(`${url}/rest/v1/${path}`,{...init,headers:{...h,Prefer:'return=representation',...(init.headers||{})},cache:'no-store'});const text=await response.text();if(!response.ok)throw new Error(`Canonical store returned ${response.status}: ${text.slice(0,300)}`);return text?JSON.parse(text):null;}
const deny=(status:number,error:string)=>NextResponse.json({error},{status});
function roleHas(ctx:AccessContext,_role:string,permission:string){return hasPermission(ctx,permission);}
function tenantId(ctx:AccessContext){return ctx.person?.tenant_id||null;}
function organizationIds(ctx:AccessContext){return [...new Set(ctx.roles.map(r=>r.scope.organization_id).filter(Boolean))] as string[];}
function inFilter(ids:string[]){return ids.length?`in.(${ids.map(encodeURIComponent).join(',')})`:'';}
async function audit(ctx:AccessContext,tenant:string,action:string,entityType:string,entityId:string,beforeData:unknown,afterData:unknown,correlationId:string){await rest('audit_events',{method:'POST',body:JSON.stringify({tenant_id:tenant,actor_user_id:ctx.user.id,actor_person_id:ctx.person?.id||null,action,entity_type:entityType,entity_id:entityId,before_data:beforeData||null,after_data:afterData||null,correlation_id:correlationId,reason:'Admin operational action',privileged:ctx.isPlatformSuperUser})});}

export async function GET(request:NextRequest){
 try{const ctx=await resolveAccess(request);if(!ctx)return deny(401,'Authentication required.');if(!ctx.allowedHubs.includes('admin'))return deny(403,'Admin access denied.');
  const roleName=(request.nextUrl.searchParams.get('role')||'org_admin').trim();if(!canUseAdminRoleContext(ctx,roleName))return deny(403,'Admin role context is not assigned or delegable for this user.');
  const canTasks=roleHas(ctx,roleName,'admin_tasks.read'),canFinance=roleHas(ctx,roleName,'finance.read'),canRoster=roleHas(ctx,roleName,'rosters.read');
  const tenant=tenantId(ctx),orgs=organizationIds(ctx); if(!tenant)return deny(403,'Canonical tenant context required.');if(!orgs.length)return deny(403,'Canonical organization context required.');
  const teamQuery=canRoster&&orgs.length?`teams?select=id&organization_id=${inFilter(orgs)}&status=eq.active`:null;
  const teams=teamQuery?await rest(teamQuery):[];
  const teamIds=(teams||[]).map((r:any)=>r.id);
  const [financeCustomers,financeEntities]=canFinance&&orgs.length?await Promise.all([rest(`customers?select=id&organization_id=${inFilter(orgs)}&limit=1000`),rest(`legal_entities?select=id&organization_id=${inFilter(orgs)}&limit=200`)]):[[],[]];
  const customerIds=(financeCustomers||[]).map((r:any)=>r.id),legalEntityIds=(financeEntities||[]).map((r:any)=>r.id);
  const [invoices,bills,tasks,athletes,calendarEvents]=await Promise.all([
   canFinance&&customerIds.length?rest(`invoices?select=id,customer_id,invoice_number,invoice_date,due_date,currency,total,balance_due,status,customers(id,person_id,display_name,customer_code,people(id,first_name,last_name,preferred_name,email))&customer_id=${inFilter(customerIds)}&order=invoice_date.desc&limit=200`):[],
   canFinance&&legalEntityIds.length?rest(`vendor_bills?select=id,bill_number,bill_date,due_date,currency,total,balance_due,status&legal_entity_id=${inFilter(legalEntityIds)}&order=bill_date.desc&limit=50`):[],
   canTasks?rest(`work_items?select=id,tenant_id,work_type,status,priority,payload&tenant_id=eq.${tenant}&order=id.desc&limit=100`):[],
   canRoster&&teamIds.length?rest(`team_memberships?select=athlete_id&team_id=${inFilter(teamIds)}&status=eq.active`):[],
   orgs.length?rest(`calendar_events?select=id,organization_id,title,event_type,starts_at,ends_at,timezone,status,metadata&organization_id=${inFilter(orgs)}&order=starts_at.asc&limit=500`):[],
  ]);
  const athleteCount=new Set((athletes||[]).map((r:any)=>r.athlete_id)).size;
  const arBalance=(invoices||[]).reduce((s:number,r:any)=>s+Number(r.balance_due||0),0),apBalance=(bills||[]).reduce((s:number,r:any)=>s+Number(r.balance_due||0),0);
  const pastDue=(invoices||[]).filter((r:any)=>r.due_date&&Number(r.balance_due||0)>0&&new Date(String(r.due_date)).getTime()<Date.now()).length;
  const orgAdmin=roleName==='org_admin'?await orgAdminSnapshot(ctx,tenant,orgs):null;
  const controls=await orgAdminControls(tenant,orgs);
  const enterprise=roleName==='org_admin'?await orgAdminEnterprise(orgs,tenant):null;
  const registrar=await registrarSnapshot(orgs);
  return NextResponse.json({calendarEvents,viewer:{personId:ctx.person?.id||null,email:ctx.user.email,displayName:ctx.person?([...(orgAdmin?.people||[]).filter((p:any)=>p.id===ctx.person?.id).map((p:any)=>p.preferred_name||p.first_name).filter(Boolean)][0]||ctx.user.email.split('@')[0]):ctx.user.email.split('@')[0]},invoices,vendorBills:bills,tasks,orgAdmin,controls,enterprise,registrar,metrics:{arBalance,apBalance,openInvoices:(invoices||[]).filter((r:any)=>Number(r.balance_due||0)>0).length,pastDue,activeAthletes:athleteCount,activeTeams:(teams||[]).length},generatedAt:new Date().toISOString(),source:'LS1SportsEAM canonical store',context:{tenantId:tenant,organizationIds:orgs,role:roleName},authorization:{finance:canFinance,tasks:canTasks,roster:canRoster}});
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
  rest(`people?select=id,first_name,last_name,preferred_name,birth_date,email,phone,status,privacy_classification&tenant_id=eq.${tenant}&order=last_name.asc,first_name.asc&limit=500`),
  rest(`role_assignments?select=id,person_id,role_definition_id,organization_id,sport_id,site_id,team_id,program_id,competition_id,starts_at,ends_at,status,metadata,created_at&tenant_id=eq.${tenant}&organization_id=${orgFilter}&order=created_at.desc&limit=500`),
  rest('role_definitions?select=id,code,name,description,privilege_level,role_type,config,is_active&is_active=eq.true&order=privilege_level.desc'),
  hasPermission(ctx,'audit.read')?rest(`audit_events?select=id,actor_person_id,action,entity_type,entity_id,occurred_at,correlation_id,reason&tenant_id=eq.${tenant}&order=occurred_at.desc&limit=100`):[]
 ]);
 return {organizations,sites,programs,seasons,teams,people,assignments,roles:(roles||[]).filter((r:any)=>!r.config?.platform_only&&Number(r.privilege_level)<=ctx.maxDelegablePrivilege),audit:auditRows};
}

async function orgAdminControls(tenant:string,orgs:string[]){
 if(!orgs.length)return {requirements:[],credentials:[],backgroundChecks:[],safeSport:[],waivers:[],memberships:[],dataQualityIssues:[],duplicateCandidates:[],competitions:[]};
 const orgFilter=inFilter(orgs);
 const scopedPeople=await rest(`people?select=id&tenant_id=eq.${tenant}&limit=2000`),personIds=(scopedPeople||[]).map((p:any)=>p.id),personFilter=inFilter(personIds);
 const [requirements,credentials,backgroundChecks,safeSport,waivers,memberships,dataQualityIssues,duplicateCandidates,competitions]=await Promise.all([
  rest('compliance_requirements?select=id,code,name,applies_to_role,applies_to_minor,severity,validity_days,rule_definition&order=name.asc'),
  personIds.length?rest(`credentials?select=id,person_id,requirement_id,credential_type,issuer,issued_on,expires_on,status,verification_status,verified_at&person_id=${personFilter}&limit=500`):[],
  personIds.length?rest(`background_checks?select=id,person_id,check_type,provider,submitted_at,completed_at,expires_on,status,result_classification&person_id=${personFilter}&limit=500`):[],
  personIds.length?rest(`safesport_records?select=id,person_id,governing_body_id,certification_type,completed_on,expires_on,status,source,verified_at&person_id=${personFilter}&limit=500`):[],
  rest(`waivers?select=id,organization_id,code,name,version,required_for,effective_from,effective_to,status&organization_id=${orgFilter}&limit=500`),
  rest(`memberships?select=id,organization_id,person_id,membership_number,membership_type,starts_on,ends_on,status&organization_id=${orgFilter}&limit=500`),
  rest(`data_quality_issues?select=id,entity_type,entity_id,severity,status,detected_at,resolved_at,details&tenant_id=eq.${tenant}&status=neq.resolved&order=detected_at.desc&limit=200`),
  rest(`duplicate_candidates?select=id,entity_type,left_entity_id,right_entity_id,confidence,match_reason,status,resolved_at&tenant_id=eq.${tenant}&status=neq.resolved&limit=200`),
  rest(`competitions?select=id,organization_id,name,competition_type,starts_at,ends_at,timezone,city,region,country_code,status,sanction_number,venue_facility_id&organization_id=${orgFilter}&order=starts_at.desc&limit=200`)
 ]);
 const competitionIds=(competitions||[]).map((x:any)=>x.id);const scopedDeadlines=competitionIds.length?await rest(`competition_deadlines?select=id,competition_id,deadline_type,name,due_at,status,rules&competition_id=${inFilter(competitionIds)}&order=due_at.asc&limit=500`):[];
 return {requirements,credentials,backgroundChecks,safeSport,waivers,memberships,dataQualityIssues,duplicateCandidates,competitions,deadlines:scopedDeadlines};
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
 const [sites,teams,legalEntities,vendors,externalOrganizations,imports,contracts]=await Promise.all([
  rest(`sites?select=id,organization_id,code,name,timezone,status&organization_id=${orgFilter}&limit=500`),
  rest(`teams?select=id&organization_id=${orgFilter}&limit=500`),
  rest(`legal_entities?select=id&organization_id=${orgFilter}&limit=100`),
  rest(`vendors?select=*&organization_id=${orgFilter}&limit=200`),
  rest(`organizations?select=id,parent_organization_id,code,name,legal_name,organization_type,status&tenant_id=eq.${tenant}&id=not.${orgFilter}&limit=200`),
  rest(`import_jobs?select=*&tenant_id=eq.${tenant}&order=started_at.desc&limit=100`),
  rest(`contracts?select=*&tenant_id=eq.${tenant}&organization_id=${orgFilter}&order=expires_on.asc&limit=500`)
 ]);
 const siteIds=sites.map((x:any)=>x.id),teamIds=teams.map((x:any)=>x.id),legalEntityIds=legalEntities.map((x:any)=>x.id);
 const facilities=siteIds.length?await rest(`facilities?select=*&site_id=${inFilter(siteIds)}&limit=200`):[];
 const facilityIds=facilities.map((x:any)=>x.id);
 const payrollRuns=legalEntityIds.length?await rest(`payroll_runs?select=*&legal_entity_id=${inFilter(legalEntityIds)}&limit=100`):[];
 const bookingFilters=[] as string[];if(facilityIds.length)bookingFilters.push(`facility_id.${inFilter(facilityIds)}`);if(teamIds.length)bookingFilters.push(`team_id.${inFilter(teamIds)}`);
 const facilityBookings=bookingFilters.length?await rest(`facility_bookings?select=*&or=(${bookingFilters.join(',')})&order=starts_at.desc&limit=500`):[];
 return {sites,facilities,vendors,externalOrganizations,payrollRuns,imports,facilityBookings,contracts};
}

export async function POST(request:NextRequest){
 try{const ctx=await resolveAccess(request);if(!ctx)return deny(401,'Authentication required.');if(!ctx.allowedHubs.includes('admin'))return deny(403,'Admin access denied.');
  const body=await request.json();const action=String(body.action||''),roleName=String(body.role||'org_admin').trim(),tenant=tenantId(ctx);if(!canUseAdminRoleContext(ctx,roleName))return deny(403,'Admin role context is not assigned or delegable for this user.');if(!tenant)return deny(403,'Canonical tenant context required.');const correlationId=crypto.randomUUID();
  if(action==='create-master-record'){
   if(roleName!=='org_admin'||!roleHas(ctx,roleName,'record.create'))return deny(403,'Organization master record creation denied.');
   const entity=String(body.entity||''),values=body.values&&typeof body.values==='object'?body.values:{};
   const specs:Record<string,{table:string,fields:string[],scope:'tenant'|'organization',required:string[]}>={person:{table:'people',fields:['first_name','last_name','preferred_name','birth_date','email','phone','status','privacy_classification'],scope:'tenant',required:['first_name','last_name']},site:{table:'sites',fields:['code','name','address_line1','city','region','postal_code','country_code','timezone','status'],scope:'organization',required:['code','name']},program:{table:'programs',fields:['code','name','program_type','status'],scope:'organization',required:['code','name']},season:{table:'seasons',fields:['code','name','starts_on','ends_on','status'],scope:'organization',required:['code','name']},team:{table:'teams',fields:['code','name','competitive_level','status'],scope:'organization',required:['code','name']}};
   const spec=specs[entity];if(!spec)return deny(400,'Supported entity is required.');const allowed=Object.fromEntries(Object.entries(values).filter(([k])=>spec.fields.includes(k)));for(const key of spec.required)if(!String(allowed[key]||'').trim())return deny(400,key+' is required.');
   const payload={...allowed,...(spec.scope==='tenant'?{tenant_id:tenant}:{organization_id:organizationIds(ctx)[0]})};const row=await rest(spec.table,{method:'POST',body:JSON.stringify(payload)});const created=row?.[0];if(!created)throw new Error('Record creation returned no record.');await audit(ctx,tenant,entity+'.created',entity,created.id,null,created,correlationId);return NextResponse.json({ok:true,row:created,correlationId});
  }
  if(action==='update-master-record'){
   if(roleName!=='org_admin'||!roleHas(ctx,roleName,'record.update'))return deny(403,'Organization master record update denied.');
   const entity=String(body.entity||''),id=String(body.id||''),changes=body.changes&&typeof body.changes==='object'?body.changes:{};
   const specs:Record<string,{table:string,fields:string[],scope:'tenant'|'organization'}>={organization:{table:'organizations',fields:['name','legal_name','organization_type','status'],scope:'tenant'},person:{table:'people',fields:['first_name','last_name','preferred_name','birth_date','email','phone','status','privacy_classification'],scope:'tenant'},site:{table:'sites',fields:['code','name','address_line1','city','region','postal_code','country_code','timezone','status'],scope:'organization'},program:{table:'programs',fields:['code','name','program_type','status'],scope:'organization'},season:{table:'seasons',fields:['code','name','starts_on','ends_on','status'],scope:'organization'},team:{table:'teams',fields:['code','name','competitive_level','status'],scope:'organization'}};
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
  if(action==='update-compliance-record'){
   if(roleName!=='org_admin'||!roleHas(ctx,roleName,'record.update'))return deny(403,'Compliance update denied.');
   const domain=String(body.domain||''),id=String(body.id||''),changes=body.changes&&typeof body.changes==='object'?body.changes:{};if(!id)return deny(400,'Compliance record ID is required.');
   const specs:Record<string,{table:string,fields:string[]}>={credentials:{table:'credentials',fields:['issuer','credential_number','issued_on','expires_on','status','verification_status','verified_at']},backgroundChecks:{table:'background_checks',fields:['provider','reference_number','submitted_at','completed_at','expires_on','status','result_classification']},safeSport:{table:'safesport_records',fields:['certificate_id','completed_on','expires_on','status','source','verified_at']}};
   const spec=specs[domain];if(!spec)return deny(400,'Supported compliance domain is required.');const allowed=Object.fromEntries(Object.entries(changes).filter(([k])=>spec.fields.includes(k)));if(!Object.keys(allowed).length)return deny(400,'No supported compliance changes supplied.');
   const existing=await rest(`${spec.table}?select=*&id=eq.${encodeURIComponent(id)}&limit=1`);if(!existing?.length)return deny(404,'Compliance record not found.');const personId=existing[0].person_id;const person=await rest(`people?select=id,tenant_id&id=eq.${encodeURIComponent(personId)}&tenant_id=eq.${tenant}&limit=1`);if(!person?.length)return deny(403,'Compliance record is outside authorized tenant scope.');
   const row=await rest(`${spec.table}?id=eq.${encodeURIComponent(id)}&person_id=eq.${encodeURIComponent(personId)}`,{method:'PATCH',body:JSON.stringify(allowed)});if(!row?.length)return deny(409,'Compliance record changed before update.');await audit(ctx,tenant,'compliance_record.updated',domain,id,existing[0],row[0],correlationId);return NextResponse.json({ok:true,row:row[0],correlationId});
  }
  if(action==='create-competition'){
   if(roleName!=='org_admin'||!roleHas(ctx,roleName,'record.create'))return deny(403,'Competition creation denied.');
   const name=String(body.name||'').trim(),orgs=organizationIds(ctx);if(!name||!orgs.length)return deny(400,'Competition name and organization scope are required.');
   const organizationId=body.organizationId?String(body.organizationId):orgs.length===1?orgs[0]:'';if(!organizationId||!orgs.includes(organizationId))return deny(403,'Authorized organization selection is required.');
   const payload:any={tenant_id:tenant,organization_id:organizationId,name};
   for(const [source,target] of [['competitionType','competition_type'],['startsAt','starts_at'],['endsAt','ends_at'],['timezone','timezone'],['city','city'],['region','region'],['countryCode','country_code'],['sanctionNumber','sanction_number']] as const){if(body[source]!==undefined&&body[source]!==null&&String(body[source]).trim()!=='')payload[target]=body[source];}
   const row=await rest('competitions',{method:'POST',body:JSON.stringify(payload)});const created=row?.[0];if(!created)throw new Error('Competition creation returned no record.');await audit(ctx,tenant,'competition.created','competition',created.id,null,created,correlationId);return NextResponse.json({ok:true,row:created,correlationId});
  }
  if(action==='update-competition'){
   if(roleName!=='org_admin'||!roleHas(ctx,roleName,'record.update'))return deny(403,'Competition update denied.');const id=String(body.id||''),orgs=organizationIds(ctx);if(!id||!orgs.length)return deny(400,'Competition ID and organization scope are required.');
   const existing=await rest(`competitions?select=*&id=eq.${encodeURIComponent(id)}&organization_id=${inFilter(orgs)}&limit=1`);if(!existing?.length)return deny(404,'Competition not found in authorized scope.');
   const allowed=Object.fromEntries(Object.entries(body.changes||{}).filter(([k])=>['name','competition_type','starts_at','ends_at','timezone','city','region','country_code','status','sanction_number','venue_facility_id'].includes(k)));if(!Object.keys(allowed).length)return deny(400,'No supported competition changes supplied.');
   const row=await rest(`competitions?id=eq.${encodeURIComponent(id)}&organization_id=${inFilter(orgs)}`,{method:'PATCH',body:JSON.stringify(allowed)});if(!row?.length)return deny(409,'Competition changed before update.');await audit(ctx,tenant,'competition.updated','competition',id,existing[0],row[0],correlationId);return NextResponse.json({ok:true,row:row[0],correlationId});
  }
  if(action==='create-competition-deadline'){if(roleName!=='org_admin'||!roleHas(ctx,roleName,'competition_entries.update'))return deny(403,'Competition deadline creation denied.');const competitionId=String(body.competitionId||''),name=String(body.name||'').trim(),deadlineType=String(body.deadlineType||'').trim(),dueAt=String(body.dueAt||''),orgs=organizationIds(ctx);if(!competitionId||!name||!deadlineType||!dueAt||Number.isNaN(Date.parse(dueAt)))return deny(400,'Competition, deadline type, name and due time are required.');const comp=await rest(`competitions?select=id,organization_id&id=eq.${encodeURIComponent(competitionId)}&organization_id=${inFilter(orgs)}&limit=1`);if(!comp?.length)return deny(404,'Competition not found in authorized scope.');const row=await rest('competition_deadlines',{method:'POST',body:JSON.stringify({competition_id:competitionId,deadline_type:deadlineType,name,due_at:dueAt,status:'open'})});const created=row?.[0];if(!created)throw new Error('Competition deadline creation returned no record.');await audit(ctx,tenant,'competition_deadline.created','competition_deadline',created.id,null,created,correlationId);return NextResponse.json({ok:true,row:created,correlationId});}
  if(action==='update-competition-deadline'){if(roleName!=='org_admin'||!roleHas(ctx,roleName,'competition_entries.update'))return deny(403,'Competition deadline update denied.');const id=String(body.id||''),orgs=organizationIds(ctx);const comps=await rest(`competitions?select=id&organization_id=${inFilter(orgs)}&limit=500`),ids=comps.map((x:any)=>x.id),existing=ids.length?await rest(`competition_deadlines?select=*&id=eq.${encodeURIComponent(id)}&competition_id=${inFilter(ids)}&limit=1`):[];if(!existing?.length)return deny(404,'Competition deadline not found in authorized scope.');const allowed=Object.fromEntries(Object.entries(body.changes||{}).filter(([k])=>['name','due_at','status','rules'].includes(k)));if(!Object.keys(allowed).length)return deny(400,'No supported deadline changes supplied.');const row=await rest(`competition_deadlines?id=eq.${encodeURIComponent(id)}&competition_id=${inFilter(ids)}`,{method:'PATCH',body:JSON.stringify(allowed)});if(!row?.length)return deny(409,'Competition deadline changed before update.');await audit(ctx,tenant,'competition_deadline.updated','competition_deadline',id,existing[0],row[0],correlationId);return NextResponse.json({ok:true,row:row[0],correlationId});}
  if(action==='create-facility'){
   if(roleName!=='org_admin'||!roleHas(ctx,roleName,'record.create'))return deny(403,'Facility creation denied.');
   const siteId=String(body.siteId||''),code=String(body.code||'').trim(),name=String(body.name||'').trim();if(!siteId||!code||!name)return deny(400,'Site, facility code and name are required.');
   const orgFilter=inFilter(organizationIds(ctx));if(!orgFilter)return deny(403,'Organization scope required.');
   const sites=await rest(`sites?select=id,organization_id,timezone&id=eq.${encodeURIComponent(siteId)}&organization_id=${orgFilter}&limit=1`);if(!sites?.length)return deny(403,'Site is outside authorized organization scope.');
   const row=await rest('facilities',{method:'POST',body:JSON.stringify({site_id:siteId,code,name,facility_type:body.facilityType||null,capacity:body.capacity?Number(body.capacity):null,timezone:body.timezone||sites[0].timezone||null,status:'active'})});const created=row?.[0];if(!created)throw new Error('Facility creation returned no record.');await audit(ctx,tenant,'facility.created','facility',created.id,null,created,correlationId);return NextResponse.json({ok:true,row:created,correlationId});
  }
  if(action==='update-facility'){
   if(roleName!=='org_admin'||!roleHas(ctx,roleName,'record.update'))return deny(403,'Facility update denied.');const id=String(body.id||'');if(!id)return deny(400,'Facility ID is required.');const orgFilter=inFilter(organizationIds(ctx));const sites=orgFilter?await rest(`sites?select=id&organization_id=${orgFilter}&limit=500`):[];const siteFilter=inFilter(sites.map((s:any)=>s.id));if(!siteFilter)return deny(403,'Organization scope required.');const existing=await rest(`facilities?select=*&id=eq.${encodeURIComponent(id)}&site_id=${siteFilter}&limit=1`);if(!existing?.length)return deny(404,'Facility not found in authorized scope.');const allowed=Object.fromEntries(Object.entries(body.changes||{}).filter(([k])=>['name','facility_type','capacity','timezone','status'].includes(k)));if(!Object.keys(allowed).length)return deny(400,'No supported facility changes supplied.');const row=await rest(`facilities?id=eq.${encodeURIComponent(id)}&site_id=${siteFilter}`,{method:'PATCH',body:JSON.stringify(allowed)});if(!row?.length)return deny(409,'Facility changed before update.');await audit(ctx,tenant,'facility.updated','facility',id,existing[0],row[0],correlationId);return NextResponse.json({ok:true,row:row[0],correlationId});
  }
  if(action==='create-facility-booking'){
   if(roleName!=='org_admin'||!roleHas(ctx,roleName,'record.create'))return deny(403,'Facility booking creation denied.');const facilityId=String(body.facilityId||''),startsAt=String(body.startsAt||''),endsAt=String(body.endsAt||'');if(!facilityId||!startsAt||!endsAt||Date.parse(endsAt)<=Date.parse(startsAt))return deny(400,'Facility and a valid booking window are required.');
   const orgFilter=inFilter(organizationIds(ctx)),sites=orgFilter?await rest(`sites?select=id&organization_id=${orgFilter}&limit=500`):[],siteFilter=inFilter(sites.map((s:any)=>s.id));const facility=siteFilter?await rest(`facilities?select=id&site_id=${siteFilter}&id=eq.${encodeURIComponent(facilityId)}&limit=1`):[];if(!facility?.length)return deny(403,'Facility is outside authorized organization scope.');
   const conflicts=await rest(`facility_bookings?select=id,starts_at,ends_at,status&facility_id=eq.${encodeURIComponent(facilityId)}&status=neq.cancelled&starts_at=lt.${encodeURIComponent(endsAt)}&ends_at=gt.${encodeURIComponent(startsAt)}&limit=20`);if(conflicts?.length)return NextResponse.json({error:'Facility booking conflicts with an existing booking.',conflicts},{status:409});
   const row=await rest('facility_bookings',{method:'POST',body:JSON.stringify({facility_id:facilityId,team_id:body.teamId||null,event_id:body.eventId||null,starts_at:startsAt,ends_at:endsAt,status:'booked'})});const created=row?.[0];if(!created)throw new Error('Facility booking returned no record.');await audit(ctx,tenant,'facility_booking.created','facility_booking',created.id,null,created,correlationId);return NextResponse.json({ok:true,row:created,correlationId});
  }
  if(action==='update-facility-booking'){
   if(roleName!=='org_admin'||!roleHas(ctx,roleName,'record.update'))return deny(403,'Facility booking update denied.');const id=String(body.id||''),orgFilter=inFilter(organizationIds(ctx)),sites=orgFilter?await rest(`sites?select=id&organization_id=${orgFilter}&limit=500`):[],siteFilter=inFilter(sites.map((s:any)=>s.id)),facilities=siteFilter?await rest(`facilities?select=id&site_id=${siteFilter}&limit=500`):[],facilityFilter=inFilter(facilities.map((x:any)=>x.id));const existing=facilityFilter?await rest(`facility_bookings?select=*&id=eq.${encodeURIComponent(id)}&facility_id=${facilityFilter}&limit=1`):[];if(!existing?.length)return deny(404,'Facility booking not found in authorized scope.');const allowed=Object.fromEntries(Object.entries(body.changes||{}).filter(([k])=>['starts_at','ends_at','status','team_id','event_id'].includes(k)));if(!Object.keys(allowed).length)return deny(400,'No supported booking changes supplied.');const row=await rest(`facility_bookings?id=eq.${encodeURIComponent(id)}&facility_id=${facilityFilter}`,{method:'PATCH',body:JSON.stringify(allowed)});if(!row?.length)return deny(409,'Facility booking changed before update.');await audit(ctx,tenant,'facility_booking.updated','facility_booking',id,existing[0],row[0],correlationId);return NextResponse.json({ok:true,row:row[0],correlationId});
  }
  if(action==='create-contract'){
   if(roleName!=='org_admin'||!roleHas(ctx,roleName,'record.create'))return deny(403,'Contract creation denied.');const title=String(body.title||'').trim(),contractType=String(body.contractType||'').trim(),orgs=organizationIds(ctx),organizationId=String(body.organizationId||'');if(!title||!contractType||!organizationId||!orgs.includes(organizationId))return deny(400,'Contract title, type and authorized organization are required.');const payload={tenant_id:tenant,organization_id:organizationId,contract_type:contractType,title,status:String(body.status||'draft'),effective_on:body.effectiveOn||null,expires_on:body.expiresOn||null,counterparty_name:body.counterpartyName||null};const row=await rest('contracts',{method:'POST',body:JSON.stringify(payload)});const created=row?.[0];if(!created)throw new Error('Contract creation returned no record.');await audit(ctx,tenant,'contract.created','contract',created.id,null,created,correlationId);return NextResponse.json({ok:true,row:created,correlationId});
  }
  if(action==='update-contract'){
   if(roleName!=='org_admin'||!roleHas(ctx,roleName,'record.update'))return deny(403,'Contract update denied.');const id=String(body.id||''),orgs=organizationIds(ctx),existing=orgs.length?await rest(`contracts?select=*&id=eq.${encodeURIComponent(id)}&tenant_id=eq.${tenant}&organization_id=${inFilter(orgs)}&limit=1`):[];if(!existing?.length)return deny(404,'Contract not found in authorized scope.');const allowed=Object.fromEntries(Object.entries(body.changes||{}).filter(([k])=>['title','status','effective_on','expires_on','counterparty_name','classification'].includes(k)));if(!Object.keys(allowed).length)return deny(400,'No supported contract changes supplied.');const row=await rest(`contracts?id=eq.${encodeURIComponent(id)}&tenant_id=eq.${tenant}&organization_id=${inFilter(orgs)}`,{method:'PATCH',body:JSON.stringify(allowed)});if(!row?.length)return deny(409,'Contract changed before update.');await audit(ctx,tenant,'contract.updated','contract',id,existing[0],row[0],correlationId);return NextResponse.json({ok:true,row:row[0],correlationId});
  }
  if(action==='update-event'){if(roleName!=='org_admin'||!roleHas(ctx,roleName,'record.update'))return deny(403,'Event update denied.');const id=String(body.id||''),orgs=organizationIds(ctx),existing=orgs.length?await rest(`calendar_events?select=*&id=eq.${encodeURIComponent(id)}&tenant_id=eq.${tenant}&organization_id=${inFilter(orgs)}&limit=1`):[];if(!existing?.length)return deny(404,'Event not found in authorized scope.');const allowed=Object.fromEntries(Object.entries(body.changes||{}).filter(([k])=>['title','event_type','starts_at','ends_at','timezone','location_facility_id','status'].includes(k)));if(!Object.keys(allowed).length)return deny(400,'No supported event changes supplied.');if(allowed.starts_at&&Number.isNaN(Date.parse(String(allowed.starts_at))))return deny(400,'Valid event start is required.');if(allowed.ends_at&&Number.isNaN(Date.parse(String(allowed.ends_at))))return deny(400,'Valid event end is required.');const row=await rest(`calendar_events?id=eq.${encodeURIComponent(id)}&tenant_id=eq.${tenant}&organization_id=${inFilter(orgs)}`,{method:'PATCH',body:JSON.stringify(allowed)});if(!row?.length)return deny(409,'Event changed before update.');await audit(ctx,tenant,'calendar_event.updated','calendar_event',id,existing[0],row[0],correlationId);return NextResponse.json({ok:true,row:row[0],correlationId});}
  if(action==='create-event'){if(roleName!=='org_admin'||!roleHas(ctx,roleName,'record.update'))return deny(403,'Event creation denied.');const name=String(body.name||'').trim(),startsAt=String(body.startsAt||''),endsAt=body.endsAt?String(body.endsAt):startsAt,timezone=String(body.timezone||'').trim();if(!name||!startsAt||Number.isNaN(Date.parse(startsAt))||!timezone)return deny(400,'Event name, valid start time and timezone are required.');const org=organizationIds(ctx)[0];if(!org)return deny(403,'Organization scope required.');const row=await rest('calendar_events',{method:'POST',body:JSON.stringify({tenant_id:tenant,organization_id:org,title:name,event_type:String(body.eventType||'meeting'),starts_at:startsAt,ends_at:endsAt,timezone,status:'scheduled',metadata:{created_from:'organization_admin_home'}})});const created=row?.[0];if(!created)throw new Error('Event creation returned no record.');await audit(ctx,tenant,'calendar_event.created','calendar_event',created.id,null,created,correlationId);return NextResponse.json({ok:true,row:created,correlationId});}
  if(action==='create-task'){if(!roleHas(ctx,roleName,'admin_tasks.create'))return deny(403,'Task creation denied.');const title=String(body.title||'').trim();if(!title)return deny(400,'Task title is required.');const row=await rest('work_items',{method:'POST',body:JSON.stringify({tenant_id:tenant,work_type:'ADMIN_TASK',status:'open',priority:body.priority||'normal',payload:{title,description:body.description||null,created_from:'admin_command_center',created_by:ctx.user.id,correlation_id:correlationId}})});const created=row?.[0];if(!created)throw new Error('Canonical task creation returned no record.');await audit(ctx,tenant,'admin_task.created','work_item',created.id,null,created,correlationId);return NextResponse.json({ok:true,row:created,correlationId});}
  if(action==='complete-task'){if(!roleHas(ctx,roleName,'admin_tasks.update'))return deny(403,'Task update denied.');const id=String(body.id||'');if(!id)return deny(400,'Task ID is required.');const existing=await rest(`work_items?select=*&id=eq.${encodeURIComponent(id)}&tenant_id=eq.${tenant}&limit=1`);if(!existing?.length)return deny(404,'Task not found in authorized scope.');if(existing[0].status==='completed')return NextResponse.json({ok:true,row:existing[0],correlationId,idempotent:true});const row=await rest(`work_items?id=eq.${encodeURIComponent(id)}&tenant_id=eq.${tenant}&status=neq.completed`,{method:'PATCH',body:JSON.stringify({status:'completed'})});if(!row?.length)return deny(409,'Task changed before completion. Refresh and retry.');await audit(ctx,tenant,'admin_task.completed','work_item',id,existing[0],row[0],correlationId);return NextResponse.json({ok:true,row:row[0],correlationId});}
  return deny(400,'Unsupported Admin action.');
 }catch(error){return deny(400,error instanceof Error?error.message:'Admin action failed.');}
}
