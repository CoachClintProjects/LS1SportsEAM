import { redirect } from 'next/navigation';

const VIEW_MAP: Record<string, string> = {
  athletes: 'athletes',
  schedule: 'schedule',
  registration: 'registration',
  finance: 'financial',
  documents: 'documents',
  compliance: 'compliance',
  comms: 'messages',
  family: 'members',
  transport: 'transport',
};

export default async function ParentLegacyRoute({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const view = VIEW_MAP[slug?.[0] || ''] || 'household';
  redirect(`/parent?view=${encodeURIComponent(view)}`);
}
