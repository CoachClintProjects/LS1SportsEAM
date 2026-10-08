# Today’s Tasks — implementation and validation ledger

Source branch: work/admin-100pct-from-prod-20260923. Requirements: `02 today's tasks.txt` and Step 01 drawer framework. Owner approved schema/scope extensions on 7 October 2026.

## Delivered

- Organization, squad, role and revision fields across operational_tasks, workflow_tasks and competition_exceptions. Restrictive RLS and server-only writes enforce tenant, club, role, assignee and squad boundaries, including ERR-901 denial.
- Authenticated live queue with pagination, search, open/closed and squad filters, role remount, stale-response protection, focus/30-second refresh and explicit loading/error/empty states.
- Checkbox and row open the dark three-column right drawer. Existing source tasks, evidence and audit activity are shown; financial/person records open in contextual drawers without replacing the canvas. Payable journals also stay in drawers.
- Atomic manual task and sequential workflow changes with optimistic concurrency and audit history. Legacy workflow completion delegates to the scoped endpoint.
- Live exception rules for contracts approaching expiry without renewal terms; vacant Volunteer Coordinator plus upcoming official staffing shortage; payable approval/payment; accepted invitations with unsigned waivers; pending replies near entry deadlines; unpaid team entry fees; unsatisfied identity requirements; expired/pending SafeSport evidence.
- Persisted derived tasks reconcile against canonical sources. They cannot be manually marked complete. Source detection, changes and cleared conditions are audited. No synthetic source records or example identities/amounts were inserted.
- Contract renewal records proposed terms as a new version, leaving contract legal status/dates unchanged.
- Explicit parent requests and RSVP reminders create recipient-scoped LS1 notifications, with hourly duplicate protection and audit. Header notification drawer supports reading and marking messages read. SMS/device-push delivery is not configured or claimed.
- Team Manager can review exact entry fee lines and send an immutable reviewed snapshot to Treasurer. Treasurer can return it or link a matching club bill. Current fees are locked/rechecked before linking; stale snapshots fail. Existing bill approval, ledger posting and payment controls retain their authority checks.
- Registrar can open person documents/registration review and review/update/approve SafeSport evidence through the existing verified-document transaction.

## Applied database migrations

- scoped_admin_triage: 20261007130921
- triage_domain_sources: 20261007182050
- triage_domain_actions: 20261007182109
- triage_resolution_guards: 20261007183118
- triage_voucher_recheck: 20261007183624
- triage_notification_boundary: 20261007183852
- triage_consent_cashbox: 20261007185112 (local filename reconciled to the applied version; content checksum matches)

All triage RPCs are SECURITY INVOKER and executable only by service_role. Fee vouchers have RLS and no client grants. Triage notifications have a restrictive recipient policy; direct client notification writes and anonymous reads are revoked.

## Validation evidence

- TypeScript passed; targeted ESLint passed for the new task/API/notification components. Existing LedgerWorkspace has two pre-existing hook warnings.
- Isolated code tests pass tenant, club, role, squad, missing-squad, assignee and delegated executive boundaries. No live fixtures are written.
- Live candidate query and reconciliation ran successfully for both organizations and returned zero current exceptions/changes, consistent with live source records.
- Database privilege checks confirm anon/authenticated cannot execute the domain/candidate/sync RPCs; service_role can.
- Initial task infrastructure commit 1da3fd2f6e0f0463e8443a580cd4a4e125fb91d4 was pushed and successfully deployed to Preview. GitHub deployment 6911090405, URL https://ls1sportseam-p5b01s5og-pieify.vercel.app.
- Local production compilation previously passed, but page-data collection requires environment variables unavailable locally. Configured Vercel build is the deployment gate.

## Remaining validation and domain limits

- Preview is protected by Vercel sign-in. Signed-in browser checks and material business write UAT remain unverified. The Vercel connector cannot access this project, although its GitHub deployment integration works.
- Current active role assignments contain only Organization Admin. Independent Team Manager, Registrar and Treasurer identities/squad assignments are unavailable for signed-in role testing.
- No current exceptions exist, so actual contract, consent, credential or financial business transactions were not executed merely to test UI.
- Consent exception controls now require an explicit Organization Admin policy, an authorized assigned role and current verified waiver evidence. No policy was enabled or waiver changed during verification. Live decision UAT remains unverified.
- Cash-box authorization now records explicit real official allocations, creates a Treasurer task and requires a different authorized person to attest to the exact physical cash total. Preparation rechecks the official assignments. No payout amounts were invented; live authorization/preparation UAT remains unverified.
- Fee voucher intake links a real matching vendor bill; creating a new bill uses the existing Accounts Payable workspace. A verified task snapshot does not itself create a vendor invoice or release funds.

This is a deployed and extended task workflow, not a claim that every Step 02 scenario or the Admin hub is 100% operational. The limits above remain on the completion ledger.

## 8 October release candidate

- Recovered the unpushed domain-resolution implementation and verified its migration content against the applied database history.
- Corrected task checkmarks to reflect persisted task status. Clicking opens the resolution drawer; changes require the applicable audit note and source controls.
- Prevented stale failed refreshes from overwriting newer task results.
- Re-ran TypeScript, targeted ESLint and the isolated tenant/club/role/squad/assignee boundary checks successfully.
- Live read-only checks found zero task candidates for both clubs. All six triage functions deny direct anonymous/authenticated execution; the three domain tables have RLS and deny direct authenticated reads.
- Deployment target: existing Admin branch, Vercel Preview under pieify/ls1sportseam. Production is unchanged. Deployment success and signed-in UAT are separate gates.
