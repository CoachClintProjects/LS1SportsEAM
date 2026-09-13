import { NextRequest,NextResponse } from 'next/server';
import { requireSuperUser,SuperUserAuthError,type SuperUserIdentity } from '@/lib/server/requireSuperUser';

const URL=process.env.NEXT_PUBLIC_SUPABASE_URL??'https://xedfstgwotzxnztpembv.supabase.co';
const KEY=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY??process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY??process.env.SUPABASE_ANON_KEY;
export const dynamic='force-dynamic'; export const revalidate=0;
function headers(actor:SuperUserIdentity){if(!KEY)throw new Error('Supabase authenticated access is not configured.');return {apikey:KEY,Authorization:`Bearer ${actor.accessToken}`,Accept:'application/json'};}
async function rest<T>(actor:SuperUserIdentity,path:string):Promise<T>{const r=await fetch(`${URL}/rest/v1/${path}`,{headers:headers(actor),cache:'no-store'});const t=await r.text();if(!r.ok)throw new Error(`Supabase ${path} returned ${r.status}: ${t.slice(0,400)}`);return (t?JSON.parse(t):null) as T;}
export async function GET(request:NextRequest){
 try{
  const actor=await requireSuperUser(request);
  const [metricsRows,capabilities]=await Promise.all([
   rest<Record<string,unknown>[]>(actor,'v_superuser_urws_metrics?select=*'),
   rest<Record<string,unknown>[]>(actor,"platform_capability_registry?select=capability_key,capability_name,domain,criticality,status,description,build_evidence,last_verified_at&or=(capability_key.ilike.*urws*,capability_name.ilike.*Exception*,capability_name.ilike.*Policy*)&order=capability_name.asc")
  ]);
  return NextResponse.json({metrics:metricsRows?.[0]??{},capabilities:capabilities??[],generatedAt:new Date().toISOString(),source:'LS1SportsEAM Supabase'},{headers:{'Cache-Control':'no-store, max-age=0'}});
 }catch(e){if(e instanceof SuperUserAuthError)return NextResponse.json({error:e.message},{status:e.status});return NextResponse.json({metrics:{},capabilities:[],generatedAt:new Date().toISOString(),source:'LS1SportsEAM Supabase',error:e instanceof Error?e.message:'URWS metrics unavailable.'},{status:500});}
}
