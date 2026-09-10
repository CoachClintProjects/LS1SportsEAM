import {NextRequest,NextResponse} from 'next/server';
import {CoachAuthError,requireCoach,type CoachIdentity} from '@/lib/server/requireCoach';

const URL=process.env.NEXT_PUBLIC_SUPABASE_URL??'https://xedfstgwotzxnztpembv.supabase.co';
const KEY=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY??process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY??process.env.SUPABASE_ANON_KEY;
export const dynamic='force-dynamic';
export const revalidate=0;

function headers(actor:CoachIdentity){if(!KEY)throw new Error('Supabase access is not configured.');return{apikey:KEY,Authorization:`Bearer ${actor.accessToken}`,Accept:'application/json'};}
async function rest<T>(actor:CoachIdentity,path:string):Promise<T>{const response=await fetch(`${URL}/rest/v1/${path}`,{headers:headers(actor),cache:'no-store'});const text=await response.text();if(!response.ok)throw new Error(`Coach data read failed (${response.status}) ${path}: ${text.slice(0,300)}`);return(text?JSON.parse(text):null)as T;}
function csv(ids:string[]){return ids.map(id=>`\"${id}\"`).join(',')}
function uniq<T>(items:T[]){return Array.from(new Set(items));}
function authError(error:unknown){if(error instanceof CoachAuthError)return NextResponse.json({error:error.message},{status:error.status});return null;}

