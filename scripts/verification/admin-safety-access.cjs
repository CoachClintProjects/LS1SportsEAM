// Controlled authentication/authority tests; no live credentials or business mutations.
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
let evaluations=[],failed=false,includeRoot=false;
const staff={id:'staff-role',code:'TEAM_MANAGER',name:'Team Manager',privilege_level:20,role_type:'operational',config:{hub_access:['admin']},is_active:true};
const root={id:'root-role',code:'ORGANIZATION_ADMIN',name:'Org Admin',privilege_level:90,role_type:'operational',config:{hub_access:['admin'],max_delegable_privilege:90},is_active:true};
const m={exports:{}};
const response=(data,ok=true)=>({ok,json:async()=>data});
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/server/accessControl.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:m,exports:m.exports,Date,Set,Map,Math,Number,Array,JSON,encodeURIComponent,require:()=>({supabaseServerConfig:()=>({url:'https://canonical.invalid',serviceKey:'test-only',publicKey:'test-only'})}),fetch:async(url,init)=>{
 if(url.endsWith('/auth/v1/user'))return response({id:'user',email:'boundary@example.invalid'});
 if(url.includes('/platform_superuser_operators?'))return response([]);
 if(url.includes('/people?'))return response([{id:'person',tenant_id:'tenant'}]);
 if(url.includes('/role_assignments?'))return response([staff,...(includeRoot?[root]:[])].map(r=>({organization_id:'org',role_definitions:r})));
 if(url.endsWith('/rpc/admin_safety_access')){assert.deepEqual(JSON.parse(init.body),{p_tenant:'tenant',p_person:'person'});return response(evaluations,!failed)}
 if(url.includes('/permission_grants?'))return response([{role_definition_id:'staff-role',effect:'allow',permission_definitions:{code:'record.update',is_active:true}}]);
 if(url.includes('/role_definitions?'))return response([staff,root]);
 throw Error('Unexpected authority read '+url);
}});
const resolve=()=>m.exports.resolveAccess({headers:{get:k=>k==='authorization'?'Bearer controlled-test-token':null}});
(async()=>{
 let ctx=await resolve();assert.equal(ctx.roles.length,1);assert.equal(m.exports.canUseAdminRoleContext(ctx,'team_manager'),true);assert.ok(ctx.permissions.includes('record.update'));
 evaluations=[{organization_id:'org',role_code:'TEAM_MANAGER',blocked:true,reasons:['Evidence missing']}];ctx=await resolve();assert.equal(ctx.roles.length,0);assert.equal(ctx.allowedHubs.length,0);assert.equal(ctx.permissions.length,0);assert.equal(m.exports.canUseAdminRoleContext(ctx,'team_manager'),false);
 includeRoot=true;ctx=await resolve();assert.equal(ctx.roles.length,1);assert.equal(ctx.roles[0].code,'ORGANIZATION_ADMIN');assert.equal(m.exports.canUseAdminRoleContext(ctx,'org_admin'),true);
 includeRoot=false;evaluations=[{organization_id:'other-org',role_code:'TEAM_MANAGER',blocked:true,reasons:[]}];ctx=await resolve();assert.equal(ctx.roles.length,1);
 evaluations=[{organization_id:'org',role_code:'TEAM_MANAGER',blocked:false,override_id:'override',reasons:['Evidence missing']}];ctx=await resolve();assert.equal(ctx.roles.length,1);
 failed=true;await assert.rejects(resolve,/clearance checks are unavailable/);
 console.log('PASS: clearance role suspension, permission/hub removal, organization isolation, executive recovery, active override and failed-check denial.');
})().catch(e=>{console.error(e);process.exitCode=1});
