# Prompt 8 — Game Day Director

Status: partial implementation; Preview checkpoint, not competition-engine completion.

## Implemented
- Dedicated Home and five role-isolated competition sections, dark three-column record drawers and locally hosted shared Lexend typography.
- Club/tenant-scoped reads of competitions, sessions, entries, officials/requirements, seeding runs/assignments, result receipts/corrections, jury cases, closures and bookings. Read pagination fails explicitly at the safety cap instead of displaying silently incomplete totals.
- Thirty-second visible-page refresh and refresh after saved competition changes; stale-request protection, error and empty states, 25-record table pages.
- Existing saved competition/event/entry/deadline editing. Entries require current approved eligibility. Dates validated on creation and update. Destructive cancellation through generic competition editing is denied pending a controlled lifecycle transaction.
- Real closure-overlap alerts and assigned-official counts. Unknown staffing requirements and unavailable timing metrics are not represented as zeros.
- ERR-601 boundaries on competition commands, finance scope and person-record access. Competition GET does not use the broad Admin data endpoint.
- Existing atomic cash-box voucher authorization can be opened by authorized actors; existing permissions, duplicate prevention, reason/audit and Treasurer handoff remain intact.

## Outstanding work in the Admin action plan
- Qualified neutral-registry official assignment and credential/affiliation validation.
- Automated seeding against locked manifests, canonical rules and publication; current view shows saved runs and heat sheets only.
- Jury decision, DQ, result reconciliation and audited permanent signoff transactions.
- Session-shift and emergency-rerouting transactions with durable manager notifications. Competition venue/date editing does not claim to perform these cascades.
- Official pay-table calculation and schedule locking during cash-box authorization. Existing authorization uses entered approved amounts.
- Competition Manager has record.read and competition_entries.update grants, but the live role lacks workflow.execute needed by the existing cash-box approval route. UI states this limitation; this release does not silently grant broad workflow authority.
- Actual start/signoff timestamps and validated delay/closeout telemetry.
- Signed-in testing by owner and Hy-Tek parallel competition verification remain required.

## Validation
- TypeScript compilation and scoped ESLint checks (warnings, no errors).
- Verification script covers unauthenticated/unauthorized/out-of-club reads, tenant/organization query filters, restricted command exclusion, eligibility expiry, half-open closure overlaps, and duplicate official counting.
- Existing database schema and cash-box routine inspected read-only. No tables, schemas or business data created; no simulated competition data or fake completion states.
