import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();const failures=[];const read=p=>fs.readFileSync(path.join(root,p),'utf8');const exists=p=>fs.existsSync(path.join(root,p));const fail=m=>failures.push(m);
const files={bridge:'supabase/migrations/20260913053000_build_urws_competition_financial_bridge.sql',metrics:'supabase/migrations/20260913054000_extend_superuser_urws_governance_competition_metrics.sql',superUi:'components/hubs/superuser/SuperUserURWSCommand.tsx'};
for(const [k,p] of Object.entries(files))if(!exists(p))fail(`URWS competition ${k} missing: ${p}`);
if(exists(files.bridge)){
 const s=read(files.bridge);
 for(const x of['source_type text','source_id uuid','urws_financial_commitments_source_uidx','urws_sync_competition_entry_fee','competition_entry_fee','urws_competition_entry_fee_sync','competition.entry.exception.requested','urws_competition_scratch_event','v_urws_competition_financial_exposure'])if(!s.includes(x))fail(`URWS competition bridge invariant missing ${x}`);
 for(const x of["'fully_recoverable'","'partially_recoverable'","'non_recoverable'"])if(!s.includes(x))fail(`URWS recovery enum repair missing ${x}`);
 for(const forbidden of["when v_recovered>=v_amount and v_amount>0 then 'recovered' when v_recovered>0 then 'partial'","then 'unlikely'"])if(s.includes(forbidden))fail(`URWS recovery recompute contains invalid recoverability value: ${forbidden}`);
 if(!s.includes("exists(select 1 from public.platform_event_outbox e where e.event_type='competition.entry.exception.requested'"))fail('Competition scratch event emission must be deduplicated.');
 if(!s.includes("c.organization_id is null then return new"))fail('Competition scratch bridge must refuse events without organization scope.');
}
if(exists(files.metrics)){const s=read(files.metrics);for(const x of['pending_decision_second_approvals','ready_decision_proposals','open_competition_cases','competition_financial_commitments','competition_unrecovered_amount'])if(!s.includes(x))fail(`SuperUser URWS competition/governance metric missing ${x}`);}
if(exists(files.superUi)){const s=read(files.superUi);for(const x of['Second approvals pending','Open competition cases','Competition fee commitments','Competition unrecovered','zero means zero, not demo data'])if(!s.includes(x))fail(`SuperUser URWS competition/governance panel missing ${x}`);if(s.includes('mock')||s.includes('demoData'))fail('SuperUser URWS metrics must not use mock/demo data.');}
if(failures.length){console.error('\nURWS competition locks FAILED:\n');failures.forEach((m,i)=>console.error(`${i+1}. ${m}`));process.exit(1)}console.log('URWS competition bridge locks passed.');
