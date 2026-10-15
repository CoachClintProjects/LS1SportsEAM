export const communicationsBoundary =
  "[DENY: ERR-201: INSUFFICIENT ACCESS TIER - COMMUNICATIONS COORDINATOR RESTRICTED FROM FINANCE/LEASES/WORKFORCE/IDENTITY]";
export function bulletinInput(b: Record<string, any>, teamIds: string[]) {
  const title = String(b.title || "").trim(),
    body = String(b.body || "").trim(),
    channel = String(b.channel || "");
  if (!title || title.length > 200 || !body || body.length > 30000)
    throw Error(
      "Enter a title (up to 200 characters) and message (up to 30,000 characters).",
    );
  if (!["CH_EMAIL_01", "CH_PUSH_01"].includes(channel))
    throw Error("Choose the intended email or push channel.");
  const segments = b.segments || {};
  const squads = Array.isArray(segments.squads)
    ? [...new Set<string>(segments.squads)]
    : [];
  if (squads.some((id) => typeof id !== "string" || !teamIds.includes(id)))
    throw Error("A selected squad is outside your club.");
  const selection = {
    parents: segments.parents === true,
    coaches: segments.coaches === true,
    volunteers: segments.volunteers === true,
    squads,
  };
  if (
    !selection.parents &&
    !selection.coaches &&
    !selection.volunteers &&
    !squads.length
  )
    throw Error("Select at least one audience.");
  const planned = b.planned_at ? new Date(String(b.planned_at)) : null;
  if (planned && !Number.isFinite(planned.getTime()))
    throw Error("Enter a valid planned date.");
  return {
    title,
    body,
    channel,
    segments: selection,
    planned_at: planned?.toISOString() || null,
  };
}
export function recipientIds(
  s: {
    parents: boolean;
    coaches: boolean;
    volunteers: boolean;
    squads: string[];
  },
  groups: {
    parents: string[];
    coaches: string[];
    volunteers: string[];
    squads: Record<string, string[]>;
  },
) {
  return [
    ...new Set([
      ...(s.parents ? groups.parents : []),
      ...(s.coaches ? groups.coaches : []),
      ...(s.volunteers ? groups.volunteers : []),
      ...s.squads.flatMap((id) => groups.squads[id] || []),
    ]),
  ];
}
