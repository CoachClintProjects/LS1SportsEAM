import {NextRequest,NextResponse} from 'next/server';
import {CoachAuthError,requireCoach,type CoachIdentity} from '@/lib/server/requireCoach';

const URL=process.env.NEXT_PUBLIC_SUPABASE_URL??'https://xedfstgwotzxnztpembv.supabase.co';
const KEY=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY??process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY??process.env.SUPABASE_ANON_KEY;
export const dynamic='force-dynamic';
export const revalidate=0;

function headers(actor:CoachIdentity,extra:HeadersInit={}){if(!KEY)throw new Error('Supabase access is not configured.');const h=new Headers(extra);h.set('apikey',KEY);h.set('Authorization',`Bearer ${actor.accessToken}`);if(!h.has('Accept'))h.set('Accept','application/json');if(!h.has('Content-Type')&&extra)h.set('Content-Type','application/json');if(!h.has('Prefer'))h.set('Prefer','return=representation');return h;}
async function rest<T>(actor:CoachIdentity,path:string,init:RequestInit={}):Promise<T>{const r=await fetch(`${URL}/rest/v1/${path}`,{...init,headers:headers(actor,init.headers),cache:'no-store'});const t=await r.text();if(!r.ok)throw new Error(`Coach debrief operation failed (${r.status}) ${t.slice(0,280)}`);return(t?JSON.parse(t):null)as T;}
function authError(e:unknown){if(e instanceof CoachAuthError)return NextResponse.json({error:e.message},{status:e.status});return null;}
function csv(ids:string[]){return ids.map(id=>`\"${id}\"`).join(',')}
function uniq<T>(items:T[]){return Array.from(new Set(items));}
function text(v:unknown,max=8000){return String(v??'').trim().slice(0,max)}
function uuid(v:unknown){const s=text(v,64);return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)?s:null;}
async function teamsFor(actor:CoachIdentity){const assigned=uniq(actor.assignments.map(a=>a.team_id).filter(Boolean)as string[]);if(actor.isSuperUser)return rest<any[]>(actor,'teams?select=id,organization_id,sport_id,season_id,name,status&status=eq.active&order=name.asc&limit=200');if(!assigned.length)return [];return rest<any[]>(actor,`teams?select=id,organization_id,sport_id,season_id,name,status&id=in.(${csv(assigned)})&status=eq.active&order=name.asc`);}
function canUseTeam(actor:CoachIdentity,team:any){return actor.isSuperUser||actor.assignments.some(a=>a.team_id===team.id||(!a.team_id&&a.organization_id===team.organization_id));}

export async function GET(request:NextRequest){
 try{
  const actor=await requireCoach(request),teams=await teamsFor(actor),requested=request.nextUrl.searchParams.get('team_id'),teamId=requested&&teams.some(t=>t.id===requested)?requested:(teams[0]?.id||null),team=teams.find(t=>t.id===teamId)||null;
  if(!team)return NextResponse.json({generatedAt:new Date().toISOString(),teams,selectedTeamId:null,competitions:[],debriefs:[],results:[],athletes:[],preparedAdjustments:[],source:'LS1 canonical competition results'});
  const memberships=await rest<any[]>(actor,`team_memberships?select=athlete_id&team_id=eq.${team.id}&status=eq.active&limit=1000`),athleteIds=uniq(memberships.map(m=>m.athlete_id).filter(Boolean));
  const athletes=athleteIds.length?await rest<any[]>(actor,`athletes?select=id,person_id,athlete_number&id=in.(${csv(athleteIds)})&limit=1000`):[],personIds=uniq(athletes.map(a=>a.person_id).filter(Boolean));
  const people=personIds.length?await rest<any[]>(actor,`people?select=id,first_name,preferred_name,last_name&id=in.(${csv(personIds)})&limit=1000`):[],pmap=new Map<string,any>(people.map(p=>[String(p.id),p] as [string,any]));
  const athleteRows=athletes.map(a=>{const p=pmap.get(String(a.person_id));return{id:a.id,name:p?[p.preferred_name||p.first_name,p.last_name].filter(Boolean).join(' '):'Athlete',athleteNumber:a.athlete_number};});
  const now=new Date().toISOString(),past=new Date(Date.now()-365*86400000).toISOString();
  const competitions=await rest<any[]>(actor,`competitions?select=id,name,competition_type,starts_at,ends_at,status,city,region,sanction_number&organization_id=eq.${team.organization_id}&ends_at=gte.${encodeURIComponent(past)}&ends_at=lte.${encodeURIComponent(now)}&order=ends_at.desc&limit=100`);
  const results=athleteIds.length?await rest<any[]>(actor,`competition_results?select=id,competition_entry_id,athlete_id,result_value,result_unit,rank,status,recorded_at,validation_status,canonical&athlete_id=in.(${csv(athleteIds)})&canonical=eq.true&recorded_at=gte.${encodeURIComponent(past)}&order=recorded_at.desc&limit=5000`):[],entryIds=uniq(results.map(r=>r.competition_entry_id).filter(Boolean));
  const entries=entryIds.length?await rest<any[]>(actor,`competition_entries?select=id,competition_event_id,athlete_id& id=in.(${csv(entryIds)})&limit=5000`.replace('& ', '&')):[],eventIds=uniq(entries.map(e=>e.competition_event_id).filter(Boolean));
  const events=eventIds.length?await rest<any[]>(actor,`competition_events?select=id,competition_id,code,name& id=in.(${csv(eventIds)})&limit=5000`.replace('& ', '&')):[],emap=new Map<string,any>(entries.map(e=>[String(e.id),e] as [string,any])),evmap=new Map<string,any>(events.map(e=>[String(e.id),e] as [string,any]));
  const decorated=results.map(r=>{const e=emap.get(String(r.competition_entry_id)),ev=e?evmap.get(String(e.competition_event_id)):null;return{...r,competitionId:ev?.competition_id||null,eventCode:ev?.code||null,eventName:ev?.name||null};});
  const coachFilter=actor.personId?`coach_person_id=eq.${encodeURIComponent(actor.personId)}`:'id=not.is.null';
  const debriefs=await rest<any[]>(actor,`coach_competition_debriefs?select=*&team_id=eq.${team.id}&${coachFilter}&order=created_at.desc&limit=500`),debriefIds=debriefs.map(d=>d.id);
  const preparedAdjustments=debriefIds.length?await rest<any[]>(actor,`coach_agent_proposals?select=id,subject_id,proposal,status,created_at,reviewed_at,decision_note&subject_type=eq.coach_competition_debriefs&subject_id=in.(${csv(debriefIds)})&proposal_type=eq.training_adjustment&order=created_at.desc&limit=500`):[];
  return NextResponse.json({generatedAt:new Date().toISOString(),source:'LS1 canonical competition results → Coach judgment → governed training adjustment',teams,selectedTeamId:team.id,competitions,debriefs,results:decorated,athletes:athleteRows,preparedAdjustments},{headers:{'Cache-Control':'no-store, max-age=0'}});
 }catch(e){const auth=authError(e);if(auth)return auth;return NextResponse.json({error:e instanceof Error?e.message:'Coach debrief data unavailable.'},{status:500});}
}

