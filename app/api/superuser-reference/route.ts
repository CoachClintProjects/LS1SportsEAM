import { NextRequest, NextResponse } from 'next/server';
import { requireSuperUser, SuperUserAuthError } from '@/lib/server/requireSuperUser';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type RefConfig = { label: string; select: string; search: string[]; display: string[] };
const REFS: Record<string, RefConfig> = {
  people: { label: 'People', select: 'id,first_name,last_name,preferred_name,email,status', search: ['first_name','last_name','preferred_name','email'], display: ['preferred_name','first_name','last_name','email'] },
  organizations: { label: 'Organizations', select: 'id,code,name,legal_name,status', search: ['code','name','legal_name'], display: ['name','legal_name','code'] },
  legal_entities: { label: 'Legal entities', select: 'id,code,name,status', search: ['code','name'], display: ['name','code'] },
  facilities: { label: 'Facilities', select: 'id,code,name,facility_type,status', search: ['code','name','facility_type'], display: ['name','code','facility_type'] },
  assets: { label: 'Assets', select: 'id,asset_number,name,asset_type,status', search: ['asset_number','name','asset_type'], display: ['name','asset_number','asset_type'] },
  chart_of_accounts: { label: 'GL accounts', select: 'id,account_code,account_name,account_type,active', search: ['account_code','account_name','account_type'], display: ['account_name','account_code','account_type'] },
  accounting_ledgers: { label: 'Ledgers', select: 'id,code,name,currency,is_primary', search: ['code','name'], display: ['name','code','currency'] },
  customers: { label: 'Customers', select: 'id,customer_code,display_name,status', search: ['customer_code','display_name'], display: ['display_name','customer_code'] },
  invoices: { label: 'Invoices', select: 'id,invoice_number,status,total,balance_due', search: ['invoice_number','status'], display: ['invoice_number','status'] },
  vendors: { label: 'Vendors', select: 'id,vendor_code,name,status', search: ['vendor_code','name'], display: ['name','vendor_code'] },
  vendor_bills: { label: 'Vendor bills', select: 'id,bill_number,status,total,balance_due', search: ['bill_number','status'], display: ['bill_number','status'] },
  budgets: { label: 'Budgets', select: 'id,name,fiscal_year,status', search: ['name','status'], display: ['name','fiscal_year','status'] },
  cost_centers: { label: 'Cost centers', select: 'id,code,name,active', search: ['code','name'], display: ['name','code'] },
  profit_centers: { label: 'Profit centers', select: 'id,code,name,active', search: ['code','name'], display: ['name','code'] },
  teams: { label: 'Teams', select: 'id,code,name,competitive_level,status', search: ['code','name','competitive_level'], display: ['name','code','competitive_level'] },
  athletes: { label: 'Athletes', select: 'id,athlete_number,status,person_id', search: ['athlete_number','status'], display: ['athlete_number','status'] },
  competitions: { label: 'Competitions', select: 'id,name,competition_type,starts_at,status', search: ['name','competition_type','status'], display: ['name','competition_type','status'] },
  competition_events: { label: 'Competition events', select: 'id,code,name,sequence_no,competition_id', search: ['code','name'], display: ['name','code','sequence_no'] },
  competition_entries: { label: 'Competition entries', select: 'id,competition_event_id,athlete_id,team_id,entry_status,eligibility_status', search: ['entry_status','eligibility_status'], display: ['entry_status','eligibility_status'] },
  competition_results: { label: 'Competition results', select: 'id,competition_entry_id,result_value,result_unit,rank,status,validation_status,canonical', search: ['status','validation_status'], display: ['result_value','result_unit','status','validation_status'] },
  roles: { label: 'Roles', select: 'id,code,name,privilege_level', search: ['code','name'], display: ['name','code'] },
  permissions: { label: 'Permissions', select: 'id,code,name,resource,action', search: ['code','name','resource','action'], display: ['name','code','resource','action'] },
  platform_project_tasks: { label: 'Project tasks', select: 'id,code,name,status,percent_complete', search: ['code','name','status'], display: ['name','code','status'] },
  platform_milestone_units: { label: 'Implementation units', select: 'id,unit_key,status,implementation_percent,operational_percent,validation_percent', search: ['unit_key','status'], display: ['unit_key','status'] },
  workflow_definitions: { label: 'Workflow definitions', select: 'id,code,name,version,status', search: ['code','name','status'], display: ['name','code','status'] },
  workflow_tasks: { label: 'Workflow tasks', select: 'id,task_code,status,assigned_to,due_at', search: ['task_code','status'], display: ['task_code','status'] },
  purchase_requests: { label: 'Purchase requests', select: 'id,status,amount,currency,purpose', search: ['status','purpose'], display: ['purpose','status','amount'] },
  purchase_orders: { label: 'Purchase orders', select: 'id,po_number,status,total,currency', search: ['po_number','status'], display: ['po_number','status'] },
  payroll_runs: { label: 'Payroll runs', select: 'id,period_start,period_end,pay_date,status,gross_total,net_total', search: ['status'], display: ['period_start','period_end','status'] },
  ai_agents: { label: 'AI agents', select: 'id,code,name,risk_level,status', search: ['code','name','risk_level','status'], display: ['name','code','status'] },
};

function safeTerm(value: string) { return value.replace(/[(),.*]/g, ' ').trim().slice(0, 120); }
function labelFor(row: Record<string, unknown>, config: RefConfig) {
  const values = config.display.map(key => row[key]).filter(value => value !== null && value !== undefined && String(value).trim() !== '').map(String);
  return values.join(' · ') || String(row.id || 'Record');
}

export async function GET(request: NextRequest) {
  try {
    await requireSuperUser(request);
    if (!URL || !KEY) throw new Error('Supabase service credentials are not configured.');
    const table = String(request.nextUrl.searchParams.get('table') || '').trim();
    const config = REFS[table];
    if (!config) return NextResponse.json({ error: 'Reference type is not exposed.' }, { status: 403 });
    const query = safeTerm(String(request.nextUrl.searchParams.get('q') || ''));
    let path = `${table}?select=${encodeURIComponent(config.select)}&limit=25`;
    if (query) path += `&or=(${config.search.map(field => `${field}.ilike.*${encodeURIComponent(query)}*`).join(',')})`;
    const response = await fetch(`${URL}/rest/v1/${path}`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` }, cache: 'no-store' });
    const text = await response.text();
    if (!response.ok) throw new Error(`Reference lookup failed: ${response.status} ${text.slice(0, 300)}`);
    const rows = text ? JSON.parse(text) : [];
    return NextResponse.json({ table, label: config.label, options: (rows || []).map((row: Record<string, unknown>) => ({ id: row.id, label: labelFor(row, config), data: row })) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof SuperUserAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Reference lookup failed.' }, { status: 500 });
  }
}
