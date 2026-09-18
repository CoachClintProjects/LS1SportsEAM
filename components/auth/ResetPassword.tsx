'use client';

import { FormEvent, useEffect, useState } from 'react';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

let client: SupabaseClient | null | undefined;
function supabase() {
  if (client !== undefined) return client;
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  client=url&&key?createClient(url,key):null;
  return client;
}

export function ResetPassword(){
 const router=useRouter();
 const[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 useEffect(()=>{const s=supabase();if(!s){setError('LS1Sports authentication is not configured.');return}
   s.auth.getSession().then(({data})=>setReady(Boolean(data.session)));
   const {data:listener}=s.auth.onAuthStateChange((event)=>{if(event==='PASSWORD_RECOVERY'||event==='SIGNED_IN')setReady(true)});
   return()=>listener.subscription.unsubscribe();
 },[]);
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();const s=supabase();if(!s)return;const fd=new FormData(e.currentTarget),password=String(fd.get('password')||''),confirm=String(fd.get('confirm')||'');setError('');setMessage('');
   if(password.length<8){setError('Password must be at least 8 characters.');return}if(password!==confirm){setError('Passwords do not match.');return}
   setBusy(true);const {error:err}=await s.auth.updateUser({password});setBusy(false);if(err){setError(err.message);return}setMessage('Password updated. You can now sign in.');await s.auth.signOut({scope:'local'});
 }
 return <main className="min-h-screen bg-[#070A09] px-6 py-12 text-[#F5F5F0]"><div className="mx-auto max-w-md rounded-2xl border border-[#242B26] bg-[#0E1210] p-7"><div className="text-[10px] font-black uppercase tracking-[.25em] text-[#FA4616]">Account recovery</div><h1 className="mt-3 text-3xl font-black">Reset password</h1>{!ready&&!error&&<p className="mt-4 text-sm text-[#9CA49E]">Open this page from the secure recovery link sent to your email.</p>}{ready&&<form onSubmit={submit} className="mt-6 space-y-4"><input name="password" type="password" required autoComplete="new-password" placeholder="New password" className="w-full rounded-xl border border-[#242B26] bg-[#070A09] px-4 py-3"/><input name="confirm" type="password" required autoComplete="new-password" placeholder="Confirm new password" className="w-full rounded-xl border border-[#242B26] bg-[#070A09] px-4 py-3"/><button disabled={busy} className="w-full rounded-xl bg-[#FA4616] px-4 py-3 font-black text-black">{busy?'Updating…':'Update password'}</button></form>}{error&&<div className="mt-4 text-sm text-red-300">{error}</div>}{message&&<div className="mt-4 text-sm text-emerald-300">{message}</div>}<button onClick={()=>router.push('/login')} className="mt-6 text-sm font-bold text-[#FA4616]">Back to sign in</button></div></main>
}
