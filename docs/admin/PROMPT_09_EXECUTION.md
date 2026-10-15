# Prompt 9 — Volunteer Helper

Status: partial implementation; not 100% operational. Owner signed-in testing remains pending.

## Live-store findings (2026-10-15)
- HPAC has zero volunteer opportunities and zero configured volunteer roles.
- Existing stores: volunteer_opportunities, volunteer_assignments, volunteer_roles, volunteer_credentials, credentials and operational_tasks.
- volunteer_shifts and family_obligations do not exist. No volunteer provisioning, assignment, family-hour settlement or no-show cascade transaction was found. admin_urws_workforce_snapshot is a read projection, not such a transaction.
- Volunteer Coordinator has record read/create/update and task permissions. No grants were added or broadened.

## Delivered
- Five dedicated navigation sections and Home; scoped role remounting; exact ERR-301 guards on broad command, finance, person-record and restricted triage actions.
- Exact initial empty-mode wording and provision button. It opens a working manual shift form with required capacity, valid times and recorded reason. A saved session can supply the descriptive name and times; this does not create a durable competition relationship or infer league rules.
- Existing-table shift creation with a client request UUID, duplicate-request checking, audit attempt, and explicit warning if the data save succeeds but audit insertion fails. No false rollback claim or blind repeat instruction.
- Club-scoped live shift/assignment reads, 25-record pagination, explicit empty/error states, 30-second visible-page refresh, three-column dark drawers and existing local Lexend typography.
- Check-in validates current, verified credential types configured on the role through the shift end. Missing roles, missing restricted-role requirements, revoked/unverified/future-issued/expired evidence fail closed. Requirements use role metadata.required_credential_types and metadata.restricted_zone; this release does not invent values for absent configuration.
- Check-in and cancellation use status + updated_at compare-and-swap to reject a concurrent change. Cancellation retains the worker and assignment history while releasing the counted vacancy.
- Saved assignment credits are labeled as credits; no assertion that these represent hours, verified family balances or seasonal compliance.

## Outstanding Admin action plan
- Atomic capacity-controlled recruitment and replacement with configured roles and qualification requirements.
- League-rule workforce calculation, durable session/shift linkage and atomic multi-role provisioning.
- No-show strike and transactional Team Manager notification/escalation.
- Family obligations, actual-hour settlement, duplicate-credit prevention, seasonal targets and reminders.
- Durable 48-hour/vacant-coordinator fallback to Organization Admin and affected squad managers.
- Atomic mutation plus audit recording; current limited writes explicitly report partial audit failures.
- Full owner UAT and verification against actual workers and events.

The prompt forbids adding database tables or schemas. None were created. Missing stores/rules/actions are not replaced by client-side success states, fabricated people, hours or notifications.

## Verification
- TypeScript and focused ESLint (warnings, no errors).
- scripts/verification/admin-volunteers.cjs: invalid dates/capacities, qualification expiry/verification/revocation/future issuance, authentication/club scope, restricted actions, concurrent-write rejection, cancellation retaining history, and explicit audit-failure warning.
- Tests use isolated doubles, not live business writes or claimed signed-in UAT.
