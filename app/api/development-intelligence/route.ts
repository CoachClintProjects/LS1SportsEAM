import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://vahkvgyhxvrnybmnjkhj.supabase.co';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_zB6PZU5UiPOxwWlxVnYsgw_U0DIuXYK';

type Counts = Record<string, number | null>;

const sources = [
  ['organizations', 'org', 'organization'],
  ['people', 'core', 'person'],
  ['athletes', 'athlete', 'athlete'],
  ['teams', 'sportops', 'team'],
  ['teamMembers', 'sportops', 'team_member'],
  ['programs', 'sportops', 'program'],
  ['seasons', 'sportops', 'season'],
  ['competitions', 'sportops', 'competition'],
  ['results', 'sportops', 'competition_result'],
  ['messages', 'communication', 'message'],
  ['auditEvents', 'audit', 'event'],
  ['integrations', 'platform', 'integration'],
] as const;

async function countTable(schema: string, table: string): Promise<number | null> {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, {
      method: 'GET',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        Accept: 'application/json',
        'Accept-Profile': schema,
        Prefer: 'count=exact',
        Range: '0-0',
      },
      cache: 'no-store',
    });
    if (!response.ok) return null;
    const contentRange = response.headers.get('content-range');
    const match = contentRange?.match(/\/([0-9]+|\*)$/);
    return match?.[1] && match[1] !== '*' ? Number(match[1]) : null;
  } catch {
    return null;
  }
}

async function walk(directory: string, counts: Record<string, number>): Promise<void> {
  let entries;
  try { entries = await fs.readdir(directory, { withFileTypes: true }); } catch { return; }
  await Promise.all(entries.map(async (entry) => {
    if (['node_modules', '.next', '.git'].includes(entry.name)) return;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(fullPath, counts);
    const lower = entry.name.toLowerCase();
    if (lower.endsWith('.tsx')) counts.tsxFiles += 1;
    if (lower.endsWith('.ts')) counts.tsFiles += 1;
    if (lower === 'page.tsx' || lower === 'page.ts') counts.pageFiles += 1;
    if (lower === 'route.ts' || lower === 'route.tsx') counts.routeFiles += 1;
    const normalized = fullPath.replaceAll('\\', '/').toLowerCase();
    if (normalized.includes('/components/')) counts.componentFiles += 1;
    if (normalized.includes('/components/domains/')) counts.domainFiles += 1;
    if (normalized.includes('/components/team-manager/')) counts.teamManagerFiles += 1;
    if (normalized.includes('/components/hubs/')) counts.hubFiles += 1;
    if (normalized.includes('/components/hubs/superuser/')) counts.superuserFiles += 1;
    if (normalized.includes('/app/api/')) counts.apiRouteFiles += 1;
  }));
}

export async function GET() {
  const projectRoot = process.cwd();
  const filesystem: Record<string, number> = { tsFiles: 0, tsxFiles: 0, routeFiles: 0, pageFiles: 0, componentFiles: 0, domainFiles: 0, teamManagerFiles: 0, hubFiles: 0, superuserFiles: 0, apiRouteFiles: 0 };
  await walk(projectRoot, filesystem);

  const databaseEntries = await Promise.all(
    sources.map(async ([key, schema, table]) => [key, await countTable(schema, table)] as const),
  );
  const database = Object.fromEntries(databaseEntries) as Counts;

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    source: 'filesystem + supabase',
    filesystem: { ...filesystem, sourceFiles: filesystem.tsFiles + filesystem.tsxFiles },
    database,
    databaseProject: SUPABASE_URL,
  }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
}
