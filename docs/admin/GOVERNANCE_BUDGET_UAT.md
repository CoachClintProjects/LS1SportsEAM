# Organization governance and budget controls

Status: implemented, NOT RUN in the signed-in application. No operational acceptance claimed.

## Scope of this change

Governance & risk contains canonical policies/bylaws, corporate insurance, sanction/charter records and incidents. Metadata definitions drive fields and state choices. The dark right drawer supports permitted edits, assignments, due dates, evidence upload/open and decisions, with version checks. Each write updates its canonical work item and audit history atomically. Expired/rejected records remain open for follow-up. Active policies require an active replacement before supersession. Insurance and sanction activation require uploaded evidence. External sanction submission is recorded only after an administrator supplies its confirmation; LS1 does not transmit it to a governing body.

Budgets uses the existing budget, budget-line and account tables. Treasurer may prepare allocations, submit and return a submitted budget to draft. Org Admin has approval/lock/close/cancel authority. Database triggers enforce lifecycle order and draft-only line mutation across entry points. Budget changes update review work and audit history in the transaction. Org Admin can create an account for the legal entity when required. Home links directly to the work records. New nav entries are enabled after successful deployment.

## Technical evidence

- TypeScript and focused ESLint checks are recorded at the release checkpoint.
- Controlled `admin-governance.cjs` and `admin-budgets.cjs` check role, permission, scope and mutation boundaries. These are source tests, not business UAT.
- Live schema: governance tables have RLS enabled and no anon/authenticated grants. No end-user RLS policies is intentional: the authenticated server checks scope and uses service-only transactions. Evidence bucket is private.
- Budget/budget-line direct client writes are revoked; lifecycle and line guards are installed. New RPCs deny anon/authenticated execution.
- No fabricated operational records, accounts, incidents, budgets or files were inserted for verification.

## Required acceptance evidence — all pending

| Workflow | Expected evidence | Result |
|---|---|---|
| Policy ratification | Genuine draft/body/effective date → review → approved; actor, reason and before/after audit | Pending |
| Policy replacement | Active contents locked; supersession requires another active policy; old history retained | Pending |
| Insurance | Correct coverage values/dates; private certificate upload/open; activation blocked without evidence or with expired dates | Pending |
| Sanctioning | Submission confirmation required; approval evidence required; renewal/expiry work remains visible | Pending |
| Incident | Restricted details; reported → investigation → findings → resolved → closed; reopening audited | Pending |
| Responsibility | Only current Org Admin owners; assignment/due change appears in linked work; expiry cannot be postponed by a later follow-up date | Pending |
| Governance stale/retry | Concurrent stale edit denied; retry creates no duplicate; source and work/audit commit together | Pending |
| Governance files | Cross-org file/record access denied; storage upload failure surfaced; ambiguous metadata response does not delete a committed file | Pending |
| Budget preparation | Correct legal entity/accounts/periods; add/edit/remove draft allocations; account-code collision detected | Pending |
| Budget approval | Treasurer cannot approve/lock/close; Org Admin can; submitted/locked line changes fail at the database boundary | Pending |
| Budget concurrency | Another line change invalidates the current version; losing transaction reloads without overwriting | Pending |
| Budget Home | Submitted budget appears for Org Admin; draft preparation appears for Treasurer; click opens budget drawer | Pending |
| Regression | Existing roster/drawer, role switch, finance and Superuser paths remain operational | Pending |

## Scope still open

This is not full Org Admin or Treasurer completion. SafeSport automatic lockout/override consequences, purchasing signature thresholds, fee architecture, master budget variance/reporting, accounting journals/reconciliation/period close, and the other requested role workflows remain open. Budget close is a budget lifecycle action; it is not accounting-period close. End-to-end signed-in validation has not been performed.
