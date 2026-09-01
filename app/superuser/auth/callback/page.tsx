'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SuperUserAuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState('Verifying LS1Sports SuperUser access…');

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const accessToken = hash.get('access_token');
    if (!accessToken) { setMessage('No Supabase access token was returned. Request a new sign-in link.'); return; }
    void fetch('/api/superuser-auth/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accessToken }) })
      .then(async (response) => { const body = await response.json(); if (!response.ok) throw new Error(body.error || 'Authorization failed'); return body; })
      .then(() => router.replace('/superuser?view=onboarding-queue'))
      .catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'Authorization failed'));
  }, [router]);

  return <div className="min-h-full w-full bg-[#050707] p-8"><section className="mx-auto max-w-xl rounded-2xl border border-neutral-800 bg-[#090b0b] p-8"><div className="text-[9px] font-black uppercase tracking-[.25em] text-[#FA4616]">SUPERUSER AUTHORIZATION</div><h1 className="mt-3 text-2xl font-black text-white">Platform operator access</h1><p className="mt-3 text-sm leading-6 text-neutral-400">{message}</p></section></div>;
}
