import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, AdminAuthError } from '@/lib/server/requireAdmin';
import { adminRest } from '@/lib/server/adminRest';

export const dynamic='force-dynamic';
export const revalidate=0;

type Row=Record<string,any>;
const has=(roles:string[],...wanted:string[])=>wanted.some(role=>roles.includes(role));
const todayBounds=()=>{const now=new Date(),start=new Date(now);start.setUTCHours(0,0,0,0);const end=new Date(start);end.setUTCDate(end.getUTCDate()+14);return{start:start.toISOString(),end:end.toISOString()}};

export async function GET(request:NextRequest){
 try{
  const actor=await requireAdmin(request),roles=actor.roles,{start,end}=todayBounds();
  const actionFilter=roles.length?`&role_name=in.(${roles.map(encodeURIComponent).join(',')})`:'';
  const basePromises:[Promise<any>,Promise<any>,Promise<any>,Promise<any>]=[
   adminRest(actor,`calendar_events?select=id,title,event_type,starts_at,ends_at,timezone,status,metadata&starts_at=gte.${encodeURIComponent(start)}&starts_at=lt.${encodeURIComponent(end)}&order=starts_at.asc&limit=40`),
   adminRest(actor,'operational_tasks?select=id,title,description,priority,status,due_at,assigned_to&status=neq.completed&order=due_at.asc.nullslast&limit=30'),
   adminRest(actor,'work_items?select=id,work_type,status,priority,payload,owner_person_id&status=neq.completed&limit=30'),
   adminRest(actor,`admin_home_role_actions?select=id,role_name,action_key,label,description,href,sort_order&is_active=eq.true${actionFilter}&order=sort_order.asc`),
  ];
  const [events,operationalTasks,workItems,quickActions]=await Promise.all(basePromises);

  let invoices:Row[]=[],vendorBills:Row[]=[],registrations:Row[]=[],activity:Row[]=[],athletes:Row[]=[],teams:Row[]=[];
  const extra:Promise<void>[]=[];
  if(has(roles,'org_admin','treasurer'))extra.push((async()=>{[invoices,vendorBills]=await Promise.all([
   adminRest(actor,'invoices?select=id,invoice_number,invoice_date,due_date,total,balance_due,status&order=invoice_date.desc&limit=100'),
   adminRest(actor,'vendor_bills?select=id,bill_number,bill_date,due_date,total,balance_due,status&order=bill_date.desc&limit=100'),
  ])})());
  if(has(roles,'org_admin','registrar'))extra.push((async()=>{registrations=await adminRest(actor,'registrations?select=id,organization_id,athlete_id,season_id,program_id,submitted_at,approved_at,status,source&order=submitted_at.desc&limit=100')})());
  if(has(roles,'org_admin','compliance','reporting'))extra.push((async()=>{activity=await adminRest(actor,'audit_events?select=id,occurred_at,action,entity_type,entity_id,reason,privileged&order=occurred_at.desc&limit=20')})());
  if(has(roles,'org_admin','registrar','operations','team_engine'))extra.push((async()=>{[athletes,teams]=await Promise.all([adminRest(actor,'athletes?select=id,status&limit=1000'),adminRest(actor,'teams?select=id,status,name&limit=1000')])})());
  await Promise.all(extra);

  const arBalance=invoices.reduce((sum,row)=>sum+Number(row.balance_due||0),0),apBalance=vendorBills.reduce((sum,row)=>sum+Number(row.balance_due||0),0),now=Date.now();
  const pendingRegistrations=registrations.filter(row=>!['approved','completed'].includes(String(row.status||'').toLowerCase())).length;
  const pastDue=invoices.filter(row=>row.due_date&&Number(row.balance_due||0)>0&&new Date(String(row.due_date)).getTime()<now).length;
  const tasks=[...(operationalTasks||[]).map((row:Row)=>({...row,source:'operational_tasks'})),...(workItems||[]).map((row:Row)=>({id:row.id,title:row.payload?.title||row.work_type,description:row.payload?.description||null,priority:row.priority,status:row.status,due_at:row.payload?.due_at||null,source:'work_items'}))];

  return NextResponse.json({
   actor:{displayName:actor.displayName,roles:actor.roles,isSuperUser:actor.isSuperUser},
   events:events||[],tasks,quickActions:quickActions||[],registrations,invoices,vendorBills,activity,
   metrics:{
    priorityWork:tasks.filter(row=>!['completed','closed'].includes(String(row.status||'').toLowerCase())).length,
    todayEvents:(events||[]).filter((row:Row)=>new Date(row.starts_at).getTime()<new Date(start).getTime()+86400000).length,
    pendingRegistrations,
    arBalance,apBalance,pastDue,
    activeAthletes:athletes.filter(row=>String(row.status||'').toUpperCase()==='ACTIVE').length,
    activeTeams:teams.filter(row=>String(row.status||'').toLowerCase()==='active').length,
   },
   generatedAt:new Date().toISOString(),source:'LS1SportsEAM Supabase · authenticated Admin RLS',
  },{headers:{'Cache-Control':'no-store'}});
 }catch(error){
  if(error instanceof AdminAuthError)return NextResponse.json({error:error.message},{status:error.status});
  return NextResponse.json({error:error instanceof Error?error.message:'Admin command data unavailable.'},{status:500});
 }
}

