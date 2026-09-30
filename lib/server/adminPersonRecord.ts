import { hasAdminContextPermission, type AccessContext } from "./accessControl";
export type RecordStore = (path: string, init?: RequestInit) => Promise<any>;
const ids = (values: string[]) =>
  `in.(${[...new Set(values.filter(Boolean))].join(",")})`;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export class PersonRecordError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function personRecordScope(
  rest: RecordStore,
  ctx: AccessContext,
  role: string,
  tenant: string,
  orgs: string[],
  personId: string,
) {
  if (!uuid.test(personId))
    throw new PersonRecordError(400, "A valid person record is required.");
  if (
    !hasAdminContextPermission(ctx, role, "rosters.read") &&
    role !== "org_admin"
  )
    throw new PersonRecordError(403, "Roster access denied.");
  const people = await rest(
    `people?select=id,first_name,last_name,preferred_name,birth_date,email,phone,status,updated_at&tenant_id=eq.${tenant}&id=eq.${personId}`,
  );
  if (!people.length) throw new PersonRecordError(404, "Person not found.");
  const [athletes, teams, assignments] = await Promise.all([
    rest(
      `athletes?select=id,person_id,athlete_number,athlete_status,primary_family_id,privacy_level,status&person_id=eq.${personId}`,
    ),
    rest(
      `teams?select=id,name,organization_id,program_id,season_id,status&organization_id=${ids(orgs)}`,
    ),
    rest(
      `role_assignments?select=id&tenant_id=eq.${tenant}&organization_id=${ids(orgs)}&person_id=eq.${personId}&limit=1`,
    ),
  ]);
  const athlete = athletes[0] || null;
  const [registrations, memberships] = athlete
    ? await Promise.all([
        rest(
          `registrations?select=id,organization_id,program_id,season_id,status,submitted_at&athlete_id=eq.${athlete.id}&organization_id=${ids(orgs)}`,
        ),
        teams.length
          ? rest(
              `team_memberships?select=id,team_id,athlete_id,membership_type,status,starts_on,ends_on&athlete_id=eq.${athlete.id}&team_id=${ids(teams.map((t: any) => t.id))}`,
            )
          : [],
      ])
    : [[], []];
  if (!registrations.length && !memberships.length && !assignments.length) {
    // Imported/unassigned people are manageable by the sole organization's administrator.
    const tenantOrgs =
      role === "org_admin"
        ? await rest(`organizations?select=id&tenant_id=eq.${tenant}&limit=2`)
        : [];
    if (tenantOrgs.length !== 1 || !orgs.includes(tenantOrgs[0].id))
      throw new PersonRecordError(404, "Person is outside this organization.");
  }
  return {
    person: people[0],
    athlete,
    registrations,
    memberships,
    teams: teams.filter((t: any) =>
      memberships.some((m: any) => m.team_id === t.id),
    ),
  };
}
export async function readPersonRecord(
  rest: RecordStore,
  ctx: AccessContext,
  role: string,
  tenant: string,
  orgs: string[],
  personId: string,
) {
  const base = await personRecordScope(rest, ctx, role, tenant, orgs, personId);
  const { athlete, teams } = base,
    teamIds = teams.map((t: any) => t.id);
  const medicalAccess =
    role === "org_admin" && hasAdminContextPermission(ctx, role, "record.read");
  const canEdit =
    hasAdminContextPermission(ctx, role, "record.update") &&
    ["org_admin", "registrar", "team_manager"].includes(role);
  const canFinance = hasAdminContextPermission(ctx, role, "finance.read");
  const [
    familyLinks,
    authorities,
    emergency,
    coaches,
    bookings,
    entries,
    responses,
    consents,
    activity,
    medical,
  ] = await Promise.all([
    rest(`family_members?select=family_id&person_id=eq.${personId}`),
    athlete
      ? rest(
          `family_authority_assignments?select=id,family_id,person_id,relationship_type,status,valid_from,valid_until&tenant_id=eq.${tenant}&athlete_id=eq.${athlete.id}&status=eq.active`,
        )
      : [],
    athlete
      ? rest(
          `emergency_contacts?select=contact_id,name,relationship,phone_primary,phone_secondary,email,is_primary,can_pickup,updated_at&athlete_id=eq.${athlete.id}`,
        )
      : [],
    teamIds.length
      ? rest(
          `coach_access_assignments?select=id,coach_person_id,team_id,is_head_coach,role_key,status&tenant_id=eq.${tenant}&organization_id=${ids(orgs)}&team_id=${ids(teamIds)}&status=eq.active`,
        )
      : [],
    teamIds.length
      ? rest(
          `facility_bookings?select=id,facility_id,team_id,starts_at,ends_at,status&team_id=${ids(teamIds)}&ends_at=gte.${encodeURIComponent(new Date().toISOString())}&order=starts_at.asc&limit=30`,
        )
      : [],
    athlete
      ? rest(
          `competition_entries?select=id,competition_event_id,entry_status,eligibility_status,scratch_status&athlete_id=eq.${athlete.id}`,
        )
      : [],
    athlete
      ? rest(
          `competition_participation_responses?select=id,competition_id,response_status&tenant_id=eq.${tenant}&organization_id=${ids(orgs)}&athlete_id=eq.${athlete.id}`,
        )
      : [],
    rest(
      `consents?select=id,consent_type_id,granted_at,revoked_at&person_id=eq.${personId}`,
    ),
    hasAdminContextPermission(ctx, role, "audit.read")
      ? rest(
          `audit_events?select=id,action,entity_type,entity_id,occurred_at&tenant_id=eq.${tenant}&entity_id=${ids([personId, athlete?.id])}&order=occurred_at.desc&limit=50`,
        )
      : [],
    athlete && medicalAccess
      ? rest(
          `athlete_medical_profiles?select=*&tenant_id=eq.${tenant}&organization_id=${ids(orgs)}&athlete_id=eq.${athlete.id}`,
        )
      : [],
  ]);
  const familyIds = [
    ...new Set<string>(
      [
        athlete?.primary_family_id,
        ...familyLinks.map((x: any) => x.family_id),
        ...authorities.map((x: any) => x.family_id),
      ].filter(Boolean),
    ),
  ];
  const familyMembers = familyIds.length
    ? await rest(
        `family_members?select=family_id,person_id,relationship_type,is_primary_guardian&family_id=${ids(familyIds)}&person_id=neq.${personId}`,
      )
    : [];
  const relatedIds = [
    ...authorities.map((x: any) => x.person_id),
    ...familyMembers.map((x: any) => x.person_id),
    ...coaches.map((x: any) => x.coach_person_id),
  ];
  const programIds = [
    ...base.registrations.map((x: any) => x.program_id),
    ...teams.map((x: any) => x.program_id),
  ].filter(Boolean);
  const seasonIds = [
    ...base.registrations.map((x: any) => x.season_id),
    ...teams.map((x: any) => x.season_id),
  ].filter(Boolean);
  const [
    relatedPeople,
    facilities,
    events,
    customers,
    programs,
    seasons,
    consentTypes,
  ] = await Promise.all([
    relatedIds.length
      ? rest(
          `people?select=id,first_name,last_name,preferred_name,email,phone&tenant_id=eq.${tenant}&id=${ids(relatedIds)}`,
        )
      : [],
    bookings.length
      ? rest(
          `facilities?select=id,name,site_id& id=${ids(bookings.map((x: any) => x.facility_id))}`.replace(
            "& id",
            "&id",
          ),
        )
      : [],
    entries.length
      ? rest(
          `competition_events?select=id,competition_id,name&id=${ids(entries.map((x: any) => x.competition_event_id))}`,
        )
      : [],
    canFinance
      ? rest(
          `customers?select=id,display_name,family_id&organization_id=${ids(orgs)}&or=(person_id.eq.${personId}${familyIds.length ? `,family_id.${ids(familyIds)}` : ""})`,
        )
      : [],
    programIds.length
      ? rest(
          `programs?select=id,name&organization_id=${ids(orgs)}&id=${ids(programIds)}`,
        )
      : [],
    seasonIds.length
      ? rest(
          `seasons?select=id,name&organization_id=${ids(orgs)}&id=${ids(seasonIds)}`,
        )
      : [],
    consents.length
      ? rest(
          `consent_types?select=id,name&id=${ids(consents.map((x: any) => x.consent_type_id))}`,
        )
      : [],
  ]);
  const competitionIds = [
    ...events.map((e: any) => e.competition_id),
    ...responses.map((r: any) => r.competition_id),
  ];
  const [competitions, invoices, sites] = await Promise.all([
    competitionIds.length
      ? rest(
          `competitions?select=id,name,starts_at,ends_at,status&organization_id=${ids(orgs)}&id=${ids(competitionIds)}&order=starts_at.asc`,
        )
      : [],
    customers.length
      ? rest(
          `invoices?select=id,customer_id,invoice_number,due_date,balance_due,currency,status&customer_id=${ids(customers.map((c: any) => c.id))}&balance_due=gt.0&order=due_date.asc`,
        )
      : [],
    facilities.length
      ? rest(
          `sites?select=id,name,address_line1,city&organization_id=${ids(orgs)}&id=${ids(facilities.map((f: any) => f.site_id))}`,
        )
      : [],
  ]);
  const person = (id: string) =>
    relatedPeople.find((p: any) => p.id === id) || null;
  return {
    ...base,
    programs,
    seasons,
    guardians: familyMembers
      .filter(
        (m: any) =>
          m.is_primary_guardian ||
          /parent|guardian|mother|father/i.test(m.relationship_type || ""),
      )
      .map((m: any) => ({ ...m, person: person(m.person_id) }))
      .filter((m: any) => m.person),
    authorities: authorities
      .map((a: any) => ({ ...a, person: person(a.person_id) }))
      .filter((a: any) => a.person),
    emergency,
    coaches: coaches
      .map((c: any) => ({ ...c, person: person(c.coach_person_id) }))
      .filter((c: any) => c.person),
    bookings: bookings
      .map((b: any) => ({
        ...b,
        facility: facilities.find((f: any) => f.id === b.facility_id),
      }))
      .filter((b: any) => sites.some((s: any) => s.id === b.facility?.site_id)),
    sites,
    competitions: competitions.map((c: any) => ({
      ...c,
      response: responses.find((r: any) => r.competition_id === c.id)
        ?.response_status,
      entries: entries
        .filter((e: any) =>
          events.some(
            (v: any) =>
              v.id === e.competition_event_id && v.competition_id === c.id,
          ),
        )
        .map((e: any) => ({
          ...e,
          name: events.find((v: any) => v.id === e.competition_event_id)?.name,
        })),
    })),
    invoices: invoices.map((i: any) => ({
      ...i,
      account: customers.find((c: any) => c.id === i.customer_id)?.display_name,
    })),
    consents: consents.map((c: any) => ({
      ...c,
      name: consentTypes.find((t: any) => t.id === c.consent_type_id)?.name,
    })),
    activity,
    medical: medical[0] || null,
    authorization: {
      edit: canEdit,
      finance: canFinance,
      medical: medicalAccess,
      editMedical: medicalAccess && canEdit,
    },
    organizationId: orgs.length === 1 ? orgs[0] : null,
  };
}
