import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, AdminAuthError } from '@/lib/server/requireAdmin';
import { adminRest } from '@/lib/server/adminRest';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Row = Record<string, any>;

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAdmin(request);
    const area = request.nextUrl.searchParams.get('area') || '';

    if (area === 'organization') {
      const records = await adminRest<Row[]>(actor, 'organizations?select=id,code,name,legal_name,organization_type,status,parent_organization_id,created_at,updated_at&order=name.asc&limit=250');
      return NextResponse.json({ records });
    }

    if (area === 'facilities') {
      const [records, bookings] = await Promise.all([
        adminRest<Row[]>(actor, 'facilities?select=id,site_id,code,name,facility_type,capacity,timezone,status&order=name.asc&limit=250'),
        adminRest<Row[]>(actor, 'facility_bookings?select=id,facility_id,team_id,event_id,starts_at,ends_at,status&order=starts_at.desc&limit=250'),
      ]);
      return NextResponse.json({ records, related: bookings });
    }

    if (area === 'payroll') {
      const [records, lines] = await Promise.all([
        adminRest<Row[]>(actor, 'payroll_runs?select=id,legal_entity_id,period_start,period_end,pay_date,status,gross_total,net_total&order=pay_date.desc&limit=100'),
        adminRest<Row[]>(actor, 'payroll_lines?select=id,payroll_run_id,person_id,earnings,deductions,net_pay&limit=500'),
      ]);
      return NextResponse.json({ records, related: lines });
    }

    if (area === 'compliance') {
      const [records, checks] = await Promise.all([
        adminRest<Row[]>(actor, 'compliance_requirements?select=id,code,name,applies_to_role,applies_to_minor,severity,validity_days,rule_definition&order=name.asc&limit=250'),
        adminRest<Row[]>(actor, 'background_checks?select=id,person_id,check_type,provider,reference_number,submitted_at,completed_at,expires_on,status,result_classification&order=submitted_at.desc&limit=250'),
      ]);
      return NextResponse.json({ records, related: checks });
    }

    if (area === 'reporting') {
      const [records, runs] = await Promise.all([
        adminRest<Row[]>(actor, 'report_definitions?select=id,code,name,report_type,sensitivity,status&order=name.asc&limit=250'),
        adminRest<Row[]>(actor, 'report_runs?select=id,report_id,requested_by,started_at,completed_at,status,output_location,row_count&order=started_at.desc&limit=250'),
      ]);
      return NextResponse.json({ records, related: runs });
    }

    return NextResponse.json({ error: 'Unsupported Admin operational area.' }, { status: 400 });
  } catch (error) {
    const status = error instanceof AdminAuthError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Admin operational data unavailable.' }, { status });
  }
}
