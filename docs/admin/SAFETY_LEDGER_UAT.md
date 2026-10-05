# Personnel safety and general ledger release candidate — 2026-10-05

Status: local application candidate; database migrations applied. Not deployed. Not signed-in verified. No role is certified complete by this document.

## Implemented scope

- Org Admin drafts, activates and pauses a personnel clearance policy. Covered staff roles require current verified background / SafeSport evidence according to the organization's saved policy. Policy activation is a business decision; no policy was seeded or activated.
- Effective role resolution excludes blocked staff assignments in their organization. Org Admin recovery roles cannot be included in the policy. Temporary overrides have an explicit reason, bounded expiry, policy version and revocation history. Replacing a policy invalidates old overrides.
- Org Admin configures a ledger, scoped accounts, fiscal year and monthly periods. Treasurer / Org Admin create and edit draft journals in dark drawers, post balanced entries, cancel drafts and post linked reversals. Canonical writes, audit and review work commit together.
- Posted journal headers, lines and postings are immutable. Journal accounts must be active in the correct legal entity; currency comes from the ledger. The posting date must be in the matching open period. Reversals preserve the original and require an open period.
- Treasurer submits a posting period for close; Org Admin approves, returns or reopens it with a reason. Draft journals and outstanding payment reconciliation runs block submission / close. Review and closed periods reject postings. This does not establish bank-feed integration or complete bank reconciliation.
- Trial balance, income statement and balance sheet use posted ledger data, exact decimal totals and CSV export. Unclosed operating earnings are explicit on the balance sheet. These statements do not automatically post existing billing activity into GL.
- Journal / period work routes from Home to the authorized financial workspace. Lists use 25 records per page with server sorting and search. Admin now loads the selected workspace module instead of eagerly importing every role module.

## Technical evidence

- `npx tsc --noEmit`: passed before final build review.
- `node scripts/verification/admin-safety-access.cjs`: controlled authority tests passed, including organization isolation, blocked-role permission removal, executive recovery, valid override and failed-check denial.
- `node scripts/verification/admin-ledger-boundary.cjs`: controlled API authority, actor/tenant binding, period decision authority, pagination, exact decimal sums and CSV escaping passed.
- `node scripts/verification/admin-home-scope.cjs`: all nine role contexts and denied-source reads passed.
- Live database: new ledger RPCs executable by service role, not anon/authenticated; journal and period guards installed. New journals / lines / periods / safety policies / overrides all have zero rows. No fake operational records or financial test transactions inserted.
- Production build: compilation, lint and type validation passed after fixing one JSX escape. Page-data collection is blocked by missing local Supabase environment configuration (`supabaseUrl is required` from `/api/icons`). No successful full-build claim.
- Browser inventory: only an `about:blank` tab is available; no signed-in LS1 session exists for runtime acceptance.

## Required runtime acceptance — NOT RUN

Use authorized organization records and separate role sessions. Preserve real accounting data; use an approved test organization for destructive / failure scenarios.

1. Configure a draft safety policy; save / reload. Activate only after reviewing affected staff. Verify missing evidence removes only the affected role and that unauthorized users cannot grant overrides. Verify documented current evidence restores authority; expiry removes it again. Test policy-version mismatch, bounded exception, expiry and revocation.
2. Configure legal entity / ledger / chart / fiscal year. Confirm wrong-organization IDs and missing permissions fail server-side without audit or business writes. No user must select a second organization for a single-organization account.
3. Save a journal with exact decimal amounts. Reload, inspect audit and Home work. Retry the identical create request, then a changed-payload retry. Verify one journal and no duplicate lines.
4. Edit competing versions; one succeeds, one returns a conflict. Attempt an invalid / inactive / other-entity account, negative / mixed-side / excessive-precision line and currency substitution.
5. Attempt an unbalanced posting. Confirm no partial posting/header/audit/work transition. Post a balanced journal; confirm one posting, completed Home work and correct statements. Re-login and compare database / UI.
6. Attempt direct edits / deletion of posted header, lines and posting. Reverse into an open period; verify equal opposite amounts, unique reversal and retained source. Retry reversal and verify no duplication.
7. Submit a period with drafts / incomplete payment reconciliation: deny. Resolve those records, submit and verify Org Admin Home task. Treasurer cannot approve or reopen. Approve as Org Admin and verify posting denial. Reopen with a reason and inspect history.
8. Check trial balance debits equal credits, income and balance-sheet treatment of unclosed earnings. Compare exported exact values against authorized source entries, including decimal / large / negative amounts and spreadsheet formula-like labels.
9. Switch every Admin role forward and backward. Verify navigation, Home sources, record access, drawer dark theme and close / focus behavior. Measure signed-in transition times; module loading changes alone are not measured performance evidence.

## Remaining broader accounting scope

Bank statements / matching, subledger-to-GL posting, accounts payable authorization thresholds and disbursement, cash-box custody / reconciliation, restricted funds and full Treasurer end-to-end acceptance remain unfinished. Other Admin role gaps remain in the requirements ledger. No full Admin completion or operational percentage is inferred from these additions.

## Vendor bills added to the candidate

The former payables list incorrectly opened the receivable invoice drawer and its invoice payment / void controls. Vendor bills now open their own dark drawer with scoped vendor / legal-entity selection, editable lines and tax, draft save, submission, executive approval, return, cancellation and recording of payments already made. No money transfer is performed. Every bill currently requires executive approval; configurable approval thresholds and GL integration are still outstanding.

The transactional write locks the bill, rejects stale edits, recomputes totals, rejects duplicate vendor bill numbers, rejects overpayments, reuses a payment UUID on retries, and updates bill balance, AP payment, audit and Home work together. No bills or payments were inserted during implementation. `admin-payables-boundary.cjs` controlled permission/scope/pagination tests pass. Signed-in acceptance remains NOT RUN.

Additional runtime cases: enter a real authorized bill; reload; edit/save; submit as Treasurer; approve as Org Admin; record an actual payment reference; refresh both roles and verify balance/history/work. Deny overpayment, wrong vendor organization, stale edits, payment before approval, cancellation after payment and mismatched payment retries. Verify exact retry creates one payment only. These cases are specified, not claimed executed.
