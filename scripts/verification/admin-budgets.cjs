// Controlled request-boundary checks; no persisted data and no UAT claim.
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
class PersonRecordError extends Error{constructor(status,message){super(message);this.status=status}}
let permissions=new Set(['finance.read','record.update','record.create']),calls=[],ctx={user:{id:'actor'},person:{id:'person',tenant_id:'tenant'},adminScope:{tenantId:'tenant',organizationId:'org'},roles:[],allowedHubs:['admin']};
const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/api/admin-budgets/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:m,exports:m.exports,Set,require(name){if(name==='next/server')return {NextResponse:{json:(body,o={})=>({body,status:o.status||200})}};if(name.endsWith('accessControl'))return {resolveAccess:async()=>ctx,canUseAdminRoleContext:()=>true,hasAdminContextPermission:(_,role,p)=>permissions.has(p)};if(name.endsWith('adminPersonRecord'))return {PersonRecordError};if(name.endsWith('adminGovernance'))return {governanceUuid:/^[0-9a-f-]{36}$/};if(name.endsWith('adminRecordAccess'))return {recordRest:async(path,init)=>{calls.push({path,init});return []}};throw new Error(name)}});
const id='00000000-0000-0000-0000-000000000003';
async function post(b){calls=[];return m.exports.POST({json:async()=>({role:'treasurer',id,operation:'transition',expectedVersion:1,values:{status:'approved'},reason:'Boundary check',...b})})}
(async()=>{
 for(const role of ['team_manager','registrar','competition_manager','volunteer_coordinator','communications_media','fundraising_coordinator']){assert.equal((await post({role})).status,403);assert.equal(calls.length,0)}
 assert.equal((await post({})).status,403);assert.equal(calls.length,0);
 assert.equal((await post({values:{status:'submitted'}})).status,200);assert.equal(calls[0].path,'rpc/admin_budget_write');const p=JSON.parse(calls[0].init.body);assert.equal(p.p_role,'treasurer');assert.equal(p.p_org,'org');assert.equal(p.p_tenant,'tenant');
 assert.equal((await post({operation:'save_line',expectedVersion:null})).status,400);assert.equal(calls.length,0);
 assert.equal((await post({operation:'create_account',values:{legal_entity_id:id}})).status,403);assert.equal(calls.length,0);
 assert.equal((await post({role:'org_admin'})).status,403);assert.equal(calls.length,0);
 permissions.add('workflow.execute');assert.equal((await post({role:'org_admin'})).status,200);
 assert.equal((await post({role:'org_admin',operation:'create_account',values:{legal_entity_id:id}})).status,200);assert.equal(calls[0].path,'rpc/admin_budget_account_create');
 permissions.delete('record.update');assert.equal((await post({operation:'save_line'})).status,403);assert.equal(calls.length,0);
 ctx=null;assert.equal((await post({})).status,401);assert.equal(calls.length,0);
 console.log('PASS: budget role isolation, Treasurer/Org Admin decision separation, account setup authority, mutation version and scope boundaries.');
})().catch(e=>{console.error(e);process.exitCode=1});
