# Design

## Context

See `proposal.md` and the two capability specs. The Prisma schema already contains `ServiceZone` and `RideRequest` foreign-key fields, but there is no ride-request feature, seed script, route-corridor implementation, distance helper, or fare response projection. The repository uses a versioned Express API, per-route controllers, class-based Prisma repositories, strict Zod validation, and authenticated actors from `request.user`.

## Goals / Non-Goals

**Goals:**

- Make PostgreSQL ServiceZone records the only supported location source.
- Seed the requested zones idempotently and resolve corridor order from zone records.
- Add authenticated passenger ride-request creation with authoritative foreign keys, Haversine distance, and a testable integer-paisa fare breakdown.
- Preserve the existing lifecycle by creating requests as `REQUESTED` without matching or pool membership.
- Provide authenticated driver and passenger read projections for active/completed ride requests.
- Use offset pagination for completed ride history and Redis cache-aside for all new list reads.
- Let drivers open directional pools using their own online vehicle.
- Let passengers opt into pooling and join a selected compatible pool using their stored requested seat count.
- Let the pool-owning driver accept a pending request and let the passenger or driver submit an ephemeral counter fare.

**Non-Goals:**

- Pool joining, matching, seat reservation, driver actions, live road routing, Google Maps, geocoding, or location search.
- Mutating driver lifecycle actions such as arrive, start, or complete.
- Automatic matching without an explicit passenger pool-join action.
- Storing a second location snapshot on RideRequest.
- Accepting client coordinates, names, passenger IDs, fares, or distances.

## Decisions

### Use the existing ServiceZone relation as the source of truth

Add only missing indexes and seed data around the existing Prisma model. Repositories will load both zones by ID and include them in the create/read projection. A hardcoded location list in a controller is rejected because it can diverge from database state; a separate location table is rejected because `ServiceZone` already models the required identity and coordinates.

### Represent corridors as an explicit ordered application rule

Keep corridor definitions separate from ServiceZone records, with ordered normalized zone names resolved to database IDs at request evaluation time. This preserves the distinction between a location and route order. A database corridor table is deferred because only two static MVP corridors are required and no administrative corridor API is requested. The request must find one corridor containing both zones and require pickup index `<` destination index.

### Use a reusable Haversine distance helper

Create a pure distance calculation utility that accepts numeric latitude/longitude values, converts Prisma Decimal values at the boundary, and returns kilometers using the Haversine formula. No external routing provider is introduced. Round only at the response/fare policy boundary and retain integer paisa for monetary values.

### Keep fare calculation server-owned and explicit

Create a pure fare calculation utility that receives backend distance, seat count, and weather condition. The initial policy uses integer-paisa constants: base fare `5000` paisa and per-kilometer rate `1000` paisa (`10 BDT/km`), with weather adjustments represented by a closed enum/configuration and `CLEAR` equal to zero. The implementation must centralize these values so a later product decision changes one policy module rather than controllers; client input never selects rates.

### Keep creation transactional and owner-derived

The controller validates the request and authenticated passenger role, the repository reads both zones and creates the RideRequest with `passengerId` from `request.user.id`, `REQUESTED` status, zone foreign keys, and persisted estimated fare. The create operation is a single database transaction or one atomic repository operation; no Redis state participates. Pool matching is explicitly not invoked.

### Use the established API shape

Register `GET /api/v1/service-zones` for read-only ServiceZone discovery and `POST /api/v1/ride-requests` for authenticated passenger creation beneath the app's existing `/api/v1` mount; no unversioned compatibility alias is included. Accept optional weather with `CLEAR` as the default. Return `sendSuccess` with the request, populated zones, and a fare object; map missing zones, unsupported corridors, same-zone requests, validation failures, and unauthenticated access to the project's standard error handling.

### Authenticated ride-history projections

Register `GET /api/v1/ride-requests/driver` for requests assigned to pools owned by the authenticated driver, `GET /api/v1/ride-requests/driver/completed` for that driver's completed requests, and `GET /api/v1/ride-requests/completed` for the authenticated passenger's completed requests. The two completed endpoints accept `page` (default `1`) and `limit` (default `20`, maximum `100`) and return `items`, `page`, `limit`, `totalItems`, `totalPages`, and `hasNextPage`. The driver all-requests endpoint uses the existing cursor pagination contract. Each list controller checks Redis first using an actor- and filter-isolated key, loads PostgreSQL on a miss, caches for a bounded TTL, and still succeeds when Redis is unavailable.

### Driver pool opening and passenger pool joining

Register `POST /api/v1/ride-requests/open-pool` for authenticated drivers. The controller derives the driver's vehicle from `request.user`, validates pickup and destination ServiceZone IDs and the directional corridor, and creates an `OPEN` RidePool with `reservedSeats = 0` and both zone foreign keys. Only one active pool per vehicle is allowed.

Extend passenger ride creation with `enableRidePool`, defaulting to `false`, and persist the opt-in on RideRequest. Register `POST /api/v1/ride-requests/:rideRequestId/join-pool` with `{ poolId }`; the backend derives the passenger and requested seat count from the RideRequest, validates pool/request route compatibility and opt-in, locks the pool row, re-reads capacity, increments `reservedSeats`, assigns `poolId`, changes the request to `PENDING_DRIVER_ACCEPTANCE`, and records status history in one PostgreSQL transaction. Redis is not used for this decision.

### Acceptance and ephemeral fare negotiation

Register `POST /api/v1/ride-requests/:rideRequestId/accept` for the driver who owns the request's pool. Acceptance is allowed only from `PENDING_DRIVER_ACCEPTANCE`, runs in a PostgreSQL transaction, changes the request to `MATCHED`, records status history, and persists the latest counter fare when one is present in Redis. Register `POST /api/v1/ride-requests/:rideRequestId/counter-fare` for either the owning passenger or pool-owning driver with `{ farePaisa }`. Store only the latest positive integer counter fare at `ride-request:counter-fare:<rideRequestId>` with a bounded TTL. Countering does not change lifecycle state and Redis remains a temporary negotiation store, never the source of truth for the final fare.

## Risks / Trade-offs

- [Haversine distance is not road distance] → Document the limitation in README and keep the distance utility replaceable for a future routing provider.
- [Static corridors can become stale as supported areas grow] → Keep ordered corridor rules isolated and test forward, reverse, and cross-corridor cases; defer an administrative corridor model until needed.
- [Weather adjustments may be expanded later] → Keep weather values in a closed server-owned policy and default omitted weather to `CLEAR`.
- [A zone is deleted or renamed after clients cache its ID] → Treat PostgreSQL foreign keys and lookup errors as authoritative; seed by normalized unique names and do not accept names at the API boundary.
- [Concurrent creation could later interact with matching] → This change performs no capacity decision; future matching must use its own PostgreSQL transaction and row locks per repository rules.

## Migration Plan

1. Add any missing `RideRequest` zone indexes and generate/apply a Prisma migration.
2. Add idempotent ServiceZone seed data and run it after migrations.
3. Deploy the route, repository, validation, distance/fare utilities, and focused tests together.
4. Roll back by removing the route and application code; retain seeded zones and additive indexes unless a deliberate data rollback is required. No RideRequest data transformation is expected.
