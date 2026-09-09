import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, AdminAuthError, type AdminIdentity } from '@/lib/server/requireAdmin';
import { adminRest } from '@/lib/server/adminRest';
import { writeAdminAuditEvent } from '@/lib/server/writeAdminAuditEvent';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Row = Record<string, any>;
type Area = 'organization' | 'facilities' | 'payroll' | 'compliance' | 'reporting';

const areaRoles: Record<Area, string[]> = {
  organization: ['org_admin'],
  facilities: ['org_admin', 'operations'],
  payroll: ['org_admin', 'treasurer'],
  compliance: ['org_admin', 'compliance'],
  reporting: ['org_admin', 'reporting'],
};

function canWrite(actor: AdminIdentity, area: Area) {
  return actor.isSuperUser || actor.roles.some((role) => areaRoles[area].includes(role));
}
function assertWrite(actor: AdminIdentity, area: Area) {
  if (!canWrite(actor, area)) throw new AdminAuthError(`Your Admin role does not allow ${area} changes.`, 403);
}
function text(value: unknown) { const v = String(value ?? '').trim(); return v || null; }
function numberValue(value: unknown) { const n = Number(value); return Number.isFinite(n) ? n : 0; }

async function resolveTenant(actor: AdminIdentity) {
  if (actor.tenantIds[0]) return actor.tenantIds[0];
  const orgs = await adminRest<Array<{ tenant_id: string }>>(actor, 'organizations?select=tenant_id&order=created_at.asc&limit=1');
  if (orgs?.[0]?.tenant_id) return orgs[0].tenant_id;
  const tenants = await adminRest<Array<{ id: string }>>(actor, 'tenants?select=id&order=created_at.asc&limit=1');
  if (!tenants?.[0]?.id) throw new Error('No tenant is available for Admin operations.');
  return tenants[0].id;
}

