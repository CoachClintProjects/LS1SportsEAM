import { redirect } from 'next/navigation';

export default async function AdminLegacyRoute({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  await params;
  redirect('/admin');
}
