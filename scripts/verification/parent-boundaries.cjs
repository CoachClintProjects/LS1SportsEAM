// Technical boundary checks only: no created accounts, families or business records.
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
function load(file,imports={}){const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:m,exports:m.exports,Date,Map,Set,require:n=>{if(imports[n])return imports[n];throw Error(n)}});return m.exports;}
const policy=load('lib/parent/policy.ts'),now=Date.now(),grant={status:'active',valid_from:new Date(now-1000).toISOString(),valid_until:null,restrictions:[],authority_scopes:['parent.read','parent.documents'],athlete_id:'athlete-a'};
assert.equal(policy.parentGrantAllows(grant,'parent.read'),true);
for(const changed of [{status:'revoked'},{status:'restricted'},{restrictions:['no_contact']},{authority_scopes:[]},{legal_custody_status:'RESTRICTED_NO_CONTACT'},{valid_until:new Date(now-1).toISOString()},{valid_from:new Date(now+10000).toISOString()}])assert.equal(policy.parentGrantAllows({...grant,...changed},'parent.read'),false);
assert.equal(policy.parentGrantAllows(grant,'parent.finance'),false);assert.equal(policy.parentGrantAllows(grant,'parent.sign'),false);
assert.equal(policy.overlappingEvents([{id:'swim',starts_at:'2026-11-02T12:00:00Z',ends_at:'2026-11-02T13:00:00Z'},{id:'football',starts_at:'2026-11-02T12:30:00Z',ends_at:'2026-11-02T14:00:00Z'}]).size,2);
class PersonRecordError extends Error{constructor(status,message){super(message);this.status=status}}
let ctx=null,calls=0;
const access=load('lib/server/parentAccess.ts',{'./accessControl':{resolveAccess:async()=>ctx},'./adminRecordAccess':{recordRest:async()=>{calls++;return[grant]}},'./adminPersonRecord':{PersonRecordError},'@/lib/parent/policy':policy});
(async()=>{const req={nextUrl:new URL('https://test.invalid/api/parent')};await assert.rejects(access.parentAccess(req),e=>e.status===401);assert.equal(calls,0);
 ctx={person:{id:'parent-a'},isPlatformSuperUser:false};await assert.rejects(access.parentAccess({nextUrl:new URL('https://test.invalid/api/parent?guardian=another')}),e=>e.status===403);assert.equal(calls,0);
 const result=await access.parentAccess(req);assert.equal(result.athleteIds.length,1);assert.throws(()=>access.requireParentGrant(result,'athlete-b','parent.read'),e=>e.status===403);assert.throws(()=>access.requireParentGrant({...result,readOnly:true},'athlete-a','parent.documents'),e=>e.status===403);assert.equal(access.requireParentGrant(result,'athlete-a','parent.documents').athlete_id,'athlete-a');
 ctx={person:null,isPlatformSuperUser:true};const unlinked=await access.parentAccess(req);assert.equal(unlinked.athleteIds.length,0);
 console.log('PASS: no anonymous reads, no guardian impersonation, no automatic family, per-athlete/scoped permission, revoked/restricted/expired grants, read-only preview and cross-sport calendar conflicts.');})().catch(e=>{console.error(e);process.exitCode=1});
