import { supabaseServerConfig } from '@/lib/server/superuserAuth';

export type SuperUserIdentity={userId:string;email:string;operatorId:string;displayName:string;canOnboardClients:boolean;canManagePlatformSettings:boolean};
export class SuperUserAuthError extends Error{status:number;constructor(message:string,status=401){super(message);this.name='SuperUserAuthError';this.status=status}}

function cookieToken(request:Request){const raw=request.headers.get('cookie')||'';for(const part of raw.split(';')){const [name,...rest]=part.trim().split('=');if(name==='ls1_superuser_session')return decodeURIComponent(rest.join('='));}return''}

export async function requireSuperUser(request:Request):Promise<SuperUserIdentity>{
 const{url:SUPABASE_URL,publicKey:PUBLIC_KEY,serviceKey:SERVICE_KEY}=supabaseServerConfig();
 if(!SUPABASE_URL||!PUBLIC_KEY||!SERVICE_KEY)throw new SuperUserAuthError('SuperUser authentication is not configured.',500);
 const header=request.headers.get('authorization')||'';
 const bearer=header.toLowerCase().startsWith('bearer ')?header.slice(7).trim():'';
 const token=bearer||cookieToken(request);
 if(!token)throw new SuperUserAuthError('Authentication required.',401);
 const userResponse=await fetch(`${SUPABASE_URL}/auth/v1/user`,{headers:{apikey:PUBLIC_KEY,Authorization:`Bearer ${token}`},cache:'no-store'});
 if(!userResponse.ok)throw new SuperUserAuthError('Invalid or expired session.',401);
 const user=await userResponse.json() as{id?:string;email?:string|null};const email=String(user.email||'').trim().toLowerCase();
 if(!user.id||!email)throw new SuperUserAuthError('Authenticated user has no usable identity.',403);
 const operatorResponse=await fetch(`${SUPABASE_URL}/rest/v1/platform_superuser_operators?select=id,email,display_name,active,can_onboard_clients,can_manage_platform_settings&email=eq.${encodeURIComponent(email)}&active=eq.true&limit=1`,{headers:{apikey:SERVICE_KEY,Authorization:`Bearer ${SERVICE_KEY}`},cache:'no-store'});
 if(!operatorResponse.ok)throw new SuperUserAuthError('Unable to verify SuperUser authorization.',500);
 const operators=await operatorResponse.json() as Array<{id:string;display_name:string|null;can_onboard_clients:boolean|null;can_manage_platform_settings:boolean|null}>;const operator=operators[0];
 if(!operator)throw new SuperUserAuthError('SuperUser access required.',403);
 return{userId:user.id,email,operatorId:operator.id,displayName:operator.display_name||email,canOnboardClients:Boolean(operator.can_onboard_clients),canManagePlatformSettings:Boolean(operator.can_manage_platform_settings)};
}
