<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# LS1Sports non-negotiable product architecture

LS1Sports is a sports-native Enterprise Athlete Management operating system. It is not a collection of disconnected sports apps.

## Enterprise operating model

Use mature ERP/EAM design patterns as the architectural baseline. LS1Sports should deliberately leverage the proven operating models found in IBM Maximo, JD Edwards, SAP, and Sage X3: canonical master data, controlled lifecycle state transitions, organization/tenant structure, role and authority models, approvals, work management, accounting controls, procurement, asset/facility management, auditability, segregation of duties, reconciliation, period/state controls, and authoritative transaction history.

Do not copy vendor code, proprietary text, or protected implementation details. Reproduce the durable enterprise patterns and adapt them to sports operations and Enterprise Athlete Management.

Every material workflow must have a canonical source of truth, explicit states, validation rules, permissions, audit evidence, and recoverable/reconcilable transitions. Avoid generic browser-side CRUD when a domain-specific transaction or lifecycle workflow is required.

## Workflow and experience model

Use HubSpot-level ease of use as the interaction standard. Complex ERP/EAM mechanics belong underneath simple, contextual workflows. The interface should guide the user through the next correct action, reduce unnecessary fields and navigation, preserve context, surface exceptions, and make status and ownership obvious.

Do not simplify by removing enterprise controls. Simplify how the user interacts with those controls.

Material visible product content, navigation, configuration, workflow definitions, and platform state should be database-driven where practical. Avoid hard-coded business content or configuration when it can be represented canonically in the data model.

## Hub completion standard

Hub delivery sequence is strict unless explicitly changed by the product owner:

1. Super User
2. Admin
3. Athlete
4. Parent / Official / Scout and other role hubs as prioritized
5. Coach is last unless explicitly reprioritized

A hub is not complete because screens render. 100% means every intended route, link, workflow, read, write, hook, permission, authority check, audit path, validation state, lifecycle transition, empty/error/loading state, integration boundary, and deployment behavior works end to end.

Anything below that standard remains in the Super User action plan. Implemented but not operational is unfinished. Operational but not validated is unfinished.

## Deployment discipline

Vercel production deployments are a constrained validation resource. Do not intentionally trigger a deployment after every implementation commit while a hub is knowingly incomplete.

Build the active hub to a coherent release-candidate state first. Use source inspection, schema validation, type-safe implementation, local/static checks where available, and the Super User action plan to eliminate known defects before the deliberate deployment checkpoint. Then deploy the release candidate and work backward through runtime/browser defects until the hub is genuinely 100% operational and validated.

Do not mark deployment validation at 100% until the release candidate has been proven on the deployed application.

## Current product scope and domain boundary

The active product completion target is the LS1Sports Team Manager operating domain. Super User work must first make Team Manager fully operational front-to-back and must not blur Team Manager functionality with Competition Engine functionality.

Team Manager includes the enterprise operating capabilities needed to run organizations, people/person master, teams, rosters, memberships, programs, seasons, administration, finance/accounting, facilities/assets, payroll/workforce operations, procurement, imports/data quality, reporting, compliance/governance, security/authority, workflow, audit, integrations, platform configuration, and operational health.

Competition Engine is a separate domain and may later be deployed on its own domain or subdomain. Competition navigation, timing, seeding, scoring, results, advancement, judicial operations, reconciliation, publication, records, awards, and competition-specific actions must not be mounted into the current Team Manager runtime or counted toward current Team Manager completion. Preserve Competition Engine source/data for future work; do not delete it merely to enforce separation.

Super User may eventually govern multiple LS1Sports domains, but the current Team Manager Super User control plane must remain internally coherent and independently certifiable.

## Competition Engine truth standard

Competition Engine correctness is existential to LS1Sports when that domain becomes active. If LS1Sports cannot prove competition truth, the EAM fails.

During validation, LS1Sports runs in parallel with Hy-Tek Meet Manager. Hy-Tek source/results files are verification evidence against LS1Sports calculations and outcomes; they are not the long-term authoritative architecture or a permanent runtime dependency.

The parallel-validation program must compare the complete competition lifecycle where applicable: entries and eligibility, event/session structure, seeding, scratches/check-ins, officials and judicial decisions, timing/result ingestion, result versions, scoring, advancement, reconciliation, records, awards, publication, reports, and financial/operational consequences.

Discrepancies must be explicit, attributable, reproducible, and resolved through canonical rules/evidence rather than hidden by imports.

Only after LS1Sports has matched or correctly explained real competition outcomes across multiple independent live competitions should Hy-Tek imports be considered removable from the primary operating workflow.

The long-term target is an LS1-native competition exchange/package format (`.ls1`) that can carry canonical competition definitions, state, provenance, results, and verification evidence. Do not assume `.ls1` is a standard until the engine has earned that trust through repeated live validation.

## Human authority

AI may surface issues, propose changes, reconcile evidence, explain calculations, and coordinate work. Authoritative business changes remain subject to the appropriate human approval and authority rules.
