// Controlled source tests. This does not substitute for signed-in UAT.
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const assert = require('node:assert/strict');
const loaded = {exports:{}};
const compiled = ts.transpileModule(fs.readFileSync('lib/server/adminHomeSnapshot.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
let allowed = true;
vm.runInNewContext(compiled, {module:loaded,exports:loaded.exports,Date,Map,Set,require:()=>({hasAdminContextPermission:()=>allowed,hasPermission:()=>allowed})});
const ctx = {user:{id:'user',email:'review@example.invalid'},person:{id:'person'},roles:[]};
const roles = ['org_admin','team_manager','registrar','competition_manager','treasurer','volunteer_coordinator','communications_media','fundraising_coordinator','facilities_equipment_manager'];
(async()=>{
 const observed = new Set();
 for (const role of roles) {
  const paths=[];
  const result=await loaded.exports.adminHomeSnapshot(async path=>{paths.push(path);observed.add(path);return [{id:'scope-id',athlete_id:'athlete-id',person_id:'person-id'}]},ctx,role,'tenant-id',['organization-id']);
  const queried = table=>paths.some(p=>p.startsWith(table+'?'));
  assert.equal(queried('documents'),false);
  assert.equal(queried('medical_profiles'),false);
  assert.equal(queried('invoice_lines'),false);
  assert.equal(queried('contract_versions'),false);
  assert.equal(queried('credentials'),['org_admin','registrar'].includes(role));
  assert.equal(queried('registrations'),['org_admin','registrar'].includes(role));
  assert.equal(queried('invoices'),['org_admin','treasurer'].includes(role));
  assert.equal(queried('volunteer_opportunities'),['org_admin','volunteer_coordinator'].includes(role));
  assert.equal(queried('communication_campaigns'),['org_admin','communications_media'].includes(role));
  assert.equal(queried('fundraising_commitments'),['org_admin','fundraising_coordinator'].includes(role));
  assert.equal(queried('contracts'),['org_admin','team_manager','facilities_equipment_manager'].includes(role));
  const workflow = paths.find(p=>p.startsWith('workflow_tasks?'));
  assert.ok(workflow.includes('workflow_instance_id=in.(scope-id)'));
  assert.ok(paths.find(p=>p.startsWith('workflow_definitions?')).includes('tenant_id=eq.tenant-id'));
  const tasks=paths.find(p=>p.startsWith('work_items?'));
  if(role!=='org_admin') assert.ok(tasks.includes('assigned_role='));
  assert.equal(result.context.role,role);
 }
 allowed=false;
 const denied=[];
 await loaded.exports.adminHomeSnapshot(async path=>{denied.push(path);return []},ctx,'treasurer','tenant-id',['organization-id']);
 assert.ok(!denied.some(p=>/^(invoices|customers|work_items|workflow_tasks)\?/.test(p)));
 const schema = [...observed].map(p=>({table:p.split('?')[0],columns:new URLSearchParams(p.split('?')[1]).get('select').split(',')}));
 fs.writeFileSync('/tmp/admin-home-projections.json',JSON.stringify(schema));
 console.log('PASS: Home query isolation across all nine Admin contexts, permission denial, and tenant-bound workflow reads.');
})().catch(e=>{console.error(e);process.exitCode=1});
