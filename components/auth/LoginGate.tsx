'use client';

import { FormEvent, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { ArrowLeft, CalendarDays, LogIn } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

function safeNext(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/admin';
  return value;
}

export function LoginGate() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = useMemo(() => safeNext(searchParams.get('next')), [searchParams]);
  const [mode, setMode] = useState<'login' | 'demo'>('login');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') || '').trim();
    const password = String(form.get('password') || '');

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError('Unable to sign in with those credentials.');
      setBusy(false);
      return;
    }

    router.replace(next);
    router.refresh();
  }

  async function handleDemo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    const body = Object.fromEntries(new FormData(event.currentTarget).entries());

    const response = await fetch('/api/demo-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(result.error || 'Unable to submit the demo request.');
      setBusy(false);
      return;
    }

    event.currentTarget.reset();
    setMessage('Demo request received.');
    setBusy(false);
  }

  return (
    <main className="min-h-screen bg-[#070A09] text-[#F5F5F0]">
      <div className="mx-auto flex min-h-screen max-w-[1180px] flex-col px-6 py-8 lg:px-10">
        <div className="flex items-center justify-between border-b border-[#242B26] pb-6">
          <button onClick={() => router.push('/')} className="text-left" aria-label="Return to LS1Sports corporate site">
            <div className="text-2xl font-black tracking-[-0.04em]">LS1<span className="text-[#FA4616]">Sports</span></div>
            <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.24em] text-[#9CA49E]">Enterprise Athlete Management</div>
          </button>
          <button onClick={() => router.push('/')} className="flex items-center gap-2 text-xs font-bold text-[#9CA49E] hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Corporate site
          </button>
        </div>

        <div className="grid flex-1 items-center gap-12 py-12 lg:grid-cols-[1.05fr_.95fr]">
          <section>
            <div className="text-[10px] font-black uppercase tracking-[.28em] text-[#FA4616]">Platform access</div>
            <h1 className="mt-5 max-w-2xl text-4xl font-black tracking-[-.045em] sm:text-5xl">Enter LS1Sports or schedule a working session.</h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-[#9CA49E]">Platform access is controlled. Organizations evaluating LS1Sports can request a demo without entering the operational application.</p>
          </section>

          <section className="rounded-2xl border border-[#242B26] bg-[#0E1210] p-5 sm:p-7">
            <div className="grid grid-cols-2 gap-2 rounded-xl border border-[#242B26] bg-[#070A09] p-1">
              <button onClick={() => { setMode('login'); setError(''); setMessage(''); }} className={`rounded-lg px-4 py-3 text-sm font-black ${mode === 'login' ? 'bg-[#FA4616] text-black' : 'text-[#9CA49E]'}`}>
                <span className="flex items-center justify-center gap-2"><LogIn className="h-4 w-4" /> Sign in</span>
              </button>
              <button onClick={() => { setMode('demo'); setError(''); setMessage(''); }} className={`rounded-lg px-4 py-3 text-sm font-black ${mode === 'demo' ? 'bg-[#FA4616] text-black' : 'text-[#9CA49E]'}`}>
                <span className="flex items-center justify-center gap-2"><CalendarDays className="h-4 w-4" /> Schedule demo</span>
              </button>
            </div>

            {mode === 'login' ? (
              <form onSubmit={handleLogin} className="mt-6 space-y-4">
                <div>
                  <label className="mb-2 block text-[10px] font-black uppercase tracking-[.18em] text-[#9CA49E]">Email</label>
                  <input name="email" type="email" required autoComplete="email" className="w-full rounded-xl border border-[#242B26] bg-[#070A09] px-4 py-3 text-sm outline-none focus:border-[#FA4616]" />
                </div>
                <div>
                  <label className="mb-2 block text-[10px] font-black uppercase tracking-[.18em] text-[#9CA49E]">Password</label>
                  <input name="password" type="password" required autoComplete="current-password" className="w-full rounded-xl border border-[#242B26] bg-[#070A09] px-4 py-3 text-sm outline-none focus:border-[#FA4616]" />
                </div>
                <button disabled={busy} className="w-full rounded-xl bg-[#FA4616] px-4 py-3 text-sm font-black text-black disabled:opacity-60">{busy ? 'Signing in…' : 'Sign in to LS1Sports'}</button>
              </form>
            ) : (
              <form onSubmit={handleDemo} className="mt-6 grid gap-4 sm:grid-cols-2">
                <div><label className="mb-2 block text-[10px] font-black uppercase tracking-[.18em] text-[#9CA49E]">Name</label><input name="name" required className="w-full rounded-xl border border-[#242B26] bg-[#070A09] px-4 py-3 text-sm outline-none focus:border-[#FA4616]" /></div>
                <div><label className="mb-2 block text-[10px] font-black uppercase tracking-[.18em] text-[#9CA49E]">Organization</label><input name="organization" required className="w-full rounded-xl border border-[#242B26] bg-[#070A09] px-4 py-3 text-sm outline-none focus:border-[#FA4616]" /></div>
                <div><label className="mb-2 block text-[10px] font-black uppercase tracking-[.18em] text-[#9CA49E]">Work email</label><input name="email" type="email" required className="w-full rounded-xl border border-[#242B26] bg-[#070A09] px-4 py-3 text-sm outline-none focus:border-[#FA4616]" /></div>
                <div><label className="mb-2 block text-[10px] font-black uppercase tracking-[.18em] text-[#9CA49E]">Role / title</label><input name="role_title" className="w-full rounded-xl border border-[#242B26] bg-[#070A09] px-4 py-3 text-sm outline-none focus:border-[#FA4616]" /></div>
                <div><label className="mb-2 block text-[10px] font-black uppercase tracking-[.18em] text-[#9CA49E]">Phone</label><input name="phone" type="tel" className="w-full rounded-xl border border-[#242B26] bg-[#070A09] px-4 py-3 text-sm outline-none focus:border-[#FA4616]" /></div>
                <div><label className="mb-2 block text-[10px] font-black uppercase tracking-[.18em] text-[#9CA49E]">Preferred timing</label><input name="preferred_timing" placeholder="e.g. weekday afternoons" className="w-full rounded-xl border border-[#242B26] bg-[#070A09] px-4 py-3 text-sm outline-none focus:border-[#FA4616]" /></div>
                <div className="sm:col-span-2"><label className="mb-2 block text-[10px] font-black uppercase tracking-[.18em] text-[#9CA49E]">What would you like to evaluate?</label><textarea name="message" rows={4} className="w-full rounded-xl border border-[#242B26] bg-[#070A09] px-4 py-3 text-sm outline-none focus:border-[#FA4616]" /></div>
                <button disabled={busy} className="sm:col-span-2 w-full rounded-xl bg-[#FA4616] px-4 py-3 text-sm font-black text-black disabled:opacity-60">{busy ? 'Submitting…' : 'Request a demo'}</button>
              </form>
            )}

            {error && <div className="mt-4 rounded-xl border border-red-900/60 bg-red-950/20 px-4 py-3 text-sm text-red-300">{error}</div>}
            {message && <div className="mt-4 rounded-xl border border-emerald-900/60 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-300">{message}</div>}
          </section>
        </div>
      </div>
    </main>
  );
}
