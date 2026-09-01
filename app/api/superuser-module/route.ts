import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://xedfstgwotzxnztpembv.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Domain = { label: string; tables: Array<{ table: string; label: string }> };

const domains: Record<string, Domain> = {
  platform: { label: 'Platform Core', tables: [{table:'tenants',label:'Tenants'},{table:'sports',label:'Sports'},{table:'system_configurations',label:'Configurations'},{table:'dashboard_definitions',label:'Dashboards'},{table:'rules',label:'Rules'}] },
  organizations: { label: 'Organizations', tables: [{table:'organizations',label:'Organizations'},{table:'sites',label:'Sites'},{table:'governing_bodies',label:'Governing Bodies'},{table:'legal_entities',label:'Legal Entities'}] },
  people: { label: 'People / Person Master', tables: [{table:'people',label:'People'},{table:'users',label:'Users'},{table:'families',label:'Families'},{table:'family_members',label:'Family Members'},{table:'external_ids',label:'External IDs'},{table:'duplicate_candidates',label:'Duplicate Candidates'}] },
  'team-manager': { label: 'Team Manager', tables: [{table:'teams',label:'Teams'},{table:'team_memberships',label:'Team Memberships'},{table:'memberships',label:'Memberships'},{table:'programs',label:'Programs'},{table:'seasons',label:'Seasons'},{table:'staff_assignments',label:'Staff Assignments'},{table:'groups',label:'Groups'},{table:'communication_threads',label:'Communication Threads'}] },
  athletes: { label: 'Athlete Intelligence', tables: [{table:'athletes',label:'Athletes'},{table:'athlete_sport_participation',label:'Sport Participation'},{table:'development_plans',label:'Development Plans'},{table:'development_goals',label:'Goals'},{table:'performance_records',label:'Performance Records'},{table:'athlete_asset_ledger',label:'Asset Ledger'}] },
  'financial-overview': { label: 'Financial Overview', tables: [{table:'billing_accounts',label:'Billing Accounts'},{table:'invoices',label:'Invoices'},{table:'payments',label:'Payments'},{table:'expenses',label:'Expenses'},{table:'budgets',label:'Budgets'},{table:'gl_journals',label:'GL Journals'}] },
  'general-ledger': { label: 'General Ledger', tables: [{table:'chart_of_accounts',label:'Chart of Accounts'},{table:'accounting_ledgers',label:'Ledgers'},{table:'gl_journals',label:'Journals'},{table:'gl_lines',label:'Journal Lines'},{table:'journal_postings',label:'Postings'},{table:'fiscal_periods',label:'Fiscal Periods'}] },
  receivables: { label: 'Accounts Receivable', tables: [{table:'customers',label:'Customers'},{table:'invoices',label:'Invoices'},{table:'invoice_lines',label:'Invoice Lines'},{table:'payments',label:'Payments'},{table:'payment_allocations',label:'Allocations'},{table:'ar_adjustments',label:'AR Adjustments'}] },
  payables: { label: 'Accounts Payable', tables: [{table:'vendors',label:'Vendors'},{table:'vendor_bills',label:'Vendor Bills'},{table:'vendor_bill_lines',label:'Bill Lines'},{table:'ap_payments',label:'AP Payments'}] },
  revenue: { label: 'Revenue', tables: [{table:'invoices',label:'Invoices'},{table:'payments',label:'Payments'},{table:'credits',label:'Credits'},{table:'refunds',label:'Refunds'}] },
  costs: { label: 'Costs & Overhead', tables: [{table:'expenses',label:'Expenses'},{table:'cost_centers',label:'Cost Centers'},{table:'purchase_orders',label:'Purchase Orders'},{table:'vendor_bills',label:'Vendor Bills'}] },
  budgets: { label: 'Budgets', tables: [{table:'budgets',label:'Budgets'},{table:'budget_lines',label:'Budget Lines'},{table:'cost_centers',label:'Cost Centers'},{table:'profit_centers',label:'Profit Centers'}] },
  forecasting: { label: 'Forecasting', tables: [{table:'budgets',label:'Budgets'},{table:'budget_lines',label:'Budget Lines'},{table:'fiscal_periods',label:'Fiscal Periods'},{table:'platform_metric_snapshots',label:'Metric Snapshots'}] },
  profitability: { label: 'Profitability', tables: [{table:'profit_centers',label:'Profit Centers'},{table:'invoices',label:'Revenue Documents'},{table:'expenses',label:'Expenses'},{table:'gl_lines',label:'GL Lines'}] },
  'cash-flow': { label: 'Cash Flow', tables: [{table:'bank_accounts',label:'Bank Accounts'},{table:'bank_transactions',label:'Bank Transactions'},{table:'payments',label:'Receipts'},{table:'ap_payments',label:'Payments Out'}] },
  facilities: { label: 'Facilities', tables: [{table:'facilities',label:'Facilities'},{table:'sites',label:'Sites'},{table:'facility_bookings',label:'Bookings'},{table:'facility_closures',label:'Closures'}] },
  assets: { label: 'Assets', tables: [{table:'assets',label:'Assets'},{table:'fixed_assets',label:'Fixed Assets'},{table:'asset_status_history',label:'Status History'},{table:'asset_meter_readings',label:'Meter Readings'}] },
  maintenance: { label: 'Maintenance', tables: [{table:'maintenance_work_orders',label:'Work Orders'},{table:'work_order_labor',label:'Labor'},{table:'work_order_materials',label:'Materials'},{table:'asset_meter_readings',label:'Meter Readings'}] },
  resources: { label: 'Resources', tables: [{table:'resources',label:'Resources'},{table:'inventory_items',label:'Inventory Items'},{table:'inventory_balances',label:'Inventory Balances'},{table:'inventory_transactions',label:'Inventory Transactions'}] },
  identity: { label: 'Identity', tables: [{table:'people',label:'People'},{table:'users',label:'Users'},{table:'external_ids',label:'External IDs'},{table:'person_role_assignments',label:'Role Assignments'}] },
  roles: { label: 'Roles', tables: [{table:'roles',label:'Roles'},{table:'person_role_assignments',label:'Assignments'},{table:'role_permissions',label:'Role Permissions'},{table:'role_permission_history',label:'Permission History'}] },
  permissions: { label: 'Permissions', tables: [{table:'permissions',label:'Permissions'},{table:'role_permissions',label:'Role Permissions'},{table:'role_permission_history',label:'Permission Changes'}] },
  raci: { label: 'RACI / Authority Matrix', tables: [{table:'platform_raci_assignments',label:'RACI Assignments'},{table:'platform_project_tasks',label:'Project Tasks'},{table:'roles',label:'Roles'}] },
  delegation: { label: 'Delegation', tables: [{table:'person_role_assignments',label:'Role Assignments'},{table:'approvals',label:'Approvals'},{table:'workflow_tasks',label:'Workflow Tasks'}] },
  sod: { label: 'Segregation of Duties', tables: [{table:'roles',label:'Roles'},{table:'permissions',label:'Permissions'},{table:'role_permissions',label:'Role Permissions'},{table:'conflicts',label:'Conflicts'}] },
  'privileged-access': { label: 'Privileged Access', tables: [{table:'person_role_assignments',label:'Role Assignments'},{table:'security_events',label:'Security Events'},{table:'audit_events',label:'Audit Events'}] },
  compliance: { label: 'Compliance', tables: [{table:'compliance_requirements',label:'Requirements'},{table:'credentials',label:'Credentials'},{table:'safesport_records',label:'SafeSport Records'},{table:'background_checks',label:'Background Checks'},{table:'safeguarding_cases',label:'Safeguarding Cases'}] },
  'data-governance': { label: 'Data Governance', tables: [{table:'data_quality_rules',label:'Quality Rules'},{table:'data_quality_issues',label:'Quality Issues'},{table:'data_lineage_events',label:'Lineage Events'},{table:'canonical_data_locks',label:'Canonical Locks'},{table:'duplicate_candidates',label:'Duplicate Candidates'}] },
  privacy: { label: 'Privacy / Sovereignty', tables: [{table:'consents',label:'Consents'},{table:'consent_history',label:'Consent History'},{table:'privacy_requests',label:'Privacy Requests'},{table:'media_permissions',label:'Media Permissions'},{table:'data_retention_policies',label:'Retention Policies'}] },
  retention: { label: 'Retention / Legal Holds', tables: [{table:'data_retention_policies',label:'Retention Policies'},{table:'documents',label:'Documents'},{table:'document_versions',label:'Document Versions'},{table:'audit_events',label:'Audit Events'}] },
  audit: { label: 'Audit', tables: [{table:'audit_events',label:'Audit Events'},{table:'security_events',label:'Security Events'},{table:'data_lineage_events',label:'Lineage Events'},{table:'record_versions',label:'Record Versions'}] },
  procurement: { label: 'Procurement', tables: [{table:'purchase_requests',label:'Purchase Requests'},{table:'purchase_request_lines',label:'Request Lines'},{table:'purchase_orders',label:'Purchase Orders'},{table:'purchase_order_lines',label:'Order Lines'},{table:'vendors',label:'Vendors'}] },
  payroll: { label: 'Payroll', tables: [{table:'payroll_runs',label:'Payroll Runs'},{table:'payroll_lines',label:'Payroll Lines'},{table:'staff_assignments',label:'Staff Assignments'}] },
  workflow: { label: 'Workflow', tables: [{table:'workflow_definitions',label:'Workflow Definitions'},{table:'workflow_instances',label:'Workflow Instances'},{table:'workflow_tasks',label:'Workflow Tasks'},{table:'approvals',label:'Approvals'},{table:'work_items',label:'Work Items'}] },
  integrations: { label: 'Integrations', tables: [{table:'integration_connections',label:'Connections'},{table:'integration_runs',label:'Runs'},{table:'integration_event_log',label:'Events'},{table:'integration_dead_letters',label:'Dead Letters'},{table:'integration_mappings',label:'Mappings'}] },
  imports: { label: 'Imports / Ingestion', tables: [{table:'import_jobs',label:'Import Jobs'},{table:'data_quality_issues',label:'Quality Issues'},{table:'duplicate_candidates',label:'Duplicate Candidates'},{table:'record_reconciliation_runs',label:'Reconciliation Runs'},{table:'hpac_profile_import_staging',label:'HPAC Staging Records'}] },
  reporting: { label: 'Reporting', tables: [{table:'report_definitions',label:'Report Definitions'},{table:'report_runs',label:'Report Runs'},{table:'dashboard_definitions',label:'Dashboards'},{table:'platform_metrics',label:'Platform Metrics'}] },
  agents: { label: 'AI Agents', tables: [{table:'ai_agents',label:'Agents'},{table:'ai_agent_tools',label:'Agent Tools'},{table:'ai_agent_policies',label:'Agent Policies'},{table:'ai_agent_runs',label:'Agent Runs'},{table:'ai_actions',label:'AI Actions'}] },
  automation: { label: 'Automations', tables: [{table:'automation_definitions',label:'Automations'},{table:'automation_steps',label:'Steps'},{table:'automation_runs',label:'Runs'},{table:'automation_run_steps',label:'Run Steps'}] },
  alerts: { label: 'Alerts', tables: [{table:'notification_events',label:'Notifications'},{table:'security_events',label:'Security Events'},{table:'data_quality_issues',label:'Data Quality Issues'},{table:'integration_dead_letters',label:'Dead Letters'}] },
  insights: { label: 'Insights', tables: [{table:'platform_metrics',label:'Platform Metrics'},{table:'platform_metric_snapshots',label:'Metric Snapshots'},{table:'ai_actions',label:'AI Actions'},{table:'data_quality_issues',label:'Quality Issues'}] },
  product: { label: 'Product / Feature Factory', tables: [{table:'platform_projects',label:'Projects'},{table:'platform_milestones',label:'Milestones'},{table:'platform_milestone_units',label:'Milestone Units'},{table:'platform_project_tasks',label:'Project Tasks'},{table:'platform_project_task_dependencies',label:'Dependencies'}] },
  deployments: { label: 'Deployments', tables: [{table:'platform_projects',label:'Projects'},{table:'platform_project_tasks',label:'Release Tasks'},{table:'platform_metric_snapshots',label:'Metric Snapshots'},{table:'audit_events',label:'Audit Events'}] },
  'system-health': { label: 'System Health', tables: [{table:'platform_metrics',label:'Platform Metrics'},{table:'integration_connections',label:'Integration Connections'},{table:'integration_dead_letters',label:'Dead Letters'},{table:'security_events',label:'Security Events'},{table:'data_quality_issues',label:'Data Quality Issues'}] },
  knowledge: { label: 'Knowledge / SOP', tables: [{table:'knowledge_items',label:'Knowledge Items'},{table:'documents',label:'Documents'},{table:'document_versions',label:'Document Versions'}] },
  'all-clients': { label: 'All Clients', tables: [{table:'tenants',label:'Tenants'},{table:'organizations',label:'Organizations'},{table:'client_onboarding_cases',label:'Onboarding Cases'}] },
  'new-client': { label: 'New Client', tables: [{table:'client_onboarding_cases',label:'Onboarding Cases'},{table:'client_onboarding_steps',label:'Onboarding Steps'},{table:'tenants',label:'Tenants'},{table:'organizations',label:'Organizations'}] },
  'onboarding-queue': { label: 'Onboarding Queue', tables: [{table:'client_onboarding_cases',label:'Onboarding Cases'},{table:'client_onboarding_steps',label:'Onboarding Steps'},{table:'import_jobs',label:'Import Jobs'},{table:'data_quality_issues',label:'Validation Exceptions'}] },
  'active-clients': { label: 'Active Clients', tables: [{table:'tenants',label:'Tenants'},{table:'organizations',label:'Organizations'},{table:'client_onboarding_cases',label:'Onboarding Cases'}] },
  'client-exceptions': { label: 'At-Risk / Exceptions', tables: [{table:'client_onboarding_cases',label:'Onboarding Cases'},{table:'data_quality_issues',label:'Data Quality Issues'},{table:'integration_dead_letters',label:'Integration Dead Letters'},{table:'security_events',label:'Security Events'}] },
  'client-updates': { label: 'Existing Client Updates', tables: [{table:'import_jobs',label:'Import Jobs'},{table:'record_reconciliation_runs',label:'Reconciliation Runs'},{table:'duplicate_candidates',label:'Duplicate Candidates'},{table:'data_quality_issues',label:'Validation Issues'}] },
  settings: { label: 'Platform / Site Settings', tables: [{table:'system_configurations',label:'System Configurations'},{table:'platform_preferences',label:'Platform Preferences'},{table:'dashboard_definitions',label:'Dashboard Definitions'}] },
  'role-customization': { label: 'Role-Specific Customization', tables: [{table:'platform_preferences',label:'Role Preferences'},{table:'roles',label:'Roles'},{table:'permissions',label:'Permissions'},{table:'role_permissions',label:'Role Permissions'}] },
};

async function count(table: string) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=id`, {
    method: 'HEAD',
    headers: { apikey: SERVICE_KEY!, Authorization: `Bearer ${SERVICE_KEY}`, Prefer: 'count=exact', Range: '0-0' },
    cache: 'no-store',
  });
  if (!response.ok) return null;
  const range = response.headers.get('content-range');
  const total = range?.split('/')[1];
  return total && total !== '*' ? Number(total) : null;
}

export async function GET(request: NextRequest) {
  if (!SERVICE_KEY) return NextResponse.json({ error: 'Supabase server credentials are not configured.' }, { status: 500 });
  const view = request.nextUrl.searchParams.get('view') ?? '';
  const domain = domains[view];
  if (!domain) return NextResponse.json({ error: 'Unknown SuperUser workspace.' }, { status: 404 });
  const metrics = await Promise.all(domain.tables.map(async item => ({ ...item, count: await count(item.table) })));
  return NextResponse.json({ view, label: domain.label, metrics, generatedAt: new Date().toISOString(), source: 'LS1SportsEAM Supabase' }, { headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' } });
}
