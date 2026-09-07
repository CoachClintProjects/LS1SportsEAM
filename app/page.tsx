import { CorporateSitePage } from '@/components/corporate/CorporateSitePage';
import { getCorporateSite } from '@/lib/server/corporateSite';

export default async function HomePage() {
  const site = await getCorporateSite('home');
  return <CorporateSitePage site={site} />;
}
