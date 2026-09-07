import { CorporateSitePage } from '@/components/corporate/CorporateSitePage';
import { getCorporateSite } from '@/lib/server/corporateSite';

export default async function CompetitionPage() {
  const site = await getCorporateSite('competition');
  return <CorporateSitePage site={site} />;
}
