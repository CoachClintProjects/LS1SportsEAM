import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { CorporateWebsite } from '@/components/marketing/CorporateWebsite';
import { getMarketingSite } from '@/lib/server/marketingSite';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata(): Promise<Metadata> {
  // Admin previews must not depend on public marketing data to reach sign-in.
  if (process.env.VERCEL_ENV === 'preview') {
    return { title: 'LS1Sports Preview', description: 'LS1Sports staff workspace.' };
  }

  const data = await getMarketingSite();

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
  if (process.env.VERCEL_ENV === 'preview') redirect('/login');

  const data = await getMarketingSite();

  if (!data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#070A09] px-6 text-white">
        <p className="text-sm text-neutral-400">The LS1Sports corporate site is not currently published.</p>
      </main>
    );
  }

  return <CorporateWebsite data={data} />;
}
