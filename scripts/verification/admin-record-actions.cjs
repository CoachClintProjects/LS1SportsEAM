// Controlled API permission tests, not signed-in UAT or persisted business data.
const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript'), assert = require('node:assert/strict');
class PersonRecordError extends Error { constructor(status,message){super(message);this.status=status} }
let permissions = new Set(), calls = [];
const base = {person:{id:'28d371d2-a41e-42dc-bc54-ea2659b3bcfa'},athlete:{id:'d73041c5-eb4e-4bd1-b173-d67f4c7ace85'}};
const rest = async (path,init) => {calls.push({path,init});return path.startsWith('rpc/') ? {ok:true} : []};
const moduleUnderTest = {exports:{}};
const code = ts.transpileModule(fs.readFileSync('app/api/admin-record-work/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
vm.runInNewContext(code,{module:moduleUnderTest,exports:moduleUnderTest.exports,Date,Set,require(name){
 if(name==='next/server') return {NextResponse:{json:(body,options={})=>({status:options.status||200,body})}};
 if(name.endsWith('/adminRecordAccess')) return {recordRest:rest,recordAccess:async()=>({ctx:{user:{id:null},person:null},tenant:'beb8f24e-fcd0-5dbe-ba1b-39c488ebaa4f',orgs:['c9032ebb-0507-5004-b1ad-0bca7cf3cc53'],base})};
 if(name.endsWith('/accessControl')) return {hasAdminContextPermission:(_ctx,_role,p)=>permissions.has(p)};
 if(name.endsWith('/adminPersonRecord')) return {PersonRecordError};
 throw new Error(name);
}});
const {POST,GET}=moduleUnderTest.exports;
async function post(b){calls=[];return POST({json:async()=>({personId:base.person.id,...b})})}
(async()=>{
 permissions=new Set(['record.update']);
 assert.equal((await post({role:'team_manager',kind:'relationship',operation:'athlete_inactivate',values:{reason:'Review'}})).status,403);assert.equal(calls.length,0);
 assert.equal((await post({role:'org_admin',kind:'relationship',operation:'team_remove',values:{}})).status,400);assert.equal(calls.length,0);
 permissions=new Set(['registrations.read','record.create']);
 assert.equal((await post({role:'registrar',kind:'registration',operation:'transition',values:{status:'approved'}})).status,403);assert.equal(calls.length,0);
 assert.equal((await post({role:'registrar',kind:'registration',operation:'create',values:{}})).status,200);assert.equal(calls[0].path,'rpc/admin_record_registration');
 assert.equal((await post({role:'registrar',kind:'registration',operation:'delete'})).status,400);assert.equal(calls.length,0);
 permissions=new Set(['admin_tasks.read']);calls=[];
 const result=await GET({nextUrl:{searchParams:new URLSearchParams({role:'team_manager',personId:base.person.id,section:'Activity & Tasks'})}});
 assert.equal(result.status,200);assert.equal(calls.length,1);assert.ok(calls[0].path.startsWith('work_items?'));assert.equal(result.body.authorization.documents,false);
 assert.equal((await post({role:'team_manager',kind:'task',operation:'complete',id:base.person.id})).status,403);assert.equal(calls.length,0);
 console.log('PASS: relationship/registration/task action permissions, required reasons, operation allowlist, and tab-specific query isolation.');
})().catch(e=>{console.error(e);process.exitCode=1});
