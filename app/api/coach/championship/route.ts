import {NextRequest,NextResponse} from 'next/server';
import {CoachAuthError,requireCoach,type CoachIdentity} from '@/lib/server/requireCoach';

const URL=process.env.NEXT_PUBLIC_SUPABASE_URL??'https://xedfstgwotzxnztpembv.supabase.co';
const KEY=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY??process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY??process.env.SUPABASE_ANON_KEY;
export const dynamic='force-dynamic';
export const revalidate=0;

function headers(actor:CoachIdentity){if(!KEY)throw new Error('Supabase access is not configured.');return{apikey:KEY,Authorization:`Bearer ${actor.accessToken}`,Accept:'application/json'};}
async function rest<T>(actor:CoachIdentity,path:string):Promise<T>{const r=await fetch(`${URL}/rest/v1/${path}`,{headers:headers(actor),cache:'no-store'});const t=await r.text();if(!r.ok)throw new Error(`Championship planning read failed (${r.status}) ${t.slice(0,240)}`);return(t?JSON.parse(t):null)as T;}
function csv(ids:string[]){return ids.map(id=>`\"${id}\"`).join(',')}
function uniq<T>(items:T[]){return Array.from(new Set(items));}
function authError(e:unknown){if(e instanceof CoachAuthError)return NextResponse.json({error:e.message},{status:e.status});return null;}
function resultMs(value:unknown,unit:unknown){const n=Number(value);if(!Number.isFinite(n))return null;const u=String(unit||'').trim().toLowerCase();if(['ms','millisecond','milliseconds'].includes(u))return Math.round(n);if(['s','sec','secs','second','seconds'].includes(u))return Math.round(n*1000);return null;}
function ageOn(date:string,birthDate:string|null){if(!birthDate)return null;const d=new Date(`${date.slice(0,10)}T00:00:00Z`),b=new Date(`${birthDate}T00:00:00Z`);if(Number.isNaN(d.getTime())||Number.isNaN(b.getTime()))return null;let age=d.getUTCFullYear()-b.getUTCFullYear();const m=d.getUTCMonth()-b.getUTCMonth();if(m<0||(m===0&&d.getUTCDate()<b.getUTCDate()))age--;return age;}