async function loadPeople(actor: AdminIdentity) {
  return adminRest<Row[]>(actor, 'people?select=id,first_name,last_name,email,status&order=last_name.asc,first_name.asc&limit=500').catch(() => []);
}

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAdmin(request);
    const area = String(request.nextUrl.searchParams.get('area') || '') as Area;
    if (!Object.keys(areaRoles).includes(area)) return NextResponse.json({ error: 'Unsupported Admin operational area.' }, { status: 400 });

    if (area === 'organization') {
      const [records, sites, legalEntities] = await Promise.all([
        adminRest<Row[]>(actor, 'organizations?select=id,tenant_id,code,name,legal_name,organization_type,status,parent_organization_id,created_at,updated_at&order=name.asc&limit=250'),
        adminRest<Row[]>(actor, 'sites?select=id,organization_id,code,name,city,region,country_code,timezone,status&order=name.asc&limit=250').catch(() => []),
        adminRest<Row[]>(actor, 'legal_entities?select=id,organization_id,legal_name,registration_number,country_code,base_currency&order=legal_name.asc&limit=250').catch(() => []),
      ]);
      return NextResponse.json({ records, related: [...sites.map((r) => ({ ...r, related_type: 'site' })), ...legalEntities.map((r) => ({ ...r, related_type: 'legal_entity' }))], options: { organizations: records }, canWrite: canWrite(actor, area) });
    }

    if (area === 'facilities') {
      const [records, bookings, sites, teams] = await Promise.all([
        adminRest<Row[]>(actor, 'facilities?select=id,site_id,code,name,facility_type,capacity,timezone,status&order=name.asc&limit=250'),
        adminRest<Row[]>(actor, 'facility_bookings?select=id,facility_id,team_id,event_id,starts_at,ends_at,status&order=starts_at.desc&limit=250'),
        adminRest<Row[]>(actor, 'sites?select=id,organization_id,code,name,city,region,timezone,status&order=name.asc&limit=250').catch(() => []),
        adminRest<Row[]>(actor, 'teams?select=id,name,status&order=name.asc&limit=250').catch(() => []),
      ]);
      return NextResponse.json({ records, related: bookings, options: { sites, facilities: records, teams }, canWrite: canWrite(actor, area) });
    }

    if (area === 'payroll') {
      const [records, lines, legalEntities, people] = await Promise.all([
        adminRest<Row[]>(actor, 'payroll_runs?select=id,legal_entity_id,period_start,period_end,pay_date,status,gross_total,net_total&order=pay_date.desc&limit=100'),
        adminRest<Row[]>(actor, 'payroll_lines?select=id,payroll_run_id,person_id,earnings,deductions,net_pay&limit=500'),
        adminRest<Row[]>(actor, 'legal_entities?select=id,legal_name,organization_id&order=legal_name.asc&limit=100').catch(() => []),
        loadPeople(actor),
      ]);
      return NextResponse.json({ records, related: lines, options: { legalEntities, people, payrollRuns: records }, canWrite: canWrite(actor, area) });
    }

    if (area === 'compliance') {
      const [records, checks, people] = await Promise.all([
        adminRest<Row[]>(actor, 'compliance_requirements?select=id,code,name,applies_to_role,applies_to_minor,severity,validity_days,rule_definition&order=name.asc&limit=250'),
        adminRest<Row[]>(actor, 'background_checks?select=id,person_id,check_type,provider,reference_number,submitted_at,completed_at,expires_on,status,result_classification&order=submitted_at.desc&limit=250'),
        loadPeople(actor),
      ]);
      return NextResponse.json({ records, related: checks, options: { people }, canWrite: canWrite(actor, area), canManageRequirements: actor.isSuperUser });
    }

    const [records, runs] = await Promise.all([
      adminRest<Row[]>(actor, 'report_definitions?select=id,tenant_id,code,name,report_type,query_definition,sensitivity,status&order=name.asc&limit=250'),
      adminRest<Row[]>(actor, 'report_runs?select=id,report_id,requested_by,started_at,completed_at,status,output_location,row_count&order=started_at.desc&limit=250'),
    ]);
    return NextResponse.json({ records, related: runs, options: { reports: records }, canWrite: canWrite(actor, area) });
  } catch (error) {
    const status = error instanceof AdminAuthError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Admin operational data unavailable.' }, { status });
  }
}

async function recalcPayroll(actor: AdminIdentity, payrollRunId: string) {
  const lines = await adminRest<Row[]>(actor, `payroll_lines?select=earnings,net_pay&payroll_run_id=eq.${encodeURIComponent(payrollRunId)}`);
  const gross_total = lines.reduce((sum, row) => sum + numberValue(row.earnings), 0);
  const net_total = lines.reduce((sum, row) => sum + numberValue(row.net_pay), 0);
  await adminRest(actor, `payroll_runs?id=eq.${encodeURIComponent(payrollRunId)}`, { method: 'PATCH', body: JSON.stringify({ gross_total, net_total }) });
  return { gross_total, net_total };
}

