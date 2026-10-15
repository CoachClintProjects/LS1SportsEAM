# Prompt 11 — Fundraising Chief

Status: partial implementation; Preview checkpoint, not a complete fundraising or accounting engine. Owner signed-in testing remains pending.

## Live-store findings
- Existing stores are fundraising_campaigns and fundraising_commitments. No dedicated sponsorship_deals, donor_campaigns, grant_proposals or fundraising_telemetry tables were found.
- HPAC has zero campaigns and no configured legal-entity base currency. No existing function referencing the fundraising stores was found.
- Fundraising Coordinator has record read/create/update, task permissions and finance.read. The new workspace limits those capabilities to fundraising tracking and explicitly denies general finance access.

## Implemented
- Home plus five requested sections, role-specific navigation, exact ERR-801 guards, dark three-column drawers, shared locally hosted Lexend and 25-row pagination.
- Exact initial empty-state wording and a working corporate lead intake flow. When no campaign exists, the form creates a campaign first and proceeds to the partner lead.
- Campaign setup with explicit tracking currency, goals and validated planning dates. Tracking currency selection does not configure accounting.
- Saved partner/donor/grant prospects with purpose, sponsor obligations and contract-reference notes. Restricted-gift prospects require a stated purpose; descriptive notes do not create reserved ledger balances.
- Editing restricted to uncommitted prospects. Marking a saved pledge committed requires a positive amount, records the date and prevents further generic edits. Unsaved UI changes must be saved before commitment.
- Communications implementation task for a committed sponsorship with recorded obligations. Deterministic task ID prevents duplicate handoffs; original pledge values and reasons remain available.
- Decimal-safe totals separated by currency and status. Prospect amounts, unreceived pledges and records previously marked received remain distinct; none are labeled verified collections or bank deposits.
- Status/updated_at compare-and-swap for prospect mutations, request IDs for creation, scoped reads, explicit errors and refresh after saved actions. Audit insertion failures are reported as partial saves, not rollback or success with a complete audit trail.
- Destructive deletion, fabricated receipts, direct money receipt/posting and pretend reversing journals are denied.

## Outstanding Admin action plan
- Formal sponsor contract/milestone and amendment lifecycle beyond descriptive notes and one implementation handoff.
- Grant application records, certified governance-vault linking and actual submission-window/deadline controls.
- Matching agreement thresholds, purpose-reserved accounting and executive approval/ratification transactions.
- Verified donation intake, eligible tax-receipt issuer configuration, benefit valuation, immutable receipt numbering and accounting reconciliation.
- Balanced posted-journal reversal tied to immutable contribution records. The disabled void control is not presented as a working reversal.
- Actual collection velocity, stable donor identity/retention and grant conversion telemetry.
- Atomic data/audit/handoff transactions and owner signed-in verification.

No database tables or schemas, fake business data, external services or live financial postings were created. Existing financial records remain outside this role's endpoint.

## Verification
TypeScript passes. Focused ESLint reports warnings and no errors. scripts/verification/admin-fundraising.cjs covers decimal and date validation, currency separation, required restricted-gift purpose, authentication and club scope, forbidden financial/deletion actions, stale writes, immutable committed pledges and duplicate Communications handoffs. Tests use isolated doubles and are not claimed as live UAT.

Receipt design references reviewed (no tax receipt issued):
- https://www.canada.ca/en/revenue-agency/services/charities-giving/charities/sample-official-donation-receipts.html
- https://www.canada.ca/en/revenue-agency/services/charities-giving/charities/operating-a-registered-charity/receiving-gifts/sponsorship.html
