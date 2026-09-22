import { NextRequest,NextResponse } from 'next/server';
import { hasPermission,resolveAccess,serviceHeaders,type AccessContext } from '@/lib/server/accessControl';
import { supabaseServerConfig } from '@/lib/server/superuserAuth';
export const dynamic='force-dynamic'; export const revalidate=0;

async function rest(path:string,init:RequestInit={}){const {url}=supabaseServerConfig();const h=serviceHeaders();if(!url||!h)throw new Error('Supabase service credentials are not configured.');const response=await fetch(`${url}/rest/v1/${path}`,{...init,headers:{...h,Prefer:'return=representation',...(init.headers||{})},cache:'no-store'});const text=await response.text();if(!response.ok)throw new Error(`Canonical store returned ${response.status}: ${text.slice(0,300)}`);return text?JSON.parse(text):null;}
const deny=(status:number,error:string)=>NextResponse.json({error},{status});
function tenantFilter(ctx:AccessContext){return ctx.person?.tenant_id?`&tenant_id=eq.${encodeURIComponent(ctx.person.tenant_id)}`:'';}

export async function GET(request:NextRequest){
 try{const ctx=await resolveAccess(request);if(!ctx)return deny(401,'Authentication required.');if(!ctx.allowedHubs.includes('admin'))return deny(403,'Admin access denied.');
  const canTasks=hasPermission(ctx,'admin_tasks.read');const canFinance=hasPermission(ctx,'finance.read');const canRoster=hasPermission(ctx,'rosters.read');
  const [invoices,bills,tasks,athletes,teams]=await Promise.all([
   canFinance&&ctx.isPlatformSuperUser?rest('invoices?select=id,invoice_number,invoice_date,due_date,total,balance_due,status&order=invoice_date.desc&limit=50'):[],
   canFinance&&ctx.isPlatformSuperUser?rest('vendor_bills?select=id,bill_number,bill_date,due_date,total,balance_due,status&order=bill_date.desc&limit=50'):[],
   canTasks?rest(`work_items?select=id,tenant_id,work_type,status,priority,payload&status=neq.completed${tenantFilter(ctx)}&order=id.desc&limit=50`):[],
   canRoster&&ctx.isPlatformSuperUser?rest('athletes?select=id&status=eq.ACTIVE'):[],
   canRoster&&ctx.isPlatformSuperUser?rest('teams?select=id&status=eq.active'):[],
  ]);
  const arBalance=(invoices||[]).reduce((s:number,r:any)=>s+Number(r.balance_due||0),0),apBalance=(bills||[]).reduce((s:number,r:any)=>s+Number(r.balance_due||0),0);
  const pastDue=(invoices||[]).filter((r:any)=>r.due_date&&Number(r.balance_due||0)>0&&new Date(String(r.due_date)).getTime()<Date.now()).length;
  return NextResponse.json({invoices,vendorBills:bills,tasks,metrics:{arBalance,apBalance,openInvoices:(invoices||[]).filter((r:any)=>Number(r.balance_due||0)>0).length,pastDue,activeAthletes:(athletes||[]).length,activeTeams:(teams||[]).length},generatedAt:new Date().toISOString(),source:'LS1SportsEAM canonical store',authorization:{finance:canFinance,tasks:canTasks,roster:canRoster}});
 }catch(error){return deny(500,error instanceof Error?error.message:'Admin command data unavailable.');}
}

export async function POST(request:NextRequest){
 try{const ctx=await resolveAccess(request);if(!ctx)return deny(401,'Authentication required.');if(!ctx.allowedHubs.includes('admin'))return deny(403,'Admin access denied.');
  const body=await request.json();const action=String(body.action||'');
  if(action==='create-task'){if(!hasPermission(ctx,'admin_tasks.create'))return deny(403,'Task creation denied.');const title=String(body.title||'').trim();if(!title)throw new Error('Task title is required.');if(!ctx.person?.tenant_id&&!ctx.isPlatformSuperUser) return deny(403,'A canonical tenant context is required.');const tenant=ctx.person?.tenant_id||(await rest('tenants?select=id&order=created_at.asc&limit=1'))?.[0]?.id;if(!tenant)throw new Error('No canonical tenant is available.');const row=await rest('work_items',{method:'POST',body:JSON.stringify({tenant_id:tenant,work_type:'ADMIN_TASK',status:'open',priority:body.priority||'normal',payload:{title,description:body.description||null,created_from:'admin_command_center',created_by:ctx.user.id}})});return NextResponse.json({ok:true,row:row?.[0]||null});}
  if(action==='complete-task'){if(!hasPermission(ctx,'admin_tasks.update'))return deny(403,'Task update denied.');const id=String(body.id||'');if(!id)throw new Error('Task ID is required.');const scope=ctx.person?.tenant_id?`&tenant_id=eq.${encodeURIComponent(ctx.person.tenant_id)}`:ctx.isPlatformSuperUser?'':null;if(scope===null)return deny(403,'Task scope denied.');const row=await rest(`work_items?id=eq.${encodeURIComponent(id)}${scope}`,{method:'PATCH',body:JSON.stringify({status:'completed'})});if(!row?.length)return deny(404,'Task not found in authorized scope.');return NextResponse.json({ok:true,row:row[0]});}
  return deny(400,'Unsupported Admin action.');
 }catch(error){return deny(400,error instanceof Error?error.message:'Admin action failed.');}
}
