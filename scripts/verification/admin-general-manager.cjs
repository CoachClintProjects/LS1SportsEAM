// Scope and stale-write regression checks. No live business records are created.
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
function load(file,req){const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:m,exports:m.exports,require:req,Date,Set,Map,JSON,encodeURIComponent});return m.exports;}
const policy=load('lib/generalManagerPolicy.ts',()=>({}));
class PersonRecordError extends Error{constructor(status,message){super(message);this.status=status;}}
const id='00000000-0000-0000-0000-000000000001';let ctx,allowed=true,calls=[],rows=[];
const api=load('app/api/admin-general-manager/route.ts',n=>{
 if(n==='next/server')return {NextResponse:{json:(body,o={})=>({body,status:o.status||200})}};
 if(n.endsWith('generalManagerPolicy'))return policy;
 if(n.endsWith('adminPersonRecord'))return {PersonRecordError};
 if(n.endsWith('adminGovernance'))return {governanceUuid:/^[0-9a-f-]{36}$/};
 if(n.endsWith('accessControl'))return {resolveAccess:async()=>ctx,canUseAdminRoleContext:()=>allowed,hasAdminContextPermission:()=>allowed};
 if(n.endsWith('adminRecordAccess'))return {recordRest:async(path,init)=>{calls.push({path,init});return path.startsWith('rpc/')?{id}:rows;}};
 throw Error(n);
});
const post=async(extra={})=>{calls=[];return api.POST({json:async()=>({id,operation:'create',values:{kind:'incident',title:'Unit check'},reason:'Scoped verification',...extra})});};
(async()=>{
 ctx=null;assert.equal((await post()).status,401);assert.equal(calls.length,0);
 ctx={user:{id:'actor'},person:{id:'person',tenant_id:'tenant'},allowedHubs:['admin'],roles:[{code:'GENERAL_MANAGER',scope:{organization_id:'club'}}]};
 allowed=false;assert.equal((await post()).status,403);allowed=true;
 for(const operation of ['delete','settings','deactivate','assign']){assert.equal((await post({operation})).status,403);assert.equal(calls.length,0);}
 for(const kind of ['policy','bylaws']){assert.equal((await post({values:{kind}})).status,403);assert.equal(calls.length,0);}
 assert.equal((await post({org:'forged',tenant:'forged'})).status,200);let payload=JSON.parse(calls[0].init.body);assert.equal(payload.p_org,'club');assert.equal(payload.p_tenant,'tenant');assert.equal(payload.p_actor_user,'actor');
 ctx.roles[0].scope.team_id='restricted';assert.equal((await post()).status,403);assert.equal(calls.length,0);delete ctx.roles[0].scope.team_id;
 rows=[];assert.equal((await post({operation:'edit',expectedVersion:1})).status,404);assert.ok(calls[0].path.includes('organization_id=eq.club&kind=in.(incident,insurance)'));
 rows=[{id,kind:'incident',owner_person_id:'owner'}];assert.equal((await post({operation:'edit',expectedVersion:3,values:{title:'Updated',kind:'incident',owner_person_id:'forged'}})).status,200);payload=JSON.parse(calls.at(-1).init.body);assert.equal(payload.p_values.owner_person_id,'owner');
 assert.equal((await post({operation:'edit',expectedVersion:3,values:{kind:'policy'}})).status,403);
 assert.equal((await post({operation:'registrar_followup'})).status,200);payload=JSON.parse(calls.at(-1).init.body);assert.equal(payload.p_role,'registrar');assert.equal(payload.p_create.assigned_role,'registrar');assert.equal(payload.p_create.organization_id,'club');
 rows=[{id,status:'open',summary:'Changed',rule_reference:null,evidence:{},competition_id:'competition'}];assert.equal((await post({operation:'jury_signoff',expectedStatus:'open',expectedCase:{summary:'Old',rule_reference:null,evidence:{}},decision:'Recorded ruling'})).status,409);assert.ok(!calls.some(c=>c.init?.method==='PATCH'));
 const metrics=policy.programMetrics([{id:'p',name:'Program'}],[{id:'old',name:'Old',starts_on:'2024-01-01',ends_on:'2024-12-31'},{id:'new',name:'New',starts_on:'2025-01-01',ends_on:'2025-12-31'}],[{program_id:'p',season_id:'old',athlete_id:'a',status:'completed'},{program_id:'p',season_id:'new',athlete_id:'a',status:'approved'},{program_id:'p',season_id:'new',athlete_id:'a',status:'active'},{program_id:'p',season_id:'new',athlete_id:'b',status:'pending'}]);assert.equal(metrics[1].participants,1);assert.equal(metrics[1].retained,1);assert.equal(metrics[1].priorCount,1);assert.equal(metrics[1].pending,1);
 assert.equal(policy.currentMembership({status:'active',ends_on:'2020-01-01'},'2026-01-01'),false);
 console.log('PASS: GM authentication, club boundaries, protected operations, incident owner preservation, Registrar delegation, stale jury evidence, cohort deduplication and membership dates.');
})().catch(e=>{console.error(e);process.exitCode=1;});
