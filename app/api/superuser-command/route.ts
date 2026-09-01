import { NextResponse } from 'next/server';

type Row = Record<string, unknown>;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

async function read(table: string, query: string) {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Supabase environment variables are not configured.');
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, Accept: 'application/json', 'Accept-Profile': 'public' },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Supabase ${table} returned ${response.status}`);
  return response.json() as Promise<Row[]>;
}

export async function GET() {
  try {
    const projects = await read('platform_projects', 'select=id,name,status,start_date,target_date&code=eq.LS1SPORTS-IMPLEMENTATION&limit=1');
    const project = projects[0] ?? null;
    if (!project) return NextResponse.json({ project: null, tasks: [], raci: [], generatedAt: new Date().toISOString(), error: 'Implementation project has not been initialized.' }, { headers: { 'Cache-Control': 'no-store' } });
    const [tasks, raci] = await Promise.all([
      read('platform_project_tasks', `select=id,code,name,description,status,percent_complete,start_date,target_date,sort_order,blocker&project_id=eq.${project.id}&order=sort_order.asc`),
      read('platform_raci_assignments', `select=id,task_id,responsibility,person_id,role_id,notes&project_id=eq.${project.id}&order=created_at.asc`),
    ]);
    return NextResponse.json({ project, tasks, raci, generatedAt: new Date().toISOString() }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (error) {
    return NextResponse.json({ project: null, tasks: [], raci: [], generatedAt: new Date().toISOString(), error: error instanceof Error ? error.message : 'Command data unavailable' }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  }
}
