import type { NextRequest } from 'next/server';
import { supabaseServerConfig } from '@/lib/server/superuserAuth';

export type Scope = { organization_id:string|null; sport_id:string|null; site_id:string|null; team_id:string|null; program_id:string|null; competition_id:string|null };
export type EffectiveRole = { id:string; code:string; name:string; privilege_level:number; role_type:string; config:Record<string,unknown>; scope:Scope };
export type AccessContext = { user:{id:string;email:string}; person:{id:string;tenant_id:string}|null; roles:EffectiveRole[]; permissions:string[]; allowedHubs:string[]; isPlatformSuperUser:boolean; maxDelegablePrivilege:number };

const HUB_ORDER=['superuser','admin','coach','athlete','parent','official','scout'];
const headersFor=(key:string)=>({apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'});

export async function resolveAccess(request:NextRequest):Promise<AccessContext|null>{
 const {url,serviceKey,publicKey}=supabaseServerConfig(); if(!serviceKey||!publicKey)return null;
 const auth=request.headers.get('authorization')||''; const token=auth.toLowerCase().startsWith('bearer ')?auth.slice(7).trim():''; if(!token)return null;
 const ur=await fetch(`${url}/auth/v1/user`,{headers:{apikey:publicKey,Authorization:`Bearer ${token}`},cache:'no-store'}); if(!ur.ok)return null;
 const user=await ur.json() as {id?:string;email?:string}; const email=user.email?.trim().toLowerCase(); if(!user.id||!email)return null;
 const h=headersFor(serviceKey);
 const op=await fetch(`${url}/rest/v1/platform_superuser_operators?select=email&active=eq.true&email=ilike.${encodeURIComponent(email)}&limit=1`,{headers:h,cache:'no-store'}); const isPlatformSuperUser=op.ok&&((await op.json()) as unknown[]).length>0;
 const pr=await fetch(`${url}/rest/v1/people?select=id,tenant_id,email&email=ilike.${encodeURIComponent(email)}&limit=1`,{headers:h,cache:'no-store'}); const people=pr.ok?await pr.json() as Array<{id:string;tenant_id:string|null}>:[]; const person=people[0]||null;
 const roles:EffectiveRole[]=[]; const roleIds=new Set<string>();
 if(person?.tenant_id){
  const ar=await fetch(`${url}/rest/v1/role_assignments?select=role_definition_id,organization_id,sport_id,site_id,team_id,program_id,competition_id,starts_at,ends_at,status,role_definitions(id,code,name,privilege_level,role_type,config,is_active)&person_id=eq.${person.id}&tenant_id=eq.${person.tenant_id}&status=eq.active`,{headers:h,cache:'no-store'});
  if(ar.ok){const rows=await ar.json() as any[];const now=Date.now();for(const a of rows){const r=a.role_definitions;if(!r?.is_active)continue;if(a.starts_at&&Date.parse(a.starts_at)>now)continue;if(a.ends_at&&Date.parse(a.ends_at)<=now)continue;if(r.config?.platform_only)continue;roleIds.add(r.id);roles.push({id:r.id,code:r.code,name:r.name,privilege_level:r.privilege_level,role_type:r.role_type,config:r.config||{},scope:{organization_id:a.organization_id||null,sport_id:a.sport_id||null,site_id:a.site_id||null,team_id:a.team_id||null,program_id:a.program_id||null,competition_id:a.competition_id||null}});}}
 }
 const permissions=new Set<string>();
 if(roleIds.size){const ids=[...roleIds].join(',');const gr=await fetch(`${url}/rest/v1/permission_grants?select=effect,role_definition_id,permission_definitions(code,is_active)&role_definition_id=in.(${ids})`,{headers:h,cache:'no-store'});if(gr.ok){const rows=await gr.json() as any[];const denied=new Set<string>();for(const g of rows){const p=g.permission_definitions;if(!p?.is_active)continue;if(g.effect==='deny')denied.add(p.code);else if(g.effect==='allow')permissions.add(p.code);}for(const code of denied)permissions.delete(code);}}
 const hubs=new Set<string>();
 // Level 0 platform operators are the global operating authority. They can enter every engine
 // without needing client-side role assignments or a tenant-bound people record.
 if(isPlatformSuperUser){for(const hub of HUB_ORDER)hubs.add(hub);}else{for(const role of roles){const configured=Array.isArray(role.config?.hub_access)?role.config.hub_access as string[]:[];for(const hub of configured)hubs.add(hub);}}
 const maxDelegablePrivilege=isPlatformSuperUser?100:Math.max(0,...roles.map(r=>Number(r.config?.max_delegable_privilege||0)));
 return {user:{id:user.id,email},person:person?.tenant_id?{id:person.id,tenant_id:person.tenant_id}:null,roles,permissions:[...permissions].sort(),allowedHubs:HUB_ORDER.filter(h=>hubs.has(h)),isPlatformSuperUser,maxDelegablePrivilege};
}

export function hasPermission(ctx:AccessContext,code:string){return ctx.isPlatformSuperUser||ctx.permissions.includes(code);}
export function serviceHeaders(){const {serviceKey}=supabaseServerConfig();return serviceKey?headersFor(serviceKey):null;}
