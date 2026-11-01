import {
  parentAccess,
  parentRest as rest,
  parentIds as ids,
} from "./parentAccess";
import { parentGrantAllows } from "@/lib/parent/policy";
import { competitionEligibility } from "@/lib/athleteEligibility";
export async function parentSnapshot(
  a: Awaited<ReturnType<typeof parentAccess>>,
) {
  const choices = a.ctx.isPlatformSuperUser
    ? await rest(
        "family_authority_assignments?select=person_id,people!family_authority_assignments_person_id_fkey(first_name,last_name)&status=eq.active&limit=500",
      )
    : [];
  const previewGuardians = [
    ...new Map(
      choices.map((x: any) => [
        x.person_id,
        {
          id: x.person_id,
          name: [x.people?.first_name, x.people?.last_name]
            .filter(Boolean)
            .join(" "),
        },
      ]),
    ).values(),
  ];
  const empty = {
    athletes: [],
    memberships: [],
    teams: [],
    programs: [],
    seasons: [],
    sports: [],
    organizations: [],
    families: [],
    events: [],
    competitions: [],
    responses: [],
    entries: [],
    registrations: [],
    requirements: [],
    requirementStatus: [],
    invoices: [],
    invoiceLines: [],
    documents: [],
    documentTypes: [],
    waivers: [],
    messages: [],
    requests: [],
    opportunities: [],
    volunteer: [],
    grants: a.grants.map((g: any) => ({
      athlete_id: g.athlete_id,
      scopes: g.authority_scopes,
    })),
    readOnly: a.readOnly,
    previewGuardians,
    viewer: null,
  };
  if (!a.athleteIds.length) return { ...empty, setupRequired: true };
  const today = new Date().toISOString().slice(0, 10);
  const [athletes, memberships, registrations, families, viewer] =
    await Promise.all([
      rest(
        `athletes?select=id,person_id,athlete_number,athlete_status,primary_family_id&id=${ids(a.athleteIds)}`,
      ),
      rest(
        `team_memberships?select=id,team_id,athlete_id,status,starts_on,ends_on&athlete_id=${ids(a.athleteIds)}&status=eq.active&and=(or(starts_on.is.null,starts_on.lte.${today}),or(ends_on.is.null,ends_on.gte.${today}))`,
      ),
      rest(
        `registrations?select=id,athlete_id,organization_id,program_id,season_id,status&athlete_id=${ids(a.athleteIds)}`,
      ),
      rest(
        `families?select=id,name& id=${ids(a.familyIds)}`.replace(
          "& id",
          "&id",
        ),
      ),
      rest(
        `people?select=id,first_name,last_name,email,phone,phone_secondary,updated_at&id=eq.${a.personId}`,
      ),
    ]);
  const people = await rest(
    `people?select=id,first_name,last_name,preferred_name,birth_date,status&id=${ids(athletes.map((x: any) => x.person_id))}`,
  );
  const teamIds = [...new Set<string>(memberships.map((m: any) => m.team_id))];
  const teams = teamIds.length
    ? await rest(
        `teams?select=id,name,organization_id,program_id,season_id,sport_id& id=${ids(teamIds)}`.replace(
          "& id",
          "&id",
        ),
      )
    : [];
  const orgIds = [
    ...new Set<string>(
      [...teams, ...registrations].map((x: any) => x.organization_id),
    ),
  ];
  if (!orgIds.length)
    return {
      ...empty,
      athletes: athletes.map((x: any) => ({
        ...x,
        person: people.find((p: any) => p.id === x.person_id),
      })),
      families,
      viewer: viewer[0],
    };
  const readableDocs = athletes.filter((x: any) =>
    a.grants.some(
      (g: any) =>
        g.athlete_id === x.id && parentGrantAllows(g, "parent.documents"),
    ),
  );
  const financeAthletes = athletes.filter((x: any) =>
    a.grants.some(
      (g: any) =>
        g.athlete_id === x.id &&
        parentGrantAllows(g, "parent.finance") &&
        g.financial_guarantor_authorized,
    ),
  );
  const familyAthletes = await rest(
    `athletes?select=id,primary_family_id&primary_family_id=${ids(a.familyIds)}`,
  );
  const financeFamilies = a.familyIds.filter((f) => {
    const members = familyAthletes.filter(
      (x: any) => x.primary_family_id === f,
    );
    return (
      members.length > 0 &&
      members.every((x: any) => financeAthletes.some((y: any) => y.id === x.id))
    );
  });
  const [
    organizations,
    sports,
    programs,
    seasons,
    events,
    competitions,
    responses,
    documents,
    documentTypes,
    requirements,
    requirementStatus,
    customers,
    messages,
    requests,
    opportunities,
    volunteer,
    waivers,
  ] = await Promise.all([
    rest(
      `organizations?select=id,name& id=${ids(orgIds)}`.replace("& id", "&id"),
    ),
    rest("sports?select=id,name,code"),
    rest(
      `programs?select=id,name,sport_id,organization_id,status&organization_id=${ids(orgIds)}`,
    ),
    rest(
      `seasons?select=id,name,organization_id&organization_id=${ids(orgIds)}`,
    ),
    teamIds.length
      ? rest(
          `calendar_events?select=id,title,event_type,organization_id,sport_id,starts_at,ends_at,timezone,status,metadata&organization_id=${ids(orgIds)}&metadata->>team_id=${ids(teamIds)}&ends_at=gte.${new Date().toISOString()}&order=starts_at.asc&limit=1000`,
        )
      : [],
    rest(
      `competitions?select=id,name,organization_id,sport_id,competition_type,starts_at,ends_at,timezone,status&organization_id=${ids(orgIds)}&status=not.in.(cancelled,archived)&order=starts_at.asc`,
    ),
    rest(
      `competition_participation_responses?select=id,competition_id,athlete_id,recipient_person_id,invitation_status,response_status,metadata,updated_at&athlete_id=${ids(a.athleteIds)}&recipient_person_id=eq.${a.personId}`,
    ),
    readableDocs.length
      ? rest(
          `documents?select=id,owner_person_id,title,mime_type,expires_at,verification_status,created_at,document_types!inner(code)&owner_person_id=${ids(readableDocs.map((x: any) => x.person_id))}&document_types.code=in.(IDENTITY,REGISTRATION,WAIVER,MEDIA_RELEASE)&order=created_at.desc`,
        )
      : [],
    rest(
      "document_types?select=id,name,code&code=in.(IDENTITY,REGISTRATION,WAIVER,MEDIA_RELEASE)",
    ),
    rest(
      `registration_requirements?select=id,organization_id,program_id,season_id,name,required,valid_from,valid_until&organization_id=${ids(orgIds)}`,
    ),
    registrations.length
      ? rest(
          `registration_requirement_status?select=id,registration_id,requirement_id,status,notes&registration_id=${ids(registrations.map((x: any) => x.id))}`,
        )
      : [],
    financeAthletes.length
      ? rest(
          `customers?select=id,organization_id,display_name,person_id,family_id&organization_id=${ids(orgIds)}&or=(person_id.${ids(financeAthletes.map((x: any) => x.person_id))}${financeFamilies.length ? `,family_id.${ids(financeFamilies)}` : ""})`,
        )
      : [],
    rest(
      `family_messages?select=id,family_id,athlete_id,title,body,category,created_at&family_id=${ids(a.familyIds)}&athlete_id=${ids(a.athleteIds)}&category=in.(GENERAL,SCHEDULE,COMPETITION,ANNOUNCEMENT)&order=created_at.desc&limit=200`,
    ),
    rest(
      `work_items?select=id,status,priority,payload&owner_person_id=eq.${a.personId}&work_type=eq.ADMIN_TASK&payload->>source=eq.parent&order=id.desc&limit=200`,
    ),
    rest(
      `volunteer_opportunities?select=id,organization_id,title,starts_at,ends_at,capacity,credits,status&organization_id=${ids(orgIds)}&status=in.(open,active,published)&starts_at=gte.${new Date().toISOString()}&order=starts_at.asc`,
    ),
    rest(
      `volunteer_assignments?select=id,opportunity_id,status,checked_in_at,completed_at,credits_awarded&volunteer_person_id=eq.${a.personId}`,
    ),
    rest(
      `waiver_assignments?select=id,athlete_id,person_id,waiver_id,organization_id,status,due_at,updated_at&athlete_id=${ids(a.athleteIds)}`,
    ),
  ]);
  const compIds = competitions.map((x: any) => x.id);
  const [invoices, eligibility, rules, waiverDefinitions, templates] =
    await Promise.all([
      customers.length
        ? rest(
            `invoices?select=id,customer_id,invoice_number,invoice_date,due_date,currency,total,balance_due,status&customer_id=${ids(customers.map((x: any) => x.id))}&order=due_date.desc`,
          )
        : [],
      compIds.length
        ? rest(
            `eligibility_records?select=id,athlete_id,competition_id,rule_id,status,evaluated_at,expires_at,reason&athlete_id=${ids(a.athleteIds)}&competition_id=${ids(compIds)}`,
          )
        : [],
      rest(
        "eligibility_rules?select=id,name,sport_id,status,effective_from,effective_to&status=eq.active",
      ),
      waivers.length
        ? rest(
            `waivers?select=id,organization_id,code,name,version,status& id=${ids(waivers.map((x: any) => x.waiver_id))}`.replace(
              "& id",
              "&id",
            ),
          )
        : [],
      waivers.length
        ? rest(
            `waiver_templates?select=id,organization_id,code,version,body_template,status,signature_policy,updated_at&organization_id=${ids(orgIds)}&status=eq.active`,
          )
        : [],
    ]);
  const invoiceLines = invoices.length
    ? await rest(
        `invoice_lines?select=id,invoice_id,description,quantity,unit_price,line_total&invoice_id=${ids(invoices.map((x: any) => x.id))}`,
      )
    : [];
  const athleteRows = athletes.map((x: any) => ({
    ...x,
    person: people.find((p: any) => p.id === x.person_id),
    sportIds: [
      ...new Set(
        [
          ...memberships
            .filter((m: any) => m.athlete_id === x.id)
            .map(
              (m: any) => teams.find((t: any) => t.id === m.team_id)?.sport_id,
            ),
          ...registrations
            .filter((r: any) => r.athlete_id === x.id)
            .map(
              (r: any) =>
                programs.find((p: any) => p.id === r.program_id)?.sport_id,
            ),
        ].filter(Boolean),
      ),
    ],
  }));
  const competitionRows = athleteRows.flatMap((x: any) =>
    competitions
      .filter(
        (c: any) =>
          responses.some(
            (r: any) => r.athlete_id === x.id && r.competition_id === c.id,
          ) ||
          (x.sportIds.includes(c.sport_id) &&
            [
              ...memberships
                .filter((m: any) => m.athlete_id === x.id)
                .map(
                  (m: any) =>
                    teams.find((t: any) => t.id === m.team_id)?.organization_id,
                ),
              ...registrations
                .filter((r: any) => r.athlete_id === x.id)
                .map((r: any) => r.organization_id),
            ].includes(c.organization_id)),
      )
      .map((c: any) => ({
        ...c,
        athlete_id: x.id,
        assessment: competitionEligibility(
          c,
          rules,
          eligibility.filter((e: any) => e.athlete_id === x.id),
        ),
        response: responses.find(
          (r: any) => r.athlete_id === x.id && r.competition_id === c.id,
        ),
      })),
  );
  return {
    ...empty,
    setupRequired: false,
    viewer: viewer[0],
    athletes: athleteRows,
    memberships,
    teams,
    organizations,
    sports,
    programs,
    seasons,
    families,
    events: events.map((e: any) => ({
      ...e,
      athleteIds: memberships
        .filter((m: any) => m.team_id === e.metadata?.team_id)
        .map((m: any) => m.athlete_id),
    })),
    competitions: competitionRows,
    responses,
    documents,
    documentTypes,
    registrations,
    requirements,
    requirementStatus,
    invoices: invoices.map((i: any) => ({
      ...i,
      athleteIds: financeAthletes
        .filter((x: any) => {
          const customer = customers.find((c: any) => c.id === i.customer_id);
          return (
            customer?.person_id === x.person_id ||
            (customer?.family_id && customer.family_id === x.primary_family_id)
          );
        })
        .map((x: any) => x.id),
      organization_id: customers.find((c: any) => c.id === i.customer_id)
        ?.organization_id,
    })),
    invoiceLines,
    messages,
    requests: requests
      .filter((r: any) => a.athleteIds.includes(r.payload?.athlete_id))
      .map((r: any) => ({
        id: r.id,
        status: r.status,
        payload: {
          athlete_id: r.payload.athlete_id,
          organization_id: r.payload.organization_id,
          title: r.payload.title,
          description: r.payload.description,
          assigned_role: r.payload.assigned_role,
          parent_reply: r.payload.parent_reply,
        },
      })),
    opportunities,
    volunteer,
    waivers: waivers.map((w: any) => {
      const definition = waiverDefinitions.find(
        (d: any) => d.id === w.waiver_id,
      );
      return {
        ...w,
        definition,
        template: templates.find(
          (t: any) =>
            t.organization_id === definition?.organization_id &&
            t.code.toLowerCase() === definition?.code.toLowerCase() &&
            String(t.version) === definition?.version,
        ),
      };
    }),
  };
}
