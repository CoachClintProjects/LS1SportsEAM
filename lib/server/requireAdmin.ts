const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://xedfstgwotzxnztpembv.supabase.co';
const PUBLIC_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;

export type AdminRoleName = 'org_admin'|'registrar'|'treasurer'|'operations'|'compliance'|'reporting'|'team_engine';
export type AdminIdentity = {
  userId:string;
  email:string;
  personId:string|null;
  tenantIds:string[];
  organizationIds:string[];
  roles:AdminRoleName[];
  displayName:string;
  isSuperUser:boolean;
  accessToken:string;
};

export class AdminAuthError extends Error {
  status:number;
  constructor(message:string,status=401){super(message);this.name='AdminAuthError';this.status=status;}
}

const roleMap:Record<string,AdminRoleName>={
  ORGANIZATION_ADMIN:'org_admin',
  REGISTRAR:'registrar',
  TREASURER:'treasurer',
  OPERATIONS_ADMIN:'operations',
  COMPLIANCE_ADMIN:'compliance',
  REPORTING_ADMIN:'reporting',
  TEAM_ENGINE_ADMIN:'team_engine',
};

function headers(token:string){
  if(!PUBLIC_KEY)throw new AdminAuthError('Admin authentication is not configured.',500);
  return {apikey:PUBLIC_KEY,Authorization:`Bearer ${token}`};
}

async function rest<T>(token:string,path:string):Promise<T>{
  if(!SUPABASE_URL)throw new AdminAuthError('Admin authentication is not configured.',500);
  const response=await fetch(`${SUPABASE_URL}/rest/v1/${path}`,{headers:headers(token),cache:'no-store'});
  const text=await response.text();
  if(!response.ok)throw new AdminAuthError(`Unable to verify Admin authorization (${response.status}).`,response.status===401?401:500);
  return (text?JSON.parse(text):null) as T;
}

export async function requireAdmin(request:Request):Promise<AdminIdentity>{
  if(!SUPABASE_URL||!PUBLIC_KEY)throw new AdminAuthError('Admin authentication is not configured.',500);
  const auth=request.headers.get('authorization')||'';
  const token=auth.startsWith('Bearer ')?auth.slice(7).trim():'';
  if(!token)throw new AdminAuthError('Authentication required.',401);

  const userResponse=await fetch(`${SUPABASE_URL}/auth/v1/user`,{headers:headers(token),cache:'no-store'});
  if(!userResponse.ok)throw new AdminAuthError('Invalid or expired session.',401);
  const authUser=await userResponse.json() as {id?:string;email?:string|null};
  const userId=String(authUser.id||'');
  const email=String(authUser.email||'').trim().toLowerCase();
  if(!userId||!email)throw new AdminAuthError('Authenticated user has no usable identity.',403);

  const operators=await rest<Array<{display_name:string|null;person_id:string|null}>>(token,`platform_superuser_operators?select=display_name,person_id&auth_user_id=eq.${encodeURIComponent(userId)}&active=eq.true&limit=1`);
  if(operators?.[0]){
    return {userId,email,personId:operators[0].person_id||null,tenantIds:[],organizationIds:[],roles:['org_admin'],displayName:operators[0].display_name||email,isSuperUser:true,accessToken:token};
  }

  const users=await rest<Array<{person_id:string|null;status:string}>>(token,`users?select=person_id,status&id=eq.${encodeURIComponent(userId)}&limit=1`);
  const personId=users?.[0]?.person_id||null;
  if(!personId||String(users?.[0]?.status||'').toUpperCase()!=='ACTIVE')throw new AdminAuthError('Admin access requires an active person identity.',403);

  const assignments=await rest<Array<{role_id:string;tenant_id:string|null;organization_id:string|null}>>(token,`person_role_assignments?select=role_id,tenant_id,organization_id&person_id=eq.${encodeURIComponent(personId)}&status=eq.ACTIVE`);
  const roleIds=[...new Set((assignments||[]).map(row=>row.role_id).filter(Boolean))];
  if(!roleIds.length)throw new AdminAuthError('Admin access required.',403);
  const roles=await rest<Array<{id:string;code:string;name:string}>>(token,`roles?select=id,code,name&id=in.(${roleIds.map(encodeURIComponent).join(',')})`);
  const adminRoles=[...new Set((roles||[]).map(row=>roleMap[String(row.code||'').toUpperCase()]).filter(Boolean))] as AdminRoleName[];
  if(!adminRoles.length)throw new AdminAuthError('Admin access required.',403);

  return {
    userId,email,personId,
    tenantIds:[...new Set((assignments||[]).map(row=>row.tenant_id).filter(Boolean))] as string[],
    organizationIds:[...new Set((assignments||[]).map(row=>row.organization_id).filter(Boolean))] as string[],
    roles:adminRoles,
    displayName:email.split('@')[0]||email,
    isSuperUser:false,
    accessToken:token,
  };
}
