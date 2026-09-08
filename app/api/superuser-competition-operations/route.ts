import { NextRequest, NextResponse } from 'next/server';
import { requireSuperUser, SuperUserAuthError } from '@/lib/server/requireSuperUser';
import { writeAuditEvent } from '@/lib/server/writeAuditEvent';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
export const dynamic = 'force-dynamic';
export const revalidate = 0;
type Row = Record<string, unknown>;

function headers() {
  if (!KEY) throw new Error('Supabase service credentials are not configured.');
  return { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' };
}
async function rest(path: string, init: RequestInit = {}) {
  if (!URL || !KEY) throw new Error('Supabase service credentials are not configured.');
  const response = await fetch(`${URL}/rest/v1/${path}`, { ...init, headers: { ...headers(), ...(init.headers || {}) }, cache: 'no-store' });
  const text = await response.text();
  if (!response.ok) throw new Error(`Supabase ${path} returned ${response.status}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : null;
}
function req(value: unknown, label: string, max = 240) { const s = String(value || '').trim(); if (!s) throw new Error(`${label} is required.`); if (s.length > max) throw new Error(`${label} is too long.`); return s; }
function opt(value: unknown, max = 2000) { const s = String(value || '').trim(); if (!s) return null; if (s.length > max) throw new Error('Value is too long.'); return s; }
function json(value: unknown, label: string, fallback: unknown = {}) { if (value === undefined || value === null || value === '') return fallback; if (typeof value === 'object') return value; try { return JSON.parse(String(value)); } catch { throw new Error(`${label} must be valid JSON.`); } }
function num(value: unknown, label: string) { const n = Number(value); if (!Number.isFinite(n)) throw new Error(`${label} must be numeric.`); return n; }
async function one(table: string, id: string) { return (await rest(`${table}?id=eq.${encodeURIComponent(id)}&select=*&limit=1`))?.[0] || null; }
async function tenantId() { return (await rest('tenants?select=id&limit=1'))?.[0]?.id || null; }
async function audit(actor: Awaited<ReturnType<typeof requireSuperUser>>, tenant: string | null, action: string, table: string, id: string | null, before: unknown, after: unknown, reason: string) {
  await writeAuditEvent(actor, { action, entityType: table, entityId: id, tenantId: tenant, beforeData: before ?? null, afterData: after ?? null, reason });
}
async function assertCanonicalResult(resultId: string) {
  const result = await one('competition_results', resultId);
  if (!result) throw new Error('Competition result not found.');
  if (!result.canonical || String(result.status || '').toLowerCase() !== 'official' || !['validated','verified'].includes(String(result.validation_status || '').toLowerCase())) {
    throw new Error('This operation requires an official canonical LS1Sports result that has passed validation.');
  }
  return result;
}
async function assertVerificationApproved(competitionId: string) {
  const recs = await rest(`competition_reconciliations?competition_id=eq.${encodeURIComponent(competitionId)}&select=id,status`);
  for (const rec of recs || []) {
    if (String(rec.status || '').toLowerCase() !== 'approved') throw new Error('Competition verification reconciliation remains unapproved.');
    const open = await rest(`competition_reconciliation_items?reconciliation_id=eq.${encodeURIComponent(rec.id)}&resolution_status=neq.resolved&select=id&limit=1`);
    if (open?.length) throw new Error('Competition verification still contains unresolved differences.');
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireSuperUser(request);
    if (!actor.canManagePlatformSettings) throw new SuperUserAuthError('Platform-management permission required.', 403);
    const body = await request.json() as Row;
    const action = String(body.action || '');
    const tenant = await tenantId();

    if (action === 'create-official-requirement') {
      const item = (await rest('competition_official_requirements', { method: 'POST', body: JSON.stringify({ competition_id: req(body.competition_id,'Competition ID',80), session_id: body.session_id || null, role_code: req(body.role_code,'Role code',80), required_count: Math.max(1, Number(body.required_count || 1)), credential_requirements: json(body.credential_requirements,'Credential requirements',{}), ruleset_id: body.ruleset_id || null, active: true }) }))?.[0];
      await audit(actor,tenant,'OFFICIAL_REQUIREMENT_CREATED','competition_official_requirements',item?.id||null,null,item||body,'Super User defined competition official requirement');
      return NextResponse.json(item);
    }

    if (action === 'assign-official') {
      const item = (await rest('competition_official_assignments', { method: 'POST', body: JSON.stringify({ competition_id: req(body.competition_id,'Competition ID',80), session_id: body.session_id || null, requirement_id: body.requirement_id || null, person_id: req(body.person_id,'Official person ID',80), role_code: req(body.role_code,'Role code',80), status: 'assigned', credential_snapshot: json(body.credential_snapshot,'Credential snapshot',{}) }) }))?.[0];
      await audit(actor,tenant,'OFFICIAL_ASSIGNED','competition_official_assignments',item?.id||null,null,item||body,'Super User assigned competition official with credential snapshot');
      return NextResponse.json(item);
    }

    if (action === 'set-official-duty-status') {
      const id = req(body.id,'Official assignment ID',80), before = await one('competition_official_assignments',id);
      if (!before) return NextResponse.json({error:'Official assignment not found.'},{status:404});
      const status = req(body.status,'Duty status',40).toLowerCase();
      if (!['assigned','checked_in','checked_out','cancelled'].includes(status)) throw new Error('Official duty status must be assigned, checked_in, checked_out, or cancelled.');
      const patch: Row = { status };
      if (status === 'checked_in') patch.check_in_at = new Date().toISOString();
      if (status === 'checked_out') patch.check_out_at = new Date().toISOString();
      const after = (await rest(`competition_official_assignments?id=eq.${encodeURIComponent(id)}`, { method:'PATCH', body: JSON.stringify(patch) }))?.[0];
      await audit(actor,tenant,'OFFICIAL_DUTY_STATUS_CHANGED','competition_official_assignments',id,before,after,'Super User changed official duty lifecycle');
      return NextResponse.json(after);
    }

    if (action === 'create-timing-session') {
      const item = (await rest('competition_timing_sessions', { method:'POST', body: JSON.stringify({ competition_id:req(body.competition_id,'Competition ID',80), session_id:body.session_id||null, timing_system_id:body.timing_system_id||null, source_system_id:body.source_system_id||null, external_session_key:opt(body.external_session_key,160), status:'initialized', configuration:json(body.configuration,'Timing configuration',{}) }) }))?.[0];
      await audit(actor,tenant,'TIMING_SESSION_CREATED','competition_timing_sessions',item?.id||null,null,item||body,'Super User initialized competition timing session');
      return NextResponse.json(item);
    }

    if (action === 'set-timing-session-status') {
      const id=req(body.id,'Timing session ID',80),before=await one('competition_timing_sessions',id); if(!before)return NextResponse.json({error:'Timing session not found.'},{status:404});
      const status=req(body.status,'Timing session status',40).toLowerCase(); if(!['initialized','open','closed','failed'].includes(status))throw new Error('Timing session status must be initialized, open, closed, or failed.');
      const patch:Row={status}; if(status==='open')patch.opened_at=new Date().toISOString(); if(status==='closed')patch.closed_at=new Date().toISOString();
      const after=(await rest(`competition_timing_sessions?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify(patch)}))?.[0];
      await audit(actor,tenant,'TIMING_SESSION_STATUS_CHANGED','competition_timing_sessions',id,before,after,'Super User changed timing-session lifecycle'); return NextResponse.json(after);
    }

    if (action === 'record-timing-message') {
      const timingSession=await one('competition_timing_sessions',req(body.timing_session_id,'Timing session ID',80)); if(!timingSession) return NextResponse.json({error:'Timing session not found.'},{status:404});
      if(String(timingSession.status).toLowerCase()!=='open') throw new Error('Timing messages may only be recorded while the timing session is open.');
      const item=(await rest('competition_timing_messages',{method:'POST',body:JSON.stringify({timing_session_id:timingSession.id,event_id:body.event_id||null,heat_no:body.heat_no?Number(body.heat_no):null,lane_no:body.lane_no?Number(body.lane_no):null,message_type:req(body.message_type,'Message type',80),source_record_key:opt(body.source_record_key,160),raw_payload:json(body.raw_payload,'Raw timing payload',{}),normalized_payload:json(body.normalized_payload,'Normalized timing payload',null),validation_status:req(body.validation_status||'pending','Validation status',40),processed_at:body.processed_at||null})}))?.[0];
      await audit(actor,tenant,'TIMING_MESSAGE_RECORDED','competition_timing_messages',item?.id||null,null,item||body,'Timing evidence captured with raw and normalized payload lineage'); return NextResponse.json(item);
    }

    if (action === 'create-scoring-rule') {
      const item=(await rest('competition_scoring_rules',{method:'POST',body:JSON.stringify({ruleset_id:req(body.ruleset_id,'Ruleset ID',80),scoring_code:req(body.scoring_code,'Scoring code',80),name:req(body.name,'Scoring rule name'),applies_to:opt(body.applies_to,80),configuration:json(body.configuration,'Scoring configuration',{}),priority:Number(body.priority||100),active:true})}))?.[0];
      await audit(actor,tenant,'SCORING_RULE_CREATED','competition_scoring_rules',item?.id||null,null,item||body,'Super User created competition scoring rule'); return NextResponse.json(item);
    }

    if (action === 'create-score-snapshot') {
      const competitionId=req(body.competition_id,'Competition ID',80); const scores=json(body.scores,'Scores',{});
      const item=(await rest('competition_score_snapshots',{method:'POST',body:JSON.stringify({competition_id:competitionId,session_id:body.session_id||null,snapshot_no:Number(body.snapshot_no||1),scoring_rule_id:body.scoring_rule_id||null,scope_type:req(body.scope_type||'competition','Scope type',80),scores,canonical:false})}))?.[0];
      await audit(actor,tenant,'SCORE_SNAPSHOT_CREATED','competition_score_snapshots',item?.id||null,null,item||body,'LS1Sports score snapshot recorded as non-canonical evidence'); return NextResponse.json(item);
    }

    if (action === 'promote-score-snapshot') {
      const id=req(body.id,'Score snapshot ID',80),before=await one('competition_score_snapshots',id); if(!before)return NextResponse.json({error:'Score snapshot not found.'},{status:404});
      await assertVerificationApproved(String(before.competition_id));
      await rest(`competition_score_snapshots?competition_id=eq.${encodeURIComponent(String(before.competition_id))}&canonical=eq.true`,{method:'PATCH',body:JSON.stringify({canonical:false})});
      const after=(await rest(`competition_score_snapshots?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify({canonical:true})}))?.[0];
      await audit(actor,tenant,'SCORE_SNAPSHOT_CANONICALIZED','competition_score_snapshots',id,before,after,'Score snapshot promoted only after verification gates'); return NextResponse.json(after);
    }

    if (action === 'record-advancement-decision') {
      const item=(await rest('competition_advancement_decisions',{method:'POST',body:JSON.stringify({competition_id:req(body.competition_id,'Competition ID',80),competition_event_id:body.competition_event_id||null,source_round_id:body.source_round_id||null,target_round_id:body.target_round_id||null,athlete_id:body.athlete_id||null,team_id:body.team_id||null,entry_id:body.entry_id||null,decision:req(body.decision,'Advancement decision',80),rank:body.rank?Number(body.rank):null,qualification_basis:opt(body.qualification_basis,300),evidence:json(body.evidence,'Advancement evidence',{}),decided_by:actor.personId})}))?.[0];
      await audit(actor,tenant,'ADVANCEMENT_DECISION_RECORDED','competition_advancement_decisions',item?.id||null,null,item||body,'LS1Sports advancement decision recorded with evidence'); return NextResponse.json(item);
    }

    if (action === 'create-record-book') {
      const item=(await rest('competition_record_books',{method:'POST',body:JSON.stringify({tenant_id:tenant,organization_id:body.organization_id||null,sport_id:body.sport_id||null,code:req(body.code,'Record book code',80),name:req(body.name,'Record book name'),scope_type:req(body.scope_type,'Scope type',80),governing_body_id:body.governing_body_id||null,configuration:json(body.configuration,'Record-book configuration',{}),active:true})}))?.[0];
      await audit(actor,tenant,'RECORD_BOOK_CREATED','competition_record_books',item?.id||null,null,item||body,'Super User created competition record book'); return NextResponse.json(item);
    }

    if (action === 'create-record-claim') {
      const competitionId=req(body.competition_id,'Competition ID',80),resultId=req(body.competition_result_id,'Competition result ID',80); const result=await assertCanonicalResult(resultId); await assertVerificationApproved(competitionId);
      const item=(await rest('competition_record_claims',{method:'POST',body:JSON.stringify({competition_id:competitionId,competition_result_id:resultId,record_type:req(body.record_type,'Record type',80),record_scope:opt(body.record_scope,100),record_code:opt(body.record_code,100),prior_value:body.prior_value===''||body.prior_value===undefined?null:num(body.prior_value,'Prior value'),new_value:body.new_value===''||body.new_value===undefined?result.result_value:num(body.new_value,'New value'),unit:opt(body.unit,40)||result.result_unit||null,status:'candidate',evidence:json(body.evidence,'Record evidence',{canonical_result_id:resultId})})}))?.[0];
      await audit(actor,tenant,'RECORD_CLAIM_CREATED','competition_record_claims',item?.id||null,null,item||body,'Record claim created only from canonical validated LS1Sports result'); return NextResponse.json(item);
    }

    if (action === 'verify-record-claim') {
      const id=req(body.id,'Record claim ID',80),claim=await one('competition_record_claims',id); if(!claim)return NextResponse.json({error:'Record claim not found.'},{status:404});
      const result=await assertCanonicalResult(String(claim.competition_result_id)); await assertVerificationApproved(String(claim.competition_id));
      const verified=(await rest(`competition_record_claims?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify({status:'verified',verified_by:actor.personId,verified_at:new Date().toISOString()})}))?.[0];
      const record=(await rest('competition_records',{method:'POST',body:JSON.stringify({record_book_id:req(body.record_book_id,'Record book ID',80),event_definition_id:body.event_definition_id||null,athlete_id:result.athlete_id||null,team_id:result.team_id||null,result_id:result.id,record_value:claim.new_value??result.result_value??null,record_unit:claim.unit||result.result_unit||null,course_code:opt(body.course_code,80),effective_from:body.effective_from||new Date().toISOString().slice(0,10),effective_to:null,status:'official',evidence:{claim_id:id,verification:claim.evidence||{}}})}))?.[0];
      await audit(actor,tenant,'RECORD_CLAIM_VERIFIED','competition_record_claims',id,claim,{claim:verified,record},'Record claim verified and official record created from canonical result'); return NextResponse.json({claim:verified,record});
    }

    if (action === 'create-award-program') {
      const item=(await rest('competition_award_programs',{method:'POST',body:JSON.stringify({competition_id:req(body.competition_id,'Competition ID',80),code:req(body.code,'Award program code',80),name:req(body.name,'Award program name'),award_type:req(body.award_type,'Award type',80),rule_definition:json(body.rule_definition,'Award rules',{}),active:true})}))?.[0];
      await audit(actor,tenant,'AWARD_PROGRAM_CREATED','competition_award_programs',item?.id||null,null,item||body,'Super User created competition award program'); return NextResponse.json(item);
    }

    if (action === 'create-award') {
      const competitionId=req(body.competition_id,'Competition ID',80); if(body.competition_result_id)await assertCanonicalResult(String(body.competition_result_id)); await assertVerificationApproved(competitionId);
      const item=(await rest('competition_awards',{method:'POST',body:JSON.stringify({competition_id:competitionId,competition_event_id:body.competition_event_id||null,competition_result_id:body.competition_result_id||null,athlete_id:body.athlete_id||null,team_id:body.team_id||null,award_code:req(body.award_code,'Award code',80),award_name:req(body.award_name,'Award name'),place:body.place?Number(body.place):null,status:'provisional',metadata:json(body.metadata,'Award metadata',{})})}))?.[0];
      await audit(actor,tenant,'COMPETITION_AWARD_CREATED','competition_awards',item?.id||null,null,item||body,'Competition award created from verified LS1Sports evidence'); return NextResponse.json(item);
    }

    if (action === 'finalize-award') {
      const id=req(body.id,'Award ID',80),before=await one('competition_awards',id); if(!before)return NextResponse.json({error:'Award not found.'},{status:404}); if(before.competition_result_id)await assertCanonicalResult(String(before.competition_result_id)); await assertVerificationApproved(String(before.competition_id));
      const after=(await rest(`competition_awards?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify({status:'official',awarded_at:new Date().toISOString()})}))?.[0];
      await audit(actor,tenant,'COMPETITION_AWARD_FINALIZED','competition_awards',id,before,after,'Competition award finalized only after canonical/verification gates'); return NextResponse.json(after);
    }

    return NextResponse.json({error:'Unsupported competition operations action.'},{status:400});
  } catch (error) {
    if (error instanceof SuperUserAuthError) return NextResponse.json({error:error.message},{status:error.status});
    return NextResponse.json({error:error instanceof Error?error.message:'Competition operations action failed.'},{status:400});
  }
}