async function countReportRows(actor: AdminIdentity, reportType: string) {
  const table = reportType === 'finance' ? 'invoices' : reportType === 'compliance' ? 'background_checks' : reportType === 'teams' ? 'teams' : reportType === 'facilities' ? 'facilities' : 'memberships';
  const rows = await adminRest<Row[]>(actor, `${table}?select=id&limit=5000`).catch(() => []);
  return rows.length;
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAdmin(request);
    const body = (await request.json()) as Row;
    const area = String(body.area || '') as Area;
    const action = String(body.action || '');
    if (!Object.keys(areaRoles).includes(area)) return NextResponse.json({ error: 'Unsupported Admin operational area.' }, { status: 400 });
    assertWrite(actor, area);
    const tenantId = await resolveTenant(actor);

    if (action === 'create-organization') {
      const name = String(body.name || '').trim(); const code = String(body.code || '').trim();
      if (!name || !code) throw new Error('Organization code and name are required.');
      const rows = await adminRest<Row[]>(actor, 'organizations', { method: 'POST', body: JSON.stringify({ tenant_id: tenantId, code, name, legal_name: text(body.legal_name), organization_type: text(body.organization_type), parent_organization_id: text(body.parent_organization_id), status: 'active' }) });
      await writeAdminAuditEvent(actor, { action: 'ORGANIZATION_CREATED', entityType: 'organization', entityId: rows?.[0]?.id, tenantId, afterData: rows?.[0] });
      return NextResponse.json({ ok: true, record: rows?.[0] });
    }
    if (action === 'create-site') {
      const organization_id = String(body.organization_id || ''); const code = String(body.code || '').trim(); const name = String(body.name || '').trim();
      if (!organization_id || !code || !name) throw new Error('Organization, site code and site name are required.');
      const rows = await adminRest<Row[]>(actor, 'sites', { method: 'POST', body: JSON.stringify({ organization_id, code, name, city: text(body.city), region: text(body.region), country_code: text(body.country_code) || 'CA', timezone: text(body.timezone) || 'America/Edmonton', status: 'active' }) });
      await writeAdminAuditEvent(actor, { action: 'SITE_CREATED', entityType: 'site', entityId: rows?.[0]?.id, tenantId, afterData: rows?.[0] });
      return NextResponse.json({ ok: true, record: rows?.[0] });
    }
    if (action === 'create-legal-entity') {
      const organization_id = String(body.organization_id || ''); const legal_name = String(body.legal_name || '').trim();
      if (!organization_id || !legal_name) throw new Error('Organization and legal name are required.');
      const rows = await adminRest<Row[]>(actor, 'legal_entities', { method: 'POST', body: JSON.stringify({ organization_id, legal_name, registration_number: text(body.registration_number), country_code: text(body.country_code) || 'CA', base_currency: text(body.base_currency) || 'CAD' }) });
      await writeAdminAuditEvent(actor, { action: 'LEGAL_ENTITY_CREATED', entityType: 'legal_entity', entityId: rows?.[0]?.id, tenantId, afterData: rows?.[0] });
      return NextResponse.json({ ok: true, record: rows?.[0] });
    }
    if (action === 'create-facility') {
      const site_id = String(body.site_id || ''); const code = String(body.code || '').trim(); const name = String(body.name || '').trim();
      if (!site_id || !code || !name) throw new Error('Site, facility code and facility name are required.');
      const rows = await adminRest<Row[]>(actor, 'facilities', { method: 'POST', body: JSON.stringify({ site_id, code, name, facility_type: text(body.facility_type), capacity: body.capacity === '' ? null : numberValue(body.capacity), timezone: text(body.timezone) || 'America/Edmonton', status: 'active' }) });
      await writeAdminAuditEvent(actor, { action: 'FACILITY_CREATED', entityType: 'facility', entityId: rows?.[0]?.id, tenantId, afterData: rows?.[0] });
      return NextResponse.json({ ok: true, record: rows?.[0] });
    }
    if (action === 'create-booking') {
      const facility_id = String(body.facility_id || ''); const starts_at = String(body.starts_at || ''); const ends_at = String(body.ends_at || '');
      if (!facility_id || !starts_at || !ends_at) throw new Error('Facility, start and end are required.');
      if (new Date(ends_at) <= new Date(starts_at)) throw new Error('Booking end must be after the start.');
      const rows = await adminRest<Row[]>(actor, 'facility_bookings', { method: 'POST', body: JSON.stringify({ facility_id, team_id: text(body.team_id), starts_at, ends_at, status: 'booked' }) });
      await writeAdminAuditEvent(actor, { action: 'FACILITY_BOOKING_CREATED', entityType: 'facility_booking', entityId: rows?.[0]?.id, tenantId, afterData: rows?.[0] });
      return NextResponse.json({ ok: true, record: rows?.[0] });
    }
    if (action === 'create-payroll-run') {
      const legal_entity_id = String(body.legal_entity_id || '');
      const period_start = String(body.period_start || ''); const period_end = String(body.period_end || '');
      if (!legal_entity_id || !period_start || !period_end) throw new Error('Legal entity, payroll period start and end are required.');
      if (period_end < period_start) throw new Error('Payroll period end must be on or after start.');
      const rows = await adminRest<Row[]>(actor, 'payroll_runs', { method: 'POST', body: JSON.stringify({ legal_entity_id, period_start, period_end, pay_date: text(body.pay_date), status: 'draft', gross_total: 0, net_total: 0 }) });
      await writeAdminAuditEvent(actor, { action: 'PAYROLL_RUN_CREATED', entityType: 'payroll_run', entityId: rows?.[0]?.id, tenantId, afterData: rows?.[0] });
      return NextResponse.json({ ok: true, record: rows?.[0] });
    }
    if (action === 'add-payroll-line') {
      const payroll_run_id = String(body.payroll_run_id || ''); if (!payroll_run_id) throw new Error('Payroll run is required.');
      const earnings = numberValue(body.earnings); const deductions = numberValue(body.deductions); const net_pay = earnings - deductions;
      if (earnings < 0 || deductions < 0) throw new Error('Payroll earnings and deductions cannot be negative.');
      const rows = await adminRest<Row[]>(actor, 'payroll_lines', { method: 'POST', body: JSON.stringify({ payroll_run_id, person_id: text(body.person_id), earnings, deductions, net_pay }) });
      const totals = await recalcPayroll(actor, payroll_run_id);
      await writeAdminAuditEvent(actor, { action: 'PAYROLL_LINE_ADDED', entityType: 'payroll_run', entityId: payroll_run_id, tenantId, afterData: { line: rows?.[0], totals } });
      return NextResponse.json({ ok: true, record: rows?.[0], totals });
    }
    if (action === 'set-payroll-status') {
      const id = String(body.id || ''); const status = String(body.status || '').toLowerCase();
      if (!id || !['draft', 'approved', 'paid'].includes(status)) throw new Error('Valid payroll run and status are required.');
      const before = (await adminRest<Row[]>(actor, `payroll_runs?select=*&id=eq.${encodeURIComponent(id)}&limit=1`))?.[0];
      if (!before) throw new Error('Payroll run not found.');
      const allowed = before.status === 'draft' ? ['approved'] : before.status === 'approved' ? ['paid', 'draft'] : [];
      if (!allowed.includes(status)) throw new Error(`Payroll transition ${before.status} → ${status} is not allowed.`);
      const rows = await adminRest<Row[]>(actor, `payroll_runs?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      await writeAdminAuditEvent(actor, { action: 'PAYROLL_STATUS_CHANGED', entityType: 'payroll_run', entityId: id, tenantId, beforeData: before, afterData: rows?.[0], reason: text(body.reason) });
      return NextResponse.json({ ok: true, record: rows?.[0] });
    }
    if (action === 'create-compliance-requirement') {
      if (!actor.isSuperUser) throw new AdminAuthError('Compliance requirement definitions are platform-level and require SuperUser authority.', 403);
      const code = String(body.code || '').trim(); const name = String(body.name || '').trim(); if (!code || !name) throw new Error('Requirement code and name are required.');
      const rows = await adminRest<Row[]>(actor, 'compliance_requirements', { method: 'POST', body: JSON.stringify({ code, name, applies_to_role: text(body.applies_to_role), applies_to_minor: Boolean(body.applies_to_minor), severity: text(body.severity) || 'required', validity_days: body.validity_days === '' ? null : numberValue(body.validity_days), rule_definition: {} }) });
      await writeAdminAuditEvent(actor, { action: 'COMPLIANCE_REQUIREMENT_CREATED', entityType: 'compliance_requirement', entityId: rows?.[0]?.id, tenantId, afterData: rows?.[0] });
      return NextResponse.json({ ok: true, record: rows?.[0] });
    }
    if (action === 'create-background-check') {
      const person_id = String(body.person_id || ''); const check_type = String(body.check_type || '').trim(); if (!person_id || !check_type) throw new Error('Person and check type are required.');
      const rows = await adminRest<Row[]>(actor, 'background_checks', { method: 'POST', body: JSON.stringify({ person_id, check_type, provider: text(body.provider), reference_number: text(body.reference_number), submitted_at: new Date().toISOString(), expires_on: text(body.expires_on), status: 'pending' }) });
      await writeAdminAuditEvent(actor, { action: 'BACKGROUND_CHECK_CREATED', entityType: 'background_check', entityId: rows?.[0]?.id, tenantId, afterData: rows?.[0] });
      return NextResponse.json({ ok: true, record: rows?.[0] });
    }
    if (action === 'set-background-check-status') {
      const id = String(body.id || ''); const status = String(body.status || '').toLowerCase(); if (!id || !['pending', 'clear', 'review', 'failed', 'expired'].includes(status)) throw new Error('Valid background-check status is required.');
      const before = (await adminRest<Row[]>(actor, `background_checks?select=*&id=eq.${encodeURIComponent(id)}&limit=1`))?.[0]; if (!before) throw new Error('Background check not found.');
      const patch = { status, result_classification: text(body.result_classification) || status, completed_at: status === 'pending' ? null : new Date().toISOString() };
      const rows = await adminRest<Row[]>(actor, `background_checks?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) });
      await writeAdminAuditEvent(actor, { action: 'BACKGROUND_CHECK_STATUS_CHANGED', entityType: 'background_check', entityId: id, tenantId, beforeData: before, afterData: rows?.[0], reason: text(body.reason) });
      return NextResponse.json({ ok: true, record: rows?.[0] });
    }
    if (action === 'create-report-definition') {
      const code = String(body.code || '').trim(); const name = String(body.name || '').trim(); if (!code || !name) throw new Error('Report code and name are required.');
      const report_type = String(body.report_type || 'membership').toLowerCase();
      const rows = await adminRest<Row[]>(actor, 'report_definitions', { method: 'POST', body: JSON.stringify({ tenant_id: tenantId, code, name, report_type, sensitivity: text(body.sensitivity) || 'standard', status: 'active', query_definition: { source: report_type, generated_by: 'admin-reporting' } }) });
      await writeAdminAuditEvent(actor, { action: 'REPORT_DEFINITION_CREATED', entityType: 'report_definition', entityId: rows?.[0]?.id, tenantId, afterData: rows?.[0] });
      return NextResponse.json({ ok: true, record: rows?.[0] });
    }
    if (action === 'run-report') {
      const report_id = String(body.report_id || ''); if (!report_id) throw new Error('Report definition is required.');
      const report = (await adminRest<Row[]>(actor, `report_definitions?select=*&id=eq.${encodeURIComponent(report_id)}&limit=1`))?.[0]; if (!report) throw new Error('Report definition not found.');
      const created = await adminRest<Row[]>(actor, 'report_runs', { method: 'POST', body: JSON.stringify({ report_id, requested_by: actor.personId, status: 'running', started_at: new Date().toISOString(), row_count: 0 }) });
      const runId = created?.[0]?.id; const row_count = await countReportRows(actor, String(report.report_type || 'membership').toLowerCase());
      const completed_at = new Date().toISOString();
      const rows = await adminRest<Row[]>(actor, `report_runs?id=eq.${encodeURIComponent(runId)}`, { method: 'PATCH', body: JSON.stringify({ status: 'completed', completed_at, row_count, output_location: `summary://admin/report-runs/${runId}` }) });
      await writeAdminAuditEvent(actor, { action: 'REPORT_EXECUTED', entityType: 'report_run', entityId: runId, tenantId, afterData: { report_id, report_type: report.report_type, row_count, completed_at } });
      return NextResponse.json({ ok: true, record: rows?.[0], summary: { report: report.name, row_count } });
    }

    throw new Error('Unsupported Admin operational action.');
  } catch (error) {
    const status = error instanceof AdminAuthError ? error.status : 400;
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Admin operational action failed.' }, { status });
  }
}