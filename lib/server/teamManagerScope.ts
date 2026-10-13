import type { AccessContext } from "./accessControl";
import { hasAdminContextPermission } from "./accessControl";
import { triageScope, TriageError } from "./adminTriage";
import type { RecordStore } from "./adminPersonRecord";
export const squadBoundary =
  "[DENY: ERR-901: SECURITY BOUNDARY VIOLATION - ACCESS RESTRICTED TO ASSIGNED SQUAD]";
export const squadCode = "SQD_BANANA_01";
export async function teamManagerScope(
  rest: RecordStore,
  ctx: AccessContext,
  requested?: string | null,
) {
  const scope = triageScope(ctx, "team_manager", null);
  if (!hasAdminContextPermission(ctx, "team_manager", "rosters.read"))
    throw new TriageError(squadBoundary, 403);
  const teams = await rest(
    `teams?select=id,name,code,organization_id&organization_id=in.(${scope.orgs.join(",")})&code=eq.${squadCode}&status=eq.active`,
  );
  const authorized = teams.filter(
    (t: { id: string }) =>
      scope.teamIds === null || scope.teamIds.includes(t.id),
  );
  if (authorized.length !== 1 || (requested && requested !== authorized[0].id))
    throw new TriageError(
      `${squadBoundary} The active Banana Slugs squad and its assignment must be configured by Organization Admin.`,
      403,
    );
  return {
    ...scope,
    team: authorized[0].id as string,
    org: authorized[0].organization_id as string,
    squad: authorized[0],
  };
}
export async function squadMembers(rest: RecordStore, team: string) {
  const today = new Date().toISOString().slice(0, 10);
  return rest(
    `team_memberships?select=athlete_id&team_id=eq.${team}&status=eq.active&and=(or(starts_on.is.null,starts_on.lte.${today}),or(ends_on.is.null,ends_on.gte.${today}))&athlete_id=not.is.null&limit=1000`,
  );
}
