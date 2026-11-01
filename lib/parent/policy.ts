export const parentScopes = [
  "parent.read",
  "parent.respond",
  "parent.documents",
  "parent.finance",
  "parent.sign",
  "parent.contact",
] as const;
export function parentGrantAllows(grant: any, scope: string, now = Date.now()) {
  return (
    grant.status === "active" &&
    grant.legal_custody_status !== "RESTRICTED_NO_CONTACT" &&
    Date.parse(grant.valid_from) <= now &&
    (!grant.valid_until || Date.parse(grant.valid_until) > now) &&
    Array.isArray(grant.restrictions) &&
    grant.restrictions.length === 0 &&
    Array.isArray(grant.authority_scopes) &&
    grant.authority_scopes.includes("parent.read") &&
    grant.authority_scopes.includes(scope)
  );
}
export function overlappingEvents(events: any[]) {
  return new Set(
    events
      .filter((a) =>
        events.some(
          (b) =>
            a.id !== b.id &&
            Date.parse(a.starts_at) < Date.parse(b.ends_at) &&
            Date.parse(b.starts_at) < Date.parse(a.ends_at),
        ),
      )
      .map((x) => x.id),
  );
}
export const parentNavigation = [
  ["household", "Home"],
  ["athletes", "My athletes"],
  ["schedule", "Calendar"],
  ["competitions", "Competitions"],
  ["financial", "Fees"],
  ["documents", "Forms & documents"],
  ["messages", "Messages & requests"],
  ["volunteer", "Volunteering"],
  ["members", "Family settings"],
] as const;
