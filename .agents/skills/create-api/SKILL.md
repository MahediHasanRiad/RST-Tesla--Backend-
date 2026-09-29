---
name: create-api
description: Plan and, after explicit approval, implement or materially change versioned REST APIs for Dhaka Tesla Pool. Use for endpoint, route, controller, repository, validation, upload, authorization, or API-contract work; do not use for frontend-only changes.
---

# Create API

Create reliable ride-pooling APIs that follow this repository's feature-oriented modular-monolith architecture. Read `AGENTS.md`, `docs/project.md`, and `docs/architecture.md` when relevant.

## Approval-first workflow

Before editing a project file, changing a dependency, creating a migration, or changing an API contract:

1. Inspect the relevant feature, complete auth feature, routes, schema/migrations, infrastructure adapters, tests, and documentation.
2. Present a concise plan covering routes, status codes, affected files, validation, authorization, data impact, image/cache/transaction behavior, and focused tests.
3. Stop and request explicit user approval.
4. cache will add in controller function with redis

Approval authorizes only the approved API work. It does not authorize unrelated changes, destructive operations, deployment, or commits.

## Repository architecture

- Use `src/api/v1/<feature>/` with a separate controller file for each route action.
- Keep routes thin: compose auth, Multer, validation, controller invocation, and `asyncHandler`.
- Controllers translate HTTP, derive the actor, coordinate infrastructure, and enforce feature business rules.
- Repositories are the only layer allowed to access Prisma/PostgreSQL.
- Do not add a service layer merely to wrap one repository or SDK call. If a real reusable domain workflow is needed, inspect existing conventions and document the reason.
- Reuse existing error, validation, auth, logging, response, Redis/cache, Cloudinary/media, and configuration utilities. Do not invent a parallel abstraction.
- Return the existing standard response helper shape and safe error codes; never expose stack traces, secrets, passwords, tokens, raw database errors, image buffers, or complete upload payloads.
- Use Winston structured logs with request ID, actor ID where available, resource ID, transition, and safe failure context.

## Validation and authorization

- Validate `params`, `query`, and `body` independently with strict Zod objects where appropriate; reject unknown, malformed, unsafe, and client-controlled fields.
- Validate UUIDs and domain enums explicitly. Normalize only when the API contract permits it.
- Prefer the repository's established route/middleware validation pattern. Controllers should receive validated, typed input; do not define ad hoc schemas or duplicate parsing in a controller when a shared validation middleware exists.
- Derive identity from `request.user`. Never trust client-provided role, ownership, fare, lifecycle status, seat count, driver ID, passenger ID, or calculated totals.
- Enforce ownership in the database query or repository operation, not by trusting a request body field. For example, a driver's “my vehicle” lookup resolves the driver from the authenticated user and then queries by `driverId`.
- Use conventional statuses: `200` read/update, `201` create, `204` delete, `400` validation, `401` unauthenticated, `403` unauthorized, `404` missing, and `409` conflict or invalid transition.

## Multipart images and Cloudinary

- Every API image input is `multipart/form-data`, received through the existing Multer middleware. Never accept base64 data, arbitrary image URLs, or paths from request JSON unless the endpoint explicitly documents it.
- Validate required/optional file presence, MIME type, file size, file count, and allowed image signatures before upload. Image fields are `Express.Multer.File` at the controller boundary.
- Routes only attach the existing Multer configuration; Cloudinary calls belong in the configured media adapter/helper and are coordinated by controllers.
- For image create/update flows: validate body/params/query and files, derive the actor, upload validated files, persist only required Cloudinary metadata through the repository, and return the normal response.
- Store at least `public_id` and secure URL whenever deletion or replacement is required. Never store raw image bytes in PostgreSQL.
- For replacement, persist the new upload and database update successfully before deleting the previous asset. If upload succeeds but persistence fails, attempt best-effort cleanup of newly uploaded assets and log safe structured context.
- Keep Cloudinary configuration in the existing infrastructure layer and add safe placeholders to `.env.example` when configuration changes.
- For a vehicle image update, an empty Multer file array must preserve existing images; only replace image metadata when new files are actually uploaded.

## Redis and external infrastructure

- PostgreSQL is authoritative for ride lifecycle, pool membership, capacity, fares, ownership, authorization, and final matching/reservation decisions.
- Redis may only hold cacheable/non-authoritative reads, short-lived derived data, rate limits, BullMQ infrastructure, or explicitly documented ephemeral state.
- Access Redis through the established cache abstraction. On cache failure, an endpoint should still succeed when PostgreSQL can satisfy a non-authoritative read.
- Invalidate or update cache only after the authoritative PostgreSQL transaction commits.
- Keep Prisma, Cloudinary, Redis, logging, and configuration access behind their existing boundaries; routes and repositories must not call Cloudinary or raw Redis for convenience.

## Transactions, capacity, and lifecycle

Before implementing an operation affecting capacity, membership, fare finalization, or lifecycle state, determine its transaction and locking requirements.

- Use a PostgreSQL transaction for capacity-sensitive mutations.
- Lock the relevant pool/vehicle/capacity row, re-read authoritative state inside the transaction, check capacity, and mutate within that same transaction.
- Commit before cache invalidation or retryable side effects.
- Never implement `read capacity → check in application memory → update later` when concurrent requests can violate capacity.
- Add a concurrency test proving two simultaneous claims for the final seat cannot both succeed.

Represent lifecycle transitions explicitly:

```text
REQUESTED
  → PENDING_DRIVER_ACCEPTANCE
  → MATCHED
  → DRIVER_ARRIVED
  → STARTED
  → COMPLETED
```

Cancellation is allowed only from explicitly supported states. Do not expose a generic client-controlled status update; use domain actions such as accept, arrive, start, complete, and cancel and validate transitions before repository mutation.

## Required discovery before implementation

1. Read `docs/project.md` and `docs/architecture.md`.
2. Inspect `src/app.ts` and route registration.
3. Inspect the complete auth feature as the structural reference.
4. Inspect `prisma/schema.prisma` and existing migrations.
5. Inspect existing error, validation, auth, logging, Redis/cache, Cloudinary/media, Multer, and response utilities.
6. Inspect relevant tests and test conventions.
7. State which existing patterns will be reused in the implementation plan.

Prefer the smallest compatible file set. When uncertain about a convention, inspect the repository instead of guessing.

## Completion checklist

After approval and implementation:

1. Add focused tests for successful behavior, validation, authorization, missing resources, conflicts/state transitions, image failures/replacement when applicable, and concurrency when applicable.
2. Run the relevant focused tests.
3. Run `npm run check` and `npm run build`.
4. Inspect the resulting diff and working-tree status.
5. Verify no secret or generated artifact was added.
6. Verify `.env.example` when configuration changed and docs when an architectural/API decision changed.
7. Report exactly which commands passed or failed and identify known unrelated failures; never claim an unexecuted command passed.
