// Controlled server-boundary and decimal tests. No live financial records are created.
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
class PersonRecordError extends Error{constructor(status,message){super(message);this.status=status}}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const id='00000000-0000-0000-0000-000000000001';
let permissions=new Set(['finance.read','record.create','record.update','workflow.execute']),calls=[],contextAllowed=true;
const ctx={user:{id:'verified-actor'},person:{id:'verified-person'}};
function moduleAt(path,require){const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:m,exports:m.exports,require,BigInt,Date,Set,Number,JSON,Object,encodeURIComponent,URLSearchParams});return m.exports}
const api=moduleAt('app/api/admin-ledger/route.ts',n=>n==='next/server'?{NextResponse:{json:(body,o={})=>({body,status:o.status||200})}}:n.endsWith('adminFinanceScope')?{financeScope:async(req,role,permission)=>{if(!contextAllowed||!['org_admin','treasurer'].includes(role)||!permissions.has('finance.read')||(permission&&!permissions.has(permission)))throw new PersonRecordError(403,'Denied');return {ctx,tenant:'verified-tenant',org:'verified-org'}}}:n.endsWith('accessControl')?{hasAdminContextPermission:(_,__,p)=>permissions.has(p)}:n.endsWith('adminPersonRecord')?{PersonRecordError}:n.endsWith('adminGovernance')?{governanceUuid:uuid}:{recordRest:async(path,init)=>{calls.push({path,init});if(path.startsWith('rpc/'))return {id};if(path.startsWith('legal_entities?'))return [{id,legal_name:'Boundary entity',base_currency:'CAD'}];if(path.startsWith('gl_journals?')&&!path.includes('&id=eq.'))return Array.from({length:26},(_,i)=>({id:String(i)}));return []}});
const post=async(extra={})=>{calls=[];return api.POST({json:async()=>({role:'treasurer',operation:'post',id,expectedVersion:1,values:{},reason:'Reviewed entry',...extra})})};
(async()=>{
 assert.equal((await post({role:'team_manager'})).status,403);assert.equal(calls.length,0);
 permissions.delete('workflow.execute');assert.equal((await post()).status,403);assert.equal(calls.length,0);permissions.add('workflow.execute');
 permissions.delete('record.update');assert.equal((await post()).status,403);assert.equal(calls.length,0);permissions.add('record.update');
 assert.equal((await post({expectedVersion:null})).status,400);assert.equal(calls.length,0);
 assert.equal((await post({operation:'ledger',entity:id})).status,403);assert.equal(calls.length,0);
 assert.equal((await post({operation:'period',values:{status:'closed'}})).status,403);assert.equal(calls.length,0);
 assert.equal((await post({operation:'period',values:{status:'review'}})).status,200);assert.equal(calls[0].path,'rpc/admin_ledger_period');
 assert.equal((await post({operation:'period',role:'org_admin',values:{status:'closed'}})).status,200);
 assert.equal((await post({tenant:'forged',org:'forged',actor:'forged'})).status,200);const b=JSON.parse(calls[0].init.body);assert.equal(b.p_tenant,'verified-tenant');assert.equal(b.p_org,'verified-org');assert.equal(b.p_actor_user,'verified-actor');
 calls=[];let list=await api.GET({nextUrl:{searchParams:new URLSearchParams({role:'treasurer',page:'2',sort:'malicious',direction:'invalid'})}});assert.equal(list.status,200);assert.equal(list.body.journals.length,25);assert.equal(list.body.hasMore,true);assert.ok(calls.some(c=>c.path.includes('offset=50&limit=26')));assert.ok(calls.some(c=>c.path.includes('order=journal_date.desc')));
 calls=[];assert.equal((await api.GET({nextUrl:{searchParams:new URLSearchParams({role:'treasurer',entity:'outside'})}})).status,404);assert.equal(calls.length,1);
 const m=moduleAt('lib/client/ledgerAmounts.ts',()=>{});assert.equal(m.decimal(m.cents('0.1')+m.cents('0.2')),'0.30');assert.equal(m.decimal(m.cents('999999999999.99')+m.cents('0.01')),'1000000000000.00');assert.equal(m.decimal(m.cents('-0.01')),'-0.01');assert.throws(()=>m.cents('1.001'));assert.throws(()=>m.cents('NaN'));assert.equal(m.ledgerCsv([['=HYPERLINK("bad")','-12.30','a,b']]),'"\'=HYPERLINK(""bad"")","-12.30","a,b"');
 console.log('PASS: ledger authority, executive period decisions, tenant binding, stale-input validation, pagination, exact decimal sums and CSV escaping.');
})().catch(e=>{console.error(e);process.exitCode=1});
