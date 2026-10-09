# Prompt 01 recovery checkpoint

Recovered 2026-10-09 onto deployed Today's Tasks tree f86f9cc. User authorized backend extensions using existing tables. Target: Preview only.

Implemented: persistent authorized role bar, Home reset and workspace remount, dark Admin shell and document-wide Lexend Deca, expandable authorized folders, per-role display settings and authenticated utility catalogs, durable help-ticket entry, and server-side ERR-701 self-deactivation/archive/role-revocation protection.

Executive actions now use scoped server routes and existing restricted database functions for waiver exceptions/restoration, cash receipts, club-covered entry fees, recorded escrow payments and reversals. Reasons, request idempotency, balanced journals and audit records are preserved. Escrow records an actual payment; it does not transfer money. Generic ledger reversals cannot bypass club decision reconciliation. Saved lifecycle status is displayed in record/task drawers. Today's Tasks is retained.

Verification: TypeScript passed. Production build compiled and completed lint/type checks, then stopped collecting page data at the existing icons route because this checkout lacks Supabase URL configuration. Executive action permission/input/routing checks, task delegation/ERR-701 checks and triage tenant/club/role/squad boundary checks passed without live business writes. Live executive SQL bodies match recovered SQL; functions deny anonymous/authenticated execution and allow service role. No new migration or schema was applied during recovery. Preview build verification follows publication.

Remaining: signed-in end-to-end business actions are unverified. Folders show actual enabled routes; the full specialty workflow inventory is not certified complete or mapped to every requested label. Lifecycle shows saved status rather than proof of prior approvals. No fabricated records or financial transactions were created. This checkpoint does not claim 100% completion of specialized role workflows.

## 9 October interaction fixes

- Club President navigation now retains Organization Admin authority and all role folders when opening a workspace inside another role directory. The folder is carried separately in the URL. A live read-only grant check found no enabled Admin component missing from the Organization Admin navigation grants.
- Programs, Teams and Seasons menu destinations now initialize their matching section rather than defaulting to People. Finance has a direct Pay bills & vendors entry.
- Club and competition creation forms use the shared right drawer, retain failed submissions and display server errors inside the drawer. Duplicate submission guards were added. Master record editors expose only supported editable fields, include saved lifecycle status and confirm archival within the drawer.
- Competition records use a three-column right drawer with current properties, controlled actions, available audit history and real linked events/deadlines.
- Person records open waiver and cash decisions filtered to that person's records within the authorized club. Server input checks and isolated regression checks cover both filters. Saving no longer displays an approval phase before server confirmation.
- TypeScript passed. Focused ESLint has zero errors (existing loose-type/hook warnings remain). Production compilation passed and page-data collection stops at the existing icons route without local Supabase configuration. Permission, actor binding, self-deactivation and triage boundary checks passed without live business writes.

This is an interaction correction release. It does not supersede the remaining signed-in verification or certify every specialized workflow/menu destination listed in the original prompt. No database schema or business records were changed in this batch.

## 9 October drawer coverage follow-up

- Replaced remaining centered Admin forms in Home, roster onboarding, registration, finance setup/invoice creation, facilities/contracts/bookings/closures and campaign creation with the shared dark right-side drawer. Form fields are disabled during saves, and API errors remain visible inside the form.
- Converted existing billing, registration, facility and campaign record panels to the shared lifecycle drawer with separate property, action and linked-record columns. Existing Home activity, event and follow-up panels use the shared shell as well.
- Preserved database-provided nested navigation sections instead of flattening every group. Club President still keeps full authority and all folders when navigating.
- TypeScript and focused ESLint passed (zero lint errors; legacy warnings remain). A before/after action inventory confirmed all 33 existing mutation action references remain present across the converted workspaces. No centered modal containers remain in components/hubs/admin. These are source-level checks, not signed-in browser UAT.
- Prior correction release abdefcd deployed successfully to Preview at https://ls1sportseam-5s2dm84of-pieify.vercel.app. This follow-up is based on that exact published commit.

Remaining original specialty menu destinations and business workflow certification are still tracked above. This entry does not claim those workflows were created by converting their surrounding shell.
