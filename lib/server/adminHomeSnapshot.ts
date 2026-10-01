import {
  hasAdminContextPermission as can,
  hasPermission,
  type AccessContext,
} from "./accessControl";
import type { RecordStore } from "./adminPersonRecord";
type Row = Record<string, any>;
const ids = (values: string[]) => `in.(${[...new Set(values)].join(",")})`;

// Home reads only the sources needed by the selected role's agenda. Detail workspaces
// retain their own reads; no cross-request cache holds user or permission state.
export async function adminHomeSnapshot(
  rest: RecordStore,
  ctx: AccessContext,
  role: string,
  tenant: string,
  orgs: string[],
) {
  const executive = role === "org_admin";
  const registrar = executive || role === "registrar";
  const sourcing =
    executive ||
    ["team_manager", "facilities_equipment_manager"].includes(role);
  const finance =
    (executive || role === "treasurer") && can(ctx, role, "finance.read");
  const volunteers =
    (executive || role === "volunteer_coordinator") &&
    can(ctx, role, "record.read");
  const communications =
    (executive || role === "communications_media") &&
    can(ctx, role, "communications.read");
  const fundraising =
    (executive || role === "fundraising_coordinator") &&
    can(ctx, role, "finance.read");
  const orgFilter = ids(orgs);
  const [
    organizations,
    calendarEvents,
    competitions,
    tasks,
    dataQualityIssues,
    duplicateCandidates,
    contracts,
    vendors,
    registrations,
    customers,
    opportunities,
    campaigns,
    fundraisingCampaigns,
    audit,
    approvals,
    workflowDefinitions,
    governanceTasks,
    budgetTasks,
  ] = await Promise.all([
    rest(
      `organizations?select=id,name,code,status&tenant_id=eq.${tenant}&id=${orgFilter}`,
    ),
    rest(
      `calendar_events?select=id,organization_id,title,event_type,starts_at,ends_at,timezone,status&organization_id=${orgFilter}&status=neq.cancelled&starts_at=gte.${new Date().toISOString()}&order=starts_at.asc&limit=30`,
    ),
    rest(
      `competitions?select=id,name,starts_at,ends_at,timezone,status&organization_id=${orgFilter}&status=neq.cancelled&or=(ends_at.gte.${new Date().toISOString()},starts_at.gte.${new Date().toISOString()})&order=starts_at.asc&limit=100`,
    ),
    can(ctx, role, "admin_tasks.read")
      ? rest(
          `work_items?select=id,status,priority,payload&tenant_id=eq.${tenant}&work_type=eq.ADMIN_TASK${executive ? "" : role === "team_manager" ? "&payload->>assigned_role=in.(team_manager,facilities_equipment_manager)" : `&payload->>assigned_role=eq.${encodeURIComponent(role)}`}&order=id.desc&limit=100`,
        )
      : [],
    registrar
      ? rest(
          `data_quality_issues?select=id,entity_type,entity_id,severity,status,details&tenant_id=eq.${tenant}&status=neq.resolved&limit=200`,
        )
      : [],
    registrar
      ? rest(
          `duplicate_candidates?select=id,entity_type,left_entity_id,right_entity_id,confidence,match_reason,status&tenant_id=eq.${tenant}&status=neq.resolved&limit=200`,
        )
      : [],
    sourcing && can(ctx, role, "record.read")
      ? rest(
          `contracts?select=id,title,expires_on,status&tenant_id=eq.${tenant}&organization_id=${orgFilter}&order=expires_on.asc&limit=500`,
        )
      : [],
    sourcing && can(ctx, role, "record.read")
      ? rest(
          `vendors?select=id,name,insurance_expires_on,status&organization_id=${orgFilter}&limit=200`,
        )
      : [],
    registrar && can(ctx, role, "registrations.read")
      ? rest(
          `registrations?select=id,athlete_id,program_id,season_id,status,submitted_at&organization_id=${orgFilter}&status=in.(submitted,pending,under_review)&order=submitted_at.asc&limit=500`,
        )
      : [],
    finance
      ? rest(`customers?select=id&organization_id=${orgFilter}&limit=1000`)
      : [],
    volunteers
      ? rest(
          `volunteer_opportunities?select=id,title,starts_at,ends_at,capacity,status&organization_id=${orgFilter}&status=eq.OPEN&order=starts_at.asc&limit=500`,
        )
      : [],
    communications
      ? rest(
          `communication_campaigns?select=id,name,status,scheduled_at&tenant_id=eq.${tenant}&status=eq.draft&limit=500`,
        )
      : [],
    fundraising
      ? rest(
          `fundraising_campaigns?select=id,name,status&tenant_id=eq.${tenant}&organization_id=${orgFilter}&limit=500`,
        )
      : [],
    executive && hasPermission(ctx, "audit.read")
      ? rest(
          `audit_events?select=id,actor_person_id,action,entity_type,entity_id,occurred_at,reason&tenant_id=eq.${tenant}&order=occurred_at.desc&limit=20`,
        )
      : [],
    executive && can(ctx, role, "workflow.execute")
      ? rest(
          `approvals?select=id,entity_type,entity_id,requested_by,approver_person_id,approval_type,status,requested_at&tenant_id=eq.${tenant}&status=eq.pending&order=requested_at.asc&limit=200`,
        )
      : [],
    can(ctx, role, "workflow.execute")
      ? rest(`workflow_definitions?select=id&tenant_id=eq.${tenant}&limit=500`)
      : [],
    executive && can(ctx, role, "record.read")
      ? rest(
          `work_items?select=id,entity_id,status,priority,payload&tenant_id=eq.${tenant}&work_type=eq.GOVERNANCE_REVIEW&payload->>organization_id=${orgFilter}&status=eq.open&limit=500`,
        )
      : [],
    finance
      ? rest(
          `work_items?select=id,entity_id,status,payload&tenant_id=eq.${tenant}&work_type=eq.BUDGET_REVIEW&payload->>organization_id=${orgFilter}&status=eq.open${executive ? "" : `&payload->>assigned_role=eq.${role}`}&limit=500`,
        )
      : [],
  ]);
  const [
    athletes,
    invoices,
    assignments,
    commitments,
    deadlines,
    compliancePeople,
    instances,
  ] = await Promise.all([
    registrations.length
      ? rest(
          `athletes?select=id,person_id&id=${ids(registrations.map((r: Row) => r.athlete_id))}`,
        )
      : [],
    customers.length
      ? rest(
          `invoices?select=id,invoice_number,due_date,balance_due,currency,status&customer_id=${ids(customers.map((c: Row) => c.id))}&balance_due=gt.0&order=due_date.asc&limit=500`,
        )
      : [],
    opportunities.length
      ? rest(
          `volunteer_assignments?select=id,opportunity_id,status&opportunity_id=${ids(opportunities.map((o: Row) => o.id))}&limit=2000`,
        )
      : [],
    fundraisingCampaigns.length
      ? rest(
          `fundraising_commitments?select=id,campaign_id,counterparty_name,status&campaign_id=${ids(fundraisingCampaigns.map((c: Row) => c.id))}&status=eq.prospect&limit=2000`,
        )
      : [],
    competitions.length &&
    (executive || ["team_manager", "competition_manager"].includes(role))
      ? rest(
          `competition_deadlines?select=id,competition_id,name,due_at,status&competition_id=${ids(competitions.map((c: Row) => c.id))}&status=neq.completed&order=due_at.asc&limit=500`,
        )
      : [],
    registrar && can(ctx, role, "record.read")
      ? rest(
          `people?select=id,first_name,last_name,preferred_name,birth_date&tenant_id=eq.${tenant}&limit=2000`,
        )
      : [],
    workflowDefinitions.length
      ? rest(
          `workflow_instances?select=id&workflow_definition_id=${ids(workflowDefinitions.map((d: Row) => d.id))}&status=neq.completed&limit=500`,
        )
      : [],
  ]);
  const personIds = compliancePeople.map((p: Row) => p.id);
  const [credentials, backgroundChecks, safeSport, workflowTasks] =
    await Promise.all([
      personIds.length
        ? rest(
            `credentials?select=id,person_id,credential_type,expires_on,status,verification_status&person_id=${ids(personIds)}&order=expires_on.asc&limit=500`,
          )
        : [],
      personIds.length
        ? rest(
            `background_checks?select=id,person_id,check_type,expires_on,status&person_id=${ids(personIds)}&order=expires_on.asc&limit=500`,
          )
        : [],
      personIds.length
        ? rest(
            `safesport_records?select=id,person_id,certification_type,expires_on,status&person_id=${ids(personIds)}&order=expires_on.asc&limit=500`,
          )
        : [],
      instances.length
        ? rest(
            `workflow_tasks?select=id,task_code,status,due_at,assigned_to&workflow_instance_id=${ids(instances.map((i: Row) => i.id))}&status=not.in.(completed,cancelled)&or=(assigned_to.eq.${ctx.person?.id || "00000000-0000-0000-0000-000000000000"},assigned_to.is.null)&order=due_at.asc&limit=200`,
          )
        : [],
    ]);
  const names = new Map(compliancePeople.map((p: Row) => [p.id, p]));
  const athleteById = new Map(athletes.map((a: Row) => [a.id, a]));
  return {
    viewer: {
      displayName: ctx.user.email.split("@")[0],
      personId: ctx.person?.id,
    },
    context: { tenantId: tenant, organizationIds: orgs, role },
    orgAdmin: executive
      ? { organizations, people: compliancePeople, audit }
      : null,
    controls: {
      organizations,
      competitions,
      deadlines,
      dataQualityIssues,
      duplicateCandidates,
      credentials,
      backgroundChecks,
      safeSport,
    },
    registrar: {
      registrations: registrations.map((r: Row) => {
        const athlete = athleteById.get(r.athlete_id) as Row | undefined;
        const person = athlete
          ? (names.get(athlete.person_id) as Row | undefined)
          : undefined;
        return {
          ...r,
          person_id: athlete?.person_id,
          name: person
            ? [person.preferred_name || person.first_name, person.last_name]
                .filter(Boolean)
                .join(" ")
            : "Registration awaiting review",
        };
      }),
    },
    enterprise: { contracts, vendors },
    volunteerData: { opportunities, assignments },
    communicationData: { campaigns },
    fundraisingData: { commitments },
    people: compliancePeople,
    calendarEvents,
    tasks,
    invoices,
    approvals,
    workflowTasks,
    governanceTasks,
    budgetTasks,
    competitionReadiness: [],
    authorization: {
      createTask: can(ctx, role, "admin_tasks.create"),
      updateTask: can(ctx, role, "admin_tasks.update"),
      events: can(ctx, role, "record.update"),
      workflow: can(ctx, role, "workflow.execute"),
    },
    generatedAt: new Date().toISOString(),
  };
}
