# Prompt 04 — club oversight and controlled exports

Built 2026-10-13 for Admin Preview. Clint performs signed-in acceptance testing.

## Delivered

- `OverwatchTelemetry.tsx` mounted above Organization Admin Today's Tasks. Three live cards: personnel clearances, bank/reserve balances, record integrity. Refresh button and one-minute refresh while visible; failed reads remain explicit.
- Platform-wide `v_superuser_compliance` is not exposed to a club. Its underlying SafeSport/background sources are recomputed for distinct active staff in the selected club. A clean person has both current, verified supporting documents and acceptable clearance records. Missing evidence never counts as cleared. No personnel yields no percentage.
- The schema has no `ledger_entries.cash_balance` or `reserve_liquidity`. Selected bank/reserve asset accounts use posted journal balances. Separate account mappings are versioned in existing settings and audited. No inferred account names or invented balances.
- Income statement, balance sheet (including unclosed earnings) and closing trial balance derive from posted journals. Calculations use integer cents. An unbalanced posted journal blocks reports and financial export. A configured ledger with no postings shows the requested honest zero-transaction state.
- CSV exports contain active club personnel clearance records or posted financial lines for the selected ledger/dates. Exports are scoped on the server, timestamped and audited. Every cell is quoted; embedded quotes are doubled; trailing newlines are stripped. Formula-leading characters (including leading whitespace/tab) receive an apostrophe in addition to CSV quoting. Quoting alone does not neutralize spreadsheet formulas.
- Vendor bill rows/drawers show President holds. Threshold comparison includes equality; absent policy fails closed. President signs with their full account name in an authenticated Org Admin context. Signature audit binds bill content, policy version, actor and time. Editing bill content or changing policy invalidates the sign-off. The payment button and API block unsigned holds, and a database insert guard protects other payment entry points too. Role switching alone grants no authority.

## Live source findings

HPAC currently has no accounting ledger and no dedicated BIRTH_CERTIFICATE document type. These are shown as not configured, not as a clean ledger or a made-up certificate count. The snapshot finds 229 active club athletes and one active personnel identity. Birth-certificate verification cannot be claimed until the document type and supporting evidence exist.

The pending-ID metric checks saved PENDING membership/external identifier values for club athletes; there is no literal gov_body_id text column in the current schema. Counts are not added together because issue categories may overlap.

## Validation and deployment scope

TypeScript, focused lint (no errors), CSV/math tests, payable permission tests and spending-policy boundary tests pass. The SQL snapshot ran read-only against live club records; no sample staff, bills, postings or certificates were inserted. Database routines are service-only security invoker functions. New database logic is applied to the existing shared Supabase project; payment holds therefore protect that database independently of the application's deployment environment. Only the Admin branch is pushed for Vercel Preview; no Production application deployment is requested.

## Acceptance

Check the three cards and export personnel. Configure a real ledger and bank/reserve accounts to check balances and statements. Test a real bill below, exactly at and above its configured threshold; verify Treasurer cannot release a held bill, President name mismatch fails, valid President signature clears the hold, and later bill/policy edits require renewed sign-off. Financial exports should match the chosen dates and ledger. No signed-in verification is claimed until Clint completes it.
