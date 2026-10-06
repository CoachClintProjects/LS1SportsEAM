// Controlled API tests. Does not create club records or establish signed-in UAT.
const fs=require('node:fs'), vm=require('node:vm'), ts=require('typescript'), assert=require('node:assert/strict');
let calls=[], allowed=true;
const context={user:{id:'actor'},person:{id:'person',tenant_id:'tenant'},allowedHubs:['admin'],adminScope:{tenantId:'tenant',organizationId:'club'},roles:[]};
const roles=['org_admin','team_manager','registrar','competition_manager','treasurer','volunteer_coordinator','communications_media','fundraising_coordinator','facilities_equipment_manager'];
const loaded={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/api/admin-command/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{
 module:loaded,exports:loaded.exports,Date,Set,Map,URLSearchParams,crypto:{randomUUID:()=> 'correlation'},
 fetch:async(url,init)=>{calls.push({url,init});return {ok:true,text:async()=>JSON.stringify([{id:'created'}])};},
 require(name){
  if(name==='next/server')return {NextResponse:{json:(body,options={})=>({body,status:options.status||200})}};
  if(name.endsWith('/accessControl'))return {resolveAccess:async()=>context,serviceHeaders:()=>({}),hasAdminContextPermission:()=>allowed,canUseAdminRoleContext:(_ctx,role)=>roles.includes(role),adminRoleCodes:role=>roles.includes(role)?[role]:[],hasPermission:()=>allowed};
  if(name.endsWith('/superuserAuth'))return {supabaseServerConfig:()=>({url:'https://example.invalid'})};
  return {};
 }
});
async function post(body){calls=[];return loaded.exports.POST({json:async()=>({action:'create-task',role:'org_admin',title:'Review club policy',...body})});}
(async()=>{
 allowed=false;assert.equal((await post({})).status,403);assert.equal(calls.length,0);allowed=true;
 assert.equal((await post({assignedRole:'invalid'})).status,400);assert.equal(calls.length,0);
 assert.equal((await post({role:'registrar',assignedRole:'treasurer'})).status,403);assert.equal(calls.length,0);
 for(const dueOn of ['not-a-date','2026-02-30','2026-1-01']){assert.equal((await post({dueOn})).status,400);assert.equal(calls.length,0);}
 assert.equal((await post({assignedRole:'treasurer',dueOn:'2026-10-20'})).status,200);
 const task=JSON.parse(calls.find(c=>c.url.endsWith('/work_items')).init.body);
 assert.equal(task.tenant_id,'tenant');assert.equal(task.payload.assigned_role,'treasurer');assert.equal(task.payload.due_on,'2026-10-20');assert.equal(task.payload.created_by,'actor');
 assert.ok(calls.some(c=>c.url.endsWith('/audit_events')));
 assert.equal((await post({role:'registrar'})).status,200);assert.equal(JSON.parse(calls[0].init.body).payload.assigned_role,'registrar');
 console.log('PASS: task delegation role boundary, valid dates, actor/tenant binding and audit request. No business records created.');
})().catch(error=>{console.error(error);process.exitCode=1;});
