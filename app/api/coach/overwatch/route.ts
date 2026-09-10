import {NextRequest,NextResponse} from 'next/server';
import {CoachAuthError,requireCoach} from '@/lib/server/requireCoach';

const URL=process.env.NEXT_PUBLIC_SUPABASE_URL??'https://xedfstgwotzxnztpembv.supabase.co';
const KEY=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY??process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY??process.env.SUPABASE_ANON_KEY;

export async function POST(request:NextRequest){
 try{
  const actor=await requireCoach(request);
  if(!actor.personId)return NextResponse.json({error:'A canonical Coach person identity is required to run Overwatch.'},{status:409});
  const body=await request.json().catch(()=>({}));
  const teamId=String(body.team_id||'').trim();
  if(!/^[0-9a-f-]{36}$/i.test(teamId))return NextResponse.json({error:'A valid team is required.'},{status:400});
  if(!actor.isSuperUser&&!actor.assignments.some(a=>a.team_id===teamId))return NextResponse.json({error:'Coach is not authorized for this team.'},{status:403});
  if(!KEY)return NextResponse.json({error:'Supabase access is not configured.'},{status:500});
  const response=await fetch(`${URL}/rest/v1/rpc/refresh_coach_overwatch`,{method:'POST',headers:{apikey:KEY,Authorization:`Bearer ${actor.accessToken}`,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({p_coach_person_id:actor.personId,p_team_id:teamId}),cache:'no-store'});
  const text=await response.text();
  if(!response.ok)throw new Error(`Overwatch refresh failed (${response.status}): ${text.slice(0,300)}`);
  const created=Number(JSON.parse(text||'0')||0);
  return NextResponse.json({created,refreshedAt:new Date().toISOString(),source:'canonical LS1 operational data'});
 }catch(error){if(error instanceof CoachAuthError)return NextResponse.json({error:error.message},{status:error.status});return NextResponse.json({error:error instanceof Error?error.message:'Overwatch refresh failed.'},{status:500});}
}
