'use client';

import { ReactNode, useEffect, useState } from 'react';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let supabase: SupabaseClient | null = null;

function getSupabaseClient() {
  if (supabase) return supabase;
  if (typeof window === 'undefined') {
    throw new Error('Super User browser auth is only available in the browser.');
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase browser configuration is missing.');

  supabase = createClient(url, key);
  return supabase;
}

function isProtectedApi(input: RequestInfo | URL) {
  const raw = input instanceof Request ? input.url : String(input);
  const url = new URL(raw, window.location.origin);
  return (
    url.origin === window.location.origin &&
    (
      url.pathname.startsWith('/api/superuser-') ||
      url.pathname.startsWith('/api/superuser/') ||
      url.pathname === '/api/competition-import' ||
      url.pathname === '/api/hub-navigation'
    )
  );
}

export default function SuperUserApiBoundary({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    let accessToken = '';
    const originalFetch = window.fetch.bind(window);
    let unsubscribe: (() => void) | null = null;

    async function initialize() {
      try {
        const client = getSupabaseClient();
        const { data, error: sessionError } = await client.auth.getSession();
        if (!active) return;

        if (sessionError || !data.session?.access_token) {
          setError('Your LS1Sports session is missing or expired. Sign in again.');
          return;
        }

        accessToken = data.session.access_token;

        window.fetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
          if (!isProtectedApi(input)) return originalFetch(input, init);

          const headers = new Headers(input instanceof Request ? input.headers : undefined);
          new Headers(init.headers || {}).forEach((value, key) => headers.set(key, value));
          headers.set('Authorization', `Bearer ${accessToken}`);

          if (input instanceof Request) {
            return originalFetch(new Request(input, { ...init, headers }));
          }

          return originalFetch(input, { ...init, headers });
        };

        const { data: authSubscription } = client.auth.onAuthStateChange((_event, session) => {
          accessToken = session?.access_token || '';
          if (!accessToken && active) {
            setReady(false);
            setError('Your LS1Sports session ended. Sign in again.');
          }
        });
        unsubscribe = () => authSubscription.subscription.unsubscribe();

        setReady(true);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Unable to initialize Super User session.');
      }
    }

    void initialize();

    return () => {
      active = false;
      unsubscribe?.();
      window.fetch = originalFetch;
    };
  }, []);

  if (error) {
    return (
      <section className="rounded-2xl border border-red-900/60 bg-red-950/20 p-6 text-sm text-red-200">
        {error}
      </section>
    );
  }

  if (!ready) {
    return (
      <section className="rounded-2xl border border-neutral-800 bg-[#090b0b] p-6 text-sm text-neutral-500">
        Verifying Super User session…
      </section>
    );
  }

  return <>{children}</>;
}
