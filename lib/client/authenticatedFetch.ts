'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let supabase: SupabaseClient | null = null;

function getSupabaseClient() {
  if (supabase) return supabase;

  if (typeof window === 'undefined') {
    throw new Error('Authenticated Supabase access is only available in the browser.');
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Supabase browser configuration is missing.');
  }

  supabase = createClient(url, key);
  return supabase;
}

export async function authenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const client = getSupabaseClient();
  const { data, error } = await client.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new Error('Your LS1Sports session is missing or expired. Sign in again.');
  }

  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bearer ${data.session.access_token}`);

  return fetch(input, {
    ...init,
    headers,
  });
}
