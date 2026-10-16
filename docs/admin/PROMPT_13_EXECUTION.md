# Prompt 13 — General Manager Operations

Implemented for the Admin Preview branch on 2026-10-16. Signed-in acceptance remains with the owner; this is not a 100% certification of the Admin program.

## Delivered
- General Manager role configuration and role switcher, five operational destinations plus Home, eight subordinate folders, dark shell and bundled Lexend Deca.
- Club-scoped programs, seasonal participation, deduplicated cohort retention, 30-day intake, pending registrations, live tasks, membership exceptions and group capacities. Reports fail explicitly instead of silently truncating their totals.
- Capacity drawer opens the existing transactional transfer controller. Explicit capacity override, saved fee quote, membership changes and timeline use the existing cross-engine RPC. Transfers still require its real fee evidence and posting configuration.
- Incident/insurance creation, edits and lifecycle transitions use the existing governance transaction, version checks and audit history. The wrapper excludes policies/bylaws and preserves the existing owner. Registrar follow-up uses the existing task transaction.
- Technical jury sign-off checks club ownership and stale evidence, stores signer/time/reason, and prevents overwriting a final decision. Separate audit insertion failures are explicitly reported after the signed case has saved; those two writes are not atomic.
- GM club-wide Team Manager squad selection; ordinary managers retain their assigned-squad limits. Derived subordinate permissions remain subject to clearance checks and never grant Organization Administrator.
- ERR-702 protects root governance, finance-policy changes and root-context commands. Existing financial reversal controls remain available; no destructive financial or grant deletion is introduced.
- Facility calendar reuses the existing booking and blackout controls, with links to competition venue review and emergency alerts.

## Verification
- TypeScript passed.
- Isolated GM API, cross-engine, Team Manager and personnel safety checks passed. They cover authorization, denied commands, club binding, stale jury evidence, preserved incident ownership, follow-up delegation and cohort counts. They create no operational fixtures.
- Local production compilation passed; local page collection requires Supabase environment configuration. The Vercel Preview build is the deployment gate.
- Existing font fix verified: `app/fonts/index.ts` uses `next/font/local` and tracked Lexend Deca font assets. No Google font imports remain in application code.

## Limits / owner acceptance
- Automated rerouting of an entire competitive bracket is not implemented; venue/booking changes and closure alerts are separate controlled workflows.
- A non-financial completed grant proposal has no balanced ledger reversal implemented here. Actual posted financial transactions use the existing reversal engines.
- Existing missing subordinate workflows are not certified complete by granting GM access.
- Test the GM switcher and eight folders, squad switching, incident save/reopen, Registrar follow-up, jury sign-off and duplicate/concurrent failures using authorized real records. Exercise transfer overrides only with configured fees and posting accounts.
