// Controlled boundary tests; no club or financial records are created.
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
class PersonRecordError extends Error{constructor(status,message){super(message);this.status=status;}}
const id='00000000-0000-0000-0000-000000000001';
let calls=[],allowed=true,permissions=new Set(['record.read','record.update','record.create','workflow.execute','waivers.read','waivers.update','finance.read']);
const ctx={user:{id:'signed-in-user'},person:{id:'signed-in-person'}};
const m={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/api/admin-executive-actions/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:m,exports:m.exports,Date,Number,JSON,Array,encodeURIComponent,require(n){
 if(n==='next/server')return {NextResponse:{json:(body,o={})=>({body,status:o.status||200})}};
 if(n.endsWith('adminPersonRecord'))return {PersonRecordError};
 if(n.endsWith('accessControl'))return {hasAdminContextPermission:(_,__,p)=>permissions.has(p)};
 if(n.endsWith('adminGovernance'))return {governanceUuid:/^[0-9a-f-]{36}$/i,governanceScope:async(req,role,p='record.read')=>{if(!allowed||role!=='org_admin'||!permissions.has(p))throw new PersonRecordError(403,'Denied');return {ctx,tenant:'real-tenant',org:'real-club'};}};
 if(n.endsWith('adminRecordAccess'))return {recordRest:async(path,init)=>{calls.push({path,init});if(path.startsWith('rpc/'))return {id};if(path.startsWith('waiver_assignments?'))return Array.from({length:26},(_,i)=>({id:String(i)}));if(path.startsWith('payment_methods?'))return [{code:'CASH'}];return [];}};
 throw new Error(n);
}});
const post=async(extra={})=>{calls=[];return m.exports.POST({json:async()=>({kind:'waiver',role:'org_admin',requestId:id,id,operation:'waive',expectedUpdatedAt:'2026-10-06T00:00:00Z',reason:'Club approved exception',...extra})});};
(async()=>{
 for(const extra of [{role:'registrar'},{role:'treasurer'}]){assert.equal((await post(extra)).status,403);assert.equal(calls.length,0);}
 allowed=false;assert.equal((await post()).status,403);assert.equal(calls.length,0);allowed=true;
 permissions.delete('workflow.execute');assert.equal((await post()).status,403);assert.equal(calls.length,0);permissions.add('workflow.execute');
 for(const extra of [{reason:'no'},{requestId:'bad'},{operation:'delete'},{expectedUpdatedAt:'bad'}]){assert.equal((await post(extra)).status,400);assert.equal(calls.length,0);}
 assert.equal((await post({tenant:'forged',org:'forged',actor:'forged'})).status,200);
 let payload=JSON.parse(calls[0].init.body);assert.equal(payload.p_tenant,'real-tenant');assert.equal(payload.p_org,'real-club');assert.equal(payload.p_actor_user,'signed-in-user');assert.equal(payload.p_actor_person,'signed-in-person');
 assert.equal((await post({kind:'cash',amount:0})).status,400);assert.equal(calls.length,0);
 assert.equal((await post({kind:'cash',amount:12.5,method:'CASH'})).status,200);assert.equal(calls[1].path,'rpc/admin_club_cash_receipt');
 for(const kind of ['cover_entry_fee','release_escrow','reverse']){assert.equal((await post({kind,values:{date:'2026-10-06'}})).status,200);assert.equal(calls[0].path,'rpc/admin_club_finance_action');assert.equal(JSON.parse(calls[0].init.body).p_operation,kind);}
 calls=[];const page=await m.exports.GET({nextUrl:{searchParams:new URLSearchParams({page:'2'})}});assert.equal(page.status,200);assert.equal(page.body.rows.length,25);assert.equal(page.body.hasMore,true);assert.ok(calls[0].path.includes('organization_id=eq.real-club'));assert.ok(calls[0].path.includes('offset=50&limit=26'));assert.ok(calls.at(-1).path.includes('organization_id.eq.real-club'));
 calls=[];assert.equal((await m.exports.GET({nextUrl:{searchParams:new URLSearchParams({page:'-1'})}})).status,400);assert.equal(calls.length,0);
 console.log('PASS: club action permissions, actor and club binding, invalid input rejection, RPC routing, scoped history and 25-record pagination. No business records created.');
})().catch(e=>{console.error(e);process.exitCode=1;});
