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
if(failures.length){console.error('\nLS1Sports authentication locks FAILED:\n');failures.forEach((f,i)=>console.error(`${i+1}. ${f}`));process.exit(1)}
console.log('LS1Sports authentication locks passed.');
