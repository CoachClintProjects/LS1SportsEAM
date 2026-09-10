import {NextRequest,NextResponse} from 'next/server';
import {CoachAuthError,requireCoach,type CoachIdentity} from '@/lib/server/requireCoach';

const URL=process.env.NEXT_PUBLIC_SUPABASE_URL??'https://xedfstgwotzxnztpembv.supabase.co';
const KEY=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY??process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY??process.env.SUPABASE_ANON_KEY;

function headers(actor:CoachIdentity,extra:HeadersInit={}){
  if(!KEY) throw new Error('Supabase access is not configured.');
  const h=new Headers(extra);h.set('apikey',KEY);h.set('Authorization',`Bearer ${actor.accessToken}`);h.set('Content-Type','application/json');if(!h.has('Prefer'))h.set('Prefer','return=representation');return h;
}
async function rest<T>(actor:CoachIdentity,path:string,init:RequestInit={}):Promise<T>{
  const response=await fetch(`${URL}/rest/v1/${path}`,{...init,headers:headers(actor,init.headers),cache:'no-store'});
  const text=await response.text();
  if(!response.ok) throw new Error(`Coach action failed (${response.status}) ${text.slice(0,300)}`);
  return (text?JSON.parse(text):null) as T;
}
function authError(error:unknown){if(error instanceof CoachAuthError)return NextResponse.json({error:error.message},{status:error.status});return null;}
function text(v:unknown,max=4000){return String(v??'').trim().slice(0,max)}
function uuid(v:unknown){const s=text(v,64);return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)?s:null;}
async function assignmentAllows(actor:CoachIdentity,organizationId:string,teamId:string|null){
  if(actor.isSuperUser)return true;
  return actor.assignments.some(a=>a.organization_id===organizationId&&(!teamId||a.team_id===teamId||a.team_id===null));
}
async function audit(actor:CoachIdentity,input:{organizationId?:string|null;action:string;entityType:string;entityId?:string|null;decision?:string|null;before?:unknown;after?:unknown;reason?:string|null}){
  await rest(actor,'coach_decision_log',{method:'POST',body:JSON.stringify({organization_id:input.organizationId||null,coach_person_id:actor.personId,action:input.action,entity_type:input.entityType,entity_id:input.entityId||null,decision:input.decision||null,before_data:input.before??null,after_data:input.after??null,reason:input.reason||null,source:'coach_hub'})});
}

