const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://xedfstgwotzxnztpembv.supabase.co';
const PUBLIC_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;

export type CoachAssignment = {
  id:string;
  organization_id:string;
  team_id:string|null;
  program_id:string|null;
  role_key:string;
  is_head_coach:boolean;
};

export type CoachIdentity = {
  userId:string;
  email:string|null;
  personId:string|null;
  displayName:string;
  isSuperUser:boolean;
  assignments:CoachAssignment[];
  accessToken:string;
};

export class CoachAuthError extends Error {
  status:number;
  constructor(message:string,status=401){super(message);this.name='CoachAuthError';this.status=status;}
}

function headers(token:string){
  if(!PUBLIC_KEY) throw new CoachAuthError('Coach authentication is not configured.',500);
  return {apikey:PUBLIC_KEY,Authorization:`Bearer ${token}`};
}

function cookieToken(request:Request){
  const cookie=request.headers.get('cookie')||'';
  const pair=cookie.split(';').map(v=>v.trim()).find(v=>v.startsWith('ls1_superuser_session='));
  return pair?decodeURIComponent(pair.slice('ls1_superuser_session='.length)):'';
}

async function rest<T>(token:string,path:string):Promise<T>{
  const response=await fetch(`${SUPABASE_URL}/rest/v1/${path}`,{headers:headers(token),cache:'no-store'});
  const text=await response.text();
  if(!response.ok) throw new CoachAuthError(`Unable to verify Coach authorization (${response.status}).`,response.status===401?401:500);
  return (text?JSON.parse(text):null) as T;
}

export async function requireCoach(request:Request):Promise<CoachIdentity>{
  if(!SUPABASE_URL||!PUBLIC_KEY) throw new CoachAuthError('Coach authentication is not configured.',500);
  const authorization=request.headers.get('authorization')||'';
  const headerToken=authorization.startsWith('Bearer ')?authorization.slice(7).trim():'';
  const token=headerToken||cookieToken(request);
  if(!token) throw new CoachAuthError('Authentication required.',401);

  const authResponse=await fetch(`${SUPABASE_URL}/auth/v1/user`,{headers:headers(token),cache:'no-store'});
  if(!authResponse.ok) throw new CoachAuthError('Invalid or expired session.',401);
  const authUser=await authResponse.json() as {id?:string;email?:string|null};
  const userId=String(authUser.id||'');
  const email=authUser.email?String(authUser.email).trim().toLowerCase():null;
  if(!userId) throw new CoachAuthError('Authenticated user has no usable identity.',403);

  const operators=await rest<Array<{display_name:string|null;person_id:string|null}>>(token,`platform_superuser_operators?select=display_name,person_id&auth_user_id=eq.${encodeURIComponent(userId)}&active=eq.true&limit=1`);
  if(operators?.[0]){
    const personId=operators[0].person_id||null;
    return {userId,email,personId,displayName:operators[0].display_name||email||'SuperUser',isSuperUser:true,assignments:[],accessToken:token};
  }

  if(!headerToken) throw new CoachAuthError('Coach session token required.',401);
  const users=await rest<Array<{person_id:string|null;status:string}>>(token,`users?select=person_id,status&id=eq.${encodeURIComponent(userId)}&limit=1`);
  const personId=users?.[0]?.person_id||null;
  if(!personId||String(users?.[0]?.status||'').toUpperCase()!=='ACTIVE') throw new CoachAuthError('Coach access requires an active person identity.',403);
  const people=await rest<Array<{first_name:string;preferred_name:string|null}>>(token,`people?select=first_name,preferred_name&id=eq.${encodeURIComponent(personId)}&limit=1`);
  const assignments=await rest<CoachAssignment[]>(token,`coach_access_assignments?select=id,organization_id,team_id,program_id,role_key,is_head_coach&coach_person_id=eq.${encodeURIComponent(personId)}&status=eq.active`);
  if(!assignments.length) throw new CoachAuthError('This account is not assigned to an active Coach scope.',403);
  return {userId,email,personId,displayName:people?.[0]?.preferred_name||people?.[0]?.first_name||email||'Coach',isSuperUser:false,assignments,accessToken:token};
}
