// Aggregate recorded rule decisions without treating missing evidence as clearance.
export function competitionEligibility(
  competition: any,
  rules: any[],
  records: any[],
  now = Date.now(),
) {
  const day = (competition.starts_at || new Date(now).toISOString()).slice(
    0,
    10,
  );
  const clearanceAt = Math.max(now, Date.parse(competition.starts_at) || now);
  const required = rules.filter(
    (r) =>
      r.status === "active" &&
      (!r.sport_id || r.sport_id === competition.sport_id) &&
      (!r.effective_from || r.effective_from <= day) &&
      (!r.effective_to || r.effective_to >= day),
  );
  const latest = new Map<string, any>();
  for (const r of records
    .filter((r) => r.competition_id === competition.id)
    .sort((a, b) => Date.parse(b.evaluated_at) - Date.parse(a.evaluated_at))) {
    const key = r.rule_id || "overall";
    if (!latest.has(key)) latest.set(key, r);
  }
  const checks = required.map((rule) => {
    const r = latest.get(rule.id);
    const current =
      r && (!r.expires_at || Date.parse(r.expires_at) > clearanceAt);
    return {
      name: rule.name,
      status: !r
        ? "Not assessed"
        : !current
          ? "Expired or expires before competition"
          : r.status,
      reason: current ? r.reason : null,
    };
  });
  const overall = latest.get("overall");
  const evidence = checks.length
    ? checks
    : [...latest.values()].map((r) => ({
        name: "Recorded assessment",
        status:
          r.expires_at && Date.parse(r.expires_at) <= clearanceAt
            ? "Expired or expires before competition"
            : r.status,
        reason: r.reason,
      }));
  const blocked = [...evidence, ...(overall ? [overall] : [])].some((r) =>
    ["blocked", "ineligible", "failed", "denied"].includes(
      r.status?.toLowerCase(),
    ),
  );
  const valid = (r: any) =>
    ["eligible", "approved", "cleared", "passed"].includes(
      r.status?.toLowerCase(),
    );
  const overallCurrent =
    overall &&
    (!overall.expires_at || Date.parse(overall.expires_at) > clearanceAt) &&
    valid(overall);
  const complete =
    evidence.length > 0 &&
    evidence.every(valid) &&
    (!overall || overallCurrent) &&
    (required.length > 0 || overallCurrent);
  return {
    status: blocked
      ? "Not eligible"
      : complete
        ? "Eligible"
        : "Not assessed / review required",
    checks: evidence,
    reason: !evidence.length
      ? "No eligibility assessment or configured rules are available for this competition."
      : !required.length && !overallCurrent
        ? "Competition-wide clearance has not been recorded."
        : null,
  };
}
