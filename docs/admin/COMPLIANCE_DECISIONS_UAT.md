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

## Release candidate additions — 2026-10-03

Application changes are held locally for the coherent Admin release; no application deployment is triggered by this checkpoint. Additive database functions/columns are installed and preserve the deployed API signature.

- Evidence intake for credentials, background checks and SafeSport uses existing scoped people, pending review, a stable request ID, an atomic review work item and audit event. Retries return the same created record only for the same actor and intake values.
- Documents are associated with the person and role document authority. Activation requires verified, current supporting evidence of the appropriate type. Editing evidence properties returns the source to pending and removes previous verification.
- Home includes evidence review work and links through the authorized Compliance navigation record into the matching drawer.
- Lists use database search, allowlisted sorting and 25-row pagination. Drawer history, document review and failure recovery are connected.
- TypeScript, intake/decision authorization tests and Home role query tests pass. The list RPC executes against the live schema; the intake INSERT shape passes database EXPLAIN without inserting records.

Still pending: signed-in lifecycle acceptance, policy-defined personnel lockout and controlled override, and remaining Admin role scope. This checkpoint does not certify the Admin engine or any full role.
