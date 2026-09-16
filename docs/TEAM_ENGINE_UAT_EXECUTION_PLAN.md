# LS1 Team Engine — UAT Execution Plan

## Scope lock
Prototype/UAT scope is the shared Team Engine spine only:

Organization / Team / Season → People / Athlete → Roster → Coach Assignment → Training Plan / Workout → Deployment → Attendance / Execution → Performance / Result → Athlete / Parent Visibility → RBAC / Audit.

Competition-specific functionality is explicitly deferred to the Competition Engine.

## Non-negotiable operating contract
- Canonical LS1 data only. No demo rows, simulated success, hard-coded completion, or fake operational evidence.
- One shared record graph across Admin, Coach, Athlete, and Parent. Hubs must not maintain independent copies of team, roster, training, attendance, or performance state.
- Server-side role + scope + permission enforcement is mandatory for reads and writes.
- Every visible mutation must persist, survive refresh/re-login, fail safely, and produce auditable evidence when privileged or consequential.
- Unknown/unverified is not reported as failure or zero; UAT evidence is recorded only when actually observed.
- SuperUser is held stable during this closure except for defects that block Team Engine UAT.

## Execution order
| Gate | Capability | Admin responsibility | Coach responsibility | Athlete / Parent integration | UAT exit evidence |
|---|---|---|---|---|---|
| TE-01 | Organization / Team / Season | Create/maintain canonical hierarchy | Read assigned hierarchy | Read authorized hierarchy context | Same IDs/state visible after refresh in every authorized hub |
| TE-02 | People / Athlete | Maintain canonical people/athlete identity | Read scoped athletes | Athlete sees self; parent sees linked athlete only | Cross-tenant/unlinked access denied |
| TE-03 | Roster | Add/retire roster membership | Read/manage roster within authority | Athlete/parent see membership permitted to them | Roster mutation propagates without duplicate copies |
| TE-04 | Coach Assignment | Assign coach role/scope to team | Assignment determines team authority | No administrative assignment authority | Assigned coach gains only intended scope; removed coach loses it |
| TE-05 | Training Plan / Workout | Governance/visibility only where authorized | Create/edit/publish plan and workout | Athlete sees published applicable work; parent sees permitted summary | Draft is not exposed as published; persisted plan survives re-login |
| TE-06 | Deployment | Govern team/season relationships | Deploy workout to canonical roster/athletes | Athlete receives correct deployment | Duplicate submission is idempotent; wrong roster cannot receive deployment |
| TE-07 | Attendance / Execution | Operational oversight | Record attendance/execution | Athlete/parent see permitted execution state | Failure/retry does not duplicate/corrupt attendance |
| TE-08 | Performance / Result | Govern canonical athlete/team relationship | Record/inspect performance evidence | Athlete sees own permitted result; parent sees linked permitted result | Result is traceable to athlete + workout/session and survives refresh |
| TE-09 | Athlete / Parent Visibility | Maintain relationships/authority | No privilege escalation through Coach UI | Self/family boundary enforced | Athlete cannot see teammate private data; parent cannot see unlinked athlete |
| TE-10 | RBAC / Audit | Client Admin authority bounded by tenant/delegation | Coach writes bounded by assigned scope | Athlete/parent least privilege | Unauthorized happy/ugly paths denied server-side; privileged writes auditable |

## Prototype acceptance journey
Use HPAC as the established-team regression path. A Team Engine prototype is UAT-ready only when the same canonical records complete this journey end-to-end:

1. Admin opens the existing organization/team/season and confirms canonical identity.
2. Admin confirms an athlete/person and roster membership.
3. Admin confirms a coach assignment scoped to the team.
4. Coach signs in and sees the same team and roster through that assignment.
5. Coach creates a training plan/workout and publishes it.
6. Coach deploys the workout to an authorized roster/athlete.
7. Athlete sees the published deployment; an unrelated athlete does not.
8. Parent sees only the permitted linked-athlete view.
9. Coach records attendance/execution and performance/result evidence.
10. Athlete/parent views reflect the permitted canonical update.
11. Refresh/re-login preserves state.
12. Unauthorized, duplicate, invalid, stale-session, retry, and partial-failure paths do not create false success or corrupt canonical state.
13. Privileged/consequential mutations have audit evidence with actor, entity, action, and resulting state.

## Build closure rule
A gate is not complete because a component or route exists. It is complete only when its intended workflow executes end-to-end against canonical data under actual authorization. Any gate that cannot be proven remains outstanding for UAT handoff.
