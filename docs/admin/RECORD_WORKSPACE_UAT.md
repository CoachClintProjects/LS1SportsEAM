# Org Admin record workspace UAT

Status: NOT RUN in signed-in application. Technical checks below do not substitute for acceptance.
Use existing authorized HPAC records and legitimate data corrections only. Do not create fictional athletes, health information, contacts or tickets to claim UAT.

| Case | Steps | Expected evidence | Result |
|---|---|---|---|
| Home | Open Home from Roster and change roles forwards/backwards | Today's tasks; matching role sidebar and task permissions | Pending |
| Roster | Open Roster, page forwards/backwards, open a named athlete | 25 records/page; stable identity; roster remains behind a dark right drawer | Pending |
| People sorting | Sort every People header twice; change filter/page | Ascending/descending indicator and correct records | Pending |
| Drawer keyboard | Open by keyboard; Tab/Shift-Tab; Escape | Focus stays in drawer; close returns focus; body scroll restored | Pending |
| Profile save | Make a legitimate contact correction and reload record | Saved database value; person audit entry; drawer remains open | Pending |
| Concurrent save | Open same record twice; save one; save stale second | Second save rejected with reload instruction | Pending |
| Linked data | Compare athlete relationships to authoritative records | Correct parents, contacts, team, coach, facility, competitions and fee account | Pending |
| Missing data | Open existing record with missing relationships | Explicit absence; no generated parents, health or invoices | Pending |
| Medical access | Compare Org Admin and role without medical access | Authorized edit only; denied role receives no medical payload | Pending |
| Finance access | Open same record with and without finance permission | No invoice/customer reads or data in denied role | Pending |
| Emergency contacts | Add/edit a genuine emergency contact | Scoped athlete association, validation, conflict check and audit | Pending |
| Contacts | Add/edit a genuine external operating contact; inactivate | Persisted person/contact association; facility/vendor scope; history retained | Pending |
| Ticket | Report a real issue once, retry identical request | One ticket and submission event; no false email-delivered claim | Pending |
| Catalogs | Compare Admin/Coach and Parent/Scout navigation | Catalog controls only in Admin/Coach; server rejects other hubs | Pending |
| Superuser evidence | Open implementation evidence after this release | Current commit/artifacts; unverified work remains marked pending | Pending |

## Technical checks completed

- `npm run typecheck`: pass.
- Focused ESLint on new components/routes: pass (existing `any` warnings remain).
- `node scripts/verification/admin-person-record.cjs`: pass. Controlled request-boundary test, not UAT.
- Live database profile-save transaction on an existing person: correct record returned; rolled back, no persistent change.
- Stale profile timestamp: save rejected.
- `athlete_medical_profiles`: RLS enabled; anon/authenticated SELECT grants absent.
- Local Next build: compilation/type validation passed; full build blocked at existing icons route by absent runtime credentials.
