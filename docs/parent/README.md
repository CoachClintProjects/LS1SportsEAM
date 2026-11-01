# Parent workspace release

This release provides a shared multi-sport Parent workspace with child, sport and club filters. Navigation covers Home, My athletes, Calendar, Competitions, Fees, Forms & documents, Messages & requests, Volunteering and Family settings.

## Access setup

Organization Admin opens the athlete record, edits a saved parent/guardian, and configures Parent portal access. A unique saved guardian email is required; the parent signs in through the existing account process using that email. Granting portal access does not create an authentication account, assert custody, or grant pickup rights. New portal grants use UNVERIFIED custody and no pickup authority. Existing restricted or externally governed authority records require separate review.

Permissions are per athlete: read, competition response, documents, signing, finance and own contact editing. Emergency contact status alone grants no access. Superuser may select an explicitly configured guardian for read-only preview; no family is selected implicitly.

## Saved behavior

- Current squad memberships and registrations provide sport and club context.
- Combined calendars flag overlaps and export ICS. Absences become staff requests.
- Addressed competition invitations accept responses with stale-record and deadline checks. Responses do not become accepted entries or eligibility clearance.
- Registration, identity, squad-change, nomination and billing requests enter the existing Admin task queue with role routing. Parents see their own request status. Staff task completion is available; a dedicated conversational reply editor is not part of this release.
- Safe registration documents upload into private athlete storage with audited metadata; authorized reads use short-lived signed URLs.
- Assigned active waivers support explicitly agreed typed-name signatures where template policy permits them, retaining the signed text/version.
- Invoices require explicit financial authority. Family-account invoices require authority for every athlete associated with that account. Amounts retain their original currencies.
- Volunteer requests check capacity; cancellation does not award hours or credits. Clearance and confirmation remain staff responsibilities.
- Parents can edit their own telephone details. Identity, email, guardian access and squad changes remain staff-controlled requests.

## Verification and limits

TypeScript and the optimized Next.js build passed. Parent boundary tests and existing roster, person record, record action and Team Manager checks passed. Every selected database column was checked against the connected schema. PL/pgSQL static checks reported no errors or warnings for the three new functions. The legacy family-reader RPC is now service-only. No sample accounts, family grants or business records were created for verification.

Authenticated parent UAT remains pending because no real parent authority grants were configured at release. This is technical verification, not completed UAT. Refresh and window focus reload saved state; this release does not claim realtime subscriptions. Card payments are not configured. Eligibility displays existing recorded assessments and unknown/missing states; automatic meet-rule evaluation and automatic entry submission remain separate work. Messages show permitted announcements and staff requests rather than a completed two-way chat system.

Database functions are in sql/parent-actions.sql. Applied migrations include parent_multisport_authorized_actions, parent_action_validation, restrict_legacy_parent_hub and parent_explicit_input_validation. The plpgsql_check extension was installed in extensions for static verification.
