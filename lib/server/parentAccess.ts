import type { NextRequest } from "next/server";
import { resolveAccess } from "./accessControl";
import { recordRest as rest } from "./adminRecordAccess";
import { PersonRecordError } from "./adminPersonRecord";
import { parentGrantAllows } from "@/lib/parent/policy";
export { rest as parentRest };
export const parentIds = (v: string[]) => `in.(${[...new Set(v)].join(",")})`;
export async function parentAccess(request: NextRequest) {
  const ctx = await resolveAccess(request);
  if (!ctx) throw new PersonRecordError(401, "Sign in to your parent account.");
  const preview = request.nextUrl.searchParams.get("guardian");
  if (preview && !ctx.isPlatformSuperUser)
    throw new PersonRecordError(
      403,
      "Parent preview is restricted to platform Superusers.",
    );
  if (preview && !/^[0-9a-f-]{36}$/i.test(preview))
    throw new PersonRecordError(400, "Choose a valid guardian.");
  const personId = preview || ctx.person?.id || null;
  const rows = personId
    ? await rest(
        `family_authority_assignments?select=*&person_id=eq.${personId}&status=eq.active`,
      )
    : [];
  const grants = rows.filter((g: any) => parentGrantAllows(g, "parent.read"));
  return {
    ctx,
    personId,
    grants,
    readOnly: !!preview,
    athleteIds: [...new Set<string>(grants.map((g: any) => g.athlete_id))],
    familyIds: [...new Set<string>(grants.map((g: any) => g.family_id))],
  };
}
export function requireParentGrant(
  access: Awaited<ReturnType<typeof parentAccess>>,
  athleteId: string,
  scope: string,
) {
  if (access.readOnly)
    throw new PersonRecordError(403, "Superuser parent preview is read-only.");
  const grant = access.grants.find(
    (g: any) => g.athlete_id === athleteId && parentGrantAllows(g, scope),
  );
  if (!grant)
    throw new PersonRecordError(
      403,
      "This action is outside your current guardian permissions.",
    );
  return grant;
}
