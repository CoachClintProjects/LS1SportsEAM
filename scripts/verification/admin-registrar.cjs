const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
function load(file,deps={}){const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:m,exports:m.exports,require:n=>{if(n in deps)return deps[n];throw Error(`Unexpected dependency ${n}`);},Date,Set,JSON,Boolean,String,Promise,encodeURIComponent});return m.exports;}
const policy=load('lib/registrarPolicy.ts');
assert.equal(policy.currentIdentityEvidence({verification_status:'verified',expires_at:'2020-01-01'},Date.parse('2026-10-14')),false);
assert.equal(policy.currentIdentityEvidence({verification_status:'pending'}),false);
assert.equal(policy.currentIdentityEvidence({verification_status:'verified',expires_at:'invalid'}),false);
assert.equal(policy.currentIdentityEvidence({verification_status:'verified'}),true);
for(const command of ['record-payment','create-legal-entity','update-compliance-record','update-team-membership'])assert.equal(policy.registrarCommands.includes(command),false);
class PersonRecordError extends Error{constructor(status,message){super(message);this.status=status;}}
let ctx=null,delegable=true,allowed=true;const calls=[];
const api=load('app/api/admin-registrar/route.ts',{
 'next/server':{NextResponse:{json:(data,options)=>({data,status:options?.status||200})}},
 '@/lib/server/accessControl':{resolveAccess:async()=>ctx,canUseAdminRoleContext:()=>delegable,hasAdminContextPermission:()=>allowed},
 '@/lib/server/adminRecordAccess':{recordAccess:async()=>{},recordRest:async path=>{calls.push(path);return [];}},
 '@/lib/server/adminPersonRecord':{PersonRecordError},'@/lib/registrarPolicy':policy,
});
const req={nextUrl:{searchParams:new URLSearchParams()}};
(async()=>{
 assert.equal((await api.GET(req)).status,401);
 ctx={allowedHubs:['admin'],adminScope:{tenantId:'tenant-a',organizationId:'org-a'},roles:[]};
 delegable=false;assert.equal((await api.GET(req)).status,403);assert.equal(calls.length,0);
 delegable=true;allowed=false;assert.equal((await api.GET(req)).status,403);assert.equal(calls.length,0);
 allowed=true;const result=await api.GET(req);assert.equal(result.status,200);
 assert.equal(result.data.identityNeedsReview.length,0);
 assert.equal(result.data.truncated,false);
 assert(calls.some(q=>q.startsWith('membership_exceptions?')&&q.includes('organization_id=eq.org-a')));
 assert(calls.every(q=>!/(ledger|invoice|lease|restricted_details)/.test(q)));
 console.log('PASS: authentication, delegated role, permissions, organization scope, no financial reads, evidence expiry and restricted commands.');
})().catch(e=>{console.error(e);process.exitCode=1;});
