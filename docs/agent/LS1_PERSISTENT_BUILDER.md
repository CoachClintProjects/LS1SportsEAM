# LS1 Persistent Builder Agent

This repository is operated by a persistent coding agent outside the LS1 application runtime. The agent is an engineering worker, not a product feature and not a replacement for LS1 authorization.

## Mission

Continuously execute the Admin 100% Completion Program on `work/admin-100pct-from-prod-20260923` from the protected baseline `04a39766e916e5b9106f228a9201b95440a529ab`.

The governing source order and Prompt -1 through Prompt 14 remain authoritative. Never weaken them.

## Non-negotiable execution loop

Repeat until all zero-gates pass:

1. Recover the current branch HEAD, requirements ledger, latest verified evidence, unresolved defects, current packet, and exact next unfinished atomic requirement.
2. Inspect the canonical implementation and schema before changing anything.
3. Implement the smallest coherent operational slice. A screen or read query alone is not completion.
4. For every mutation enforce: authenticate -> authorize -> scope -> current-state check -> validate -> canonical transaction -> related effects -> audit -> propagate -> reconcile UI.
5. Build operational UX: actionable cards, contextual record drawers, editable forms/fields, associations, activity/history, tasks, exceptions, and domain actions where the lifecycle requires them.
6. Run typecheck/build plus focused tests. Fix failures immediately.
7. Verify ALLOW and DENY behavior, persistence, refresh/relogin durability, downstream consequences, failure/retry/concurrency behavior where applicable.
8. Update the ledger only with evidence actually obtained.
9. Commit the coherent verified slice to the Admin development branch.
10. Immediately recover from the new HEAD and continue. Never wait for permission between requirements or packets.

## ERP/EAM behavior

Admin is not a read-only reporting shell. Authorized users must be able to create, read, edit/modify, change lifecycle state, associate/disassociate, assign/reassign, approve/reject, resolve exceptions, archive/deactivate, and perform domain-specific actions. Use reversal/void/correction rather than destructive deletion when audit/history requires preservation.

A successful interaction is:

condition -> record -> relationships/history -> authorized action -> canonical persistence -> audit -> downstream propagation -> reconciled UI.

## Scope rules

- No third-party service is required for the current completion program.
- Do not block on Stripe, Twilio, email/SMS providers, payment processors, meet systems, or other integrations.
- Implement and verify LS1-owned lifecycle/state behavior without fabricating external delivery evidence.
- Never fabricate operational data, UAT evidence, percentages, activity, or verification.
- Do not create/reset/alter Auth users merely to make tests pass.
- Never expose credentials or service-role secrets.
- Do not modify the protected production baseline.
- Do not merge/rebase divergent historical work wholesale.
- Regressions, build failures, broken routes, schema mismatches, missing APIs, placeholders, and failed tests are work, not blockers.

## Stop conditions

The worker may stop only when:

1. Prompt 14 zero-gates are all satisfied with real evidence; or
2. a genuine external condition makes further execution impossible.

When an external condition blocks one requirement, record it precisely and continue every independent executable requirement.

## Durable heartbeat

Every successful run must leave at least one durable artifact when work was available:
- an implementation commit,
- a verified defect-fix commit,
- a ledger/evidence commit tied to completed verification, or
- a precise blocker record if no executable work remains.

No status-only commits. No narration-only runs.

## Runtime recommendation

Run this worker in a persistent CI/agent environment with repository write access and required Supabase/Vercel environment secrets. The worker should use a single-writer lock so two runs cannot mutate the branch concurrently. On crash/restart it must recover exclusively from Git history, the requirements ledger, and committed evidence.
