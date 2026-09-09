import {NextRequest,NextResponse} from 'next/server';
import {AthleteAuthError,requireAthlete} from '@/lib/server/requireAthlete';

const SUPABASE_URL=process.env.NEXT_PUBLIC_SUPABASE_URL??'https://xedfstgwotzxnztpembv.supabase.co';
const SERVICE_KEY=process.env.SUPABASE_SERVICE_ROLE_KEY;
const AGE_BANDS=new Set(['5-8','9-11','12-14','15-17','18+']);

type Row=Record<string,any>;

function headers(){return{apikey:SERVICE_KEY!,Authorization:`Bearer ${SERVICE_KEY!}`,Accept:'application/json','Content-Type':'application/json'}}
async function rest(path:string){const r=await fetch(`${SUPABASE_URL}/rest/v1/${path}`,{headers:headers(),cache:'no-store'});const text=await r.text();if(!r.ok)throw new Error(`Supabase Athlete Experience query returned ${r.status}: ${text.slice(0,400)}`);return text?JSON.parse(text):[]}
async function rpc(name:string,body:Record<string,unknown>){const r=await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`,{method:'POST',headers:headers(),body:JSON.stringify(body),cache:'no-store'});const text=await r.text();if(!r.ok)throw new Error(`Supabase Athlete Experience RPC returned ${r.status}: ${text.slice(0,400)}`);return text?JSON.parse(text):null}
const enc=(v:string)=>encodeURIComponent(v);
const inFilter=(values:string[])=>values.length?`in.(${values.join(',')})`:'in.(00000000-0000-0000-0000-000000000000)';
function daysBetween(a:Date,b:Date){return Math.ceil((b.getTime()-a.getTime())/86400000)}
function deriveState(entries:Row[],results:Row[]){const now=new Date();const upcoming=entries.filter(e=>e.competition?.startsAt&&new Date(e.competition.startsAt)>=new Date(now.getTime()-12*3600000)).sort((a,b)=>new Date(a.competition.startsAt).getTime()-new Date(b.competition.startsAt).getTime());const next=upcoming[0];if(next){const starts=new Date(next.competition.startsAt);const ends=next.competition.endsAt?new Date(next.competition.endsAt):new Date(starts.getTime()+3*86400000);if(now>=new Date(starts.getTime()-12*3600000)&&now<=ends)return'race-day';if(daysBetween(now,starts)<=21)return'meet-prep'}const recent=results.find(r=>r.recordedAt&&now.getTime()-new Date(r.recordedAt).getTime()<=36*3600000);return recent?'post-race':'training-day'}

export const dynamic='force-dynamic';
export const revalidate=0;

export async function GET(request:NextRequest){
 try{
  if(!SERVICE_KEY)throw new Error('Supabase server credentials are not configured.');
  const actor=await requireAthlete(request);
  const requested=request.nextUrl.searchParams.get('age')??actor.ageBand??'5-8';
  const ageBand=AGE_BANDS.has(requested)?requested:'5-8';
  let athleteId=actor.athleteId;
  let personId=actor.personId;
  if(actor.isSuperUser){const hub=await rpc('get_athlete_hub',{p_age_band:ageBand,p_athlete_number:null});athleteId=hub?.athlete?.id??null;if(athleteId){const athleteRows=await rest(`athletes?id=eq.${enc(athleteId)}&select=id,person_id`);personId=athleteRows?.[0]?.person_id??null}}
  if(!athleteId)throw new AthleteAuthError('Athlete identity is unavailable.',403);

  const entries:Row[]=await rest(`competition_entries?athlete_id=eq.${enc(athleteId)}&select=id,competition_event_id,team_id,seed_value,seed_unit,entry_status,eligibility_status,scratch_status`);
  const eventIds=[...new Set(entries.map(e=>String(e.competition_event_id)).filter(Boolean))];
  const events:Row[]=eventIds.length?await rest(`competition_events?id=${enc(inFilter(eventIds))}&select=id,competition_id,session_id,code,name,sequence_no,event_definition`):[];
  const competitionIds=[...new Set(events.map(e=>String(e.competition_id)).filter(Boolean))];
  const sessionIds=[...new Set(events.map(e=>String(e.session_id)).filter(Boolean))];
  const competitions:Row[]=competitionIds.length?await rest(`competitions?id=${enc(inFilter(competitionIds))}&select=id,name,competition_type,starts_at,ends_at,timezone,city,region,country_code,status,sanction_number`):[];
  const sessions:Row[]=sessionIds.length?await rest(`competition_sessions?id=${enc(inFilter(sessionIds))}&select=id,competition_id,name,session_no,starts_at,ends_at,status`):[];
  const entryIds=entries.map(e=>String(e.id));
  const checkins:Row[]=entryIds.length?await rest(`competition_checkins?athlete_id=eq.${enc(athleteId)}&entry_id=${enc(inFilter(entryIds))}&select=id,competition_id,session_id,entry_id,checkin_type,status,checked_in_at,source,notes`):[];
  const seeding:Row[]=entryIds.length?await rest(`competition_seeding_assignments?competition_entry_id=${enc(inFilter(entryIds))}&select=id,competition_entry_id,heat_no,lane_no,seed_rank,seed_value,seed_unit,assignment_status,rationale`):[];
  const lanes:Row[]=entryIds.length?await rest(`swim_lanes?competition_entry_id=${enc(inFilter(entryIds))}&select=id,heat_id,lane_no,competition_entry_id,status`):[];
  const heatIds=[...new Set(lanes.map(l=>String(l.heat_id)).filter(Boolean))];
  const heats:Row[]=heatIds.length?await rest(`swim_heats?id=${enc(inFilter(heatIds))}&select=id,competition_event_id,heat_no,heat_type,start_at,status`):[];
  const results:Row[]=await rest(`competition_results?athlete_id=eq.${enc(athleteId)}&canonical=is.true&select=id,competition_entry_id,result_value,result_unit,rank,status,recorded_at,source_system,validation_status&order=recorded_at.desc&limit=100`);
  const reflections:Row[]=await rest(`athlete_reflections?athlete_id=eq.${enc(athleteId)}&select=id,reflection_type,title,body,occurred_on,visibility,created_at&order=occurred_on.desc&limit=20`);
  const training:Row[]=await rest(`training_athlete_logs?athlete_id=eq.${enc(athleteId)}&select=id,training_session_id,participation_status,load,distance,rpe,notes&limit=30`);
  let person:Row|null=null;
  if(personId){const people=await rest(`people?id=eq.${enc(personId)}&select=id,birth_date,sex`);person=people?.[0]??null}

  const eventMap=new Map(events.map(e=>[String(e.id),e]));const compMap=new Map(competitions.map(c=>[String(c.id),c]));const sessionMap=new Map(sessions.map(s=>[String(s.id),s]));const checkinMap=new Map(checkins.map(c=>[String(c.entry_id),c]));const seedMap=new Map(seeding.map(s=>[String(s.competition_entry_id),s]));const laneMap=new Map(lanes.map(l=>[String(l.competition_entry_id),l]));const heatMap=new Map(heats.map(h=>[String(h.id),h]));
  const myEntries=entries.map(entry=>{const event=eventMap.get(String(entry.competition_event_id));const competition=event?compMap.get(String(event.competition_id)):null;const session=event?.session_id?sessionMap.get(String(event.session_id)):null;const seed=seedMap.get(String(entry.id));const lane=laneMap.get(String(entry.id));const heat=lane?.heat_id?heatMap.get(String(lane.heat_id)):null;return{id:entry.id,entryStatus:entry.entry_status,eligibilityStatus:entry.eligibility_status,scratchStatus:entry.scratch_status,seedValue:entry.seed_value,seedUnit:entry.seed_unit,event:event?{id:event.id,code:event.code,name:event.name,sequenceNo:event.sequence_no,definition:event.event_definition}:null,competition:competition?{id:competition.id,name:competition.name,type:competition.competition_type,startsAt:competition.starts_at,endsAt:competition.ends_at,timezone:competition.timezone,city:competition.city,region:competition.region,countryCode:competition.country_code,status:competition.status,sanctionNumber:competition.sanction_number}:null,session:session?{id:session.id,name:session.name,number:session.session_no,startsAt:session.starts_at,endsAt:session.ends_at,status:session.status}:null,checkin:checkinMap.get(String(entry.id))??null,seeding:seed??null,heat:heat?{id:heat.id,number:heat.heat_no,type:heat.heat_type,startAt:heat.start_at,status:heat.status}:null,lane:lane?{number:lane.lane_no,status:lane.status}:null}}).sort((a,b)=>new Date(a.session?.startsAt??a.competition?.startsAt??0).getTime()-new Date(b.session?.startsAt??b.competition?.startsAt??0).getTime());
  const resultRows=results.map(r=>({...r,recordedAt:r.recorded_at,resultValue:r.result_value,resultUnit:r.result_unit,validationStatus:r.validation_status}));
  const state=deriveState(myEntries,resultRows);
  return NextResponse.json({athleteId,ageBand,state,entries:myEntries,results:resultRows,training,reflections,identity:{birthDate:person?.birth_date??null,sex:person?.sex??null},generatedAt:new Date().toISOString(),source:'LS1SportsEAM Supabase',authority:'Competition Engine data surfaced to Athlete Experience'},{headers:{'Cache-Control':'no-store, max-age=0, must-revalidate'}});
 }catch(error){const status=error instanceof AthleteAuthError?error.status:500;return NextResponse.json({error:error instanceof Error?error.message:'Athlete Experience unavailable'},{status,headers:{'Cache-Control':'no-store, max-age=0, must-revalidate'}})}
}
