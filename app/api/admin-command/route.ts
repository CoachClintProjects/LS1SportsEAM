import { NextRequest,NextResponse } from 'next/server';
import { hasPermission,resolveAccess,serviceHeaders,type AccessContext } from '@/lib/server/accessControl';
import { supabaseServerConfig } from '@/lib/server/superuserAuth';
export const dynamic='force-dynamic'; export const revalidate=0;

async function rest(path:string,init:RequestInit={}){const {url}=supabaseServerConfig();const h=serviceHeaders();if(!url||!h)throw new Error('Supabase service credentials are not configured.');const response=await fetch(`${url}/rest/v1/${path}`,{...init,headers:{...h,Prefer:'return=representation',...(init.headers||{})},cache:'no-store'});const text=await response.text();if(!response.ok)throw new Error(`Canonical store returned ${response.status}: ${text.slice(0,300)}`);return text?JSON.parse(text):null;}
const deny=(status:number,error:string)=>NextResponse.json({error},{status});
const HPAC_TENANT='beb8f24e-fcd0-5dbe-ba1b-39c488ebaa4f';
const HPAC_ORG='c9032ebb-0507-5004-b1ad-0bca7cf3cc53';
function tenantId(ctx:AccessContext){return ctx.person?.tenant_id||(ctx.isPlatformSuperUser?HPAC_TENANT:null);}
function organizationIds(ctx:AccessContext){if(ctx.isPlatformSuperUser)return [HPAC_ORG];return [...new Set(ctx.roles.map(r=>r.scope.organization_id).filter(Boolean))] as string[];}
function inFilter(ids:string[]){return ids.length?`in.(${ids.map(encodeURIComponent).join(',')})`:'';}
async function audit(ctx:AccessContext,tenant:string,action:string,entityType:string,entityId:string,beforeData:unknown,afterData:unknown,correlationId:string){await rest('audit_events',{method:'POST',body:JSON.stringify({tenant_id:tenant,actor_user_id:ctx.user.id,actor_person_id:ctx.person?.id||null,action,entity_type:entityType,entity_id:entityId,before_data:beforeData||null,after_data:afterData||null,correlation_id:correlationId,reason:'Admin operational action',privileged:ctx.isPlatformSuperUser})});}

export async function GET(request:NextRequest){
 try{const ctx=await resolveAccess(request);if(!ctx)return deny(401,'Authentication required.');if(!ctx.allowedHubs.includes('admin'))return deny(403,'Admin access denied.');
  const canTasks=hasPermission(ctx,'admin_tasks.read'),canFinance=hasPermission(ctx,'finance.read'),canRoster=hasPermission(ctx,'rosters.read');
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
  return NextResponse.json({invoices,vendorBills:bills,tasks,metrics:{arBalance,apBalance,openInvoices:(invoices||[]).filter((r:any)=>Number(r.balance_due||0)>0).length,pastDue,activeAthletes:athleteCount,activeTeams:(teams||[]).length},generatedAt:new Date().toISOString(),source:'LS1SportsEAM canonical store',context:{tenantId:tenant,organizationIds:orgs},authorization:{finance:canFinance,tasks:canTasks,roster:canRoster}});
 }catch(error){return deny(500,error instanceof Error?error.message:'Admin command data unavailable.');}
}

export async function POST(request:NextRequest){
 try{const ctx=await resolveAccess(request);if(!ctx)return deny(401,'Authentication required.');if(!ctx.allowedHubs.includes('admin'))return deny(403,'Admin access denied.');
  const body=await request.json();const action=String(body.action||''),tenant=tenantId(ctx);if(!tenant)return deny(403,'Canonical tenant context required.');const correlationId=crypto.randomUUID();
  if(action==='create-task'){if(!hasPermission(ctx,'admin_tasks.create'))return deny(403,'Task creation denied.');const title=String(body.title||'').trim();if(!title)return deny(400,'Task title is required.');const row=await rest('work_items',{method:'POST',body:JSON.stringify({tenant_id:tenant,work_type:'ADMIN_TASK',status:'open',priority:body.priority||'normal',payload:{title,description:body.description||null,created_from:'admin_command_center',created_by:ctx.user.id,correlation_id:correlationId}})});const created=row?.[0];if(!created)throw new Error('Canonical task creation returned no record.');await audit(ctx,tenant,'admin_task.created','work_item',created.id,null,created,correlationId);return NextResponse.json({ok:true,row:created,correlationId});}
  if(action==='complete-task'){if(!hasPermission(ctx,'admin_tasks.update'))return deny(403,'Task update denied.');const id=String(body.id||'');if(!id)return deny(400,'Task ID is required.');const existing=await rest(`work_items?select=*&id=eq.${encodeURIComponent(id)}&tenant_id=eq.${tenant}&limit=1`);if(!existing?.length)return deny(404,'Task not found in authorized scope.');if(existing[0].status==='completed')return NextResponse.json({ok:true,row:existing[0],correlationId,idempotent:true});const row=await rest(`work_items?id=eq.${encodeURIComponent(id)}&tenant_id=eq.${tenant}&status=neq.completed`,{method:'PATCH',body:JSON.stringify({status:'completed'})});if(!row?.length)return deny(409,'Task changed before completion. Refresh and retry.');await audit(ctx,tenant,'admin_task.completed','work_item',id,existing[0],row[0],correlationId);return NextResponse.json({ok:true,row:row[0],correlationId});}
  return deny(400,'Unsupported Admin action.');
 }catch(error){return deny(400,error instanceof Error?error.message:'Admin action failed.');}
}
