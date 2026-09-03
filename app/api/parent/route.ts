import { NextRequest, NextResponse } from 'next/server';

const URL=process.env.NEXT_PUBLIC_SUPABASE_URL??'https://xedfstgwotzxnztpembv.supabase.co';
const KEY=process.env.SUPABASE_SERVICE_ROLE_KEY;
export const dynamic='force-dynamic'; export const revalidate=0;
const h=()=>({apikey:KEY!,Authorization:`Bearer ${KEY!}`,'Content-Type':'application/json',Prefer:'return=representation'});
async function rest(path:string,init:RequestInit={}){
 if(!KEY) throw new Error('Supabase server credentials are not configured.');
 const r=await fetch(`${URL}/rest/v1/${path}`,{...init,headers:{...h(),...(init.headers||{})},cache:'no-store'});
 const t=await r.text(); if(!r.ok) throw new Error(`Supabase ${path} returned ${r.status}: ${t.slice(0,400)}`); return t?JSON.parse(t):null;
}

export async function GET(request:NextRequest){
 try{
  if(!KEY) throw new Error('Supabase server credentials are not configured.');
  let familyId=request.nextUrl.searchParams.get('family');
  if(!familyId){const first=await rest('families?select=id&order=created_at.asc&limit=1'); familyId=first?.[0]?.id||null;}
  if(!familyId){const candidates=await rest('athletes?select=id,person_id,athlete_number,status,people(first_name,last_name)&order=created_at.asc&limit=229'); return NextResponse.json({family:null,members:[],athletes:[],tasks:[],messages:[],invoices:[],documents:[],trips:[],custody:[],volunteer:[],metrics:{},source:'LS1SportsEAM Supabase',setupRequired:true,candidates});}
  const response=await fetch(`${URL}/rest/v1/rpc/get_parent_hub`,{method:'POST',headers:{...h(),Accept:'application/json'},body:JSON.stringify({p_family_id:familyId}),cache:'no-store'});
  const body=await response.text(); if(!response.ok) throw new Error(`Supabase Parent Hub RPC returned ${response.status}: ${body.slice(0,300)}`);
  return NextResponse.json(JSON.parse(body),{headers:{'Cache-Control':'no-store, max-age=0'}});
 }catch(error){return NextResponse.json({family:null,members:[],athletes:[],tasks:[],messages:[],invoices:[],documents:[],trips:[],custody:[],volunteer:[],metrics:{},source:'LS1SportsEAM Supabase',error:error instanceof Error?error.message:'Parent data unavailable'},{status:500});}
}

export async function POST(request:NextRequest){
 try{
  const b=await request.json(), action=String(b.action||'');
  if(action==='create-family'){
   const tenant=(await rest('tenants?select=id&limit=1'))?.[0]?.id; if(!tenant) throw new Error('Tenant not found.');
   const family=(await rest('families',{method:'POST',body:JSON.stringify({tenant_id:tenant,name:b.name,status:'ACTIVE'})}))?.[0];
   for(const personId of (b.person_ids||[])) await rest('family_members',{method:'POST',body:JSON.stringify({family_id:family.id,person_id:personId,relationship_type:'GUARDIAN',is_primary_guardian:false,can_view_minor_data:true})});
   for(const athleteId of (b.athlete_ids||[])){
    const athlete=(await rest(`athletes?id=eq.${athleteId}&select=person_id`))?.[0]; if(athlete?.person_id) await rest('family_members',{method:'POST',body:JSON.stringify({family_id:family.id,person_id:athlete.person_id,relationship_type:'CHILD',is_primary_guardian:false,can_view_minor_data:false})});
   }
   return NextResponse.json(family);
  }
  if(action==='complete-task'){
   const row=await rest(`family_tasks?id=eq.${encodeURIComponent(b.id)}`,{method:'PATCH',body:JSON.stringify({status:'COMPLETED',completed_at:new Date().toISOString()})}); return NextResponse.json(row?.[0]||null);
  }
  if(action==='create-task'){
   const row=await rest('family_tasks',{method:'POST',body:JSON.stringify({family_id:b.family_id,athlete_id:b.athlete_id||null,title:b.title,description:b.description||null,route:b.route||'/parent',priority:b.priority||'NORMAL',status:'OPEN',deadline:b.deadline||null})}); return NextResponse.json(row?.[0]||null);
  }
  if(action==='ack-message'){
   const row=await rest(`family_messages?id=eq.${encodeURIComponent(b.id)}`,{method:'PATCH',body:JSON.stringify({acknowledged_at:new Date().toISOString()})}); return NextResponse.json(row?.[0]||null);
  }
  if(action==='create-message'){
   const row=await rest('family_messages',{method:'POST',body:JSON.stringify({family_id:b.family_id,athlete_id:b.athlete_id||null,category:b.category||'GENERAL',title:b.title,body:b.body||null,route:b.route||'/parent'})}); return NextResponse.json(row?.[0]||null);
  }
  throw new Error('Unsupported Parent action.');
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Action failed'},{status:400});}
}