/** Highlights only the current saved state; it does not invent prior approvals. */
export function RecordLifecycle({ status }: { status: string }) {
  const phases = ["Intake", "Checked", "Approved", "Live"];
  const stage: Record<string, number> = {
    draft: 0,
    open: 0,
    pending: 0,
    submitted: 0,
    reviewed: 1,
    verified: 1,
    checked: 1,
    approved: 2,
    authorized: 2,
    active: 3,
    completed: 3,
    resolved: 3,
    posted: 3,
  };
  const current = stage[status.toLowerCase()];
  return (
    <div className="mb-5">
      <p className="mb-2 text-xs text-slate-300">
        Saved record status: {status.replaceAll("_", " ")}
      </p>
      <ol aria-label="Record lifecycle" className="grid grid-cols-4 gap-2">
        {phases.map((phase, index) => (
          <li
            key={phase}
            aria-current={current === index ? "step" : undefined}
            className={`rounded border px-2 py-2 text-center text-sm ${current === index ? ["border-blue-400 bg-blue-950 text-blue-100", "border-amber-400 bg-amber-950 text-amber-100", "border-teal-400 bg-teal-950 text-teal-100", "border-emerald-400 bg-emerald-950 text-emerald-100"][index] : "border-[#30363D] text-slate-400"}`}
          >
            {phase}
          </li>
        ))}
      </ol>
    </div>
  );
}
