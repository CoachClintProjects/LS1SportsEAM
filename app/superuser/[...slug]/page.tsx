import { redirect } from 'next/navigation';

const VIEW_MAP: Record<string, string> = {
  command: 'command-center',
  map: 'project-map',
  milestones: 'milestones',
  metrics: 'metrics',
  core: 'platform',
  security: 'identity',
  orgs: 'organizations',
  people: 'people',
  athletes: 'athletes',
  competition: 'imports',
  finance: 'financial-overview',
  facilities: 'facilities',
  procurement: 'procurement',
  payroll: 'payroll',
  workflow: 'workflow',
  rules: 'workflow',
  ai: 'agents',
  integrations: 'imports',
  reporting: 'reporting',
  audit: 'audit',
  engineering: 'product',
  compliance: 'compliance',
};

export default async function SuperUserLegacyRoute({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const view = VIEW_MAP[slug?.[0] || ''] || 'command-center';
  redirect(`/superuser?view=${encodeURIComponent(view)}`);
}
