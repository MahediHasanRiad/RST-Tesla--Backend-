---
name: create-api
description: Plan and, after explicit approval, implement or materially change versioned REST APIs for Dhaka Tesla Pool. Use for endpoint, route, controller, service, repository, validation, or API-contract work; do not use for frontend-only changes.
---

# Create API

Create reliable ride-pooling APIs that follow the repository architecture. Read `AGENTS.md` for shared project rules, `docs/project.md` for product requirements, and `docs/architecture.md` for API and domain decisions when they are relevant to the requested change.

## Approval-first workflow

Before writing any project file, changing a dependency, creating a migration, or changing an API contract:

1. Inspect the relevant feature, schema, routes, tests, and documentation.
2. Present a concise plan containing endpoints, status codes, affected files, validation and authorization approach, data impact, and focused tests.
3. Stop and request explicit user approval.

Proceed only after the user explicitly approves that plan. Approval does not authorize unrelated work, destructive operations, deployment, or commits.

## API implementation rules

- Use feature folders under `src/api/v1/<feature>/`. Keep routes thin; controllers translate HTTP; services own business rules; repositories are the only Prisma access layer.
- Apply DRY and SOLID principles. Reuse shared validation, constants, helpers, and error handling when they already fit; do not build abstractions without a clear repeated use.
- Define strict Zod validation before implementing a route. Reject unknown, malformed, or unsafe input.
- Derive actor identity from the authenticated server context. Never trust body, query, or path values as proof of a caller's passenger, driver, or admin identity.
- Use RESTful resource names and conventional results: `201` create, `200` successful read/update, `204` delete, `400` invalid input, `401` unauthenticated, `403` unauthorized, `404` missing, and `409` conflict or invalid state transition.
- Return consistent JSON success and error bodies. Do not expose stack traces, secrets, passwords, tokens, or internal database errors.
- Use Winston structured logs with request ID, actor ID where available, resource/pool ID, transition, and safe error context.

## Ride-pooling safeguards

- PostgreSQL is authoritative for ride state, pool membership, fares, and capacity. Redis and BullMQ cannot make final booking decisions.
- For matching or reservations, use a PostgreSQL transaction and row locking. Recheck capacity inside the transaction before creating membership or changing status.
- Preserve the documented lifecycle: `REQUESTED → PENDING_DRIVER_ACCEPTANCE → MATCHED → DRIVER_ARRIVED → STARTED → COMPLETED`, plus valid cancellation only.
- Enforce ownership: passengers act only on their own requests; drivers act only on pools served by their vehicle.
- Store money as integer paisa. Apply the documented 10 BDT/km fare model, driver discount, and cancellation rules.
- BullMQ jobs are retryable side effects only. They must invoke the service layer rather than independently changing capacity or lifecycle state.

## Completion checklist

After approval and implementation:

1. Add focused tests for successful behavior, validation, authorization, state/capacity conflicts, and any new domain rule.
2. Run `npm run check` and `npm run build`, plus relevant test commands.
3. Update API and architecture documentation when the route contract, schema, or a material decision changes.
4. Report the implementation, validation results, changed files, and known limitations concisely.
