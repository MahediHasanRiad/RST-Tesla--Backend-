# Design

## Context

The existing ride-pool controllers and repository already implement the required behavior: `openForDriver` derives the vehicle from the authenticated user, validates active-pool conflicts in a transaction, and `closeForDriver` locks the pool row, verifies ownership and `OPEN` state, then updates PostgreSQL. The current routes are mounted under `rideRequestRoutes`, while `app.ts` mounts feature routers at `/api/v1`. See `proposal.md` for the motivation and the delta specs for the externally visible contract.

## Goals / Non-Goals

**Goals:**

- Introduce a dedicated driver router mounted at `/api/v1/drivers`.
- Reuse the established ride-pool repository, validators, `requireAuth`, `asyncHandler`, `ApiError`, `sendSuccess`, logger, and cache-version abstraction.
- Keep PostgreSQL authoritative for pool status, ownership, and capacity-related state.
- Preserve passenger discovery and join behavior after an `OPEN` pool becomes `CLOSE`.
- Make the route relocation explicit in tests and API documentation.

**Non-Goals:**

- No new database models, migrations, Redis source-of-truth behavior, or driver lifecycle actions such as accept/arrive/start/complete.
- No service layer solely wrapping the existing repository.
- No image upload or media changes.
- No compatibility alias for the old ride-request paths in the baseline design.

## Decisions

### Dedicated router with the existing action shape

Create a driver feature router and expose `POST /api/v1/drivers/open-pool` and `POST /api/v1/drivers/close-pool`. Keep the current strict bodies (`pickupZoneId`/`destinationZoneId` and `poolId`) to minimize client-side contract churn while moving ownership to the correct route namespace. A more resource-oriented `POST /drivers/ride-pools` and `POST /drivers/ride-pools/:poolId/close` shape was considered, but would combine route relocation with an unnecessary body/URL redesign.

### Reuse existing controllers and repository boundary

Move or relocate the open/close controllers and their route wiring into the driver feature, then import the existing `ridePoolRepository` rather than duplicating SQL or Prisma access. This preserves the established transaction and authorization behavior and keeps Prisma access in the repository.

### Remove old routes as a deliberate breaking change

Remove the two action registrations from `rideRequestRoutes`. The proposal and delta spec identify this as breaking so clients do not silently maintain two mutation entry points. If rollout needs a deprecation window, that is a follow-up compatibility change with explicit API requirements.

### Preserve cache invalidation as a retryable side effect

After a successful close commit, retain the current version-key increment/expiry through the configured Redis abstraction. A Redis failure is logged with safe identifiers and does not roll back or fail the already-committed PostgreSQL mutation.

### Test at the controller and route-contract boundaries

Add focused tests following existing feature conventions for driver-role enforcement, strict validation, ownership rejection, duplicate active-pool conflict, successful open/close, already-closed/unknown pools, preservation of assigned requests, and Redis failure tolerance. Keep capacity/concurrency guarantees covered by the repository tests already associated with pool joins; do not move capacity authority into Redis.

## Risks / Trade-offs

- [Risk] Existing clients still call `/api/v1/ride-requests/open-pool` or `/close-pool` → Mitigation: document the new paths and update focused tests/consumers; add a separately specified compatibility alias only if rollout requires it.
- [Risk] Moving files can create duplicate imports or leave stale route registrations → Mitigation: search all route/controller imports and assert the old endpoints are absent in route-level tests.
- [Risk] Cache invalidation can fail after closure → Mitigation: PostgreSQL remains authoritative, the close response succeeds, and the existing warning log supports retry/observability.
- [Risk] A future driver action may be added inconsistently → Mitigation: keep driver pool ownership and action routes in the dedicated router, with domain actions rather than generic status updates.

## Migration Plan

1. Add the driver router and wire the two endpoints with the existing authentication and async middleware.
2. Relocate/reuse the pool controllers and validation/repository imports; remove old route registrations.
3. Update tests and API documentation/consumer references to the `/drivers` paths.
4. Deploy as an API contract change; no database migration is required.
5. Roll back by restoring the old route registrations and controller imports if clients cannot migrate, without changing persisted pool data.

