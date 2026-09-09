'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

function getClient() {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase browser configuration is missing.');
  client = createClient(url, key);
  return client;
}

export default function SuperUserSessionBridge() {
  const router = useRouter();
  const [message, setMessage] = useState('Restoring your Super User workspace…');

  useEffect(() => {
    let active = true;

    async function restore() {
      try {
        const supabase = getClient();
        const { data, error } = await supabase.auth.getSession();
        if (error || !data.session?.access_token) {
          router.replace('/login?next=/superuser');
          return;
        }

        const response = await fetch('/api/superuser-auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessToken: data.session.access_token }),
          cache: 'no-store',
        });
        const json = await response.json().catch(() => ({}));
        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            router.replace('/login?next=/superuser');
            return;
          }
          throw new Error(json.error || 'Unable to restore Super User session.');
        }

        if (!active) return;
        setMessage('Super User session restored. Opening Command Center…');
        router.replace('/superuser');
        router.refresh();
      } catch (cause) {
        if (active) setMessage(cause instanceof Error ? cause.message : 'Unable to restore Super User session.');
      }
    }

    void restore();
    return () => { active = false; };
  }, [router]);

  return (
    <div className="flex min-h-[55vh] items-center justify-center p-8 text-white">
      <div className="max-w-md rounded-2xl border border-neutral-800 bg-[#090b0b] p-6 text-center shadow-xl">
        <div className="text-sm font-black text-white">Switching to Super User</div>
        <div className="mt-2 text-sm leading-6 text-neutral-400">{message}</div>
      </div>
    </div>
  );
}
