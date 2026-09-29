'use client';

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export async function authenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new Error('Your LS1Sports session is missing or expired. Sign in again.');
  }

  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bearer ${data.session.access_token}`);
  const url = typeof input === 'string' ? input : input instanceof URL ? input.pathname : input.url;
  if (url.startsWith('/api/admin-') && url !== '/api/admin-context') {
    const selected = sessionStorage.getItem(`ls1-admin-organization:${data.session.user.id}`);
    if (selected) headers.set('x-ls1-admin-organization', selected);
  }

  return fetch(input, {
    ...init,
    headers,
  });
}
