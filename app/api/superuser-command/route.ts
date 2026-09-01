import { NextResponse } from 'next/server';

type Row = Record<string, unknown>;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://xedfstgwotzxnztpembv.supabase.co';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_Zas0f_4UBJNgjfYnHpjOxg_Ey0yOILb';

async function read(table: string, query: string) {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Supabase environment variables are not configured.');
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, Accept: 'application/json', 'Accept-Profile': 'public' },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Supabase ${table} returned ${response.status}`);
  return response.json() as Promise<Row[]>;
}

async function count(table: string) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=id`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, Prefer: 'count=exact' },
    cache: 'no-store',
  });
  if (!response.ok) return null;
  const match = response.headers.get('content-range')?.match(/\/(\d+)$/);
  return match ? Number(match[1]) : 0;
}

export async function GET() {
  try {
    const projects = await read('platform_projects', 'select=id,name,status,start_date,target_date&code=eq.LS1SPORTS-IMPLEMENTATION&limit=1');
    const project = projects[0] ?? null;
    if (!project) return NextResponse.json({ project: null, milestones: [], tasks: [], raci: [], counts: {}, generatedAt: new Date().toISOString(), error: 'Implementation project has not been initialized.' });

    const [milestones, tasks, raci] = await Promise.all([
      read('platform_milestones', 'select=id,code,name,domain,status,target_percent,metric_definition,sort_order&order=sort_order.asc'),
      read('platform_project_tasks', `select=id,code,name,description,status,percent_complete,start_date,target_date,sort_order,blocker,evidence,milestone_id&project_id=eq.${project.id}&order=sort_order.asc`),
      read('platform_raci_assignments', `select=id,task_id,responsibility,person_id,role_id,notes&project_id=eq.${project.id}&order=created_at.asc`),
    ]);

    const countTables = ['organizations','people','athletes','teams','competitions','competition_results','import_jobs','data_quality_issues','approvals','audit_events','ai_agents','automation_definitions','integration_connections','assets'];
    const entries = await Promise.all(countTables.map(async table => [table, await count(table)] as const));

    return NextResponse.json({ project, milestones, tasks, raci, counts: Object.fromEntries(entries), generatedAt: new Date().toISOString() }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (error) {
    return NextResponse.json({ project: null, milestones: [], tasks: [], raci: [], counts: {}, generatedAt: new Date().toISOString(), error: error instanceof Error ? error.message : 'Command data unavailable' }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  }
}
