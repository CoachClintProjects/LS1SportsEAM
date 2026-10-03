# Compliance decision controls

Implemented; signed-in acceptance pending.

The existing Compliance screen now submits edits and lifecycle decisions with a reason and expected record version. The database locks the record, checks tenant and organization membership, rejects stale decisions, validates current evidence before activation/verification, and commits record and audit changes together. No business compliance records were created. Live counts at this checkpoint: credentials 0, background checks 0, SafeSport records 0.

The drawer supports evidence-property edits, displays failed saves, provides reload recovery and uses colored lifecycle controls. Role changes discard obsolete load responses. This preserves the athlete drawer.

Evidence: TypeScript passed; admin-compliance.cjs passed authorization/reason/version/RPC boundary tests; admin-home-scope.cjs passed. RPC grants deny anon/authenticated direct execution. These checks are not signed-in UAT.

Pending acceptance with genuine evidence and an authenticated session:
- Edit evidence details; reload and verify persistence.
- Record an activation/verification with a reason; verify atomic audit history.
- Reject expired evidence, stale versions and cross-organization access.
- Confirm Home expiry consequences reflect the saved source values.
- Verify role-switch navigation and existing roster regression.

Not implemented by this change: initial evidence intake, policy-defined 12-month personnel lockout, executive override lifecycle, or full role completion. This controls existing record decisions; it does not certify a person's safety eligibility.

Access blocker: available browser contains only about:blank, no LS1 session. Vercel connector returned 404 for deployment HDSxfACtBppjY5QwW7NVANDjS8Lh despite GitHub's successful Vercel status. Signed-in verification requires the current Preview app URL and a user-authenticated browser session.
