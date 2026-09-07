'use client';

import Image from 'next/image';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { ArrowRight, ShieldCheck } from 'lucide-react';

type CorporateConfig = {
  brand: { name: string; mark: string; accent: string };
  signInCopy: { workspace_label: string };
  mfaCopy: {
    eyebrow: string;
    title: string;
    summary: string;
    enroll_title: string;
    enroll_body: string;
    challenge_title: string;
    challenge_body: string;
    code_label: string;
    verify_label: string;
    secret_label: string;
    loading_label: string;
  };
  superuserEntry: { href: string };
};

type MfaMode = 'loading' | 'enroll' | 'challenge' | 'error';

export default function SuperUserAuthCallbackPage() {
  const router = useRouter();
  const [config, setConfig] = useState<CorporateConfig | null>(null);
  const [mode, setMode] = useState<MfaMode>('loading');
  const [message, setMessage] = useState('');
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [busy, setBusy] = useState(false);

  const supabase = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    return url && key ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, flowType: 'pkce' } }) : null;
  }, []);

  useEffect(() => {
    if (!supabase) {
      setMode('error');
      setMessage('Authentication client is not configured.');
      return;
    }

    void (async () => {
      try {
        const configResponse = await fetch('/api/corporate-site', { cache: 'no-store' });
        const configBody = await configResponse.json();
        if (!configResponse.ok) throw new Error(configBody.error || 'Unable to load authentication configuration.');
        const loadedConfig = configBody as CorporateConfig;
        setConfig(loadedConfig);

        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        const accessToken = hash.get('access_token');
        const refreshToken = hash.get('refresh_token');
        const code = new URLSearchParams(window.location.search).get('code');

        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          if (error) throw error;
        } else if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else {
          const { data } = await supabase.auth.getSession();
          if (!data.session) throw new Error('No authenticated Supabase session was returned.');
        }

        const { data: aal, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (aalError) throw aalError;
        if (aal.currentLevel === 'aal2') {
          await issuePrivilegedSession(loadedConfig);
          return;
        }

        const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
        if (factorsError) throw factorsError;
        const verifiedTotp = factors.totp.find((factor) => factor.status === 'verified');

        if (verifiedTotp) {
          setFactorId(verifiedTotp.id);
          setMode('challenge');
          return;
        }

        const { data: enrollment, error: enrollmentError } = await supabase.auth.mfa.enroll({
          factorType: 'totp',
          friendlyName: `${loadedConfig.brand.name} ${loadedConfig.signInCopy.workspace_label}`,
        });
        if (enrollmentError) throw enrollmentError;
        setFactorId(enrollment.id);
        setQrCode(enrollment.totp.qr_code);
        setSecret(enrollment.totp.secret);
        setMode('enroll');
      } catch (error: unknown) {
        setMode('error');
        setMessage(error instanceof Error ? error.message : 'Authorization failed.');
      }
    })();
  }, [supabase]);

  async function issuePrivilegedSession(loadedConfig = config) {
    if (!supabase || !loadedConfig) throw new Error('Authentication configuration is unavailable.');
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    const token = data.session?.access_token;
    if (!token) throw new Error('No access token is available after authentication.');

    const response = await fetch('/api/superuser-auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken: token }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Unable to establish privileged session.');
    router.replace(loadedConfig.superuserEntry.href);
  }

  async function verifyMfa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !factorId || !config) return;
    setBusy(true);
    setMessage('');
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: verificationCode.trim() });
      if (error) throw error;
      await issuePrivilegedSession(config);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : 'Verification failed.');
    } finally {
      setBusy(false);
    }
  }

  const copy = config?.mfaCopy;

  return (
    <div className="min-h-screen bg-[#050706] px-5 py-10 text-white sm:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-80px)] max-w-5xl items-center justify-center">
        <section className="w-full max-w-2xl rounded-[30px] border border-white/10 bg-[#090b0a] p-7 shadow-2xl shadow-black/50 sm:p-10">
          <div className="flex items-center gap-3 border-b border-white/[0.07] pb-6">
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-[11px] font-black" style={{ color: config?.brand.accent }}>{config?.brand.mark}</div>
            <ShieldCheck className="h-5 w-5 text-neutral-600" />
          </div>

          <div className="pt-7">
            {copy ? <div className="text-[10px] font-black uppercase tracking-[0.24em]" style={{ color: config?.brand.accent }}>{copy.eyebrow}</div> : null}
            <h1 className="mt-4 text-3xl font-black tracking-[-0.04em] sm:text-4xl">{copy?.title}</h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-neutral-400">{copy?.summary}</p>
          </div>

          {mode === 'loading' ? <div className="mt-8 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5 text-sm text-neutral-400">{copy?.loading_label}</div> : null}

          {mode === 'enroll' && copy ? (
            <div className="mt-8 rounded-[24px] border border-white/[0.08] bg-white/[0.025] p-6">
              <h2 className="text-lg font-black">{copy.enroll_title}</h2>
              <p className="mt-2 text-sm leading-6 text-neutral-500">{copy.enroll_body}</p>
              <div className="mt-6 grid gap-6 sm:grid-cols-[220px_1fr] sm:items-center">
                {qrCode ? <div className="overflow-hidden rounded-2xl bg-white p-3"><Image src={qrCode} width={196} height={196} alt="" unoptimized /></div> : null}
                <div>
                  {secret ? <><div className="text-[9px] font-black uppercase tracking-[0.18em] text-neutral-600">{copy.secret_label}</div><div className="mt-2 break-all rounded-xl border border-white/[0.07] bg-black/20 p-3 font-mono text-xs text-neutral-300">{secret}</div></> : null}
                </div>
              </div>
            </div>
          ) : null}

          {mode === 'challenge' && copy ? (
            <div className="mt-8 rounded-[24px] border border-white/[0.08] bg-white/[0.025] p-6">
              <h2 className="text-lg font-black">{copy.challenge_title}</h2>
              <p className="mt-2 text-sm leading-6 text-neutral-500">{copy.challenge_body}</p>
            </div>
          ) : null}

          {(mode === 'enroll' || mode === 'challenge') && copy ? (
            <form onSubmit={verifyMfa} className="mt-6">
              <label htmlFor="mfa-code" className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-500">{copy.code_label}</label>
              <input id="mfa-code" inputMode="numeric" autoComplete="one-time-code" value={verificationCode} onChange={(event) => setVerificationCode(event.target.value)} required className="mt-3 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3.5 font-mono text-lg tracking-[0.16em] text-white outline-none transition focus:border-white/25" />
              <button type="submit" disabled={busy} className="mt-4 flex w-full items-center justify-between rounded-2xl bg-white px-5 py-4 text-left text-sm font-black text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-60">
                <span>{copy.verify_label}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          ) : null}

          {message ? <div className="mt-6 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 text-xs leading-5 text-neutral-300">{message}</div> : null}
        </section>
      </div>
    </div>
  );
}
