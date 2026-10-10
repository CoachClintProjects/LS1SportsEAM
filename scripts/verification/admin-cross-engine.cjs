// Isolated permission checks only; never creates club data.
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
class PersonRecordError extends Error{constructor(status,message){super(message);this.status=status;}}
let calls=[],allowed=true,workflow=true;
const id='00000000-0000-0000-0000-000000000001',m={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/api/admin-cross-engine/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:m,exports:m.exports,JSON,Array,encodeURIComponent,require(n){
 if(n==='next/server')return {NextResponse:{json:(body,o={})=>({body,status:o.status||200})}};
 if(n.endsWith('adminPersonRecord'))return {PersonRecordError};
 if(n.endsWith('adminGovernance'))return {governanceUuid:/^[0-9a-f-]{36}$/i};
 if(n.endsWith('accessControl'))return {hasAdminContextPermission:()=>workflow};
 if(n.endsWith('adminFinanceScope'))return {financeScope:async(_,role)=>{if(!allowed||!['org_admin','treasurer'].includes(role))throw new PersonRecordError(403,'Denied');return {ctx:{user:{id:'actor'},person:{id:'person'}},tenant:'tenant',org:'club'}}};
 if(n.endsWith('adminRecordAccess'))return {recordRest:async(path,init)=>{calls.push({path,init});return {saved:true}}};throw new Error(n);
}});
const post=async(extra={})=>{calls=[];return m.exports.POST({json:async()=>({role:'org_admin',operation:'transfer',requestId:id,values:{president_override:true},reason:'Authorized club decision',...extra})})};
(async()=>{
 for(const extra of [{role:'team_manager'},{role:'treasurer'},{role:'treasurer',operation:'settings'},{role:'treasurer',operation:'cover_fee'}]){assert.equal((await post(extra)).status,403);assert.equal(calls.length,0)}
 allowed=false;assert.equal((await post()).status,403);allowed=true;
 workflow=false;assert.equal((await post()).status,403);workflow=true;
 for(const extra of [{operation:'delete'},{reason:'no'},{requestId:'invalid'},{values:[]}]){assert.equal((await post(extra)).status,400);assert.equal(calls.length,0)}
 assert.equal((await post({tenant:'forged',org:'forged',actor:'forged'})).status,200);
 const p=JSON.parse(calls[0].init.body);assert.equal(p.p_tenant,'tenant');assert.equal(p.p_org,'club');assert.equal(p.p_actor_user,'actor');assert.equal(p.p_actor_person,'person');
 for(const operation of ['deposit','approve_credit'])assert.equal((await post({role:'treasurer',operation})).status,200);
 for(const operation of ['settings','squad_settings','preview_transfer','cash','cover_fee','deactivate','reverse_fee']){assert.equal((await post({operation})).status,200);assert.equal(JSON.parse(calls[0].init.body).p_operation,operation)}
 console.log('PASS: cross-engine role boundaries, invalid input, actor/club binding and operation routing. No live business records created.');
})().catch(e=>{console.error(e);process.exitCode=1});
