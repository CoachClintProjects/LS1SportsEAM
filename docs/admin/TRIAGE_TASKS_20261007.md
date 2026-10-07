# Today’s Tasks implementation — 7 October 2026

Source branch: work/admin-100pct-from-prod-20260923, based on 3312f20.
Requirements: 02 today's tasks.txt and its Step 01 framework dependency.
Owner approved extending task scope and access rules on 7 October 2026.

## Implemented

- Organization, squad, role and revision fields added to operational_tasks, workflow_tasks and competition_exceptions.
- Scope guards reject mismatched tenant/club/squad relationships. Team Manager tasks require a squad.
- Restrictive SELECT policies enforce organization, role, assignee and squad access. Anonymous access and direct authenticated writes are revoked; server transactions are required.
- Authenticated admin-triage API resolves current access and checks permissions. Client-provided tenant/actor values are not accepted. Both detail reads and writes enforce ERR-901 scope denial.
- Paginated live feed (25 tasks), search, open/closed filter, squad selection, role remount, stale-response protection and 30-second/focus refresh.
- Task row and checkbox open the dark three-column drawer. Resolution notes, recorded evidence and recent audit activity are shown.
- Users can create real club tasks, complete/reopen operational tasks, advance configured sequential workflow stages, and confirm/reopen competition issues where authorized.
- Task changes, workflow transitions and their audit records commit in one database transaction; revision mismatches reject stale edits.
- The old workflow-completion route now delegates to the scoped transaction API. Legacy unscoped workflow feeds are retired. Workflow creation uses the actual running/pending database states and explicit task scope.
- Existing club follow-up controls remain available below the new task queue.

## Verified evidence

- Live Supabase migration scoped_admin_triage applied as version 20261007130921.
- Live feed query succeeded and returned zero rows, matching direct counts in all three task tables.
- All three tables have RLS enabled. Database privilege checks: anon SELECT false; authenticated SELECT true; authenticated UPDATE false.
- Both new public RPC functions use SECURITY INVOKER and are executable only by service_role, not anon or authenticated.
- Supabase security-advisor comparison found no new findings. Existing findings were not changed by this task.
- TypeScript check passed. Targeted ESLint check passed.
- Isolated permission regression tests cover tenant, club, role, squad, missing squad, assignee and delegated executive views. These are code tests, not signed-in UAT and do not write live data.
- Next.js compilation and type/lint phases succeeded. Full local production build stopped during page-data collection because existing /api/icons initializes Supabase without the missing local environment variables.

## Still unverified / unfinished

- Full configured production build, browser interaction checks and signed-in read/write UAT have not been completed.
- Vercel connector can list Pieify (team_x4GsUxyaw5ap4VUBIo4pu5hD), but ls1sportseam returns 404 and is absent from that team's project list. Preview environment settings and deployment access are unavailable through this connection. Do not substitute the unrelated pieify-v1 project.
- Live role_assignments contains only Organization Admin; real non-admin identities and squad assignments are not available for signed-in role testing.
- All three task source tables are empty. No synthetic tasks, financial amounts, example identities or test logs were inserted. Existing lease/waiver/payment source records were not changed.
- This module consumes persisted task/exception records; it does not yet generate all the document's example lease, staffing, fee and identity exceptions from underlying records.
- A competition resolution confirmation records an authorized human's resolution and audit note. It does not itself waive consent, change eligibility, post payments, approve spending, send broadcasts or perform the document's other specialized business transactions. Those actions require their own verified domain controls.
- Linked evidence is displayed, but full relational record-navigation drawers for every proposed exception type remain unfinished.

This is implemented task infrastructure with verified database access configuration, not a claim that Step 02 or the Admin engine is 100% operational. No application deployment was performed.
