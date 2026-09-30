import { NextRequest, NextResponse } from "next/server";
import {
  recordAccess,
  recordRest as rest,
} from "@/lib/server/adminRecordAccess";
import { hasAdminContextPermission as can } from "@/lib/server/accessControl";
import { PersonRecordError } from "@/lib/server/adminPersonRecord";
import {
  canReadRecordDocuments,
  documentTypeFilter,
  registrarDocumentCodes,
} from "@/lib/server/adminDocumentPolicy";
export const dynamic = "force-dynamic";
const fail = (e: unknown) =>
  NextResponse.json(
    { error: e instanceof Error ? e.message : "Record operation failed." },
    { status: e instanceof PersonRecordError ? e.status : 500 },
  );
export async function GET(request: NextRequest) {
  try {
    const role = request.nextUrl.searchParams.get("role") || "org_admin",
      personId = request.nextUrl.searchParams.get("personId") || "",
      { ctx, tenant, orgs, base } = await recordAccess(request, role, personId);
    const section =
      request.nextUrl.searchParams.get("section") || "Activity & Tasks";
    const wantsRelationships = section === "Relationships";
    const wantsRegistrations = section === "Registration";
    const wantsCompetitions =
      section === "Competitions" || section === "Overview";
    const wantsDocuments = section === "Documents";
    const documentAccess = canReadRecordDocuments(ctx, role);
    const [
      tasks,
      documents,
      documentTypes,
      competitions,
      teamOptions,
      peopleOptions,
      families,
      programOptions,
      seasonOptions,
      coachAssignments,
    ] = await Promise.all([
      section === "Activity & Tasks" && can(ctx, role, "admin_tasks.read")
        ? rest(
            `work_items?select=id,status,priority,payload&tenant_id=eq.${tenant}&entity_type=eq.person&entity_id=eq.${personId}&work_type=eq.ADMIN_TASK`,
          )
        : [],
      (wantsDocuments || wantsRegistrations) && documentAccess
        ? rest(
            `documents?select=id,title,mime_type,expires_at,verification_status,current_version,created_at,document_types!inner(code)&tenant_id=eq.${tenant}&owner_person_id=eq.${personId}&order=created_at.desc${documentTypeFilter(role)}`,
          )
        : [],
      (wantsDocuments || wantsRegistrations) && documentAccess
        ? rest(
            `document_types?select=id,name&order=name.asc${role === "registrar" ? `&code=in.(${registrarDocumentCodes.join(",")})` : ""}`,
          )
        : [],
      wantsCompetitions
        ? rest(
            `competitions?select=id,name,starts_at&organization_id=in.(${orgs.join(",")})`,
          )
        : [],
      wantsRelationships
        ? rest(
            `teams?select=id,name&organization_id=in.(${orgs.join(",")})&status=eq.active`,
          )
        : [],
      wantsRelationships && role === "org_admin"
        ? rest(
            `people?select=id,first_name,last_name,preferred_name&tenant_id=eq.${tenant}&status=eq.active&order=last_name.asc&limit=1000`,
          )
        : [],
      wantsRelationships && role === "org_admin"
        ? rest(
            `families?select=id,name&tenant_id=eq.${tenant}&status=eq.active&order=name.asc`,
          )
        : [],
      wantsRegistrations
        ? rest(
            `programs?select=id,name&organization_id=in.(${orgs.join(",")})&order=name.asc`,
          )
        : [],
      wantsRegistrations
        ? rest(
            `seasons?select=id,name&organization_id=in.(${orgs.join(",")})&order=name.asc`,
          )
        : [],
      wantsRelationships &&
      role === "org_admin" &&
      can(ctx, role, "role_assignments.manage")
        ? rest(
            `role_assignments?select=person_id,role_definitions!inner(code)&tenant_id=eq.${tenant}&organization_id=in.(${orgs.join(",")})&status=eq.active&role_definitions.code=eq.COACH`,
          )
        : [],
    ]);
    const registrationIds = base.registrations.map((r: any) => r.id);
    const [requirements, requirementStatus] = wantsRegistrations
      ? await Promise.all([
          rest(
            `registration_requirements?select=id,name,required,program_id,season_id,valid_from,valid_until&organization_id=in.(${orgs.join(",")})`,
          ),
          registrationIds.length
            ? rest(
                `registration_requirement_status?select=id,registration_id,requirement_id,status,satisfied_at,evidence_document_id,notes&registration_id=in.(${registrationIds.join(",")})`,
              )
            : [],
        ])
      : [[], []];
    const compIds = competitions.map((c: any) => c.id);
    const eligibility =
      base.athlete && compIds.length
        ? await rest(
            `eligibility_records?select=id,competition_id,status,reason,expires_at,evaluated_at&athlete_id=eq.${base.athlete.id}&competition_id=in.(${compIds.join(",")})&order=evaluated_at.desc`,
          )
        : [];
    const deadlines = compIds.length
      ? await rest(
          `competition_deadlines?select=id,competition_id,name,due_at,status&competition_id=in.(${compIds.join(",")})&order=due_at.asc`,
        )
      : [];
    return NextResponse.json({
      requirements,
      requirementStatus,
      tasks: tasks.filter(
        (t: any) => role === "org_admin" || t.payload?.assigned_role === role,
      ),
      documents,
      documentTypes,
      competitions,
      eligibility,
      deadlines,
      teamOptions,
      peopleOptions,
      families,
      programOptions,
      seasonOptions,
      coachOptions: peopleOptions.filter((p: any) =>
        coachAssignments.some((a: any) => a.person_id === p.id),
      ),
      authorization: {
        createRegistration:
          !!base.athlete &&
          orgs.length === 1 &&
          can(ctx, role, "record.create") &&
          can(ctx, role, "registrations.read"),
        decideRegistration:
          !!base.athlete &&
          orgs.length === 1 &&
          can(ctx, role, "registrations.approve"),
        createTask: can(ctx, role, "admin_tasks.create"),
        updateTask: can(ctx, role, "admin_tasks.update"),
        documents: documentAccess,
        reviewRequirements:
          documentAccess && can(ctx, role, "registrations.approve"),
        reviewDocuments: documentAccess && can(ctx, role, "record.update"),
        upload: documentAccess && can(ctx, role, "record.create"),
        coaches:
          role === "org_admin" &&
          can(ctx, role, "record.update") &&
          can(ctx, role, "role_assignments.manage"),
        relationships: role === "org_admin" && can(ctx, role, "record.update"),
      },
    });
  } catch (e) {
    return fail(e);
  }
}
export async function POST(request: NextRequest) {
  try {
    const b = await request.json(),
      role = String(b.role || "org_admin"),
      { ctx, tenant, orgs, base } = await recordAccess(
        request,
        role,
        String(b.personId || ""),
      );
    if (b.kind === "task") {
      const permission =
        b.operation === "create" ? "admin_tasks.create" : "admin_tasks.update";
      if (!can(ctx, role, permission))
        throw new PersonRecordError(403, "Task action denied.");
      if (!/^[0-9a-f-]{36}$/i.test(b.id || ""))
        throw new PersonRecordError(400, "Valid task ID required.");
      if (
        b.operation === "create" &&
        (!String(b.values?.title || "").trim() ||
          String(b.values.title).length > 300)
      )
        throw new PersonRecordError(
          400,
          "Task title required (maximum 300 characters).",
        );
      if (b.values?.due_at && Number.isNaN(Date.parse(b.values.due_at)))
        throw new PersonRecordError(400, "Valid due date required.");
      return NextResponse.json(
        await rest("rpc/admin_record_task", {
          method: "POST",
          body: JSON.stringify({
            p_tenant: tenant,
            p_person: base.person.id,
            p_actor_user: ctx.user.id,
            p_actor_person: ctx.person?.id || null,
            p_role: role,
            p_id: b.id,
            p_operation: b.operation,
            p_values: b.values || {},
          }),
        }),
      );
    }
    if (b.kind === "requirement") {
      if (b.operation !== "review")
        throw new PersonRecordError(400, "Unsupported requirement action.");
      if (
        !base.athlete ||
        orgs.length !== 1 ||
        !canReadRecordDocuments(ctx, role) ||
        !can(ctx, role, "registrations.approve")
      )
        throw new PersonRecordError(403, "Requirement review denied.");
      return NextResponse.json(
        await rest("rpc/admin_record_requirement_review", {
          method: "POST",
          body: JSON.stringify({
            p_tenant: tenant,
            p_org: orgs[0],
            p_athlete: base.athlete.id,
            p_actor_user: ctx.user.id,
            p_actor_person: ctx.person?.id || null,
            p_role: role,
            p_values: b.values || {},
          }),
        }),
      );
    }
    if (b.kind === "registration") {
      if (!base.athlete || orgs.length !== 1)
        throw new PersonRecordError(
          403,
          "An athlete and organization context are required.",
        );
      if (!["create", "transition"].includes(b.operation))
        throw new PersonRecordError(400, "Unsupported registration action.");
      const allowed =
        b.operation === "create"
          ? can(ctx, role, "record.create") &&
            can(ctx, role, "registrations.read")
          : can(ctx, role, "registrations.approve");
      if (!allowed)
        throw new PersonRecordError(403, "Registration action denied.");
      return NextResponse.json(
        await rest("rpc/admin_record_registration", {
          method: "POST",
          body: JSON.stringify({
            p_tenant: tenant,
            p_org: orgs[0],
            p_athlete: base.athlete.id,
            p_actor_user: ctx.user.id,
            p_actor_person: ctx.person?.id || null,
            p_operation: b.operation,
            p_values: b.values || {},
          }),
        }),
      );
    }
    if (b.kind === "relationship") {
      if (
        role !== "org_admin" ||
        !can(ctx, role, "record.update") ||
        orgs.length !== 1 ||
        !base.athlete
      )
        throw new PersonRecordError(
          403,
          "Relationship editing requires Organization Administrator and an athlete.",
        );
      if (
        ![
          "coach_add",
          "coach_remove",
          "team_add",
          "team_remove",
          "guardian_link",
          "guardian_remove",
          "athlete_inactivate",
          "athlete_reactivate",
        ].includes(b.operation)
      )
        throw new PersonRecordError(400, "Unsupported record action.");
      if (
        b.operation.startsWith("coach_") &&
        !can(ctx, role, "role_assignments.manage")
      )
        throw new PersonRecordError(403, "Coach assignment denied.");
      if (!String(b.values?.reason || "").trim())
        throw new PersonRecordError(400, "A reason is required.");
      return NextResponse.json(
        await rest("rpc/admin_athlete_relationship", {
          method: "POST",
          body: JSON.stringify({
            p_tenant: tenant,
            p_org: orgs[0],
            p_athlete: base.athlete.id,
            p_actor_user: ctx.user.id,
            p_actor_person: ctx.person?.id || null,
            p_operation: b.operation,
            p_values: b.values,
          }),
        }),
      );
    }
    throw new PersonRecordError(400, "Unknown action");
  } catch (e) {
    return fail(e);
  }
}
