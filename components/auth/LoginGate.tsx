'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { ArrowLeft, Building2, CalendarDays, Eye, EyeOff, KeyRound, LogIn, Mail, ShieldCheck } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';

let supabase: SupabaseClient | null = null;

function getSupabaseClient() {
  if (supabase) return supabase;
  if (typeof window === 'undefined') throw new Error('Supabase browser authentication is unavailable during server prerender.');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase browser authentication is not configured.');
  supabase = createClient(url, key);
  return supabase;
}

function safeNext(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/admin';
  return value;
}

export function LoginGate() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedNext = searchParams.get('next');
  const next = useMemo(() => safeNext(requestedNext), [requestedNext]);
  const [mode, setMode] = useState<'login' | 'forgot' | 'sso' | 'demo'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function finishSession(client: SupabaseClient, accessToken: string) {
    let destination = next;
    const superUserResponse = await fetch('/api/superuser-auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken }),
    });
    if (superUserResponse.ok) {
      if (!requestedNext) destination = '/superuser';
    } else if (next.startsWith('/superuser')) {
      const result = await superUserResponse.json().catch(() => ({}));
      await client.auth.signOut({ scope: 'local' });
      throw new Error(result.error || 'This account is not authorized for Super User access.');
    }
    router.replace(destination);
    router.refresh();
  }

  useEffect(() => {
    if (searchParams.get('oauth') !== '1') return;
    let active = true;
    (async () => {
      try {
        const client = getSupabaseClient();
        const { data, error: sessionError } = await client.auth.getSession();
        if (!active || sessionError || !data.session?.access_token) return;
        setBusy(true);
        await finishSession(client, data.session.access_token);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Unable to complete secure sign in.');
      } finally {
        if (active) setBusy(false);
      }
    })();
    return () => { active = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') || '').trim();
    const password = String(form.get('password') || '');
    try {
      const client = getSupabaseClient();
      const { data, error: signInError } = await client.auth.signInWithPassword({ email, password });
      if (signInError || !data.session?.access_token) throw new Error('Unable to sign in with those credentials.');
      await finishSession(client, data.session.access_token);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Authentication is unavailable.');
      setBusy(false);
    }
  }

  async function handleResetRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    const email = String(new FormData(event.currentTarget).get('email') || '').trim();
    try {
      const client = getSupabaseClient();
      const { error: resetError } = await client.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
      if (resetError) throw resetError;
      setMessage('If that email belongs to an LS1Sports account, a secure password-reset link has been sent.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to request a password reset.');
    } finally { setBusy(false); }
  }

  async function handleOAuth(provider: 'google' | 'azure') {
    setBusy(true); setError(''); setMessage('');
    try {
      const client = getSupabaseClient();
      const callback = new URL('/login', window.location.origin);
      callback.searchParams.set('oauth', '1');
      callback.searchParams.set('next', next);
      const { error: oauthError } = await client.auth.signInWithOAuth({ provider, options: { redirectTo: callback.toString() } });
      if (oauthError) throw oauthError;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'This identity provider is not available yet.');
      setBusy(false);
    }
  }

  async function handleSso(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    const email = String(new FormData(event.currentTarget).get('work_email') || '').trim().toLowerCase();
    const domain = email.includes('@') ? email.split('@').pop() || '' : email;
    if (!domain || !domain.includes('.')) { setError('Enter your work email or organization domain.'); setBusy(false); return; }
    try {
      const client = getSupabaseClient();
      const callback = new URL('/login', window.location.origin);
      callback.searchParams.set('oauth', '1'); callback.searchParams.set('next', next);
      const { error: ssoError } = await client.auth.signInWithSSO({ domain, options: { redirectTo: callback.toString() } });
      if (ssoError) throw ssoError;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Enterprise SSO is not configured for that organization.');
      setBusy(false);
    }
  }

  async function handleDemo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    const body = Object.fromEntries(new FormData(event.currentTarget).entries());
    const response = await fetch('/api/demo-request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { setError(result.error || 'Unable to submit the demo request.'); setBusy(false); return; }
    event.currentTarget.reset(); setMessage('Demo request received.'); setBusy(false);
  }

  const setPanel = (value: typeof mode) => { setMode(value); setError(''); setMessage(''); };

  return <main className="min-h-screen bg-[#070A09] text-[#F5F5F0]">
    <div className="mx-auto flex min-h-screen max-w-[1180px] flex-col px-6 py-8 lg:px-10">
      <div className="flex items-center justify-between border-b border-[#242B26] pb-6">
        <button onClick={() => router.push('/')} className="text-left" aria-label="Return to LS1Sports corporate site"><div className="text-2xl font-black tracking-[-0.04em]">LS1<span className="text-[#FA4616]">Sports</span></div><div className="mt-1 text-[9px] font-bold uppercase tracking-[0.24em] text-[#9CA49E]">Enterprise Athlete Management</div></button>
        <button onClick={() => router.push('/')} className="flex items-center gap-2 text-xs font-bold text-[#9CA49E] hover:text-white"><ArrowLeft className="h-4 w-4" /> Corporate site</button>
      </div>
      <div className="grid flex-1 items-center gap-12 py-12 lg:grid-cols-[1.05fr_.95fr]">
        <section><div className="text-[10px] font-black uppercase tracking-[.28em] text-[#FA4616]">Platform access</div><h1 className="mt-5 max-w-2xl text-4xl font-black tracking-[-.045em] sm:text-5xl">Secure access to LS1Sports.</h1><p className="mt-6 max-w-xl text-base leading-7 text-[#9CA49E]">Email/password, password recovery, Google, Microsoft and organization SSO are available from one governed identity gateway.</p><div className="mt-6 flex items-center gap-2 text-xs text-[#8EA296]"><ShieldCheck className="h-4 w-4 text-emerald-400"/>Password-manager friendly · protected sessions · role-gated access</div></section>
        <section className="rounded-2xl border border-[#242B26] bg-[#0E1210] p-5 sm:p-7">
          <div className="grid grid-cols-2 gap-2 rounded-xl border border-[#242B26] bg-[#070A09] p-1"><button onClick={() => setPanel('login')} className={`rounded-lg px-4 py-3 text-sm font-black ${mode !== 'demo' ? 'bg-[#FA4616] text-black' : 'text-[#9CA49E]'}`}><span className="flex items-center justify-center gap-2"><LogIn className="h-4 w-4" /> Sign in</span></button><button onClick={() => setPanel('demo')} className={`rounded-lg px-4 py-3 text-sm font-black ${mode === 'demo' ? 'bg-[#FA4616] text-black' : 'text-[#9CA49E]'}`}><span className="flex items-center justify-center gap-2"><CalendarDays className="h-4 w-4" /> Schedule demo</span></button></div>
          {mode === 'login' && <div className="mt-6 space-y-4">
            <form onSubmit={handleLogin} className="space-y-4"><div><label className="mb-2 block text-[10px] font-black uppercase tracking-[.18em] text-[#9CA49E]">Email</label><input name="email" type="email" required autoComplete="username" className="w-full rounded-xl border border-[#242B26] bg-[#070A09] px-4 py-3 text-sm outline-none focus:border-[#FA4616]" /></div><div><div className="mb-2 flex items-center justify-between"><label className="text-[10px] font-black uppercase tracking-[.18em] text-[#9CA49E]">Password</label><button type="button" onClick={() => setPanel('forgot')} className="text-[11px] font-bold text-[#FA4616] hover:text-white">Forgot password?</button></div><div className="relative"><input name="password" type={showPassword ? 'text' : 'password'} required autoComplete="current-password" className="w-full rounded-xl border border-[#242B26] bg-[#070A09] px-4 py-3 pr-12 text-sm outline-none focus:border-[#FA4616]" /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(v => !v)} className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-[#9CA49E] hover:text-white">{showPassword ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}</button></div></div><button disabled={busy} className="w-full rounded-xl bg-[#FA4616] px-4 py-3 text-sm font-black text-black disabled:opacity-60">{busy ? 'Signing in…' : 'Sign in to LS1Sports'}</button></form>
            <div className="relative py-1"><div className="absolute inset-x-0 top-1/2 border-t border-[#242B26]"/><span className="relative mx-auto block w-fit bg-[#0E1210] px-3 text-[9px] font-black uppercase tracking-[.18em] text-[#667069]">or continue with</span></div>
            <div className="grid gap-2 sm:grid-cols-2"><button type="button" disabled={busy} onClick={() => void handleOAuth('google')} className="rounded-xl border border-[#303833] bg-[#070A09] px-4 py-3 text-sm font-bold hover:border-[#FA4616]">Google</button><button type="button" disabled={busy} onClick={() => void handleOAuth('azure')} className="rounded-xl border border-[#303833] bg-[#070A09] px-4 py-3 text-sm font-bold hover:border-[#FA4616]">Microsoft / Outlook</button></div>
            <button type="button" onClick={() => setPanel('sso')} className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#303833] px-4 py-3 text-sm font-bold text-[#C5CEC8] hover:border-[#FA4616]"><Building2 className="h-4 w-4"/>Enterprise SSO</button>
            <div className="flex items-center gap-2 rounded-xl border border-[#242B26] bg-[#070A09] px-3 py-2 text-[10px] text-[#718078]"><KeyRound className="h-3.5 w-3.5"/>Your browser or password manager can securely offer to save LS1Sports credentials.</div>
          </div>}
          {mode === 'forgot' && <form onSubmit={handleResetRequest} className="mt-6 space-y-4"><div className="flex items-center gap-2 text-sm font-black"><Mail className="h-4 w-4 text-[#FA4616]"/>Reset your password</div><p className="text-xs leading-5 text-[#9CA49E]">Enter your account email. We will send a secure recovery link without revealing whether an account exists.</p><input name="email" type="email" required autoComplete="email" placeholder="you@organization.com" className="w-full rounded-xl border border-[#242B26] bg-[#070A09] px-4 py-3 text-sm outline-none focus:border-[#FA4616]"/><button disabled={busy} className="w-full rounded-xl bg-[#FA4616] px-4 py-3 text-sm font-black text-black disabled:opacity-60">{busy ? 'Sending…' : 'Send secure reset link'}</button><button type="button" onClick={() => setPanel('login')} className="w-full text-xs font-bold text-[#9CA49E] hover:text-white">Back to sign in</button></form>}
          {mode === 'sso' && <form onSubmit={handleSso} className="mt-6 space-y-4"><div className="flex items-center gap-2 text-sm font-black"><Building2 className="h-4 w-4 text-[#FA4616]"/>Enterprise SSO</div><p className="text-xs leading-5 text-[#9CA49E]">Use your work email or organization domain. LS1Sports will route you to your configured identity provider.</p><input name="work_email" required autoComplete="email" placeholder="you@organization.com" className="w-full rounded-xl border border-[#242B26] bg-[#070A09] px-4 py-3 text-sm outline-none focus:border-[#FA4616]"/><button disabled={busy} className="w-full rounded-xl bg-[#FA4616] px-4 py-3 text-sm font-black text-black disabled:opacity-60">Continue with organization SSO</button><button type="button" onClick={() => setPanel('login')} className="w-full text-xs font-bold text-[#9CA49E] hover:text-white">Back to sign in</button></form>}
          {mode === 'demo' && <form onSubmit={handleDemo} className="mt-6 grid gap-4 sm:grid-cols-2"><div><label className="mb-2 block text-[10px] font-black uppercase tracking-[.18em] text-[#9CA49E]">Name</label><input name="name" required className="w-full rounded-xl border border-[#242B26] bg-[#070A09] px-4 py-3 text-sm outline-none focus:border-[#FA4616]" /></div><div><label className="mb-2 block text-[10px] font-black uppercase tracking-[.18em] text-[#9CA49E]">Organization</label><input name="organization" required className="w-full rounded-xl border border-[#242B26] bg-[#070A09] px-4 py-3 text-sm outline-none focus:border-[#FA4616]" /></div><div><label className="mb-2 block text-[10px] font-black uppercase tracking-[.18em] text-[#9CA49E]">Work email</label><input name="email" type="email" required className="w-full rounded-xl border border-[#242B26] bg-[#070A09] px-4 py-3 text-sm outline-none focus:border-[#FA4616]" /></div><div><label className="mb-2 block text-[10px] font-black uppercase tracking-[.18em] text-[#9CA49E]">Role / title</label><input name="role_title" className="w-full rounded-xl border border-[#242B26] bg-[#070A09] px-4 py-3 text-sm outline-none focus:border-[#FA4616]" /></div><div><label className="mb-2 block text-[10px] font-black uppercase tracking-[.18em] text-[#9CA49E]">Phone</label><input name="phone" type="tel" className="w-full rounded-xl border border-[#242B26] bg-[#070A09] px-4 py-3 text-sm outline-none focus:border-[#FA4616]" /></div><div><label className="mb-2 block text-[10px] font-black uppercase tracking-[.18em] text-[#9CA49E]">Preferred timing</label><input name="preferred_timing" placeholder="e.g. weekday afternoons" className="w-full rounded-xl border border-[#242B26] bg-[#070A09] px-4 py-3 text-sm outline-none focus:border-[#FA4616]" /></div><div className="sm:col-span-2"><label className="mb-2 block text-[10px] font-black uppercase tracking-[.18em] text-[#9CA49E]">What would you like to evaluate?</label><textarea name="message" rows={4} className="w-full rounded-xl border border-[#242B26] bg-[#070A09] px-4 py-3 text-sm outline-none focus:border-[#FA4616]" /></div><button disabled={busy} className="sm:col-span-2 w-full rounded-xl bg-[#FA4616] px-4 py-3 text-sm font-black text-black disabled:opacity-60">{busy ? 'Submitting…' : 'Request a demo'}</button></form>}
          {error && <div className="mt-4 rounded-xl border border-red-900/60 bg-red-950/20 px-4 py-3 text-sm text-red-300">{error}</div>}
          {message && <div className="mt-4 rounded-xl border border-emerald-900/60 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-300">{message}</div>}
        </section>
      </div>
    </div>
  </main>;
}
