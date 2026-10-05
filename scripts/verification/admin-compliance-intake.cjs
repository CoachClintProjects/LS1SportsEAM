// Controlled boundary checks. No persisted business records or UAT certification.
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
class PersonRecordError extends Error{constructor(status,message){super(message);this.status=status}}
const id='00000000-0000-0000-0000-000000000001',person='00000000-0000-0000-0000-000000000002';
let permissions=new Set(['record.read','record.create','waivers.read']),calls=[],ctx={allowedHubs:['admin'],user:{id:'actor'},person:{id:'reviewer',tenant_id:'tenant'},adminScope:{tenantId:'tenant',organizationId:'org'},roles:[]};
const m={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/api/admin-compliance/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:m.exports,module:m,Set,Number,JSON,Object,encodeURIComponent,require:n=>n==='next/server'?{NextResponse:{json:(body,o={})=>({body,status:o.status||200})}}:n.endsWith('adminPersonRecord')?{PersonRecordError}:n.endsWith('adminDocumentPolicy')?{documentTypeFilter:role=>role==='registrar'?'&document_types.code=in.(IDENTITY,REGISTRATION,SAFE_SPORT,BACKGROUND_CHECK,WAIVER,MEDIA_RELEASE)':''}:n.endsWith('adminRecordAccess')?{recordRest:async(path,init)=>{calls.push({path,init});if(path==='rpc/admin_compliance_evidence_list')return Array.from({length:26},(_,i)=>({id:String(i),total_count:26}));return []}}:{resolveAccess:async()=>ctx,canUseAdminRoleContext:()=>true,hasAdminContextPermission:(_,__,p)=>permissions.has(p)}});
const post=async extra=>{calls=[];return m.exports.POST({json:async()=>({role:'org_admin',domain:'credentials',id,personId:person,values:{credential_type:'Controlled boundary input'},reason:'Boundary test only',...extra})})};
const get=async query=>{calls=[];return m.exports.GET({nextUrl:{searchParams:new URLSearchParams(query)}})};
(async()=>{
 assert.equal((await post({role:'team_manager'})).status,403);assert.equal(calls.length,0);
 permissions.delete('record.create');assert.equal((await post({})).status,403);assert.equal(calls.length,0);permissions.add('record.create');
 assert.equal((await post({reason:''})).status,400);assert.equal(calls.length,0);
 assert.equal((await post({domain:'people'})).status,400);assert.equal(calls.length,0);
 assert.equal((await post({})).status,200);assert.equal(calls.length,1);const b=JSON.parse(calls[0].init.body);assert.equal(b.p_tenant,'tenant');assert.equal(b.p_org,'org');assert.equal(b.p_actor_user,'actor');assert.equal(b.p_person,person);
 assert.equal((await post({role:'registrar',values:{document_id:id}})).status,403);assert.equal(calls.length,1);assert.ok(calls[0].path.includes('document_types.code=in.'));
 assert.equal((await get({mode:'list',page:'-1'})).status,400);assert.equal(calls.length,0);
 const list=await get({mode:'list',page:'2',q:'search'});assert.equal(list.status,200);assert.equal(list.body.rows.length,25);assert.equal(list.body.hasMore,true);assert.equal(JSON.parse(calls[0].init.body).p_page,2);
 assert.equal((await get({personId:person})).status,404);assert.equal(calls.length,1);
 ctx=null;assert.equal((await get({})).status,401);assert.equal(calls.length,0);
 console.log('PASS: evidence intake authority, document restrictions, tenant/org binding, pagination and unauthenticated denial.');
})().catch(e=>{console.error(e);process.exitCode=1});
