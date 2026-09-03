import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL=process.env.NEXT_PUBLIC_SUPABASE_URL??'https://xedfstgwotzxnztpembv.supabase.co';
const SERVICE_KEY=process.env.SUPABASE_SERVICE_ROLE_KEY;
const headers=()=>({apikey:SERVICE_KEY!,Authorization:`Bearer ${SERVICE_KEY!}`,'Content-Type':'application/json',Accept:'application/json',Prefer:'return=representation'});

async function rest(path:string,init:RequestInit){const r=await fetch(`${SUPABASE_URL}/rest/v1/${path}`,{...init,headers:{...headers(),...(init.headers||{})},cache:'no-store'});const t=await r.text();if(!r.ok)throw new Error(`Supabase write returned ${r.status}: ${t.slice(0,500)}`);return t?JSON.parse(t):null;}

export async function POST(request:NextRequest){
 try{
  if(!SERVICE_KEY)throw new Error('Supabase server credentials are not configured.');
  const body=await request.json(); const action=String(body.action||''); const athleteId=String(body.athleteId||'');
  if(!athleteId)throw new Error('Athlete identity is required.');
  if(action==='create_goal'){
   const row={athlete_id:athleteId,goal_type:String(body.goalType||'development'),title:String(body.title||'').trim(),description:body.description?String(body.description):null,target_value:body.targetValue===null||body.targetValue===undefined||body.targetValue===''?null:Number(body.targetValue),target_unit:body.targetUnit?String(body.targetUnit):null,due_on:body.dueOn||null,status:'open'};
   if(!row.title)throw new Error('Goal title is required.');
   return NextResponse.json({ok:true,row:await rest('development_goals',{method:'POST',body:JSON.stringify(row)})});
  }
  if(action==='update_goal'){
   if(!body.goalId)throw new Error('Goal ID is required.');
   const patch={title:String(body.title||'').trim(),description:body.description?String(body.description):null,target_value:body.targetValue===null||body.targetValue===undefined||body.targetValue===''?null:Number(body.targetValue),target_unit:body.targetUnit?String(body.targetUnit):null,due_on:body.dueOn||null,status:String(body.status||'open')};
   if(!patch.title)throw new Error('Goal title is required.');
   return NextResponse.json({ok:true,row:await rest(`development_goals?id=eq.${encodeURIComponent(String(body.goalId))}&athlete_id=eq.${encodeURIComponent(athleteId)}`,{method:'PATCH',body:JSON.stringify(patch)})});
  }
  if(action==='create_reflection'){
   const row={athlete_id:athleteId,reflection_type:String(body.reflectionType||'general'),title:String(body.title||'').trim(),body:body.body?String(body.body):null,occurred_on:body.occurredOn||new Date().toISOString().slice(0,10),visibility:'athlete'};
   if(!row.title)throw new Error('Reflection title is required.');
   return NextResponse.json({ok:true,row:await rest('athlete_reflections',{method:'POST',body:JSON.stringify(row)})});
  }
  if(action==='update_challenge'){
   if(!body.challengeId)throw new Error('Challenge ID is required.');
   const row={athlete_id:athleteId,challenge_id:String(body.challengeId),progress_value:Number(body.progressValue||0),status:String(body.status||'active')};
   return NextResponse.json({ok:true,row:await rest('athlete_challenge_progress?on_conflict=athlete_id,challenge_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify(row)})});
  }
  throw new Error('Unsupported athlete action.');
 }catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:'Unable to save athlete data'},{status:400});}
}