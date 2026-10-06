// Controlled request-boundary tests only. No live policy or financial data is written.
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
class PersonRecordError extends Error{constructor(status,message){super(message);this.status=status}}
const id='00000000-0000-0000-0000-000000000001',uuid=/^[0-9a-f-]{36}$/i;
let calls=[],permissions=new Set(['record.update','workflow.execute']);const ctx={user:{id:'verified-actor'},person:{id:'verified-person'}},m={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/api/admin-payable-authority/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:m,exports:m.exports,JSON,Number,require:n=>n==='next/server'?{NextResponse:{json:(body,o={})=>({body,status:o.status||200})}}:n.endsWith('adminFinanceScope')?{financeScope:async(_,role,permission)=>{if(!['org_admin','treasurer'].includes(role)||permission&&!permissions.has(permission))throw new PersonRecordError(403,'Denied');return{ctx,tenant:'verified-tenant',org:'verified-org'}}}:n.endsWith('accessControl')?{hasAdminContextPermission:(_,__,p)=>permissions.has(p)}:n.endsWith('adminPersonRecord')?{PersonRecordError}:n.endsWith('adminGovernance')?{governanceUuid:uuid}:{recordRest:async(path,init)=>{calls.push({path,init});return path.startsWith('rpc/')?{version:2}:[]}}});
const post=async(extra={})=>{calls=[];return m.exports.POST({json:async()=>({role:'org_admin',entityId:id,expectedVersion:1,threshold:'1000.00',reason:'Approved spending policy',...extra})})};
(async()=>{
 for(const role of ['treasurer','team_manager','registrar']){assert.equal((await post({role})).status,403);assert.equal(calls.length,0);}
 permissions.delete('workflow.execute');assert.equal((await post()).status,403);assert.equal(calls.length,0);permissions.add('workflow.execute');
 for(const threshold of ['-1','NaN','Infinity','1.001','1e3','',1000]){assert.equal((await post({threshold})).status,400);assert.equal(calls.length,0);}
 for(const expectedVersion of [null,-1,1.5,'1'])assert.equal((await post({expectedVersion})).status,400);
 assert.equal((await post({threshold:'0',tenant:'forged',org:'forged',actor:'forged'})).status,200);assert.equal(calls.length,1);const b=JSON.parse(calls[0].init.body);assert.equal(b.p_actor_user,'verified-actor');assert.equal(b.p_tenant,'verified-tenant');assert.equal(b.p_org,'verified-org');assert.equal(b.p_threshold,'0');
 const r=await m.exports.GET({nextUrl:{searchParams:new URLSearchParams({role:'treasurer'})}});assert.equal(r.status,200);assert.equal(r.body.canEdit,false);
 console.log('PASS: executive-only policy writes, server-bound actor and scope, monetary and version validation; no live records created.');
})().catch(e=>{console.error(e);process.exitCode=1});
