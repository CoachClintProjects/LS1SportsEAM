import type { Metadata } from 'next';
import { cache } from 'react';
import Link from 'next/link';

import { CorporateWebsite } from '@/components/marketing/CorporateWebsite';
import { getMarketingSite } from '@/lib/server/marketingSite';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Share one outcome between metadata and rendering, including backend failures.
const loadCorporateSite = cache(async () => {
  try {
    return { data: await getMarketingSite(), unavailable: false };
  } catch {
    console.error('Corporate site data is unavailable. Check Supabase project health and server configuration.');
    return { data: null, unavailable: true };
  }
});

export async function generateMetadata(): Promise<Metadata> {
  const { data } = await loadCorporateSite();

  if (!data) {
    return {
      title: 'LS1Sports',
      description: 'Sports operations, connected.',
    };
  }

  return {
    title: data.site.meta_title,
    description: data.site.meta_description,
  };
}

export default async function HomePage() {
  const { data, unavailable } = await loadCorporateSite();

  if (!data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#070A09] px-6 text-white">
        <section className="max-w-xl text-center space-y-5">
          <h1 className="text-3xl font-bold">LS1Sports</h1>
          <p className="text-sm text-neutral-400">{unavailable ? 'Our site content is temporarily unavailable. Please try again shortly.' : 'The LS1Sports corporate site is not currently published.'}</p>
          <div className="flex justify-center gap-5"><a href="/" className="text-orange-400">Try again</a><Link href="/login" className="text-orange-400">Sign in</Link></div>
        </section>
      </main>
    );
  }

  return <CorporateWebsite data={data} />;
}
