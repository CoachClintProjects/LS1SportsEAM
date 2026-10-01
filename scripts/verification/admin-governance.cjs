// Controlled authorization tests; no persisted business records or UAT claims.
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
class PersonRecordError extends Error{constructor(status,message){super(message);this.status=status}}
const org='00000000-0000-0000-0000-000000000001',tenant='00000000-0000-0000-0000-000000000002',record='00000000-0000-0000-0000-000000000003';
let ctx,permissions,calls=[];
const access={resolveAccess:async()=>ctx,canUseAdminRoleContext:(_,role)=>role==='org_admin',hasAdminContextPermission:(_,role,p)=>permissions.has(p)};
function load(path,requires){const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:m,exports:m.exports,Date,Set,Map,require:requires});return m.exports}
const helpers=load('lib/server/adminGovernance.ts',name=>name.endsWith('accessControl')?access:{PersonRecordError});
const rest=async(path,init)=>{calls.push({path,init});if(path.startsWith('rpc/'))return {id:record};if(path.startsWith('organization_governance_types'))return [{code:'policy'}];if(path.startsWith('organization_governance_records')&&path.includes('id=eq.'))return [];return []};
const api=load('app/api/admin-governance/route.ts',name=>name==='next/server'?{NextResponse:{json:(body,opts={})=>({body,status:opts.status||200})}}:name.endsWith('adminGovernance')?helpers:name.endsWith('adminRecordAccess')?{recordRest:rest}:name.endsWith('adminPersonRecord')?{PersonRecordError}:access);
const post=async b=>{calls=[];return api.POST({json:async()=>({role:'org_admin',id:record,operation:'create',values:{},reason:'Unit boundary check',...b})})};
const get=async query=>{calls=[];return api.GET({nextUrl:{searchParams:new URLSearchParams(query)}})};
(async()=>{
 permissions=new Set(['record.read','record.create','record.update']);ctx=null;assert.equal((await get({})).status,401);assert.equal(calls.length,0);
 ctx={user:{id:'actor'},person:{id:'person',tenant_id:tenant},allowedHubs:['admin'],adminScope:{tenantId:tenant,organizationId:org},roles:[]};
 for(const role of ['team_manager','registrar','treasurer','competition_manager','volunteer_coordinator','communications_media','fundraising_coordinator','facilities_equipment_manager']){assert.equal((await get({role})).status,403);assert.equal(calls.length,0)}
 assert.equal((await post({operation:'transition',expectedVersion:1})).status,403);assert.equal(calls.length,0);
 assert.equal((await post({operation:'attach'})).status,400);assert.equal(calls.length,0);
 assert.equal((await post({reason:''})).status,400);assert.equal(calls.length,0);
 assert.equal((await post({operation:'edit',expectedVersion:null})).status,400);assert.equal(calls.length,0);
 assert.equal((await post({})).status,200);assert.equal(calls[0].path,'rpc/admin_governance_write');const payload=JSON.parse(calls[0].init.body);assert.equal(payload.p_org,org);assert.equal(payload.p_tenant,tenant);assert.equal(payload.p_actor_user,'actor');
 assert.equal((await get({id:record})).status,404);assert.equal(calls.length,1);assert.ok(calls[0].path.includes(`tenant_id=eq.${tenant}&organization_id=eq.${org}`));
 assert.equal((await get({page:'-1'})).status,400);
 assert.equal((await get({kind:'policy',sort:'details',direction:'evil',page:'2'})).status,200);const listing=calls.find(c=>c.path.includes('limit=26'));assert.ok(listing.path.includes('order=updated_at.desc.nullslast,id.asc'));assert.ok(listing.path.includes('offset=50'));
 ctx.adminScope=null;ctx.roles=[{code:'REGISTRAR',scope:{organization_id:org}}];assert.equal((await get({})).status,403);assert.equal(calls.length,0);
 console.log('PASS: governance role isolation, authority, tenant scope, mutation restrictions, validation and paginated sort allowlist.');
})().catch(e=>{console.error(e);process.exitCode=1});