export async function POST(request:NextRequest){
 try{
  const actor=await requireCoach(request);if(!actor.personId)return NextResponse.json({error:'A canonical Coach identity is required.'},{status:409});const body=await request.json(),action=text(body.action,80),teamId=uuid(body.team_id);if(!teamId)return NextResponse.json({error:'Team is required.'},{status:400});const teams=await teamsFor(actor),team=teams.find(t=>t.id===teamId);if(!team||!canUseTeam(actor,team))return NextResponse.json({error:'Coach is not authorized for this team.'},{status:403});
  if(action==='save-debrief'){
   const competitionId=uuid(body.competition_id);if(!competitionId)return NextResponse.json({error:'Competition is required.'},{status:400});const summary=text(body.summary);if(!summary)return NextResponse.json({error:'Debrief summary is required.'},{status:400});const payload={competition_id:competitionId,coach_person_id:actor.personId,team_id:team.id,athlete_id:uuid(body.athlete_id),summary,what_worked:text(body.what_worked)||null,what_changed:text(body.what_changed)||null,development_implications:text(body.development_implications)||null,training_adjustments:Array.isArray(body.training_adjustments)?body.training_adjustments:[],evidence:{source:'canonical_competition_results',result_ids:Array.isArray(body.result_ids)?body.result_ids.filter((v:unknown)=>uuid(v)).slice(0,100):[]},status:'complete',updated_at:new Date().toISOString()};const row=(await rest<any[]>(actor,'coach_competition_debriefs',{method:'POST',body:JSON.stringify(payload)}))[0];await rest(actor,'coach_decision_log',{method:'POST',body:JSON.stringify({organization_id:team.organization_id,coach_person_id:actor.personId,action:'COACH_COMPETITION_DEBRIEF_RECORDED',entity_type:'coach_competition_debriefs',entity_id:row.id,decision:'complete',after_data:{...row,summary:'[recorded]'},source:'coach_debrief'})});return NextResponse.json(row,{status:201});
  }
  if(action==='prepare-training-adjustment'){
   const debriefId=uuid(body.debrief_id);if(!debriefId)return NextResponse.json({error:'Debrief is required.'},{status:400});const debrief=(await rest<any[]>(actor,`coach_competition_debriefs?select=*&id=eq.${debriefId}&team_id=eq.${team.id}&coach_person_id=eq.${actor.personId}&limit=1`))[0];if(!debrief)return NextResponse.json({error:'Debrief not found.'},{status:404});const proposal={source_debrief_id:debrief.id,team_id:team.id,athlete_id:debrief.athlete_id,adjustments:debrief.training_adjustments||[],development_implications:debrief.development_implications,summary:debrief.summary};const row=(await rest<any[]>(actor,'coach_agent_proposals',{method:'POST',body:JSON.stringify({tenant_id:actor.assignments.find(a=>a.organization_id===team.organization_id)?.tenant_id||undefined,organization_id:team.organization_id,coach_person_id:actor.personId,agent_key:'competition_debrief_loop',proposal_type:'training_adjustment',autonomy_level:'prepare',subject_type:'coach_competition_debriefs',subject_id:debrief.id,proposal,rationale:{principle:'Coach decides. ERP executes. Agents watch.',source:'competition_debrief'},source_evidence:debrief.evidence||{},status:'prepared'})}))[0];await rest(actor,'coach_decision_log',{method:'POST',body:JSON.stringify({organization_id:team.organization_id,coach_person_id:actor.personId,action:'COACH_TRAINING_ADJUSTMENT_PREPARED',entity_type:'coach_agent_proposals',entity_id:row.id,decision:'prepared',after_data:row,source:'coach_debrief'})});return NextResponse.json(row,{status:201});
  }
  return NextResponse.json({error:'Unsupported debrief action.'},{status:400});
 }catch(e){const auth=authError(e);if(auth)return auth;return NextResponse.json({error:e instanceof Error?e.message:'Coach debrief action failed.'},{status:500});}
}
