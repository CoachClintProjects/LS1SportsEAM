import type { AdminIdentity } from '@/lib/server/requireAdmin';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://xedfstgwotzxnztpembv.supabase.co';
const PUBLIC_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;

export function adminHeaders(actor:AdminIdentity,prefer='return=representation',extra:HeadersInit={}){
  if(!PUBLIC_KEY)throw new Error('Supabase authenticated access is not configured.');
  const headers=new Headers(extra);
  headers.set('apikey',PUBLIC_KEY);
  headers.set('Authorization',`Bearer ${actor.accessToken}`);
  headers.set('Content-Type','application/json');
  if(prefer&&!headers.has('Prefer'))headers.set('Prefer',prefer);
  return headers;
}

export async function adminRest<T=any>(actor:AdminIdentity,path:string,init:RequestInit={}):Promise<T>{
  if(!SUPABASE_URL||!PUBLIC_KEY)throw new Error('Supabase authenticated access is not configured.');
  const response=await fetch(`${SUPABASE_URL}/rest/v1/${path}`,{...init,headers:adminHeaders(actor,'return=representation',init.headers),cache:'no-store'});
  const text=await response.text();
  if(!response.ok)throw new Error(`Supabase ${path} returned ${response.status}: ${text.slice(0,500)}`);
  return (text?JSON.parse(text):null) as T;
}
