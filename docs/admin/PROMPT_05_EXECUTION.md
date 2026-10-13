# Prompt 05 — Team Manager

Status: partially implemented; NOT operationally complete. Signed-in UAT belongs to the user.

## Delivered source

- Team Manager role opens Today’s Tasks and five navigation destinations: Swimmer Roster, Meet Invitations Hub, Team Travel & Hotels, Collect Team Fees, Practice Timelines.
- Fresh role/organization workspace mounting, dark drawers, 25-record list pages, search, traffic-light statuses, loading/error/empty states.
- Server resolves `SQD_BANANA_01` against existing active team records and actual role assignments. No invented IDs, squads, people, charges or test transactions. Ambiguous, absent or unauthorized squad returns ERR-901; no fallback to the club-wide roster.
- Scoped reads use active, date-valid memberships for athlete, registration, participation, travel, calendar, invoice and cash-holding data. Row-limit warnings identify incomplete collections. Practices require an explicit saved team link.
- Old broad admin-command reads/writes are denied in Team Manager role; linked person records and triage enforce the same squad boundary. Organization Admin and other roles retain their existing routes.
- Existing triage handles LS1 recipient reminders, policy/evidence-bound waiver exceptions and fee-verification vouchers. These do not fabricate consent signatures, blanket eligibility clearance, SMS delivery or a lasting entry lock.
- Physical cash receipts call the existing atomic `admin_cross_engine` operation with a server-bound actor, authorized invoice/squad and stable request ID. It records allocations, decreases only the amount received, posts balanced ledger lines, retains a cash holding, and routes a Treasurer task. Existing posting accounts and group membership are required by that transaction. Check receipts are not misclassified as cash.
- Travel participation and practice views display saved records. They do not claim to create hotel bookings or modify practice schedules.

## Live preflight blockers, 2026-10-13

- The inspected HPAC organization has team HPAC and no groups; it has no active team with code `SQD_BANANA_01`. Organization Admin must identify/configure the actual intended squad and assignment before Team Manager can enter this constrained workspace. Existing HPAC was not renamed or silently substituted.
- No existing atomic service was found that creates the requested invitation, registration and parent invoice together. The dispatch drawer explains unavailability and creates no partial records.
- Existing physical-cash transaction does not support checks or parent/family customer accounts; it requires an athlete-linked customer and active group membership.
- Fee voucher verification snapshots and rechecks fees but does not permanently freeze entries or validate a completed entry file. It is not labeled LOCKED_PENDING_PAYMENT.
- Blanket eligibility overrides and hotel booking writes have no verified existing end-to-end service.

The prompt expressly forbids schemas and migrations and says to focus on the frontend. No database DDL, migration, business transaction, message dispatch or synthetic data was executed for this work. Completing the missing transactions requires relaxing that constraint, plus resolving the real squad mapping. This release must not be counted as Prompt 05 complete.

## Verification

TypeScript no-emit and focused ESLint checks, isolated permission regressions (not UAT), source diff inspection, and Preview deployment status. No signed-in browser/UAT completion is asserted.
