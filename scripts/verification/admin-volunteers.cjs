const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
function load(file,deps={}){const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:m,exports:m.exports,require:n=>{if(n in deps)return deps[n];throw Error(n);},Date,Set,Map,JSON,Number,String,Boolean,Promise,encodeURIComponent,crypto:require('node:crypto').webcrypto});return m.exports;}
const policy=load('lib/volunteerPolicy.ts');
const now=Date.parse('2026-10-15T10:00:00Z'),end='2026-10-16T10:00:00Z',role={certification_required:true,metadata:{required_credential_types:['BACKGROUND_CHECK','SAFESPORT']}};
const credential=type=>({credential_type:type,status:'active',verification_status:'verified',issued_on:'2025-01-01',expires_on:'2027-01-01'}),credentials=['BACKGROUND_CHECK','SAFESPORT'].map(credential);
assert(policy.clearance(role,credentials,end,now).ok);
assert(!policy.clearance(undefined,credentials,end,now).ok);
assert(!policy.clearance({...role,metadata:{}},credentials,end,now).ok);
assert(!policy.clearance(role,credentials.slice(0,1),end,now).ok);
for(const patch of [{expires_on:'2026-10-15'},{issued_on:'2027-01-01'},{verification_status:'pending'},{expires_on:null},{status:'revoked'}])assert(!policy.clearance(role,[credentials[0],{...credentials[1],...patch}],end,now).ok);
const input={title:'Worker shift',starts_at:'2026-10-16T10:00Z',ends_at:'2026-10-16T12:00Z',capacity:4};assert.equal(policy.shiftInput(input).capacity,4);
for(const patch of [{capacity:1.5},{capacity:0},{capacity:Infinity},{title:''},{starts_at:'bad'},{ends_at:'2026-10-16T09:00Z'}])assert.throws(()=>policy.shiftInput({...input,...patch}));
class PersonRecordError extends Error{constructor(status,message){super(message);this.status=status;}}
let ctx=null,allow=true,mode='',requests=[];
const id='11111111-1111-4111-8111-111111111111',oppId='22222222-2222-4222-8222-222222222222';
const prior={id,opportunity_id:oppId,volunteer_person_id:'person-a',role_id:'role-a',status:'assigned',updated_at:'2026-10-15T10:00:00Z'};
const rest=async(path,init={})=>{requests.push({path,init});if(path.startsWith('audit_events')&&init.method){if(mode==='audit-failure')throw Error('Audit unavailable');return [{id:'audit'}];}
 if(path.startsWith('volunteer_assignments?')){if(init.method==='PATCH')return mode==='race'?[]:[{...prior,...JSON.parse(init.body)}];return [prior];}
 if(path.startsWith('volunteer_opportunities?'))return mode==='foreign'?[]:[{id:oppId,organization_id:'org-a',...policy.shiftInput(input),status:'OPEN',ends_at:'2099-01-01'}];
 if(path==='volunteer_opportunities')return [{...JSON.parse(init.body)}];
 if(path.startsWith('people?'))return [{id:'person-a'}];if(path.startsWith('volunteer_roles?'))return [{...role,id:'role-a'}];if(path.startsWith('credentials?'))return mode==='screening'?[]:credentials;return [];
};
const {GET,POST}=load('app/api/admin-volunteers/route.ts',{'next/server':{NextResponse:{json:(body,options)=>({body,status:options?.status||200})}},'@/lib/server/accessControl':{resolveAccess:async()=>ctx,canUseAdminRoleContext:()=>allow,hasAdminContextPermission:()=>allow},'@/lib/server/adminRecordAccess':{recordRest:rest},'@/lib/server/adminPersonRecord':{PersonRecordError},'@/lib/volunteerPolicy':policy});
const get={nextUrl:{searchParams:new URLSearchParams()}},post=body=>({json:async()=>body}),body={action:'cancel',id,updated_at:prior.updated_at,reason:'Worker cancelled attendance.'};
(async()=>{assert.equal((await GET(get)).status,401);ctx={allowedHubs:['admin'],adminScope:{tenantId:'tenant-a',organizationId:'org-a'},person:{id:'actor-a'},user:{id:'user-a'}};allow=false;assert.equal((await GET(get)).status,403);assert.equal(requests.length,0);allow=true;
 assert.equal((await POST(post({...body,action:'ledger-post'}))).status,403);
 mode='foreign';assert.equal((await POST(post(body))).status,404);assert(!requests.some(r=>r.init.method==='PATCH'));
 mode='screening';assert.equal((await POST(post({...body,action:'check_in'}))).status,409);assert(!requests.some(r=>r.init.method==='PATCH'));
 mode='race';assert.equal((await POST(post(body))).status,409);
 mode='';requests=[];const saved=await POST(post(body));assert.equal(saved.status,200);assert.equal(saved.body.row.status,'cancelled');assert.equal(saved.body.row.volunteer_person_id,'person-a');assert(requests.find(r=>r.init.method==='PATCH').path.includes('updated_at=eq.'));assert(requests.some(r=>r.path==='audit_events'&&r.init.method==='POST'));
 mode='audit-failure';const warned=await POST(post(body));assert.equal(warned.status,200);assert(warned.body.warning.includes('change saved'));
 console.log('PASS: date/capacity validation, screening expiry and verification, authentication and club scope, restricted actions, stale-write rejection, cancellation history retention and explicit partial-save audit warning.');
})().catch(e=>{console.error(e);process.exitCode=1;});
