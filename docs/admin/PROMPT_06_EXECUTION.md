# Prompt 06 — Registrar release checkpoint

Implemented on the Admin Preview branch. This is not a declaration of complete operational validation; signed-in testing belongs to the product owner.

## Delivered

- Registrar context exposes Home plus the five requested directory entries, with the other role folders collapsed. Executive browsing of the Registrar folder uses the Registrar workspace and scoped APIs.
- Organization-scoped identity evidence, pending registrations, membership identifiers and exceptions, credential expiry records, team membership dates and headcounts. Explicit warning when a source reaches its record cap; no whole-club compliance claim from partial data.
- Three-column proof-of-age review drawer with secure stored-document inspection, reference and reason, optimistic document-version/status validation, rejection, persisted verification and recorded timeline. The existing `admin_review_person_document` transaction saves the decision and audit together. Registration requirement acceptance remains a separate existing evidence workflow.
- Staff evidence intake selects a real person and supporting document, creates pending evidence and the existing COMPLIANCE_REVIEW executive task atomically through `admin_compliance_intake`. Registrar cannot directly issue final clearance through admin-command. Existing executive Home reads these tasks.
- Finance/lease navigation denial, generic command allowlist, financial scope denial and removal of finance reads from Registrar person records. Unsupported broad reads are rejected before querying those records.
- Existing locally bundled Lexend Deca retained; no Google font build dependency restored.

## Material unfinished requirements

The prompt expressly forbids schemas, columns and database migrations. No database changes or business transactions were executed during implementation.

Live `people` has none of `identity_verified`, `gov_body_id` or `safesport_status`. The implementation uses existing document decisions, membership identifiers and compliance records rather than inventing these fields or browser-only clearance.

- Governing-body ID synchronization and dependent competition eligibility recomputation have no existing approved atomic mutation workflow. The workspace shows current membership identifiers and the unavailable operation explicitly; it does not save a pretend ID or clear meet blocks.
- Cross-club releases and squad migrations require a controlled transfer transaction. Existing `admin_athlete_relationship` offers separate team add/remove operations but not an atomic transfer, tenant reassignment or fee/eligibility reconciliation. No transfer is offered as a sequence of unrelated writes.
- Current verified IDENTITY evidence is not a universal certification of birth date, registration readiness, SafeSport access or meet eligibility. Counters describe evidence coverage only.
- Expired credential records are historical records, not proof of present person-level access denial when newer evidence exists.

These gaps remain unfinished under the no-migration constraint and need an approved existing transaction or a separately authorized backend extension. This release must not be marked Prompt 06 complete.

## Verification

TypeScript passes. Focused boundary checks cover unauthenticated access, role delegation, read permission, organization filtering, prohibited financial reads, restricted commands and evidence expiry. ESLint reports no errors in the new endpoint, workspace, policy and updated intake (existing-style `any` typing and a ref-cleanup warning remain). These checks do not replace signed-in workflow testing or execute real business changes.
