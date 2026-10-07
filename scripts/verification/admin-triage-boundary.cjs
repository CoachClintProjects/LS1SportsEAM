// Isolated permission tests; never connect to Supabase or insert live records.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const modules=new Map();
function load(path){if(modules.has(path))return modules.get(path);const module={exports:{}};const code=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;vm.runInNewContext(code,{module,exports:module.exports,require:(name)=>name.includes('superuserAuth')?{}:load(name.includes('triage/types')?'lib/triage/types.ts':'lib/server/accessControl.ts'),Set,Date,Number,Object});modules.set(path,module.exports);return module.exports;}
const {triageScope,taskInScope}=load('lib/server/adminTriage.ts');
const ctx={allowedHubs:['admin'],adminScope:null,person:{id:'person',tenant_id:'tenant'},isPlatformSuperUser:false,maxDelegablePrivilege:0,roles:[{code:'TEAM_MANAGER',scope:{organization_id:'club',team_id:'squad-a'}}]};
const scope=triageScope(ctx,'team_manager','squad-a');
const row={tenant_id:'tenant',organization_id:'club',team_id:'squad-a',assigned_role:'team_manager',assigned_to:null};
assert.equal(taskInScope(row,scope),true);
for(const change of [{tenant_id:'another'},{organization_id:'another'},{team_id:'squad-b'},{team_id:null},{assigned_role:'treasurer'},{assigned_to:'another-person'}])assert.equal(taskInScope({...row,...change},scope),false);
assert.throws(()=>triageScope(ctx,'team_manager','squad-b'),/ERR-901/);
assert.throws(()=>triageScope(ctx,'org_admin',null));
assert.equal(taskInScope(row,triageScope(ctx,'team_manager',null)),false);
const executive={...ctx,maxDelegablePrivilege:100,roles:[{code:'ORGANIZATION_ADMIN',scope:{organization_id:'club',team_id:null}}]};
assert.equal(taskInScope({...row,assigned_to:'another-person'},triageScope(executive,'org_admin',null)),true);
assert.equal(taskInScope({...row,team_id:'squad-b'},triageScope(executive,'team_manager','squad-a')),false);
assert.equal(taskInScope({...row,organization_id:'another'},triageScope(executive,'org_admin',null)),false);
console.log('PASS: tenant, club, role, squad, missing-squad and assignee boundaries; executive delegation stays within selected scope.');
