const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://xedfstgwotzxnztpembv.supabase.co';
const PUBLIC_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;

export type AthleteIdentity = {
  userId: string;
  email: string | null;
  personId: string | null;
  athleteId: string | null;
  athleteNumber: string | null;
  ageBand: '5-8'|'9-11'|'12-14'|'15-17'|'18+'|null;
  isSuperUser: boolean;
  displayName: string;
  accessToken: string;
};

export class AthleteAuthError extends Error {
  status: number;
  constructor(message:string,status=401){super(message);this.name='AthleteAuthError';this.status=status;}
}

function headers(token:string){
  if(!PUBLIC_KEY) throw new AthleteAuthError('Athlete authentication is not configured.',500);
  return { apikey: PUBLIC_KEY, Authorization: `Bearer ${token}` };
}

async function rest<T>(token:string,path:string):Promise<T>{
  if(!SUPABASE_URL) throw new AthleteAuthError('Athlete authentication is not configured.',500);
  const response=await fetch(`${SUPABASE_URL}/rest/v1/${path}`,{headers:headers(token),cache:'no-store'});
  const text=await response.text();
  if(!response.ok) throw new AthleteAuthError(`Unable to verify Athlete authorization (${response.status}).`,response.status===401?401:500);
  return (text?JSON.parse(text):null) as T;
}

function ageBand(birthDate:string|null|undefined):AthleteIdentity['ageBand']{
  if(!birthDate) return null;
  const birth=new Date(`${birthDate}T00:00:00Z`);
  if(Number.isNaN(birth.getTime())) return null;
  const now=new Date();
  let age=now.getUTCFullYear()-birth.getUTCFullYear();
  const month=now.getUTCMonth()-birth.getUTCMonth();
  if(month<0||(month===0&&now.getUTCDate()<birth.getUTCDate())) age--;
  if(age<5) return null;
  if(age<=8) return '5-8';
  if(age<=11) return '9-11';
  if(age<=14) return '12-14';
  if(age<=17) return '15-17';
  return '18+';
}

export async function requireAthlete(request:Request):Promise<AthleteIdentity>{
  if(!SUPABASE_URL||!PUBLIC_KEY) throw new AthleteAuthError('Athlete authentication is not configured.',500);
  const auth=request.headers.get('authorization')||'';
  const token=auth.startsWith('Bearer ')?auth.slice(7).trim():'';
  if(!token) throw new AthleteAuthError('Authentication required.',401);

  const userResponse=await fetch(`${SUPABASE_URL}/auth/v1/user`,{headers:headers(token),cache:'no-store'});
  if(!userResponse.ok) throw new AthleteAuthError('Invalid or expired session.',401);
  const authUser=await userResponse.json() as {id?:string;email?:string|null};
  const userId=String(authUser.id||'');
  const email=authUser.email?String(authUser.email).trim().toLowerCase():null;
  if(!userId) throw new AthleteAuthError('Authenticated user has no usable identity.',403);

  const operators=await rest<Array<{display_name:string|null;person_id:string|null}>>(token,`platform_superuser_operators?select=display_name,person_id&auth_user_id=eq.${encodeURIComponent(userId)}&active=eq.true&limit=1`);
  if(operators?.[0]) return {userId,email,personId:operators[0].person_id||null,athleteId:null,athleteNumber:null,ageBand:null,isSuperUser:true,displayName:operators[0].display_name||email||'SuperUser',accessToken:token};

  const users=await rest<Array<{person_id:string|null;status:string}>>(token,`users?select=person_id,status&id=eq.${encodeURIComponent(userId)}&limit=1`);
  const personId=users?.[0]?.person_id||null;
  if(!personId||String(users?.[0]?.status||'').toUpperCase()!=='ACTIVE') throw new AthleteAuthError('Athlete Hub access requires an active person identity.',403);

  const people=await rest<Array<{first_name:string;preferred_name:string|null;birth_date:string|null}>>(token,`people?select=first_name,preferred_name,birth_date&id=eq.${encodeURIComponent(personId)}&limit=1`);
  const athletes=await rest<Array<{id:string;athlete_number:string|null;athlete_status:string}>>(token,`athletes?select=id,athlete_number,athlete_status&person_id=eq.${encodeURIComponent(personId)}&limit=1`);
  const athlete=athletes?.[0];
  if(!athlete?.id||String(athlete.athlete_status||'').toLowerCase()!=='active') throw new AthleteAuthError('This account is not linked to an active Athlete record.',403);
  const person=people?.[0];
  return {userId,email,personId,athleteId:athlete.id,athleteNumber:athlete.athlete_number||null,ageBand:ageBand(person?.birth_date),isSuperUser:false,displayName:person?.preferred_name||person?.first_name||email||'Athlete',accessToken:token};
}
