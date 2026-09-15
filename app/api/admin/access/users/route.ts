import { NextRequest, NextResponse } from 'next/server';
import { hasPermission, resolveAccess, serviceHeaders } from '@/lib/server/accessControl';
import { supabaseServerConfig } from '@/lib/server/superuserAuth';

const noStore={'Cache-Control':'no-store'};
const clean=(v:unknown)=>typeof v==='string'&&v.trim()?v.trim():null;

export async function GET(request:NextRequest){
 const ctx=await resolveAccess(request); if(!ctx)return NextResponse.json({error:'Authentication required.'},{status:401,headers:noStore});
 if(!ctx.person||!hasPermission(ctx,'users.read')||!hasPermission(ctx,'role_assignments.read'))return NextResponse.json({error:'Client access administration is not authorized.'},{status:403,headers:noStore});
 const {url}=supabaseServerConfig(); const headers=serviceHeaders(); if(!headers)return NextResponse.json({error:'Server authorization is not configured.'},{status:500}); const tenant=ctx.person.tenant_id;
 const [peopleR,rolesR,assignR,orgR,teamR]=await Promise.all([
  fetch(`${url}/rest/v1/people?select=id,first_name,last_name,preferred_name,email,status,privacy_classification&tenant_id=eq.${tenant}&order=last_name.asc,first_name.asc`,{headers,cache:'no-store'}),
  fetch(`${url}/rest/v1/role_definitions?select=id,code,name,description,privilege_level,role_type,config,is_active&is_active=eq.true&or=(tenant_id.is.null,tenant_id.eq.${tenant})&order=privilege_level.desc,name.asc`,{headers,cache:'no-store'}),
  fetch(`${url}/rest/v1/role_assignments?select=id,person_id,role_definition_id,organization_id,sport_id,site_id,team_id,program_id,competition_id,starts_at,ends_at,status,created_at&tenant_id=eq.${tenant}&status=eq.active`,{headers,cache:'no-store'}),
  fetch(`${url}/rest/v1/organizations?select=id,code,name,status&tenant_id=eq.${tenant}&order=name.asc`,{headers,cache:'no-store'}),
  fetch(`${url}/rest/v1/teams?select=id,code,name,status,organization_id&tenant_id=eq.${tenant}&order=name.asc`,{headers,cache:'no-store'}),
 ]);
 if(!peopleR.ok||!rolesR.ok||!assignR.ok)return NextResponse.json({error:'Unable to load canonical access administration data.'},{status:502,headers:noStore});
 const roles=(await rolesR.json() as any[]).filter(r=>!r.config?.platform_only&&r.privilege_level<=ctx.maxDelegablePrivilege);
 return NextResponse.json({actor:{personId:ctx.person.id,tenantId:tenant,maxDelegablePrivilege:ctx.maxDelegablePrivilege},people:await peopleR.json(),roles,assignments:await assignR.json(),organizations:orgR.ok?await orgR.json():[],teams:teamR.ok?await teamR.json():[]},{headers:noStore});
}

export async function PATCH(request:NextRequest){
 const ctx=await resolveAccess(request); if(!ctx)return NextResponse.json({error:'Authentication required.'},{status:401,headers:noStore});
 if(!ctx.person||!hasPermission(ctx,'role_assignments.manage')||!hasPermission(ctx,'engine_access.manage'))return NextResponse.json({error:'Role administration is not authorized.'},{status:403,headers:noStore});
 const body=await request.json().catch(()=>null) as any; const personId=clean(body?.personId); const requested=Array.isArray(body?.assignments)?body.assignments:[]; if(!personId)return NextResponse.json({error:'personId is required.'},{status:400,headers:noStore});
 const {url}=supabaseServerConfig(); const headers=serviceHeaders(); if(!headers)return NextResponse.json({error:'Server authorization is not configured.'},{status:500}); const tenant=ctx.person.tenant_id;
 const targetR=await fetch(`${url}/rest/v1/people?select=id,tenant_id,status&id=eq.${personId}&tenant_id=eq.${tenant}&limit=1`,{headers,cache:'no-store'}); const targets=targetR.ok?await targetR.json() as any[]:[]; if(!targets.length)return NextResponse.json({error:'Target user is outside your client boundary.'},{status:404,headers:noStore});
 const rolesR=await fetch(`${url}/rest/v1/role_definitions?select=id,code,name,privilege_level,config,is_active&is_active=eq.true&or=(tenant_id.is.null,tenant_id.eq.${tenant})`,{headers,cache:'no-store'}); if(!rolesR.ok)return NextResponse.json({error:'Unable to validate roles.'},{status:502,headers:noStore}); const roles=await rolesR.json() as any[]; const byId=new Map(roles.map(r=>[r.id,r]));
 const normalized:any[]=[]; for(const raw of requested){const role=byId.get(clean(raw?.roleDefinitionId));if(!role||role.config?.platform_only||role.privilege_level>ctx.maxDelegablePrivilege)return NextResponse.json({error:'Requested role exceeds your delegation authority.'},{status:403,headers:noStore});normalized.push({tenant_id:tenant,person_id:personId,role_definition_id:role.id,organization_id:clean(raw.organizationId),sport_id:clean(raw.sportId),site_id:clean(raw.siteId),team_id:clean(raw.teamId),program_id:clean(raw.programId),competition_id:clean(raw.competitionId),starts_at:clean(raw.startsAt),ends_at:clean(raw.endsAt),status:'active',granted_by:ctx.person.id,metadata:{source:'admin_users_access'}});}
 const beforeR=await fetch(`${url}/rest/v1/role_assignments?select=*&tenant_id=eq.${tenant}&person_id=eq.${personId}&status=eq.active`,{headers,cache:'no-store'}); const before=beforeR.ok?await beforeR.json():[];
 const deactivate=await fetch(`${url}/rest/v1/role_assignments?tenant_id=eq.${tenant}&person_id=eq.${personId}&status=eq.active`,{method:'PATCH',headers:{...headers,Prefer:'return=minimal'},body:JSON.stringify({status:'inactive',ends_at:new Date().toISOString(),updated_at:new Date().toISOString()}),cache:'no-store'}); if(!deactivate.ok)return NextResponse.json({error:'Unable to retire previous role assignments.'},{status:502,headers:noStore});
 if(normalized.length){const insert=await fetch(`${url}/rest/v1/role_assignments`,{method:'POST',headers:{...headers,Prefer:'return=minimal'},body:JSON.stringify(normalized),cache:'no-store'});if(!insert.ok)return NextResponse.json({error:'Unable to save new role assignments. Previous assignments were retired; administrator review is required.'},{status:502,headers:noStore});}
 const afterR=await fetch(`${url}/rest/v1/role_assignments?select=*&tenant_id=eq.${tenant}&person_id=eq.${personId}&status=eq.active`,{headers,cache:'no-store'}); const after=afterR.ok?await afterR.json():normalized;
 await fetch(`${url}/rest/v1/audit_events`,{method:'POST',headers:{...headers,Prefer:'return=minimal'},body:JSON.stringify({tenant_id:tenant,actor_user_id:ctx.user.id,actor_person_id:ctx.person.id,action:'role_assignments.replace',entity_type:'person',entity_id:personId,before_data:before,after_data:after,reason:clean(body?.reason)||'Client access administration',privileged:true}),cache:'no-store'}).catch(()=>null);
 return NextResponse.json({ok:true,personId,assignments:after},{headers:noStore});
}