async function tenantFor(actor:Awaited<ReturnType<typeof requireAdmin>>){
 if(actor.tenantIds[0])return actor.tenantIds[0];
 const orgs=await adminRest<Array<{tenant_id:string|null}>>(actor,'organizations?select=tenant_id&tenant_id=not.is.null&limit=1');
 return orgs?.[0]?.tenant_id||null;
}

async function audit(actor:Awaited<ReturnType<typeof requireAdmin>>,tenantId:string|null,action:string,entityType:string,entityId:string|null,afterData:unknown){
 if(!tenantId)return;
 await adminRest(actor,'audit_events',{method:'POST',body:JSON.stringify({tenant_id:tenantId,actor_user_id:actor.userId,actor_person_id:actor.personId,action,entity_type:entityType,entity_id:entityId,after_data:afterData,privileged:false,reason:'Admin daily brief action'})});
}

export async function POST(request:NextRequest){
 try{
  const actor=await requireAdmin(request),body=await request.json(),action=String(body.action||''),tenantId=await tenantFor(actor);
  if(!tenantId)throw new Error('No authorized Admin tenant is available for this action.');
  if(action==='create-task'){
   const title=String(body.title||'').trim();if(!title)throw new Error('Task title is required.');
   const rows=await adminRest<Row[]>(actor,'work_items',{method:'POST',body:JSON.stringify({tenant_id:tenantId,work_type:'ADMIN_TASK',owner_person_id:actor.personId,status:'open',priority:body.priority||'normal',payload:{title,description:body.description||null,created_from:'admin_daily_brief'}})}),row=rows?.[0]||null;
   await audit(actor,tenantId,'ADMIN_TASK_CREATED','work_item',row?.id||null,row);
   return NextResponse.json({ok:true,row});
  }
  if(action==='complete-task'){
   const id=String(body.id||'');if(!id)throw new Error('Task ID is required.');
   const source=String(body.source||'work_items');
   const rows=source==='operational_tasks'?await adminRest<Row[]>(actor,`operational_tasks?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify({status:'completed',completed_at:new Date().toISOString()})}):await adminRest<Row[]>(actor,`work_items?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify({status:'completed'})}),row=rows?.[0]||null;
   await audit(actor,tenantId,'ADMIN_TASK_COMPLETED',source==='operational_tasks'?'operational_task':'work_item',id,row);
   return NextResponse.json({ok:true,row});
  }
  throw new Error('Unsupported Admin action.');
 }catch(error){
  if(error instanceof AdminAuthError)return NextResponse.json({error:error.message},{status:error.status});
  return NextResponse.json({error:error instanceof Error?error.message:'Admin action failed.'},{status:400});
 }
}
