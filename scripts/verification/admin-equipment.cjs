const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
function load(file,deps={}){const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:m,exports:m.exports,require:n=>{if(n in deps)return deps[n];throw Error(n);},Date,Set,Map,JSON,Number,String,Boolean,Promise,encodeURIComponent});return m.exports;}
const policy=load('lib/equipmentPolicy.ts');assert.throws(()=>policy.timeWindow('not a date','2026-10-15'));assert.throws(()=>policy.timeWindow('2026-10-15','2026-10-14'));assert.equal(policy.timeWindow('2026-10-15T01:00:00Z','2026-10-15T02:00:00Z').ends_at,'2026-10-15T02:00:00.000Z');
class PersonRecordError extends Error{constructor(status,message){super(message);this.status=status;}}
let ctx=null,allowed=true,allowedRole='facilities_equipment_manager',calls=[];
const rest=async(path,init)=>{calls.push({path,init});return init?{message:'Saved'}:[];};
const {GET,POST}=load('app/api/admin-equipment/route.ts',{'next/server':{NextResponse:{json:(body,o)=>({body,status:o?.status||200})}},'@/lib/server/accessControl':{resolveAccess:async()=>ctx,canUseAdminRoleContext:(_c,r)=>allowed&&r===allowedRole,hasAdminContextPermission:()=>allowed},'@/lib/server/adminRecordAccess':{recordRest:rest},'@/lib/server/adminPersonRecord':{PersonRecordError},'@/lib/equipmentPolicy':policy});
const req={nextUrl:{searchParams:new URLSearchParams()}},post=b=>({json:async()=>b}),body={action:'receive',request_id:'11111111-1111-4111-8111-111111111111',values:{quantity:1},reason:'Recorded packing slip evidence'};
(async()=>{assert.equal((await GET(req)).status,401);ctx={allowedHubs:['admin'],adminScope:{tenantId:'tenant',organizationId:'club'},person:{id:'actor'},user:{id:'verified-user'}};allowed=false;assert.equal((await POST(post(body))).status,403);assert.equal(calls.length,0);allowed=true;
 for(const action of ['delete','pay_bill','set_consent_policy'])assert.equal((await POST(post({...body,action}))).status,403);
 for(const action of ['reopen','release_hold'])assert.equal((await POST(post({...body,action,authority:'org_admin'}))).status,403);
 assert.equal((await POST(post({...body,request_id:'bad'}))).status,400);
 let r=await POST(post({...body,p_org:'other',p_actor_user:'spoof'}));assert.equal(r.status,200);let payload=JSON.parse(calls.at(-1).init.body);assert.equal(payload.p_org,'club');assert.equal(payload.p_actor_user,'verified-user');assert.equal(payload.p_role,'facilities_equipment_manager');
 allowedRole='org_admin';assert.equal((await POST(post({...body,action:'reopen',authority:'org_admin'}))).status,200);
 allowedRole='facilities_equipment_manager';calls=[];assert.equal((await GET(req)).status,200);assert(calls.some(c=>c.path.includes('organization_id=eq.club')));assert(!calls.some(c=>c.path.includes('ledger')||c.path.includes('medical')));
 console.log('PASS: dates, authentication, role isolation, server-derived actor and club, executive reopening boundary, unsupported finance/deletion actions and scoped read set.');
})().catch(e=>{console.error(e);process.exitCode=1;});
