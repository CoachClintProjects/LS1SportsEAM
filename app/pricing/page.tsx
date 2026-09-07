import { CorporateSitePage } from '@/components/corporate/CorporateSitePage';
import { getCorporateSite } from '@/lib/server/corporateSite';

export default async function PricingPage() {
  const site = await getCorporateSite('pricing');
  return <CorporateSitePage site={site} />;
}
