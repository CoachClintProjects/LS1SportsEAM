import { NextRequest, NextResponse } from 'next/server';
import { requireSuperUser, SuperUserAuthError } from '@/lib/server/requireSuperUser';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ALLOWED_TABLES = new Set([
  'tenants','sports','system_configurations','dashboard_definitions','rules','organizations','sites','governing_bodies','legal_entities',
  'people','users','families','family_members','external_ids','duplicate_candidates','teams','team_memberships','memberships','programs','seasons','staff_assignments','groups','communication_threads',
  'athletes','athlete_sport_participation','development_plans','development_goals','performance_records','athlete_asset_ledger',
  'billing_accounts','invoices','payments','expenses','budgets','gl_journals','chart_of_accounts','accounting_ledgers','gl_lines','journal_postings','fiscal_periods','customers','invoice_lines','payment_allocations','ar_adjustments',
  'vendors','vendor_bills','vendor_bill_lines','ap_payments','credits','refunds','cost_centers','purchase_orders','budget_lines','profit_centers','bank_accounts','bank_transactions',
  'facilities','facility_bookings','facility_closures','assets','fixed_assets','asset_status_history','asset_meter_readings','maintenance_work_orders','work_order_labor','work_order_materials','resources','inventory_items','inventory_balances','inventory_transactions',
  'person_role_assignments','roles','role_permissions','role_permission_history','permissions','platform_raci_assignments','platform_project_tasks','approvals','workflow_tasks','conflicts','security_events','audit_events',
  'compliance_requirements','credentials','safesport_records','background_checks','safeguarding_cases','data_quality_rules','data_quality_issues','data_lineage_events','canonical_data_locks','consents','consent_history','privacy_requests','media_permissions','data_retention_policies','documents','document_versions','record_versions',
  'purchase_requests','purchase_request_lines','purchase_order_lines','payroll_runs','payroll_lines','workflow_definitions','workflow_instances','work_items','integration_connections','integration_runs','integration_event_log','integration_dead_letters','integration_mappings',
  'import_jobs','record_reconciliation_runs','hpac_profile_import_staging','report_definitions','report_runs','platform_metrics','ai_agents','ai_agent_tools','ai_agent_policies','ai_agent_runs','ai_actions','automation_definitions','automation_steps','automation_runs','automation_run_steps','notification_events','platform_metric_snapshots',
  'platform_projects','platform_milestones','platform_milestone_units','platform_project_task_dependencies','knowledge_items','client_onboarding_cases','client_onboarding_steps','platform_preferences','competition_import_files','competition_import_records','competition_source_systems',
  'business_rule_definitions','rule_parameters','validation_rule_definitions','eligibility_rules','competition_rulesets','competition_scoring_rules','competition_rule_evaluations','integration_definitions'
]);

function serviceHeaders() {
  if (!KEY) throw new Error('Supabase service credentials are not configured.');
  return { apikey: KEY, Authorization: `Bearer ${KEY}` };
}

async function loadRows(table: string, limit: number, offset: number) {
  if (!URL || !KEY) throw new Error('Supabase service credentials are not configured.');
  const base = `${URL}/rest/v1/${table}?select=*&limit=${limit}&offset=${offset}`;
  let response = await fetch(`${base}&order=created_at.desc`, { headers: serviceHeaders(), cache: 'no-store' });
  if (!response.ok) {
    response = await fetch(base, { headers: serviceHeaders(), cache: 'no-store' });
  }
  const text = await response.text();
  if (!response.ok) throw new Error(`Unable to load ${table}: ${response.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : [];
}

export async function GET(request: NextRequest) {
  try {
    await requireSuperUser(request);
    const table = String(request.nextUrl.searchParams.get('table') || '').trim();
    if (!ALLOWED_TABLES.has(table)) {
      return NextResponse.json({ error: 'This table is not exposed through the Super User control surface.' }, { status: 403 });
    }

    const limit = Math.max(1, Math.min(100, Number(request.nextUrl.searchParams.get('limit') || 25)));
    const offset = Math.max(0, Number(request.nextUrl.searchParams.get('offset') || 0));
    const rows = await loadRows(table, limit, offset);
    const columns = Array.from(new Set(rows.flatMap((row: Record<string, unknown>) => Object.keys(row))));

    return NextResponse.json({
      table,
      rows,
      columns,
      limit,
      offset,
      returned: rows.length,
      generatedAt: new Date().toISOString(),
      source: 'LS1SportsEAM Supabase',
    }, { headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' } });
  } catch (error) {
    if (error instanceof SuperUserAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load records.' }, { status: 500 });
  }
}
