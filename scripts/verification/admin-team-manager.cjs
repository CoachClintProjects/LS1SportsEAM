// Isolated boundary regression checks. No network or business records are used.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
const cache=new Map();
function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file).exports;const m={exports:{}};cache.set(file,m);const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;vm.runInNewContext(code,{module:m,exports:m.exports,require:n=>n.startsWith('@/')?load(n.slice(2)+'.ts'):n.startsWith('.')?load(path.resolve(path.dirname(file),n+'.ts')):require(n),process,console,URL});return m.exports;}
const {teamManagerScope,squadMembers}=load('lib/server/teamManagerScope.ts');
const ctx={allowedHubs:['admin'],person:{id:'actor',tenant_id:'tenant'},roles:[{code:'TEAM_MANAGER',scope:{organization_id:'club',team_id:'team-a'}}],isPlatformSuperUser:false,rolePermissions:{TEAM_MANAGER:['rosters.read']}};
const team={id:'team-a',organization_id:'club',code:'SQD_BANANA_01'};
(async()=>{
 const requests=[];const rest=async q=>{requests.push(q);return [team];};
 assert.equal((await teamManagerScope(rest,ctx)).team,'team-a');
 assert.match(requests[0],/organization_id=in\.\(club\).*code=eq\.SQD_BANANA_01&status=eq.active/);
 await assert.rejects(teamManagerScope(rest,ctx,'team-b'),e=>e.status===403&&e.message.includes('ERR-901'));
 await assert.rejects(teamManagerScope(async()=>[],ctx),e=>e.status===403);
 await assert.rejects(teamManagerScope(async()=>[{...team,id:'team-b'}],ctx),e=>e.status===403);
 await assert.rejects(teamManagerScope(rest,{...ctx,roles:[{code:'TEAM_MANAGER',scope:{organization_id:'club',team_id:null}}]}),e=>e.status===403);
 await assert.rejects(teamManagerScope(rest,{...ctx,rolePermissions:{}}),e=>e.status===403);
 const admin={...ctx,maxDelegablePrivilege:100,roles:[{code:'ORGANIZATION_ADMIN',scope:{organization_id:'club'}}]};
 await assert.rejects(teamManagerScope(rest,admin,'team-b'),e=>e.status===403);
 await assert.rejects(teamManagerScope(async()=>[team,team],admin),e=>e.status===403);
 await squadMembers(rest,'team-a');assert.match(requests.at(-1),/team_id=eq.team-a&status=eq.active&and=\(or\(starts_on.is.null,starts_on.lte/);assert.match(requests.at(-1),/ends_on.gte/);
 console.log('PASS: assigned squad, missing/ambiguous configuration, forged team, unassigned manager, denied permission, executive context and membership dates.');
})().catch(e=>{console.error(e);process.exitCode=1;});
