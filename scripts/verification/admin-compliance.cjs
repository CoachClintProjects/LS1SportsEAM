// Boundary tests only; no business records or signed-in acceptance claims.
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
let calls=[],allowed=true;
const ctx={user:{id:'actor'},person:{id:'person',tenant_id:'tenant'},allowedHubs:['admin'],adminScope:{tenantId:'tenant',organizationId:'organization'},roles:[]};
const m={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/api/admin-command/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:m,exports:m.exports,crypto:{randomUUID:()=> 'correlation'},Set,Date,JSON,Object,Number,encodeURIComponent,require:n=>n==='next/server'?{NextResponse:{json:(body,o={})=>({body,status:o.status||200})}}:n.endsWith('superuserAuth')?{supabaseServerConfig:()=>({url:'https://store.invalid'})}:{resolveAccess:async()=>ctx,canUseAdminRoleContext:()=>true,hasAdminContextPermission:()=>allowed,serviceHeaders:()=>({})},fetch:async(url,init)=>{calls.push({url,init});return {ok:true,text:async()=>JSON.stringify({id:'record',version:2})}}});
const run=async extra=>{calls=[];return m.exports.POST({json:async()=>({action:'update-compliance-record',role:'org_admin',domain:'credentials',id:'record',changes:{status:'expired'},expectedVersion:1,reason:'Evidence reviewed',...extra})})};
(async()=>{
 assert.equal((await run({reason:''})).status,400);assert.equal(calls.length,0);
 assert.equal((await run({expectedVersion:undefined})).status,400);assert.equal(calls.length,0);
 allowed=false;assert.equal((await run({})).status,403);assert.equal(calls.length,0);allowed=true;
 assert.equal((await run({domain:'people'})).status,400);assert.equal(calls.length,0);
 assert.equal((await run({})).status,200);assert.equal(calls.length,1);assert.ok(calls[0].url.endsWith('/rpc/admin_compliance_decide'));
 const body=JSON.parse(calls[0].init.body);assert.deepEqual(body.p_orgs,['organization']);assert.equal(body.p_tenant,'tenant');assert.equal(body.p_reason,'Evidence reviewed');assert.equal(body.p_version,1);assert.equal(body.p_actor_user,'actor');
 console.log('PASS: compliance permission, reason, version, domain and atomic scoped RPC boundaries.');
})().catch(e=>{console.error(e);process.exitCode=1});
