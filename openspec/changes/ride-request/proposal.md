# Proposal

## Why

Ride requests need a single authoritative location model so supported pickup and destination areas cannot drift between controllers, services, seed data, and clients. The existing Prisma `ServiceZone` model is already present, but the ride-request API, seed data, route-corridor rules, distance calculation, and fare response contract are not yet implemented around it.

## What Changes

- Seed normalized Dhaka `ServiceZone` records for mirpur-1, mirpur-2, mirpur-10, uttara-4, uttara-5, and uttara-6 with realistic coordinates.
- Add a database-backed ride-request creation API that accepts pickup and destination ServiceZone IDs, validates authenticated passengers, and persists foreign keys.
- Add `GET /api/v1/service-zones` so clients can discover supported ServiceZone IDs, normalized names, and coordinates.
- Validate that both zones exist, are distinct, and form a supported directional corridor segment; do not accept client-provided names, coordinates, fares, distances, or passenger IDs.
- Add reusable Haversine distance calculation and backend fare calculation using integer paisa.
- Use a `5,000` paisa base fare and `1,000` paisa per kilometer (`10 BDT/km`), with optional weather adjustment and `CLEAR` as the default.
- Return populated pickup and destination zone details plus the calculated fare breakdown.
- Add focused tests for zone lookup, corridor direction, distance/fare calculation, persistence, validation, and protection against client overrides.
- Document the MVP straight-line-distance limitation in the README.
- Add authenticated driver request listing for requests assigned to the driver's pools.
- Add completed ride history for drivers and passengers with offset pagination.
- Cache these non-authoritative list reads in Redis while keeping PostgreSQL authoritative.
- Add driver-created ride pools with a database-backed destination zone.
- Add a driver-owned route to close an open ride pool, preventing new passengers from discovering or joining it while preserving existing assignments.
- Allow passengers to opt into pooling when creating a ride request and join a selected compatible pool.
- Enforce pool capacity and request assignment in a PostgreSQL transaction.
- Add driver acceptance and Redis-backed passenger/driver counter-fare routes; persist the negotiated fare only when the driver accepts.
- Add a vehicle-discovery route so passengers can search available vehicles for a pickup/destination route before creating a fresh request.
- Add a separate fresh-ride route that requires the selected vehicleId and creates or joins the route pool atomically. Pool-enabled requests join an existing matching `OPEN` pool; private requests use a `CLOSE` pool and cannot be joined by other passengers.

## Capabilities

### New Capabilities

- `service-zone-location-model`: Database-backed service zones, seeded Dhaka locations, directional route corridors, and ride-request location resolution.
- `ride-request-creation`: Authenticated passenger ride-request creation with server-calculated distance and fare.

### Modified Capabilities

- `ride-request-negotiation`: Driver acceptance and ephemeral counter-fare negotiation for pending ride requests.

## Impact

- Affected persistence: seed data and the existing `ServiceZone`/`RideRequest` foreign-key model, including pickup and destination indexes if missing.
- Affected persistence: add `RidePool.destinationZoneId` and a passenger pool opt-in field on `RideRequest`.
- Affected persistence: keep RidePool.vehicleId required because every bookable fresh request selects a concrete vehicle.
- Affected API: new versioned ride-request creation and authenticated ride-history/list routes, validation, controllers, repositories, distance/fare helpers, and response projections.
- Affected API: authenticated driver pool-closing action with ownership and lifecycle validation.
- Affected code: vehicle discovery, selected-vehicle fresh request/pool transaction, and route-specific available-seat discovery; no automatic passenger joining beyond the selected pool reservation.
- Affected documentation: README limitation and API/location behavior.
- No paid routing dependency; coordinates in PostgreSQL remain the source of truth.
- Counter fares are ephemeral Redis data until acceptance; PostgreSQL remains authoritative for accepted fare and lifecycle state.
