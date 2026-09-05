import { redirect } from 'next/navigation';

export default async function AthleteLegacyRoute({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  await params;
  redirect('/athlete');
}
