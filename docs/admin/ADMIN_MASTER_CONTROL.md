# LS1 Admin Master Control Contract

Status: **PROMPT 0 CONTROL BASELINE ESTABLISHED**

Protected production baseline: `04a39766e916e5b9106f228a9201b95440a529ab`

Execution branch: `work/admin-100pct-from-prod-20260923`

## Source precedence
1. LS1 Master Build Blueprint / Scope of Work
2. Complete Admin UAT
3. Admin Guided Walkthrough
4. Admin Authority UAT
5. Real-World Stress UAT
6. Known Build Gaps
7. UAT Sign-Off
8. supplied HubSpot interaction references
9. explicit locked product-owner decisions
10. canonical LS1 schema and verified working implementation

Higher sources control conflicts. Existing code/schema cannot reduce an authoritative requirement.

## Locked Admin contexts
Organization Admin; Team Manager; Registrar; Treasurer; Volunteer Coordinator; Communications; Compliance; Reporting.

One identity may hold multiple roles. The selector changes operating context. URWS is authorization/scope logic and is not navigation.

## Completion model
The unit of completion is a business lifecycle, not a page/table/API.

`responsibility -> work -> context -> authorized action -> validation -> state transition -> canonical transaction -> related consequences -> audit -> communication/task/exception -> next work -> closure`

Generic CRUD is implementation plumbing, not completion when a domain lifecycle exists.

## Mutation contract
Every mutation must authenticate, authorize, scope-check, state-check, validate, commit canonical state and required related effects, audit, propagate, and reconcile UI. Applicable concurrency, atomicity, idempotency, retry and recovery controls are mandatory.

## Authorization contract
Evaluate applicable identity + effective role + permission + organization + sport + site + team + program + competition + sensitivity + record state + action. Enforcement is server-side. Both ALLOW and DENY are tested.

## UX contract
Home is actionable agenda/work/tasks/activity. Lists are human-readable, searchable, sortable, filterable and paginated with appropriate New/bulk/import/export actions. Record workspaces use left identity/actions, center lifecycle/activity, right associations/actions. UUIDs are not the primary human UI. Authorized workflows are not display-only.

## Data/activity contract
Recent Activity is actual state-changing activity, not future calendar rows or record existence. No fabricated operational records, percentages, alerts, finance, compliance, communications or UAT evidence. Empty canonical state is shown honestly.

## Secrets contract
Credentials/tokens/passwords/service secrets never belong in requirements, source, commits, logs or test evidence.

## Evidence contract
VERIFIED PASS requires executed evidence: login -> role -> workspace -> canonical record -> action -> DB before/after -> audit -> refresh -> re-login -> downstream role/engine -> forbidden action/server denial -> applicable failure/retry/concurrency -> recovery. Source inspection, code existence, compilation and deployment alone are not PASS.

## Requirements ledger invariant
`docs/admin/ADMIN_REQUIREMENTS_LEDGER.csv` is the permanent Prompt-0 ledger seed. Existing source IDs are retained. Blueprint §9.1 atomic role capabilities receive permanent `BP-ADM-* ` IDs; build gaps and sign-off gates receive permanent IDs.

Every row is assigned to at least one execution packet. Later packets enrich each row with object, lifecycle, permission, state transition, canonical transaction, downstream consequence, audit, UI, test and evidence details; they may not delete or waive rows.

Required final invariants:
- source requirements without ledger entry = 0
- ledger requirements without execution packet = 0
- unimplemented requirements = 0
- unverified requirements = 0

## Packet order
01 Requirements + Canonical Contract
02 Admin Core + Operating Spine
03 Organization + People + Households + Membership
04 Registration + Registrar
05 Team/Roster + Team Manager
06 Competition/Meet Preparation
07 Finance + Treasurer
08 Volunteer + Facilities/Operations
09 Communications
10 Compliance
11 Reporting + Imports
12 Eight Role Workspace Reconciliation
13 Cross-Engine Integration
14 Complete UAT + Release Gate

A packet narrows current work only. It never narrows total Admin scope.

## Prompt-0 controls already enforced
- clean execution branch from protected production baseline
- authenticated Admin command API boundary introduced
- eight locked Admin contexts aligned in canonical role/switcher data
- URWS visible Admin navigation disabled
- production remains untouched

No implementation/UAT row is marked PASS merely because Prompt 0 is established.
