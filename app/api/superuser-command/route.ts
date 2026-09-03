import { NextRequest, NextResponse } from 'next/server';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
export const dynamic='force-dynamic'; export const revalidate=0;
const headers=()=>({apikey:KEY!,Authorization:`Bearer ${KEY!}`,'Content-Type':'application/json',Prefer:'return=representation'});

async function rest(path:string,init:RequestInit={}){
 if(!URL||!KEY) throw new Error('SuperUser server credentials are not configured.');
 const r=await fetch(`${URL}/rest/v1/${path}`,{...init,headers:{...headers(),...(init.headers||{})},cache:'no-store'});
 const text=await r.text(); if(!r.ok) throw new Error(`Supabase ${path} returned ${r.status}: ${text.slice(0,500)}`);
 return text?JSON.parse(text):null;
}
async function audit(action:string,entity:string,id:string|null,details:any){
 try{await rest('audit_events',{method:'POST',body:JSON.stringify({action,entity_type:entity,entity_id:id,details})});}catch{}
}

export async function GET(){
 try{
  if(!URL||!KEY) throw new Error('SuperUser server credentials are not configured.');
  const r=await fetch(`${URL}/rest/v1/rpc/get_superuser_command`,{method:'POST',headers:{...headers(),Accept:'application/json'},body:'{}',cache:'no-store'});
  const body=await r.text(); if(!r.ok) throw new Error(`Supabase SuperUser RPC returned ${r.status}: ${body.slice(0,400)}`);
  return NextResponse.json(JSON.parse(body),{headers:{'Cache-Control':'no-store, max-age=0'}});
 }catch(error){return NextResponse.json({project:null,milestones:[],tasks:[],raci:[],units:[],inventory:[],counts:{},generatedAt:new Date().toISOString(),source:'LS1SportsEAM Supabase',error:error instanceof Error?error.message:'Command data unavailable'},{status:500});}
}

export async function POST(request:NextRequest){
 try{
  const b=await request.json(); const action=String(b.action||'');
  if(action==='update-task'){
   const row=await rest(`platform_project_tasks?id=eq.${encodeURIComponent(b.id)}`,{method:'PATCH',body:JSON.stringify({status:b.status,percent_complete:Number(b.percent_complete),blocker:b.blocker||null,updated_at:new Date().toISOString()})});
   await audit('SUPERUSER_TASK_UPDATED','platform_project_tasks',b.id,b); return NextResponse.json(row?.[0]||null);
  }
  if(action==='update-unit'){
   const row=await rest(`platform_milestone_units?id=eq.${encodeURIComponent(b.id)}`,{method:'PATCH',body:JSON.stringify({status:b.status,implementation_percent:Number(b.implementation_percent),operational_percent:Number(b.operational_percent),validation_percent:Number(b.validation_percent),evidence:b.evidence||{},evidence_source:'SuperUser',evidence_ref:b.evidence_ref||null,verified_at:b.verified?new Date().toISOString():null})});
   await audit('SUPERUSER_UNIT_UPDATED','platform_milestone_units',b.id,b); return NextResponse.json(row?.[0]||null);
  }
  if(action==='create-ticket'){
   const tenant=(await rest('tenants?select=id&limit=1'))?.[0]?.id||null;
   const max=await rest('support_tickets?select=ticket_number&order=ticket_number.desc&limit=1');
   const ticket_number=(Number(max?.[0]?.ticket_number||0)+1);
   const row=await rest('support_tickets',{method:'POST',body:JSON.stringify({tenant_id:tenant,ticket_number,title:b.title,description:b.description||null,category:b.category||'PRODUCT',severity:b.severity||'MEDIUM',status:'OPEN'})});
   await audit('SUPPORT_TICKET_CREATED','support_tickets',row?.[0]?.id||null,b); return NextResponse.json(row?.[0]||null);
  }
  if(action==='create-client'){
   const tenant=(await rest('tenants?select=id&limit=1'))?.[0]?.id||null;
   const row=await rest('client_onboarding_cases',{method:'POST',body:JSON.stringify({client_name:b.client_name,status:'DISCOVERY',tenant_id:tenant,primary_admin_email:b.primary_admin_email||null,sports:b.sports?.length?b.sports:['SWIMMING'],current_step:1,notes:{created_from:'superuser'}})});
   await audit('CLIENT_ONBOARDING_CREATED','client_onboarding_cases',row?.[0]?.id||null,b); return NextResponse.json(row?.[0]||null);
  }
  if(action==='register-result-import'){
   const tenant=(await rest('tenants?select=id&limit=1'))?.[0]?.id||null;
   const systems=await rest(`competition_source_systems?select=id,name&limit=100`);
   const source=systems?.find((x:any)=>String(x.name).toLowerCase()===String(b.source_system||'').toLowerCase())?.id||null;
   const job=await rest('import_jobs',{method:'POST',body:JSON.stringify({tenant_id:tenant,source_type:'COMPETITION_RESULTS',status:'RECEIVED'})}).catch(()=>null);
   const row=await rest('competition_import_files',{method:'POST',body:JSON.stringify({tenant_id:tenant,import_job_id:job?.[0]?.id||null,source_system_id:source,original_filename:b.original_filename,detected_format:b.detected_format||null,file_size_bytes:b.file_size_bytes||null,parse_status:'QUEUED',parse_summary:{registered_by:'SuperUser',note:b.note||null}})});
   await audit('COMPETITION_IMPORT_REGISTERED','competition_import_files',row?.[0]?.id||null,b); return NextResponse.json(row?.[0]||null);
  }
  throw new Error('Unsupported SuperUser action.');
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Action failed'},{status:400});}
}