import { CorporateSitePage } from '@/components/corporate/CorporateSitePage';
import { getCorporateSite } from '@/lib/server/corporateSite';

export default async function PlatformPage() {
  const site = await getCorporateSite('platform');
  return <CorporateSitePage site={site} />;
}
