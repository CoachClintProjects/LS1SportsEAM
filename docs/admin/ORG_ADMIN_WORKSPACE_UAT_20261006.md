# Organization Admin workspace — 6 October 2026

Status: implemented locally; deployment and signed-in UAT pending. This is not full Admin sign-off.

## Changed
- Home opens enabled staff/club settings, policies/insurance/incidents, budgets, and finance workspaces via the authenticated navigation API.
- Organization Admin can assign a manual task to an authorized Admin role and set a valid optional due date. Other roles cannot delegate outside their own role. Home exposes responsibility and due date and identifies overdue work.
- Club settings explains staff assignment/revocation in plain language. Existing permission checks remain server-side.
- Club record and financial labels use plain language. Missing financial records are shown explicitly, without implied real-world balances.
- Sidebar retains bundled Lexend Deca and explicitly applies its font style; navigation links use 14px normal-weight text.
- The accepted roster and athlete drawer have not been redesigned.

## Local evidence
- TypeScript: passes.
- Focused ESLint: zero errors; existing warnings remain.
- admin-task-delegation.cjs: controlled API tests for assignment authority, invalid dates, actor/tenant binding and audit request. No live business records created.
- admin-home-scope.cjs: role-specific query and permission boundaries pass.
- admin-governance.cjs: role, scope, mutation and pagination boundaries pass.
- admin-budgets.cjs: preparation/decision separation, scope and version checks pass.
- admin-payable-authority-boundary.cjs: executive-only policy writes and input validation pass.

## Signed-in acceptance cases — NOT RUN
1. Sign in as Organization Admin. Home loads real club tasks; all four shortcuts open the correct enabled workspace.
2. Open Roster and an athlete. Existing pagination and dark drawer remain usable.
3. Assign a real staff role, reopen and check effective access and audit. Remove access and verify it is denied. Do not grant access solely to manufacture a test pass.
4. Create a genuine club task with responsibility and due date. Reopen it, view it in the assigned role, complete it, refresh, and check history. Confirm another role cannot complete it through the API.
5. Open a genuine policy/insurance/incident, assign an owner, attach evidence, save, reopen, and execute an appropriate human-authorized decision. Confirm related Home task changes. Do not invent coverage or incidents.
6. Prepare a genuine budget, submit, review as Organization Admin, approve/lock and confirm locked-line edits are rejected.
7. Set real spending rules when supplied, submit a supplier bill, verify correct approval responsibility, and approve only with human authority. Do not invent financial records.
8. Confirm empty finance state and setup actions before any financial records exist.
9. Verify computed sidebar font and visual appearance on the deployed build; dark background throughout these workspaces; role switching forward/backward.
10. Measure Home loading and workspace transitions in the signed-in deployment. No measured performance claim is established by this change.

Existing database: governance/budget menus are Preview-enabled and Production-disabled. This release targets the Admin development branch, not protected main.
