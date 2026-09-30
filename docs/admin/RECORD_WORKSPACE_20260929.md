# Admin record workspace — 29 September 2026

## User requirements

- Preserve dark theme. Use a right-side record drawer, retaining the roster behind it.
- Reference: HubSpot identity/contact and association cards; user's dark day-to-day record drawer is an alternative layout. Middle/right content remains under discussion.
- Edit whole record and individual sections, with colored action buttons.
- Roster: 25 records per page, pagination, sortable people headers; sidebar label Roster; Home returns to Today's tasks.
- Automations and Marketplace navigation for Admin and Coach only.
- Submit Ticket globally. Persist tickets; email delivery awaits the user's uncreated recipient mailbox. Never claim email was sent without delivery evidence.
- Operational create/update/cancel/archive flows: athletes, admin assignments, vendors, external contacts, facilities, schedules, contracts. Missing canonical data structures must precede UI claims.
- External Contacts excludes athlete/parent lists; includes facility superintendents and sports/recreation council contacts.
- Guardians belong in the athlete drawer; assess removal of redundant navigation without deleting family relationships.
- Facilities owns booking/planning. Label the current calendar accurately. Do not call it an interactive Gantt.
- Match actual HubSpot navigation typography; screenshot alone does not establish the font family.
- Today's tasks in Parent, Scout, Coach; role-scoped tasks for all Admin roles.
- Treasurer requires full accounting, not just balances. Maintain posting, approval, reconciliation, audit and period controls.
- Superuser must reflect actual shared capabilities and verification state, without a separate stale completion picture.
- Validate Organization Admin, then each role's data, authority and domain workflows; write executable UAT against real records.

## Proposed drawer content — not approved final design

Left: identity, athlete number/status, contact details and record actions.
Middle: action-required summary, registration/eligibility, tasks/activity, competitions, fees, documents and restricted health/consent sections.
Right: guardians/emergency contacts, squad/team, coach, program/season, facility, related documents.
Use tabs/collapsible cards to fit a drawer rather than compress a full desktop screen.

## Implementation evidence

- Removed organization stylesheet rules explicitly forcing white backgrounds.
- Changed OrganizationArchitecture record overlay to a bounded dark right-side drawer.
- Added people header sorting and 25-record pagination.
- Added roster 25-record pagination.
- These are local changes. Signed-in browser verification and deployment remain outstanding.
- Existing generic record fields are not yet the requested athlete workspace. Relationships, section editing, keyboard modal behavior and all new domain workflows remain unfinished.
- Pagination currently applies to the fetched snapshot, not server-side paging; backend limits must be reconciled before asserting full large-roster coverage.

## Approved implementation batch

The product owner approved the proposed drawer arrangement with “proceed”.

Implemented in source:
- Shared dark three-column person/athlete drawer, opened from organization people and roster.
- Identity/contact profile edits, emergency contact add/edit, restricted medical add/edit; transactional audit and stale-save protection.
- Scoped live relationships: guardians, emergency contacts, coach/team, training bookings, registrations, competitions, consent and outstanding invoices. No fabricated relationships or health data.
- Home and Roster navigation based on component identity, not legacy database labels.
- Admin/Coach Automations and Marketplace catalog panels; read-only configuration inspection, no workflow builder or integration installer claimed.
- Global ticket submission, durable idempotent ticket number and event; email explicitly pending configuration.
- External Contacts directory with create/edit/inactivate and facility/vendor/external organization associations.
- Superuser displays Admin implementation inventory with runtime/acceptance state.

Database migrations applied remotely; matching SQL is in `docs/admin/sql/`.
Technical checks: TypeScript and focused ESLint passed; technical authorization regression script passed; real-person profile transaction executed and rolled back; stale-save transaction rejected; medical direct-access grant checks passed.
Local production build: compiled successfully, then page-data collection failed in the existing icons route because local Supabase runtime environment variables are absent. This is not a successful full build or signed-in test.

Still unfinished from the broader scope:
- Signed-in browser/UAT and role-by-role validation.
- Parent/Scout/Coach Today's tasks; exact HubSpot sidebar font verification.
- Full accounting acceptance, domain-specific role workflow reconciliation, interactive facility Gantt.
- Athlete documents, linked-relationship editing, full athlete lifecycle actions inside the new drawer; current edit-record action edits the person profile.
- External-contact linking to an already existing person and organization backfill for legacy external contacts.
- Server-side roster pagination beyond the current snapshot limits.
- Workflow builder, integration installation and ticket email delivery.

## 30 September preview release checkpoint

Added record task actions; private document upload and signed access; address and preferred contact method edits; guardian contact, squad membership and coach assignment changes; athlete activation/deactivation; registration submission and controlled decisions with required-check enforcement. These use canonical records and service-only database transactions with audit history. SQL definitions in this directory were applied to the connected database.

Fixed missing roster pagination controls (25 per page), header sorting, refresh after record edits, single-organization onboarding selection, and sidebar state when navigating backwards. Drawer tabs fetch only their required supplementary data. Existing document types are used; uploads do not imply document verification. Guardian contact links do not grant custody or account authority; coach changes require role-assignment permission and apply to the squad.

Checks: TypeScript passes; both admin-person-record and admin-record-actions technical regression scripts pass. These are controlled authorization tests, not signed-in UAT. Athlete lifecycle SQL was executed against an existing record in a rolled-back transaction; no business change persisted from that check.

This checkpoint supersedes the earlier unfinished list for the features named above only. Deployment readiness and signed-in workflow acceptance must be recorded separately. Full Admin completion, facilities/contract workflow reconciliation, accounting acceptance, exact typography and the other role engines are not claimed complete.

### Roster navigation correction — 30 September

User reported Roster missing after the preview release. Live inspection found the existing RostersView navigation row had is_active=false while Org Admin's can_view grant was true. The API filters inactive rows before label normalization, so the implementation existed but no menu item or authorized workspace route was returned. Restored the existing row to active, label Roster, top-level placement. Preserved existing role grants and route ID. Verified the live active-row/Org Admin grant join returns Roster and its existing route. This configuration fix applies without another application build; signed-in visual confirmation remains separate. Reproducible SQL and a live release assertion are in restore-roster-navigation.sql.

### Shared workspace correction batch — 30 September

Restored both Superuser CSV exports (milestone matrix and incomplete unit action plan), including CSV quoting and spreadsheet-formula protection. Empty/unloaded unit lists cannot claim completion. Admin implementation inventory is merged into the M09 matrix/action-plan read model each refresh; runtime and acceptance remain evidence-gated.

Role workspace remounts on role changes. Home ignores superseded responses, clears selected records on role changes, excludes cancelled tasks and labels the active role. Sidebar clears previous-role links during loading and reports navigation failures instead of silently substituting a generic Admin menu. Assigned work filtering now precedes the database row limit. Added source-derived volunteer capacity, communications draft and fundraising prospect queues; registrar includes expiring compliance.

Home requests skip unrelated communication/family/volunteer/fundraising and invoice-detail loads unless needed by the selected role. Competition detail fetches the full dataset on demand. This reduces queries; no measured signed-in latency claim is made. Added explicit action colors on Home. Sidebar uses build-hosted Lexend Deca, based on HubSpot's published September 2026 UI-font guidance; exact sizing/visual parity remains unverified.

Technical checks: TypeScript and focused lint passed; existing record authorization regressions passed. Full role scope and signed-in acceptance remain unfinished. Athlete drawer layout unchanged.
