import type { Metadata } from 'next';

import { CorporateWebsite } from '@/components/marketing/CorporateWebsite';
import { getMarketingSite } from '@/lib/server/marketingSite';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata(): Promise<Metadata> {
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
