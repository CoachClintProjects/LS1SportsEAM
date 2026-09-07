import { CorporateSitePage } from '@/components/corporate/CorporateSitePage';
import { getCorporateSite } from '@/lib/server/corporateSite';

export default async function SecurityPage() {
  const site = await getCorporateSite('security');
  return <CorporateSitePage site={site} />;
}