export async function GET(request:NextRequest){
 try{
  const actor=await requireCoach(request);
  const requestedTeam=request.nextUrl.searchParams.get('team_id');
  let assignments=actor.assignments;
  if(actor.isSuperUser)assignments=await rest(actor,'coach_access_assignments?select=id,organization_id,team_id,program_id,role_key,is_head_coach&status=eq.active&order=created_at.asc&limit=100');
  const assignmentTeamIds=uniq(assignments.map(a=>a.team_id).filter(Boolean)as string[]);
  let selectedTeamId=requestedTeam&&(!assignmentTeamIds.length||assignmentTeamIds.includes(requestedTeam))?requestedTeam:(assignmentTeamIds[0]||null);
  let teams:any[]=[];
  if(actor.isSuperUser){teams=await rest(actor,'teams?select=id,organization_id,sport_id,program_id,season_id,name,competitive_level,status&status=eq.active&order=name.asc&limit=100');if(selectedTeamId&&!teams.some(t=>t.id===selectedTeamId))selectedTeamId=null;if(!selectedTeamId)selectedTeamId=teams[0]?.id||null;}
  else if(assignmentTeamIds.length)teams=await rest(actor,`teams?select=id,organization_id,sport_id,program_id,season_id,name,competitive_level,status&id=in.(${csv(assignmentTeamIds)})&order=name.asc`);
  const selectedTeam=teams.find(t=>t.id===selectedTeamId)||null;
  const orgIds=uniq((selectedTeam?[selectedTeam.organization_id]:assignments.map(a=>a.organization_id)).filter(Boolean));
  const selectedOrgId=selectedTeam?.organization_id||orgIds[0]||null;
  const now=new Date(),nowIso=now.toISOString(),today=nowIso.slice(0,10),futureIso=new Date(now.getTime()+120*86400000).toISOString();

  const membershipRows=selectedTeamId?await rest<any[]>(actor,`team_memberships?select=id,team_id,athlete_id,person_id,membership_type,status,starts_on,ends_on&team_id=eq.${encodeURIComponent(selectedTeamId)}&status=eq.active&limit=500`):[];
  const athleteIds=uniq(membershipRows.map(r=>r.athlete_id).filter(Boolean));
  const athletes=athleteIds.length?await rest<any[]>(actor,`athletes?select=id,person_id,athlete_number,athlete_status,privacy_level,status&id=in.(${csv(athleteIds)})&limit=500`):[];
  const athletePersonIds=uniq(athletes.map(a=>a.person_id).filter(Boolean));
  const athletePeople=athletePersonIds.length?await rest<any[]>(actor,`people?select=id,first_name,preferred_name,last_name,birth_date,status&id=in.(${csv(athletePersonIds)})&limit=500`):[];
  const peopleById=new Map(athletePeople.map(p=>[p.id,p]));
  const roster=athletes.map(a=>{const p=peopleById.get(a.person_id);return{id:a.id,personId:a.person_id,athleteNumber:a.athlete_number,status:a.athlete_status,privacyLevel:a.privacy_level,birthDate:p?.birth_date||null,name:p?[p.preferred_name||p.first_name,p.last_name].filter(Boolean).join(' '):'Athlete'};});

  const trainingPlans=selectedTeamId?await rest<any[]>(actor,`training_plans?select=id,team_id,season_id,name,plan_type,starts_on,ends_on,status,created_by&team_id=eq.${encodeURIComponent(selectedTeamId)}&order=starts_on.desc&limit=50`):[];
  const trainingPlanIds=trainingPlans.map(p=>p.id);
  const sessions=trainingPlanIds.length?await rest<any[]>(actor,`training_sessions?select=id,training_plan_id,attendance_session_id,title,session_type,total_load,total_distance,distance_unit,workout_definition&training_plan_id=in.(${csv(trainingPlanIds)})&limit=250`):[];
  const attendance=selectedTeamId?await rest<any[]>(actor,`attendance_sessions?select=id,team_id,group_id,event_id,session_date,start_time,end_time,session_type,status&team_id=eq.${encodeURIComponent(selectedTeamId)}&session_date=gte.${today}&order=session_date.asc&limit=100`):[];
  const attendanceIds=attendance.map(a=>a.id);
  const attendanceRecords=attendanceIds.length?await rest<any[]>(actor,`attendance_records?select=id,session_id,athlete_id,status,check_in_at,check_out_at,note&session_id=in.(${csv(attendanceIds)})&limit=1000`):[];
  const trainingLogs=athleteIds.length?await rest<any[]>(actor,`training_athlete_logs?select=id,training_session_id,athlete_id,participation_status,load,distance,rpe,notes&athlete_id=in.(${csv(athleteIds)})&limit=1000`):[];
  const developmentPlans=athleteIds.length?await rest<any[]>(actor,`development_plans?select=id,athlete_id,plan_type,starts_on,ends_on,status,coach_person_id,definition&athlete_id=in.(${csv(athleteIds)})&limit=250`):[];
  const developmentGoals=athleteIds.length?await rest<any[]>(actor,`development_goals?select=id,athlete_id,development_plan_id,goal_type,title,description,target_value,target_unit,due_on,status&athlete_id=in.(${csv(athleteIds)})&limit=500`):[];
  const assessments=athleteIds.length?await rest<any[]>(actor,`development_assessments?select=id,athlete_id,assessor_person_id,assessment_type,assessed_at,scores,notes&athlete_id=in.(${csv(athleteIds)})&order=assessed_at.desc&limit=250`):[];
  const results=athleteIds.length?await rest<any[]>(actor,`competition_results?select=id,competition_entry_id,athlete_id,team_id,result_value,result_unit,rank,status,recorded_at,source_system,validation_status,canonical&athlete_id=in.(${csv(athleteIds)})&canonical=eq.true&order=recorded_at.desc&limit=1000`):[];
  const competitions=selectedOrgId?await rest<any[]>(actor,`competitions?select=id,organization_id,sport_id,name,competition_type,starts_at,ends_at,timezone,city,region,country_code,status,sanction_number&organization_id=eq.${encodeURIComponent(selectedOrgId)}&starts_at=gte.${encodeURIComponent(nowIso)}&starts_at=lte.${encodeURIComponent(futureIso)}&order=starts_at.asc&limit=50`):[];
  const calendar=selectedOrgId?await rest<any[]>(actor,`calendar_events?select=id,organization_id,sport_id,title,event_type,starts_at,ends_at,timezone,location_facility_id,status,metadata&organization_id=eq.${encodeURIComponent(selectedOrgId)}&starts_at=gte.${encodeURIComponent(nowIso)}&starts_at=lte.${encodeURIComponent(futureIso)}&order=starts_at.asc&limit=150`):[];
  const facilities=await rest<any[]>(actor,'facilities?select=id,name,facility_type,capacity,timezone,status&order=name.asc&limit=100');
  const assets=selectedOrgId?await rest<any[]>(actor,`assets?select=id,organization_id,facility_id,asset_number,name,asset_type,manufacturer,model,status&organization_id=eq.${encodeURIComponent(selectedOrgId)}&limit=250`):[];
  const standards=await rest<any[]>(actor,'swim_time_standards?select=id,governing_body_id,course_code,event_code,age_low,age_high,gender,standard_name,standard_time_ms,effective_from,effective_to&limit=1000');
  const rankings=athleteIds.length?await rest<any[]>(actor,`athlete_rankings?select=id,athlete_id,sport_id,event_code,ranking_scope,rank,points,ranking_date,source_system,source_reference&athlete_id=in.(${csv(athleteIds)})&order=ranking_date.desc&limit=1000`):[];

  const staffAssignments=selectedTeamId?await rest<any[]>(actor,`staff_assignments?select=id,team_id,person_id,role_code,starts_on,ends_on,status&team_id=eq.${encodeURIComponent(selectedTeamId)}&status=eq.active&limit=100`):[];
  const staffPersonIds=uniq(staffAssignments.map(s=>s.person_id).filter(Boolean));
  const staffPeople=staffPersonIds.length?await rest<any[]>(actor,`people?select=id,first_name,preferred_name,last_name,email,status&id=in.(${csv(staffPersonIds)})&limit=100`):[];
  const staffMap=new Map(staffPeople.map(p=>[p.id,p]));
  const staff=staffAssignments.map(s=>{const p=staffMap.get(s.person_id);return{...s,name:p?[p.preferred_name||p.first_name,p.last_name].filter(Boolean).join(' '):'Staff member',email:p?.email||null};});
  const credentials=actor.personId?await rest<any[]>(actor,`credentials?select=id,person_id,credential_type,issuer,credential_number,issued_on,expires_on,status,verification_status,verified_at&person_id=eq.${encodeURIComponent(actor.personId)}&order=expires_on.asc.nullslast&limit=100`):[];
  const approvals=actor.personId?await rest<any[]>(actor,`approvals?select=id,entity_type,entity_id,requested_by,approver_person_id,approval_type,status,requested_at,decided_at,decision_note&approver_person_id=eq.${encodeURIComponent(actor.personId)}&status=in.(pending,PENDING,requested,REQUESTED)&order=requested_at.asc&limit=100`):[];
  const travel=selectedOrgId?await rest<any[]>(actor,`travel_plans?select=id,organization_id,name,starts_at,ends_at,status,destination_city,destination_region,destination_country&organization_id=eq.${encodeURIComponent(selectedOrgId)}&ends_at=gte.${encodeURIComponent(nowIso)}&order=starts_at.asc&limit=100`):[];
  const reports=await rest<any[]>(actor,'report_definitions?select=id,name,report_type,sensitivity,status&status=eq.active&limit=100');
  const expenses=actor.personId?await rest<any[]>(actor,`expenses?select=id,submitted_by,expense_date,amount,currency,category,status,receipt_document_id&submitted_by=eq.${encodeURIComponent(actor.personId)}&order=expense_date.desc&limit=100`):[];

  const coachFilter=actor.personId?`coach_person_id=eq.${encodeURIComponent(actor.personId)}`:'id=not.is.null';
  const methodologies=await rest<any[]>(actor,`coach_methodologies?select=*&${coachFilter}&order=updated_at.desc&limit=20`);
  const seasonPlans=await rest<any[]>(actor,`coach_season_plans?select=*&${coachFilter}&order=starts_on.desc&limit=50`);
  const seasonPlanIds=seasonPlans.map(p=>p.id);
  const cycles=seasonPlanIds.length?await rest<any[]>(actor,`coach_training_cycles?select=*&season_plan_id=in.(${csv(seasonPlanIds)})&order=starts_on.asc,sort_order.asc&limit=500`):[];
  const attention=await rest<any[]>(actor,`coach_attention_items?select=*&${coachFilter}&status=eq.open&order=due_at.asc.nullslast,created_at.desc&limit=100`);
  const proposals=await rest<any[]>(actor,`coach_agent_proposals?select=*&${coachFilter}&status=in.(proposed,prepared)&order=created_at.desc&limit=100`);
  const candidates=selectedOrgId?await rest<any[]>(actor,`coach_competition_candidates?select=*&organization_id=eq.${encodeURIComponent(selectedOrgId)}&validation_status=eq.candidate&order=starts_at.asc.nullslast&limit=100`):[];
  const notes=actor.personId?await rest<any[]>(actor,`coach_notes?select=id,athlete_id,team_id,competition_id,training_session_id,note_type,visibility,body,created_at,updated_at&coach_person_id=eq.${encodeURIComponent(actor.personId)}&order=created_at.desc&limit=100`):[];
  const community=await rest<any[]>(actor,'coach_community_resources?select=id,creator_person_id,organization_id,sport_id,resource_type,title,age_range,skill_level,objective,duration_minutes,equipment,provenance,visibility,status,published_at,created_at&status=eq.published&order=published_at.desc.nullslast&limit=50');

  const todayCalendar=calendar.filter(e=>String(e.starts_at||'').slice(0,10)===today),todayAttendance=attendance.filter(e=>e.session_date===today);
  const horizonCounts={now:0,soon:0,watch:0,fyi:0};for(const item of attention)if(item.horizon in horizonCounts)horizonCounts[item.horizon as keyof typeof horizonCounts]++;
  const attendanceSummary={present:0,absent:0,late:0,excused:0,other:0};for(const r of attendanceRecords){const k=String(r.status||'other').toLowerCase();if(k in attendanceSummary)(attendanceSummary as any)[k]++;else attendanceSummary.other++;}

  return NextResponse.json({generatedAt:new Date().toISOString(),source:'LS1Sports canonical data',mission:'Coach decides. ERP executes. Agents watch.',actor:{displayName:actor.displayName,personId:actor.personId,isSuperUser:actor.isSuperUser},scope:{selectedTeamId,selectedOrganizationId:selectedOrgId,teams,assignments},today:{calendar:todayCalendar,attendanceSessions:todayAttendance,attention:attention.filter(i=>i.horizon==='now'),approvals:approvals.slice(0,10)},attention:{items:attention,counts:horizonCounts},roster,training:{plans:trainingPlans,sessions,logs:trainingLogs,attendanceRecords,attendanceSummary},development:{plans:developmentPlans,goals:developmentGoals,assessments},performance:{results,rankings},competition:{upcoming:competitions,candidates,standardsAvailable:standards.length,rankingsAvailable:rankings.length},planning:{methodologies,seasonPlans,cycles},operations:{calendar,facilities,assets,staff,travel,approvals,credentials,expenses,reports},agents:{proposals},notes,community,dataHealth:{roster:roster.length,trainingPlans:trainingPlans.length,trainingSessions:sessions.length,trainingLogs:trainingLogs.length,developmentPlans:developmentPlans.length,goals:developmentGoals.length,results:results.length,upcomingCompetitions:competitions.length,standards:standards.length,rankings:rankings.length,attention:attention.length,agentProposals:proposals.length,competitionCandidates:candidates.length,staff:staff.length,travel:travel.length,credentials:credentials.length,approvals:approvals.length,assets:assets.length,reports:reports.length}}, {headers:{'Cache-Control':'no-store, max-age=0'}});
 }catch(error){const auth=authError(error);if(auth)return auth;return NextResponse.json({error:error instanceof Error?error.message:'Coach operating data unavailable.'},{status:500});}
}
