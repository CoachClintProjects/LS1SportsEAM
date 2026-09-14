import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const failures=[];
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const exists=p=>fs.existsSync(path.join(root,p));
const fail=m=>failures.push(m);

const files={
 migration:'supabase/migrations/20260914231500_build_urws_authority_control_plane.sql',
 nav:'supabase/migrations/20260914233000_add_admin_urws_authority_navigation.sql',
 metrics:'supabase/migrations/20260914234500_expose_urws_authority_superuser_metrics.sql',
 api:'app/api/admin-urws-authority/route.ts',
 ui:'components/hubs/admin/AdminURWSAuthorityWorkspace.tsx',
 adminWorkspace:'components/hubs/admin/AdminWorkspace.tsx',
 superApi:'app/api/superuser-urws/route.ts',
 superUi:'components/hubs/superuser/SuperUserURWSCommand.tsx',
};

for(const [key,file] of Object.entries(files)) if(!exists(file)) fail(`URWS authority ${key} missing: ${file}`);

if(exists(files.migration)){
 const s=read(files.migration);
 for(const token of [
  'app.urws_can_admin_authority',
  "upper(r.code::text)='ORGANIZATION_ADMIN'",
  'public.urws_authority_admin_snapshot',
  'public.urws_set_authority_grant',
  'public.urws_set_decision_approval_policy',
  "p_action not in ('decide','approve_financial_remedy','execute_financial_remedy')",
  "'execute_financial_remedy','urws_case','execute_financial_remedy'",
  'Authority can only be assigned to an active organization operator',
  "'urws.authority.granted'",
  "'urws.authority.revoked'",
  "'urws.authority.policy_changed'",
 ]) if(!s.includes(token)) fail(`Authority control migration missing invariant: ${token}`);
 if(s.includes("insert into public.platform_authority_grants")&&!s.includes("'urws_authority_admin'")) fail('Authority grants must preserve canonical authority source.');
}

if(exists(files.nav)){
 const s=read(files.nav);
 for(const token of ['URWS Authority Control','/admin?view=urws-authority-control','AdminURWSAuthorityWorkspace']) if(!s.includes(token)) fail(`Authority navigation missing ${token}`);
}

if(exists(files.metrics)){
 const s=read(files.metrics);
 for(const token of ['v_superuser_urws_authority_metrics','active_authority_grants','decision_authority_operators','remedy_approval_operators','financial_execution_operators','organizations_requiring_second_approval','organization_decision_rules','authority_grants_expiring_30d','urws_authority_control_plane']) if(!s.includes(token)) fail(`Authority SuperUser metric/capability missing ${token}`);
}

if(exists(files.api)){
 const s=read(files.api);
 for(const token of ['requireAdmin',"actor.roles.includes('org_admin')",'urws_authority_admin_snapshot',"action==='set-grant'",'urws_set_authority_grant','URWS_AUTHORITY_GRANTED','URWS_AUTHORITY_REVOKED',"action==='set-decision-policy'",'urws_set_decision_approval_policy','URWS_DECISION_APPROVAL_POLICY_CHANGED']) if(!s.includes(token)) fail(`Authority API missing ${token}`);
 if(s.includes('service_role')||s.includes('SUPABASE_SERVICE_ROLE')) fail('Authority API must not bypass caller authority with service-role credentials.');
}

if(exists(files.ui)){
 const s=read(files.ui);
 const lower=s.toLowerCase();
 for(const token of ['/api/admin-urws-authority','who may decide, approve, and execute','no operator receives authority automatically.','decide cases','approve remedies','execute remedies','save approval policy','zero means no authority has been granted']) if(!lower.includes(token.toLowerCase())) fail(`Authority UI missing ${token}`);
 if(/\bmockData\b|\bdemoData\b|\bfakeData\b|\bmockAuthority\b/i.test(s)) fail('Authority UI must not use mock/demo/fake authority datasets.');
}

if(exists(files.adminWorkspace)){
 const s=read(files.adminWorkspace);
 if(!s.includes("import { AdminURWSAuthorityWorkspace }")) fail('Admin workspace must import authority workspace.');
 if(!s.includes('AdminURWSAuthorityWorkspace')) fail('Admin workspace registry must expose authority workspace.');
}

if(exists(files.superApi)){
 const s=read(files.superApi);
 for(const token of ['requireSuperUser','v_superuser_urws_authority_metrics','platform_capability_registry?select=capability_key,capability_name,domain,criticality,status,description']) if(!s.includes(token)) fail(`SuperUser URWS authority API missing ${token}`);
 if(s.includes('build_evidence')||s.includes('last_verified_at')) fail('SuperUser URWS API must not query nonexistent capability-registry columns.');
}

if(exists(files.superUi)){
 const s=read(files.superUi);
 for(const token of ['Active authority grants','active_authority_grants','Decision-authority operators','decision_authority_operators','Remedy-authority operators','remedy_approval_operators','Financial execution operators','financial_execution_operators','authority_grants_expiring_30d','organizations_requiring_second_approval']) if(!s.includes(token)) fail(`SuperUser authority visibility missing ${token}`);
 if(/\bmockData\b|\bdemoData\b|\bfakeData\b|\bmockAuthority\b/i.test(s)) fail('SuperUser authority metrics must not use mock/demo authority datasets.');
}

if(failures.length){
 console.error('\nURWS authority locks FAILED:\n');
 failures.forEach((message,index)=>console.error(`${index+1}. ${message}`));
 process.exit(1);
}
console.log('URWS authority control plane locks passed.');
