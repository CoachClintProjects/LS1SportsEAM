# Prompt 10 — Club Announcer

Status: partial implementation; Preview delivery, owner signed-in testing pending.

## Live-store findings
- Existing communications tables support threads/messages, channels, recipients, delivery events, templates and audiences. No public_bulletins or communications_telemetry store was found.
- HPAC has no configured communication_channels. No existing message/campaign dispatch transaction was found.
- No current guardian communication-link or head-coach assignment rows were found in the inspected club. Recipient groups remain empty until real source records exist; no people or delivery data were fabricated.

## Implemented
- Home and the five requested role sections, dark three-column drawer, shared locally hosted Lexend, 25-record table pages and visible-page refresh.
- Exact empty-queue container and working new-bulletin form. Drafts with an empty audience can be saved; safety staging requires current recipients.
- Live, deduplicated audience selection from current guardian links for active squad memberships, current Head Coach staff assignments and current volunteer assignments. Squad IDs are validated against the authorized club. Names are tenant-scoped; birth certificates and financial records are not exposed.
- Intended email/push channel selection, markdown source editor, safe plain-text preview, planned dates, formatting-review logging and saved history.
- Drafts are stored in existing communication_threads/communication_messages with workspace metadata. sent_at is explicitly null; delivery_status is draft, not queued/sent. Threads have no team membership, generic titles and no recipient rows are enqueued.
- Revision compare-and-swap on existing drafts. Policy holds remain in force after format edits; formatting is not presented as executive approval.
- Safety staging locks the draft in Pending_Executive_Approval and creates an idempotently identified Organization Admin review task in the same club. Task failure is reported as a saved hold with a retry instruction. A retry cannot edit a staged message or replace its saved recipient snapshot.
- Real saved recipient failures and delivery-event histories are displayed; no simulated bounces, successful deliveries, reads or rates.
- Exact ERR-201 boundaries for broad Admin commands, finance/person record access and restricted triage actions.

## Deliberate delivery boundaries
- External email, mobile push, ticket email, public web publishing, dispatch and retry remain disabled. No new services or credentials were introduced and no messages were sent during implementation.
- Planned dates are labeled as planning, not scheduled delivery jobs.
- Recipient resolution is preparation, not proof of opt-in or deliverability; a future dispatcher must enforce channel consent and final safeguarding policies.

## Remaining Admin action plan
- Configured delivery adapters, atomic dispatch/history, provider callbacks, verified velocity/bounce/engagement metrics and reliable retry tasks.
- Policy-aware terminology/format-hold clearance; editing text alone never clears POLICY_HOLD.
- Executive approval/rejection and controlled release tied to the exact reviewed revision.
- Automatic cross-role crisis hold propagation and release across future connected channels.
- Atomic message/audit/task transactions. Current saves report audit/task partial failures explicitly rather than claiming rollback or delivery.
- Signed-in owner testing and actual delivery validation once configured.

## Validation
TypeScript passes; focused ESLint has warnings and no errors. scripts/verification/admin-communications.cjs covers audience deduplication and squad scope, input validation, authentication/tenant isolation, disabled dispatch, zero-recipient drafts, null sent timestamps, safety task staging, stale revision rejection and explicit audit failure. Tests use isolated doubles; no fake UAT or live business records were created. No database tables or schemas changed.
