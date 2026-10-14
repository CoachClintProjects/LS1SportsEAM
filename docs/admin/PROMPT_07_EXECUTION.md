# Prompt 07 — Treasurer release checkpoint

## Implemented

- Money Manager role context: Home plus exactly five directory pillars. Organization Admin can browse this folder; the module consistently uses Treasurer authority.
- Financial-only read endpoint scoped through the existing finance authorization helper. Generic Admin reads and non-financial commands are denied for Treasurer, including lease, competition-structure and compliance changes. Linked triage resolutions deny lease/credential evidence access.
- Current payables are separated by currency. Cash and reserve balances come from posted ledger accounts configured by Organization Admin; absent mapping is shown as unknown, never an invented zero. Accounting setup and empty data have explicit states.
- Reuses saved invoice/payment/credit workflows, displays linked refund records, existing vendor-bill lifecycle and executive threshold approvals. Treasurer invoice void controls are removed; journals and linked payable transactions retain their existing reversal controls.
- Bank statement split view shows stored statement items and posted account movements. It does not masquerade as a live bank connection or an implemented matching transaction.
- Budget comparisons use the existing ledger report for each budget line's dates and account, with decimal-safe actual/variance arithmetic and explicit currency agreement. Different budgets and currencies are not combined.
- Cash packets capture 20/10/5 note counts, recipient and handoff certification. Server validation derives the total and records the breakdown in the existing transaction's audit/custody reason. The existing atomic cash-box procedure requires the authorized amount, unchanged official assignments and a preparer different from the authorizer. Preparation is not a payout or bank withdrawal.
- Deck cash deposit confirmation reuses the existing atomic deposit transaction: actual bank reference, balanced bank/cash-held posting, receipt completion and audit. No real money is transferred by this UI.
- Fiscal period review/closure controls retain executive sign-off. Posted-journal statements and CSV exports now reject invalid posted journals or currency mismatches before returning a report. Summation uses integer minor units. Invoice tax register CSV is available with formula-safe escaping and no tax filing claim.
- Successful billing, payable, journal and budget changes trigger refresh of the Treasurer summary.

## Boundaries and remaining work

No tables, schemas or database migrations were created. No business records were changed during implementation. Existing data and deployed routines were inspected read-only.

Prompt 07 is not 100% operationally complete:

1. No existing audited bank-statement matching routine or live bank feed was found. Matching, variance resolution and statement intake remain unfinished; there is no pretend Match button.
2. Existing refund records are visible, but a complete allocation/reallocation/refund-payment linker is not implemented. A credit note is not a bank refund.
3. Final period closure remains an Organization Admin approval. Existing posted-ledger and payable guards are retained; a universal freeze across every subledger is not claimed.
4. Tax register exports do not implement jurisdiction-specific non-profit tax checks or return filing.
5. Real ledger/account/period configuration is required before first posting. No accounts, bank balances, budgets or illustrative transactions were manufactured.

These items need further authorized backend workflow work against the existing tables, and signed-in operational testing. The user owns that testing; source checks are not UAT.

## Verification

TypeScript passes. Focused executable checks cover cash denomination validation and handoff, prohibited Treasurer commands, decimal sums, posted-only ledger scope, and rejection of unbalanced/mixed-currency journals. Focused ESLint has no errors (existing-style `any` warnings remain). Preview readiness is reported separately from workflow completion.
