export const gmBoundary =
  "[DENY: ERR-702: SYSTEM PRIVILEGE EXCEPTION - GENERAL MANAGER ACCOUNT RESTRICTED FROM MASTERS FINANCE POLICIES / SELF-LOCKOUT overrides]";
export const gmSubordinateCodes = [
  "TEAM_MANAGER",
  "REGISTRAR",
  "RECORDS_ADMINISTRATOR",
  "TREASURER",
  "FINANCE",
  "COMPETITION_MANAGER",
  "VOLUNTEER_COORDINATOR",
  "VOLUNTEER",
  "COMMUNICATIONS_MEDIA",
  "COMMUNICATIONS",
  "FUNDRAISING_COORDINATOR",
  "FACILITIES_EQUIPMENT_MANAGER",
];
export const gmFolders = [
  "general_manager",
  "team_manager",
  "registrar",
  "treasurer",
  "competition_manager",
  "volunteer_coordinator",
  "communications_media",
  "fundraising_coordinator",
  "facilities_equipment_manager",
];
export const gmClubActions = [
  "preview_transfer",
  "transfer",
  "cash",
  "deposit",
  "approve_credit",
  "cover_fee",
  "reverse_fee",
  "squad_settings",
];
export function currentMembership(
  r: { status: string; starts_on?: string; ends_on?: string },
  today = new Date().toISOString().slice(0, 10),
) {
  return (
    r.status === "active" &&
    (!r.starts_on || r.starts_on <= today) &&
    (!r.ends_on || r.ends_on >= today)
  );
}
export function programMetrics(
  programs: any[],
  seasons: any[],
  registrations: any[],
) {
  return programs.flatMap((p) =>
    seasons.map((s) => {
      const rows = registrations.filter(
        (r) => r.program_id === p.id && r.season_id === s.id,
      );
      const confirmed = new Set(
        rows
          .filter((r) => ["active", "approved"].includes(r.status))
          .map((r) => r.athlete_id),
      );
      const prior = seasons
        .filter((x) => x.ends_on && s.starts_on && x.ends_on < s.starts_on)
        .sort((a, b) => b.ends_on.localeCompare(a.ends_on))[0];
      const cohort = new Set(
        registrations
          .filter(
            (r) =>
              r.program_id === p.id &&
              r.season_id === prior?.id &&
              ["active", "approved", "completed"].includes(r.status),
          )
          .map((r) => r.athlete_id),
      );
      return {
        id: p.id + ":" + s.id,
        program_id: p.id,
        season_id: s.id,
        program: p.name,
        season: s.name,
        participants: confirmed.size,
        pending: rows.filter((r) =>
          ["draft", "submitted", "pending", "under_review"].includes(r.status),
        ).length,
        intake30: rows.filter(
          (r) =>
            r.submitted_at &&
            Date.parse(r.submitted_at) >= Date.now() - 30 * 86400000 &&
            Date.parse(r.submitted_at) <= Date.now(),
        ).length,
        retained: [...cohort].filter((id) => confirmed.has(id)).length,
        priorCount: cohort.size,
      };
    }),
  );
}
