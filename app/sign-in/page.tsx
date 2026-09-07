'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { ArrowLeft, ArrowRight, KeyRound, ShieldCheck } from 'lucide-react';

type CorporateConfig = {
  brand: { name: string; descriptor: string; mark: string; accent: string };
  authPolicy: {
    sso_enabled: boolean;
    sso_domain: string | null;
    magic_link_enabled: boolean;
    require_mfa: boolean;
    required_aal: 'aal1' | 'aal2';
  } | null;
};

export default function SignInPage() {
  const [config, setConfig] = useState<CorporateConfig | null>(null);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const supabase = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    return url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
  }, []);

  useEffect(() => {
    void fetch('/api/corporate-site', { cache: 'no-store' })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Unable to load sign-in configuration.');
        return body as CorporateConfig;
      })
      .then(setConfig)
      .catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'Unable to load sign-in configuration.'));
  }, []);

  async function requestMagicLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!config?.authPolicy?.magic_link_enabled) return;
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/superuser-auth/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to request sign-in.');
      setMessage(body.message);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : 'Unable to request sign-in.');
    } finally {
      setBusy(false);
    }
  }

  async function signInWithSso() {
    if (!supabase || !config?.authPolicy?.sso_enabled || !config.authPolicy.sso_domain) return;
    setBusy(true);
    setMessage('');
    const redirectTo = `${window.location.origin}/superuser/auth/callback`;
    const { data, error } = await supabase.auth.signInWithSSO({
      domain: config.authPolicy.sso_domain,
      options: { redirectTo },
    });
    if (error) {
      setMessage(error.message);
      setBusy(false);
      return;
    }
    if (data?.url) window.location.assign(data.url);
  }

  const brand = config?.brand;

  return (
    <div className="min-h-screen bg-[#050706] text-white">
      <div className="mx-auto flex min-h-screen max-w-7xl items-center px-5 py-10 sm:px-8 lg:px-10">
        <div className="grid w-full gap-14 lg:grid-cols-[1fr_520px] lg:items-center">
          <div className="max-w-xl">
            <Link href="/" className="inline-flex items-center gap-2 text-xs font-bold text-neutral-500 transition hover:text-white">
              <ArrowLeft className="h-4 w-4" />
              {brand?.name ?? ''}
            </Link>
            <div className="mt-16 text-[10px] font-black uppercase tracking-[0.25em]" style={{ color: brand?.accent }}>{brand?.descriptor}</div>
            <h1 className="mt-5 text-5xl font-black leading-[0.96] tracking-[-0.05em] sm:text-6xl">Privileged platform access.</h1>
            <p className="mt-6 max-w-lg text-base leading-7 text-neutral-400">SuperUser access is restricted to configured LS1Sports platform operators. Authentication policy and operator eligibility are enforced server-side.</p>
            <div className="mt-10 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
                <ShieldCheck className="h-5 w-5 text-neutral-500" />
                <div className="mt-4 text-sm font-bold">Multi-factor required</div>
                <div className="mt-2 text-xs leading-5 text-neutral-500">TOTP enrollment or challenge is required before a privileged session is issued.</div>
              </div>
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
                <KeyRound className="h-5 w-5 text-neutral-500" />
                <div className="mt-4 text-sm font-bold">Operator registry</div>
                <div className="mt-2 text-xs leading-5 text-neutral-500">Being authenticated is not enough. The account must also be active in the SuperUser operator registry.</div>
              </div>
            </div>
          </div>

          <section className="rounded-[30px] border border-white/10 bg-[#090b0a] p-7 shadow-2xl shadow-black/50 sm:p-9">
            <div className="flex items-center gap-3 border-b border-white/[0.07] pb-6">
              <div className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-[11px] font-black" style={{ color: brand?.accent }}>{brand?.mark}</div>
              <div>
                <div className="text-sm font-black">{brand?.name}</div>
                <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-neutral-600">SuperUser</div>
              </div>
            </div>

            {config?.authPolicy?.sso_enabled ? (
              <button
                type="button"
                onClick={() => void signInWithSso()}
                disabled={busy}
                className="mt-7 flex w-full items-center justify-between rounded-2xl bg-white px-5 py-4 text-left text-sm font-black text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span>Continue with SSO</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : null}

            {config?.authPolicy?.magic_link_enabled ? (
              <form onSubmit={requestMagicLink} className="mt-7">
                {config?.authPolicy?.sso_enabled ? <div className="mb-6 flex items-center gap-3"><div className="h-px flex-1 bg-white/[0.07]" /><span className="text-[9px] font-black uppercase tracking-[0.2em] text-neutral-700">or</span><div className="h-px flex-1 bg-white/[0.07]" /></div> : null}
                <label className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-500" htmlFor="email">Platform operator email</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  autoComplete="email"
                  className="mt-3 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-neutral-700 focus:border-white/25"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="mt-4 flex w-full items-center justify-between rounded-2xl border border-white/10 px-5 py-4 text-left text-sm font-black text-white transition hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span>Send secure sign-in link</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            ) : null}

            {message ? <div className="mt-6 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 text-xs leading-5 text-neutral-300">{message}</div> : null}
          </section>
        </div>
      </div>
    </div>
  );
}
