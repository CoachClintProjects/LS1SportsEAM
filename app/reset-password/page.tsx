'use client';

import { FormEvent, useEffect, useState } from 'react';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Eye, EyeOff, KeyRound, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';

let supabase: SupabaseClient | null = null;
function getSupabaseClient() {
  if (supabase) return supabase;
  if (typeof window === 'undefined') throw new Error('Password recovery is only available in the browser.');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase browser authentication is not configured.');
  supabase = createClient(url, key);
  return supabase;
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    const client = getSupabaseClient();
    client.auth.getSession().then(({ data }) => { if (active) setReady(Boolean(data.session)); });
    const { data } = client.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === 'PASSWORD_RECOVERY' || session) setReady(true);
    });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    const form = new FormData(event.currentTarget);
    const password = String(form.get('password') || '');
    const confirm = String(form.get('confirm') || '');
    if (password.length < 12) { setError('Use at least 12 characters for your new password.'); setBusy(false); return; }
    if (password !== confirm) { setError('Passwords do not match.'); setBusy(false); return; }
    try {
      const client = getSupabaseClient();
      const { error: updateError } = await client.auth.updateUser({ password });
      if (updateError) throw updateError;
      setMessage('Password updated. You can now sign in with your new password.');
      await client.auth.signOut({ scope: 'local' });
      window.setTimeout(() => router.replace('/login'), 900);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update your password.');
    } finally { setBusy(false); }
  }

  return <main className="min-h-screen bg-[#070A09] px-6 py-10 text-white">
    <div className="mx-auto max-w-xl">
      <div className="text-2xl font-black tracking-[-0.04em]">LS1<span className="text-[#FA4616]">Sports</span></div>
      <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.24em] text-[#9CA49E]">Secure account recovery</div>
      <section className="mt-12 rounded-2xl border border-[#242B26] bg-[#0E1210] p-6 sm:p-8">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.2em] text-emerald-400"><ShieldCheck className="h-4 w-4"/>Identity gateway</div>
        <h1 className="mt-3 text-3xl font-black">Choose a new password</h1>
        <p className="mt-2 text-sm leading-6 text-[#9CA49E]">This page only accepts a valid recovery session from the secure reset link sent to your email.</p>
        {!ready ? <div className="mt-6 rounded-xl border border-amber-900/50 bg-amber-950/10 p-4 text-sm text-amber-200">The recovery session is missing or still loading. Open this page from the latest LS1Sports reset email, or request another reset link from Sign in.</div> : <form onSubmit={updatePassword} className="mt-6 space-y-4">
          <div><label className="mb-2 block text-[10px] font-black uppercase tracking-[.18em] text-[#9CA49E]">New password</label><div className="relative"><input name="password" type={showPassword ? 'text' : 'password'} required minLength={12} autoComplete="new-password" className="w-full rounded-xl border border-[#242B26] bg-[#070A09] px-4 py-3 pr-12 text-sm outline-none focus:border-[#FA4616]"/><button type="button" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-[#9CA49E] hover:text-white">{showPassword ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}</button></div></div>
          <div><label className="mb-2 block text-[10px] font-black uppercase tracking-[.18em] text-[#9CA49E]">Confirm password</label><input name="confirm" type={showPassword ? 'text' : 'password'} required minLength={12} autoComplete="new-password" className="w-full rounded-xl border border-[#242B26] bg-[#070A09] px-4 py-3 text-sm outline-none focus:border-[#FA4616]"/></div>
          <div className="flex items-center gap-2 rounded-xl border border-[#242B26] bg-[#070A09] p-3 text-[10px] text-[#8B9890]"><KeyRound className="h-4 w-4"/>Minimum 12 characters. Your password manager can generate and store a stronger unique password.</div>
          <button disabled={busy} className="w-full rounded-xl bg-[#FA4616] px-4 py-3 text-sm font-black text-black disabled:opacity-60">{busy ? 'Updating…' : 'Update password'}</button>
        </form>}
        {error && <div className="mt-4 rounded-xl border border-red-900/60 bg-red-950/20 px-4 py-3 text-sm text-red-300">{error}</div>}
        {message && <div className="mt-4 rounded-xl border border-emerald-900/60 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-300">{message}</div>}
        <button onClick={() => router.replace('/login')} className="mt-5 text-xs font-bold text-[#9CA49E] hover:text-white">Return to sign in</button>
      </section>
    </div>
  </main>;
}
