import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://xedfstgwotzxnztpembv.supabase.co';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_Zas0f_4UBJNgjfYnHpjOxg_Ey0yOILb';

type Counts = Record<string, number | null>;
const sources = [
  ['organizations', 'public', 'organizations'], ['people', 'public', 'people'], ['athletes', 'public', 'athletes'], ['teams', 'public', 'teams'],
  ['teamMembers', 'public', 'team_memberships'], ['programs', 'public', 'programs'], ['seasons', 'public', 'seasons'], ['competitions', 'public', 'competitions'],
  ['results', 'public', 'competition_results'], ['messages', 'public', 'communication_messages'], ['auditEvents', 'public', 'audit_events'], ['integrations', 'public', 'integration_connections'],
] as const;

async function countTable(schema: string, table: string): Promise<number | null> {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=id`, { method: 'GET', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, Accept: 'application/json', 'Accept-Profile': schema, Prefer: 'count=exact', Range: '0-0' }, cache: 'no-store' });
    if (!response.ok) return null;
    const match = response.headers.get('content-range')?.match(/\/(\d+|\*)$/);
    return match?.[1] && match[1] !== '*' ? Number(match[1]) : null;
  } catch { return null; }
}

async function walk(directory: string, counts: Record<string, number>): Promise<void> {
  let entries; try { entries = await fs.readdir(directory, { withFileTypes: true }); } catch { return; }
  await Promise.all(entries.map(async entry => { if (['node_modules','.next','.git'].includes(entry.name)) return; const full=path.join(directory,entry.name); if(entry.isDirectory()) return walk(full,counts); const lower=entry.name.toLowerCase(); if(lower.endsWith('.tsx'))counts.tsxFiles++; if(lower.endsWith('.ts'))counts.tsFiles++; if(lower==='page.tsx'||lower==='page.ts')counts.pageFiles++; if(lower==='route.ts'||lower==='route.tsx')counts.routeFiles++; const normalized=full.replaceAll('\\','/').toLowerCase(); if(normalized.includes('/components/'))counts.componentFiles++; if(normalized.includes('/components/domains/'))counts.domainFiles++; if(normalized.includes('/components/team-manager/'))counts.teamManagerFiles++; if(normalized.includes('/components/hubs/'))counts.hubFiles++; if(normalized.includes('/components/hubs/superuser/'))counts.superuserFiles++; if(normalized.includes('/app/api/'))counts.apiRouteFiles++; }));
}

export async function GET() {
  const filesystem: Record<string, number> = { tsFiles:0, tsxFiles:0, routeFiles:0, pageFiles:0, componentFiles:0, domainFiles:0, teamManagerFiles:0, hubFiles:0, superuserFiles:0, apiRouteFiles:0 };
  await walk(process.cwd(), filesystem);
  const databaseEntries = await Promise.all(sources.map(async ([key,schema,table]) => [key, await countTable(schema,table)] as const));
  return NextResponse.json({ generatedAt:new Date().toISOString(), source:'filesystem + LS1SportsEAM Supabase', filesystem:{...filesystem,sourceFiles:filesystem.tsFiles+filesystem.tsxFiles}, database:Object.fromEntries(databaseEntries) as Counts, databaseProject:SUPABASE_URL }, { headers:{'Cache-Control':'no-store, max-age=0'} });
}