export async function GET(request:NextRequest){
 try{
  const actor=await requireCoach(request),requestedTeam=request.nextUrl.searchParams.get('team_id'),requestedCompetition=request.nextUrl.searchParams.get('competition_id');
  let assignments=actor.assignments;if(actor.isSuperUser)assignments=await rest(actor,'coach_access_assignments?select=organization_id,team_id,status&status=eq.active&limit=200');
  const assignedTeamIds=uniq(assignments.map(a=>a.team_id).filter(Boolean)as string[]);let teams:any[]=[];
  if(actor.isSuperUser)teams=await rest(actor,'teams?select=id,organization_id,sport_id,season_id,name,status&status=eq.active&order=name.asc&limit=200');else if(assignedTeamIds.length)teams=await rest(actor,`teams?select=id,organization_id,sport_id,season_id,name,status&id=in.(${csv(assignedTeamIds)})&status=eq.active&limit=200`);
  const teamId=requestedTeam&&teams.some(t=>t.id===requestedTeam)?requestedTeam:(teams[0]?.id||null),team=teams.find(t=>t.id===teamId)||null;
  if(!team)return NextResponse.json({generatedAt:new Date().toISOString(),teams,selectedTeamId:null,competition:null,competitions:[],athletes:[],qualification:[],targets:[],relayScenarios:[],dataQuality:{standards:0,canonicalResults:0,recognizedTimedResults:0},source:'LS1 canonical data'});
  const org=(await rest<any[]>(actor,`organizations?select=id,tenant_id,governing_body_id,name&id=eq.${team.organization_id}&limit=1`))[0];
  const membership=await rest<any[]>(actor,`team_memberships?select=athlete_id&team_id=eq.${team.id}&status=eq.active&limit=1000`),athleteIds=uniq(membership.map(m=>m.athlete_id).filter(Boolean));
  const athletes=athleteIds.length?await rest<any[]>(actor,`athletes?select=id,person_id,athlete_number,athlete_status&id=in.(${csv(athleteIds)})&limit=1000`):[],personIds=uniq(athletes.map(a=>a.person_id).filter(Boolean));
  const people=personIds.length?await rest<any[]>(actor,`people?select=id,first_name,preferred_name,last_name,birth_date,sex&id=in.(${csv(personIds)})&limit=1000`):[],peopleMap=new Map<string,any>(people.map(p=>[String(p.id),p] as [string,any]));
  const athleteRows=athletes.map(a=>{const p=peopleMap.get(String(a.person_id));return{id:a.id,athleteNumber:a.athlete_number,birthDate:p?.birth_date||null,sex:p?.sex||null,name:p?[p.preferred_name||p.first_name,p.last_name].filter(Boolean).join(' '):'Athlete'};});
  const now=new Date(),to=new Date(now.getTime()+365*86400000).toISOString();
  const competitions=await rest<any[]>(actor,`competitions?select=id,organization_id,sport_id,name,competition_type,starts_at,ends_at,status,sanction_number,city,region&organization_id=eq.${team.organization_id}&starts_at=gte.${encodeURIComponent(now.toISOString())}&starts_at=lte.${encodeURIComponent(to)}&order=starts_at.asc&limit=100`);
  const competitionId=requestedCompetition&&competitions.some(c=>c.id===requestedCompetition)?requestedCompetition:(competitions[0]?.id||null),competition=competitions.find(c=>c.id===competitionId)||null;
  const standards=await rest<any[]>(actor,`swim_time_standards?select=id,governing_body_id,course_code,event_code,age_low,age_high,gender,standard_name,standard_time_ms,effective_from,effective_to${org?.governing_body_id?`&governing_body_id=eq.${org.governing_body_id}`:''}&limit=5000`);
  const results=athleteIds.length?await rest<any[]>(actor,`competition_results?select=id,competition_entry_id,athlete_id,result_value,result_unit,recorded_at,validation_status,canonical&athlete_id=in.(${csv(athleteIds)})&canonical=eq.true&order=recorded_at.desc&limit=5000`):[],entryIds=uniq(results.map(r=>r.competition_entry_id).filter(Boolean));
  const resultEntries=entryIds.length?await rest<any[]>(actor,`competition_entries?select=id,competition_event_id,athlete_id&id=in.(${csv(entryIds)})&limit=5000`):[],eventIds=uniq(resultEntries.map(e=>e.competition_event_id).filter(Boolean));
  const resultEvents=eventIds.length?await rest<any[]>(actor,`competition_events?select=id,code,name,event_definition&id=in.(${csv(eventIds)})&limit=5000`):[];
  const entryMap=new Map<string,any>(resultEntries.map(e=>[String(e.id),e] as [string,any])),eventMap=new Map<string,any>(resultEvents.map(e=>[String(e.id),e] as [string,any]));
  const best=new Map<string,{ms:number;resultId:string;recordedAt:string;eventCode:string}>();let recognizedTimedResults=0;
  for(const r of results){const ms=resultMs(r.result_value,r.result_unit);if(ms===null)continue;const entry=entryMap.get(String(r.competition_entry_id)),event=entry?eventMap.get(String(entry.competition_event_id)):null,eventCode=String(event?.code||'').trim();if(!eventCode)continue;recognizedTimedResults++;const key=`${r.athlete_id}|${eventCode}`;const prev=best.get(key);if(!prev||ms<prev.ms)best.set(key,{ms,resultId:r.id,recordedAt:r.recorded_at,eventCode});}
  const competitionDate=competition?.starts_at||new Date().toISOString();const qualification:any[]=[];
  for(const athlete of athleteRows){const age=ageOn(competitionDate,athlete.birthDate);for(const standard of standards){if(age!==null&&standard.age_low!==null&&age<standard.age_low)continue;if(age!==null&&standard.age_high!==null&&age>standard.age_high)continue;if(standard.gender&&athlete.sex&&String(standard.gender).toLowerCase()!==String(athlete.sex).toLowerCase())continue;const b=best.get(`${athlete.id}|${standard.event_code}`);const gapMs=b?b.ms-Number(standard.standard_time_ms):null;qualification.push({athleteId:athlete.id,athleteName:athlete.name,eventCode:standard.event_code,standardId:standard.id,standardName:standard.standard_name,standardTimeMs:Number(standard.standard_time_ms),bestTimeMs:b?.ms??null,gapMs,status:b?(gapMs!==null&&gapMs<=0?'qualified':'chasing'):'no_verified_time',sourceResultId:b?.resultId||null});}}
  qualification.sort((a,b)=>a.athleteName.localeCompare(b.athleteName)||String(a.eventCode).localeCompare(String(b.eventCode)));
  const coachFilter=actor.personId?`coach_person_id=eq.${encodeURIComponent(actor.personId)}`:'id=not.is.null';
  const targets=competitionId?await rest<any[]>(actor,`coach_championship_targets?select=*&team_id=eq.${team.id}&competition_id=eq.${competitionId}&${coachFilter}&status=in.(active,achieved)&order=priority.asc,created_at.asc&limit=1000`):[];
  const relayScenarios=competitionId?await rest<any[]>(actor,`coach_relay_scenarios?select=*&team_id=eq.${team.id}&competition_id=eq.${competitionId}&${coachFilter}&status=in.(draft,approved)&order=created_at.desc&limit=200`):[],relayIds=relayScenarios.map(r=>r.id),relayLegs=relayIds.length?await rest<any[]>(actor,`coach_relay_scenario_legs?select=*&relay_scenario_id=in.(${csv(relayIds)})&order=leg_no.asc&limit=1000`):[];
  return NextResponse.json({generatedAt:new Date().toISOString(),source:'LS1 canonical athlete + Competition Engine + governing standards data',teams,selectedTeamId:team.id,organization:{id:org?.id||team.organization_id,tenantId:org?.tenant_id||null,name:org?.name||null},competition,competitions,athletes:athleteRows,qualification,targets,relayScenarios:relayScenarios.map(s=>({...s,legs:relayLegs.filter(l=>l.relay_scenario_id===s.id)})),dataQuality:{standards:standards.length,canonicalResults:results.length,recognizedTimedResults,eventDefinitions:resultEvents.filter(e=>e.event_definition&&Object.keys(e.event_definition).length).length}}, {headers:{'Cache-Control':'no-store, max-age=0'}});
 }catch(e){const auth=authError(e);if(auth)return auth;return NextResponse.json({error:e instanceof Error?e.message:'Championship planning unavailable.'},{status:500});}
}
