# Prompt 12 — Gear & Field Crew

Status: operational Preview candidate; owner signed-in UAT pending. Not certified 100% complete.

The owner approved updating database constraints and adding transaction functions while reusing existing tables. No new tables or schemas were added. The named `public_warehouse_inventory`, `public_equipment_allocations`, `public_procurement_orders` and `public_infrastructure_leases` do not exist in the connected database. The implementation uses inventory_items, inventory_locations, inventory_balances, inventory_transactions, purchase_requests/orders/lines, maintenance_work_orders, facilities/bookings/closures and operational_tasks.

## Implemented

- Role-specific five-section directory plus Home, dark three-column drawers, locally hosted Lexend, 25-row pagination, live refresh and the required vacant-stock intake action.
- Club-scoped catalog and bin registration. HPAC has no initial stock records; no demonstration stock was created.
- Atomic receipt: usable quantity, purchase-line received count, order lifecycle, receipt evidence, vendor discrepancy hold, Treasurer task and audit event commit or roll back together.
- Request replay protection plus packing-slip/item duplicate detection. Decimal quantities validated; explicit currency and unit-cost evidence required.
- COUNT_MISMATCH_HOLD accepted by purchase-order constraint. Payment trigger blocks payments to the affected vendor within the club until authorized resolution. This intentionally holds vendor payments conservatively because vendor bills have no purchase-order foreign key.
- Team crates use controlled operational_tasks metadata as the reservation record. Multi-line reservations cannot exceed available stock. Physical safety screening creates a Competition Manager handoff; returns release reservations and close the readiness handoff. Athlete clearance remains separate.
- Certified stock disposal reduces unreserved stock, records cost/currency/certificate evidence and sends a Treasurer reconciliation task. No general-ledger posting is claimed.
- Editable 7/14/28-day Gantt: bookings, maintenance and existing closures. Click/drag move or resize opens the review drawer; saves include a reason and stale-window checks. Booking edits check resource overlaps and closures.
- Maintenance scheduling and completion. Emergency closures mark the facility UNAVAILABLE, create executive and affected competition/team tasks for the next seven days, and queue LS1 notifications for assigned Team Managers. External SMS/email delivery is not claimed.
- Database locks prevent seeding runs and bracket assignment changes while their competition venue has an overlapping active closure. Executive reopening resolves the closure and related tasks.
- Treasurer hold resolution and executive reopening are available within their own Today’s Tasks drawer. Generic task completion cannot bypass protected equipment lifecycles.
- ERR-101 denies broad finance, athlete-record and governance-related commands in the Facilities role. New write RPC is SECURITY INVOKER, service_role-only, with fixed search_path; the API derives actor/tenant/club from authenticated context.

## Verification

- TypeScript `npx tsc --noEmit`: passed.
- Focused ESLint: zero errors; warnings about existing generic row typing and sequence refs.
- `node scripts/verification/admin-equipment.cjs`: passed authorization, scoped reads, actor spoof rejection, invalid dates and forbidden actions.
- `scripts/verification/admin-equipment.sql`: passed receipt replay, duplicate slip, foreign-bin rejection, crate reservation/over-allocation, inspection handoff, return, disposal, maintenance, emergency closure, executive reopening, discrepancy/release, payment blocking, seeding lock and generic task completion rejection.
- SQL verification runs in a transaction and rolls back every fixture. No test operational data retained.
- RPC privileges confirmed: anon false, authenticated false, service_role true.
- Security advisor reported no new equipment function finding. Existing project findings remain outside this delivery: disabled RLS on fundraising/payment-method tables, a definer roster view and user_metadata policies. See https://supabase.com/docs/guides/database/database-linter for remediation categories. This is not a project-wide security certification.

## Remaining requirements and limits

- Active athlete profiles do not contain clothing/hardware sizing fields. Crates support explicit size-labelled catalog items and manual fit confirmation; automatic athlete-profile sizing is not implemented.
- Disposal valuation is recorded evidence and a Treasurer handoff, not automatic general-ledger posting or fixed_asset depreciation/disposal accounting. Account mapping, valuation basis and ledger integration remain incomplete.
- Planned blackout creation and duration editing are implemented with stale-window and booking-conflict checks; emergency closure windows require executive resolution.
- Emergency shutdown creates seven-day risk tasks and blocks overlapping competition seeding; automated relocation to another venue is not implemented.
- Browser drag behavior and signed-in user journeys await the owner's testing. Database and API verification does not constitute signed-in UAT.

Migrations: equipment_transactions, equipment_lifecycle_guards, equipment_bracket_and_payment_guards, equipment_planned_blackouts. Preview deployment must be verified against the published commit; production promotion is not requested.
