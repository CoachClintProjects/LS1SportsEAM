// Technical authorization regression checks. These are not signed-in UAT.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
const cache=new Map();
function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file).exports;const module={exports:{}};cache.set(file,module);const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const localRequire=(name)=>name.startsWith('@/')?load(name.slice(2)+'.ts'):name.startsWith('.')?load(path.resolve(path.dirname(file),name+'.ts')):require(name);vm.runInNewContext(code,{module,exports:module.exports,require:localRequire,process,fetch,URL,console},{filename:file});return module.exports;}
const {personRecordScope,readPersonRecord}=load('lib/server/adminPersonRecord.ts');
const personId='28d371d2-a41e-42dc-bc54-ea2659b3bcfa',tenant='beb8f24e-fcd0-5dbe-ba1b-39c488ebaa4f',org='c9032ebb-0507-5004-b1ad-0bca7cf3cc53';
const ctx={isPlatformSuperUser:false,rolePermissions:{TEAM_MANAGER:['rosters.read','record.update']}};
(async()=>{
 let calls=0;await assert.rejects(personRecordScope(async()=>{calls++;return[]},ctx,'team_manager',tenant,[org],'bad-id'),e=>e.status===400);assert.equal(calls,0);
 await assert.rejects(personRecordScope(async()=>{calls++;return[]},{isPlatformSuperUser:false,rolePermissions:{}},'team_manager',tenant,[org],personId),e=>e.status===403);assert.equal(calls,0);
 const called=[];const emptyScope=async(query)=>{called.push(query);return query.startsWith('people?')?[{id:personId}]:[]};
 await assert.rejects(personRecordScope(emptyScope,ctx,'team_manager',tenant,[org],personId),e=>e.status===404);
 // These identifiers are existing records; this checks request routing with controlled query responses.
 const rest=async query=>{called.push(query);if(query.startsWith('people?'))return[{id:personId}];if(query.startsWith('role_assignments?'))return[{id:'assigned'}];return[]};
 const result=await readPersonRecord(rest,ctx,'team_manager',tenant,[org],personId);
 assert.equal(result.authorization.medical,false);assert.equal(result.authorization.finance,false);assert.equal(result.medical,null);
 assert.equal(called.some(q=>q.startsWith('athlete_medical_profiles?')||q.startsWith('invoices?')||q.startsWith('customers?')),false);
 console.log('PASS: malformed identifiers, denied roles, out-of-organization records, and medical/finance query suppression.');
})().catch(e=>{console.error(e);process.exitCode=1});
