import { NextRequest, NextResponse } from 'next/server';
import { requireSuperUser, SuperUserAuthError } from '@/lib/server/requireSuperUser';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type SearchResult = {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  href: string;
};

function serviceHeaders() {
  if (!KEY) throw new Error('Search service credentials are not configured.');
  return { apikey: KEY, Authorization: `Bearer ${KEY}` };
}

async function rows(path: string) {
  if (!URL || !KEY) throw new Error('Search service credentials are not configured.');
  const response = await fetch(`${URL}/rest/v1/${path}`, { headers: serviceHeaders(), cache: 'no-store' });
  const text = await response.text();
  if (!response.ok) throw new Error(`Search source returned ${response.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : [];
}

function cleanQuery(value: string) {
  return value.replace(/[^\p{L}\p{N}@._+\- ]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
}

export async function GET(request: NextRequest) {
  try {
    await requireSuperUser(request);
    const query = cleanQuery(request.nextUrl.searchParams.get('q') || '');
    if (query.length < 2) return NextResponse.json({ query, results: [] });

    const pattern = `*${query}*`;
    const encoded = encodeURIComponent(pattern);
    const [people, organizations, teams, tasks, onboarding, knowledge] = await Promise.all([
      rows(`people?select=id,first_name,last_name,preferred_name,email,status&or=(first_name.ilike.${encoded},last_name.ilike.${encoded},preferred_name.ilike.${encoded},email.ilike.${encoded})&limit=8`).catch(() => []),
      rows(`organizations?select=id,name,legal_name,code,status&or=(name.ilike.${encoded},legal_name.ilike.${encoded},code.ilike.${encoded})&limit=8`).catch(() => []),
      rows(`teams?select=id,name,code,status,competitive_level&or=(name.ilike.${encoded},code.ilike.${encoded})&limit=8`).catch(() => []),
      rows(`platform_project_tasks?select=id,code,name,status,percent_complete&or=(code.ilike.${encoded},name.ilike.${encoded},description.ilike.${encoded})&limit=8`).catch(() => []),
      rows(`client_onboarding_cases?select=id,client_name,status,primary_admin_email,current_step&or=(client_name.ilike.${encoded},primary_admin_email.ilike.${encoded})&limit=8`).catch(() => []),
      rows(`knowledge_items?select=id,title,category,status&or=(title.ilike.${encoded},content.ilike.${encoded},category.ilike.${encoded})&limit=8`).catch(() => []),
    ]);

    const results: SearchResult[] = [
      ...people.map((item: Record<string, unknown>) => ({
        id: String(item.id),
        type: 'Person',
        title: [item.preferred_name || item.first_name, item.last_name].filter(Boolean).join(' ') || String(item.email || 'Person'),
        subtitle: [item.email, item.status].filter(Boolean).join(' · '),
        href: '/superuser?view=people',
      })),
      ...organizations.map((item: Record<string, unknown>) => ({
        id: String(item.id), type: 'Organization', title: String(item.name || item.legal_name || item.code || 'Organization'), subtitle: [item.code, item.status].filter(Boolean).join(' · '), href: '/superuser?view=organizations',
      })),
      ...teams.map((item: Record<string, unknown>) => ({
        id: String(item.id), type: 'Team', title: String(item.name || item.code || 'Team'), subtitle: [item.code, item.competitive_level, item.status].filter(Boolean).join(' · '), href: '/superuser?view=team-manager',
      })),
      ...tasks.map((item: Record<string, unknown>) => ({
        id: String(item.id), type: 'Project task', title: `${String(item.code || 'TASK')} · ${String(item.name || 'Unnamed')}`, subtitle: `${String(item.status || 'unknown')} · ${Number(item.percent_complete || 0)}%`, href: '/superuser?view=command-center',
      })),
      ...onboarding.map((item: Record<string, unknown>) => ({
        id: String(item.id), type: 'Onboarding', title: String(item.client_name || 'Client onboarding'), subtitle: `${String(item.status || 'unknown')} · step ${Number(item.current_step || 0)}/12`, href: `/superuser/onboarding?case=${encodeURIComponent(String(item.id))}`,
      })),
      ...knowledge.map((item: Record<string, unknown>) => ({
        id: String(item.id), type: 'Knowledge', title: String(item.title || 'Knowledge item'), subtitle: [item.category, item.status].filter(Boolean).join(' · '), href: '/superuser?view=knowledge',
      })),
    ].slice(0, 30);

    return NextResponse.json({ query, results, generatedAt: new Date().toISOString() }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (error) {
    if (error instanceof SuperUserAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Search failed.' }, { status: 500 });
  }
}
