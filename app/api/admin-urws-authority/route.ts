import { NextRequest,NextResponse } from 'next/server';
import { requireAdmin,AdminAuthError,type AdminIdentity } from '@/lib/server/requireAdmin';
import { adminRest } from '@/lib/server/adminRest';
import { writeAdminAuditEvent } from '@/lib/server/writeAdminAuditEvent';

export const dynamic='force-dynamic';
export const revalidate=0;
type Row=Record<string,any>;

function canAdminAuthority(actor:AdminIdentity){return actor.isSuperUser||actor.roles.includes('org_admin')}
function scopedOrg(actor:AdminIdentity,id:string){return actor.isSuperUser||actor.organizationIds.includes(id)}

async function organizations(actor:AdminIdentity){
 const rows=await adminRest<Row[]>(actor,'organizations?select=id,name,status&order=name.asc&limit=500').catch(()=>[] as Row[]);
 return actor.isSuperUser?rows:rows.filter(o=>actor.organizationIds.includes(String(o.id)));
}

export async function GET(request:NextRequest){
 try{
  const actor=await requireAdmin(request);
  if(!canAdminAuthority(actor))throw new AdminAuthError('Only Organization Admins can manage URWS authority.',403);
  const orgs=await organizations(actor);
  const requested=request.nextUrl.searchParams.get('organization_id');
  const organizationId=requested||String(orgs[0]?.id||'');
  if(!organizationId)return NextResponse.json({organizations:orgs,snapshot:null});
  if(!scopedOrg(actor,organizationId))throw new AdminAuthError('Organization scope denied.',403);
  const snapshot=await adminRest<Row>(actor,'rpc/urws_authority_admin_snapshot',{method:'POST',body:JSON.stringify({p_organization_id:organizationId})});
  return NextResponse.json({organizations:orgs,snapshot},{headers:{'Cache-Control':'no-store'}});
 }catch(e){
  return NextResponse.json({error:e instanceof Error?e.message:'URWS authority unavailable.'},{status:e instanceof AdminAuthError?e.status:500});
 }
}

export async function POST(request:NextRequest){
 try{
  const actor=await requireAdmin(request);
  if(!canAdminAuthority(actor))throw new AdminAuthError('Only Organization Admins can manage URWS authority.',403);
  const body=await request.json() as Row;
  const action=String(body.action||'');
  const organizationId=String(body.organization_id||'');
  if(!organizationId||!scopedOrg(actor,organizationId))throw new AdminAuthError('Organization scope denied.',403);

  if(action==='set-grant'){
   const personId=String(body.person_id||'');
   const authorityAction=String(body.authority_action||'');
   const enabled=Boolean(body.enabled);
   if(!personId)throw new Error('Select an organization operator.');
   const validUntil=body.valid_until?new Date(String(body.valid_until)).toISOString():null;
   const grantId=await adminRest<string|null>(actor,'rpc/urws_set_authority_grant',{method:'POST',body:JSON.stringify({p_organization_id:organizationId,p_subject_person_id:personId,p_action:authorityAction,p_enabled:enabled,p_valid_until:validUntil})});
   await writeAdminAuditEvent(actor,{action:enabled?'URWS_AUTHORITY_GRANTED':'URWS_AUTHORITY_REVOKED',entityType:'organization',entityId:organizationId,afterData:{grant_id:grantId,person_id:personId,authority_action:authorityAction,enabled,valid_until:validUntil}});
   return NextResponse.json({ok:true,grantId});
  }

  if(action==='set-decision-policy'){
   const requiresSecond=Boolean(body.requires_second_approval);
   const threshold=body.min_financial_amount===''||body.min_financial_amount==null?null:Number(body.min_financial_amount);
   if(threshold!=null&&(!Number.isFinite(threshold)||threshold<0))throw new Error('Financial threshold must be zero or greater.');
   const ruleId=await adminRest<string>(actor,'rpc/urws_set_decision_approval_policy',{method:'POST',body:JSON.stringify({p_organization_id:organizationId,p_requires_second_approval:requiresSecond,p_min_financial_amount:threshold,p_currency:String(body.currency||'CAD')})});
   await writeAdminAuditEvent(actor,{action:'URWS_DECISION_APPROVAL_POLICY_CHANGED',entityType:'organization',entityId:organizationId,afterData:{rule_id:ruleId,requires_second_approval:requiresSecond,min_financial_amount:threshold,currency:String(body.currency||'CAD')}});
   return NextResponse.json({ok:true,ruleId});
  }

  throw new Error('Unsupported URWS authority action.');
 }catch(e){
  return NextResponse.json({error:e instanceof Error?e.message:'URWS authority action failed.'},{status:e instanceof AdminAuthError?e.status:400});
 }
}
