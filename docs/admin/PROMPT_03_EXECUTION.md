# Prompt 03 — cross-engine actions

Implemented 2026-10-10 on the Admin Preview branch. Signed-in acceptance testing belongs to Clint; no synthetic club records or financial transactions were created during development.

## Entry points

- Admin / Treasurer: **Club balance & squad changes** above the workspace.
- Athlete drawer: **Club balance & squad changes** in the record decisions card.
- The requested component is `components/hubs/superuser/TransactionEngine.tsx`; it is mounted only in the Admin hub.

## Existing-store mapping

- Squad roster limits use versioned `system_configurations` entries (`admin.squad`); `groups` has no hard_cap column. Headcounts are computed from active memberships and rechecked at save.
- Posting setup uses `admin.cross_engine` settings. Account choices are validated against the selected club ledger. No account, currency, fee, roster limit, or host vendor is invented.
- Host obligations use `vendor_bills`, the existing payable approval policy and posting functions; there is no payable_vouchers table.
- Cash custody uses `work_items` linked to payments and journals; open holdings are shown per squad. Deposit confirmation clears only the selected receipt and records an actual bank reference.
- Follow-up work uses scoped `operational_tasks`, so it appears in the existing role task queue.

## Behavior

- Transfers quote calendar days, including both season endpoints, using linked issued invoice fee lines. Source fees must link to the group. The source athlete invoice and destination fee evidence must exist. Roster limits are enforced at or above capacity; only Org Admin can submit an override. Amounts are recomputed on the server and the submitted quote must match.
- Day 30 is the conservative cutoff: reductions on day 30 and later produce no fee adjustment. Earlier reductions create pending credits for Treasurer review. Promotions create a new invoice and balanced posting. New-program registrations return to Registrar review; withdrawal retires the relevant membership rather than deleting it.
- Cash receipts apply only the amount received and post debit cash held / credit family receivables. Partial receipts remain partial. Deposit confirmation posts debit bank / credit cash held. No bank transfer is executed.
- Club fee coverage creates, approves and posts the host bill through existing financial controls, sets that specific entry fee to club_covered, and adds Prepare Cash Box. It does not falsely mark unrelated family invoices paid or bypass other eligibility checks. The host vendor is selected by the administrator because competitions lack a host-vendor foreign key.
- Deactivate & Rollback suspends group memberships, preserves source records, drafts credits for linked unpaid fees and creates a communications drafting task. Closure credits require an explicit fee/tax split at approval. No external announcement is sent.
- Covered-fee reversal cancels the unpaid bill with a compensating journal, restores the fee assessment and appends athlete history. Existing posted-journal reversals remain in the accounting workspace. Athlete history updates/deletions and posted-invoice deletion are blocked by database triggers.
- Paid invoice credits retain any unapplied credit as an open customer credit. Refund disbursement remains subject to the club's normal financial process; this module does not transfer money.

## Validation

- TypeScript passes; focused ESLint has no errors (existing any-type warnings remain).
- Cross-engine API boundary tests reject unauthorized roles, forged scope and unsupported input; existing executive action, task delegation and triage boundary tests pass.
- Database function/trigger definitions compile; migration applied to the existing Supabase project. The RPC is security invoker and service-only; public/anonymous/authenticated execution is revoked.
- Application Preview deployment is separate from Production deployment. The Supabase project is shared infrastructure; the new database routines and history guards are applied there.

## User acceptance checks

Use real configured records: save posting accounts and destination roster cap; quote a capacity-full move with and without President Override; verify proration before/on/after day 30; review the Treasurer credit; record a partial and full deck receipt and its deposit; cover a fee against its actual host vendor; reverse an unpaid covered fee; suspend a squad/program and inspect credits, role tasks and athlete history. Missing actual fee/setup records are an explicit stop, never replaced with sample data.

Signed-in behavior is not marked verified until Clint reports acceptance.