export async function POST(request:NextRequest){
 try{
  const actor=await requireCoach(request);const body=await request.json();const action=text(body.action,80);
  if(!actor.personId)return NextResponse.json({error:'A canonical Coach person identity is required for write actions.'},{status:409});

  if(action==='save-methodology'){
    const organizationId=uuid(body.organization_id);if(!organizationId)return NextResponse.json({error:'Organization is required.'},{status:400});
    if(!(await assignmentAllows(actor,organizationId,null)))return NextResponse.json({error:'Coach is not authorized for this organization.'},{status:403});
    const payload={coach_person_id:actor.personId,organization_id:organizationId,sport_id:uuid(body.sport_id),name:text(body.name,160)||'My Coaching Methodology',philosophy:text(body.philosophy,8000)||null,training_philosophy:body.training_philosophy||{},periodization_preferences:body.periodization_preferences||{},communication_preferences:body.communication_preferences||{},development_philosophy:body.development_philosophy||{},competition_philosophy:body.competition_philosophy||{},hard_constraints:body.hard_constraints||{},status:'active',approved_at:new Date().toISOString(),updated_at:new Date().toISOString()};
    const existing=await rest<any[]>(actor,`coach_methodologies?select=id,version&coach_person_id=eq.${encodeURIComponent(actor.personId)}&organization_id=eq.${encodeURIComponent(organizationId)}&order=updated_at.desc&limit=1`);
    let row:any;
    if(existing[0])row=(await rest<any[]>(actor,`coach_methodologies?id=eq.${existing[0].id}`,{method:'PATCH',body:JSON.stringify({...payload,version:Number(existing[0].version||1)+1})}))[0];
    else row=(await rest<any[]>(actor,'coach_methodologies',{method:'POST',body:JSON.stringify(payload)}))[0];
    await audit(actor,{organizationId,action:'COACH_METHODOLOGY_SAVED',entityType:'coach_methodologies',entityId:row?.id,decision:'approved',after:row,reason:'Coach methodology explicitly approved'});
    return NextResponse.json(row,{status:existing[0]?200:201});
  }

  if(action==='create-season-plan'){
    const organizationId=uuid(body.organization_id),teamId=uuid(body.team_id);if(!organizationId||!teamId)return NextResponse.json({error:'Organization and team are required.'},{status:400});
    if(!(await assignmentAllows(actor,organizationId,teamId)))return NextResponse.json({error:'Coach is not authorized for this team.'},{status:403});
    const startsOn=text(body.starts_on,10),endsOn=text(body.ends_on,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(startsOn)||!/^\d{4}-\d{2}-\d{2}$/.test(endsOn)||endsOn<startsOn)return NextResponse.json({error:'Valid season dates are required.'},{status:400});
    const payload={coach_person_id:actor.personId,organization_id:organizationId,team_id:teamId,season_id:uuid(body.season_id),sport_id:uuid(body.sport_id),methodology_id:uuid(body.methodology_id),name:text(body.name,200)||'Season Plan',starts_on:startsOn,ends_on:endsOn,primary_competition_id:uuid(body.primary_competition_id),goals:Array.isArray(body.goals)?body.goals:[],constraints:body.constraints||{},status:'draft',approval_status:'coach_review',created_by_agent:false};
    const row=(await rest<any[]>(actor,'coach_season_plans',{method:'POST',body:JSON.stringify(payload)}))[0];
    await audit(actor,{organizationId,action:'COACH_SEASON_PLAN_CREATED',entityType:'coach_season_plans',entityId:row?.id,decision:'draft',after:row,reason:'Coach created season architecture'});
    return NextResponse.json(row,{status:201});
  }

  if(action==='create-note'){
    const organizationId=uuid(body.organization_id);if(!organizationId)return NextResponse.json({error:'Organization is required.'},{status:400});
    if(!(await assignmentAllows(actor,organizationId,uuid(body.team_id))))return NextResponse.json({error:'Coach is not authorized for this scope.'},{status:403});
    const visibility=text(body.visibility,32);if(!['private','coach_staff','team_staff','athlete','parent','administrative'].includes(visibility))return NextResponse.json({error:'Invalid note visibility.'},{status:400});
    const noteBody=text(body.body,12000);if(!noteBody)return NextResponse.json({error:'Note text is required.'},{status:400});
    const payload={organization_id:organizationId,coach_person_id:actor.personId,athlete_id:uuid(body.athlete_id),team_id:uuid(body.team_id),competition_id:uuid(body.competition_id),training_session_id:uuid(body.training_session_id),note_type:text(body.note_type,80)||'observation',visibility,body:noteBody,metadata:{source:'coach_hub'}};
    const row=(await rest<any[]>(actor,'coach_notes',{method:'POST',body:JSON.stringify(payload)}))[0];
    await audit(actor,{organizationId,action:'COACH_NOTE_CREATED',entityType:'coach_notes',entityId:row?.id,decision:visibility,after:{...row,body:'[recorded]'},reason:'Coach observation recorded with explicit visibility'});
    return NextResponse.json(row,{status:201});
  }

  if(action==='resolve-attention'){
    const id=uuid(body.id);if(!id)return NextResponse.json({error:'Attention item is required.'},{status:400});
    const before=(await rest<any[]>(actor,`coach_attention_items?id=eq.${id}&select=*&limit=1`))[0];if(!before)return NextResponse.json({error:'Attention item not found.'},{status:404});
    const row=(await rest<any[]>(actor,`coach_attention_items?id=eq.${id}`,{method:'PATCH',body:JSON.stringify({status:'resolved',resolved_at:new Date().toISOString(),resolution_note:text(body.resolution_note,2000)||null,updated_at:new Date().toISOString()})}))[0];
    await audit(actor,{organizationId:before.organization_id,action:'COACH_ATTENTION_RESOLVED',entityType:'coach_attention_items',entityId:id,decision:'resolved',before,after:row,reason:text(body.resolution_note,2000)||'Resolved by coach'});
    return NextResponse.json(row);
  }

  if(action==='review-agent-proposal'){
    const id=uuid(body.id),decision=text(body.decision,32);if(!id||!['approved','rejected'].includes(decision))return NextResponse.json({error:'Proposal and approved/rejected decision are required.'},{status:400});
    const before=(await rest<any[]>(actor,`coach_agent_proposals?id=eq.${id}&select=*&limit=1`))[0];if(!before)return NextResponse.json({error:'Agent proposal not found.'},{status:404});
    const row=(await rest<any[]>(actor,`coach_agent_proposals?id=eq.${id}`,{method:'PATCH',body:JSON.stringify({status:decision,reviewed_at:new Date().toISOString(),reviewed_by_person_id:actor.personId,decision_note:text(body.decision_note,2000)||null})}))[0];
    await audit(actor,{organizationId:before.organization_id,action:'COACH_AGENT_PROPOSAL_REVIEWED',entityType:'coach_agent_proposals',entityId:id,decision,before,after:row,reason:text(body.decision_note,2000)||`Coach ${decision} agent proposal`});
    return NextResponse.json(row);
  }

  if(action==='review-competition-candidate'){
    const id=uuid(body.id),decision=text(body.decision,32);if(!id||!['accepted','rejected'].includes(decision))return NextResponse.json({error:'Candidate and accepted/rejected decision are required.'},{status:400});
    const before=(await rest<any[]>(actor,`coach_competition_candidates?id=eq.${id}&select=*&limit=1`))[0];if(!before)return NextResponse.json({error:'Competition candidate not found.'},{status:404});
    const row=(await rest<any[]>(actor,`coach_competition_candidates?id=eq.${id}`,{method:'PATCH',body:JSON.stringify({validation_status:decision,reviewed_by_person_id:actor.personId,reviewed_at:new Date().toISOString(),updated_at:new Date().toISOString()})}))[0];
    await audit(actor,{organizationId:before.organization_id,action:'COACH_COMPETITION_CANDIDATE_REVIEWED',entityType:'coach_competition_candidates',entityId:id,decision,before,after:row,reason:'Discovery candidate reviewed; Competition Engine remains authoritative'});
    return NextResponse.json(row);
  }

  return NextResponse.json({error:'Unsupported Coach action.'},{status:400});
 }catch(error){const auth=authError(error);if(auth)return auth;return NextResponse.json({error:error instanceof Error?error.message:'Coach action failed.'},{status:500});}
}
