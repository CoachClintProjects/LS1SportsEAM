import fs from 'node:fs';

const failures=[];
const read=p=>fs.existsSync(p)?fs.readFileSync(p,'utf8'):'';
const login='components/auth/LoginGate.tsx';
const reset='app/reset-password/page.tsx';
const loginSource=read(login),resetSource=read(reset);
if(!loginSource)failures.push(`${login}: missing authentication gateway.`);
if(!resetSource)failures.push(`${reset}: missing password recovery completion route.`);
for(const marker of['Show password','Forgot password?','resetPasswordForEmail','signInWithOAuth','google','azure','signInWithSSO','Enterprise SSO','autoComplete="username"','autoComplete="current-password"'])if(!loginSource.includes(marker))failures.push(`${login}: authentication contract missing ${marker}.`);
for(const marker of['PASSWORD_RECOVERY','updateUser({ password })','autoComplete="new-password"','Minimum 12 characters'])if(!resetSource.includes(marker))failures.push(`${reset}: recovery contract missing ${marker}.`);
if(/const\s+supabase\s*=\s*createClient\s*\(/.test(loginSource)||/const\s+supabase\s*=\s*createClient\s*\(/.test(resetSource))failures.push('Authentication clients must not be eagerly constructed at module scope.');

const runtimeAuthFiles=[
  'lib/server/requireSuperUser.ts',
  'app/api/superuser-auth/session/route.ts',
  'app/api/superuser-command/route.ts',
  'app/api/superuser-delivery-scope/route.ts',
  'app/api/superuser-release/route.ts',
  'app/api/superuser-team-engine-options/route.ts',
  'app/api/superuser-team-engine-action/route.ts',
  'lib/server/writeAuditEvent.ts',
];
for(const file of runtimeAuthFiles){
  const source=read(file);
  if(!source){failures.push(`${file}: missing Super User runtime auth target.`);continue;}
  if(source.includes('SUPABASE_SERVICE_ROLE_KEY'))failures.push(`${file}: active Super User runtime must not depend on a service-role secret.`);
  if(!source.includes('Bearer ${actor.accessToken}')&&file!=='lib/server/requireSuperUser.ts'&&file!=='app/api/superuser-auth/session/route.ts')failures.push(`${file}: authenticated RLS token propagation is missing.`);
}
const requireSource=read('lib/server/requireSuperUser.ts');
if(!requireSource.includes('auth_user_id=eq.')||!requireSource.includes('Bearer ${token}'))failures.push('Super User authorization must remain bound to auth_user_id and the caller JWT.');
const sessionSource=read('app/api/superuser-auth/session/route.ts');
if(!sessionSource.includes('auth_user_id=eq.')||sessionSource.includes('email=ilike.'))failures.push('Super User session gate must authorize immutable auth_user_id, not email lookup.');

if(failures.length){console.error('\nLS1Sports authentication locks FAILED:\n');failures.forEach((f,i)=>console.error(`${i+1}. ${f}`));process.exit(1)}
console.log('LS1Sports authentication locks passed.');
