# Tasks

## 1. Database and seed foundation

- [x] 1.1 Inspect the existing Prisma `ServiceZone` and `RideRequest` relations, add missing pickup/destination indexes if needed, generate the migration, and verify Prisma validation/generation succeeds.
- [x] 1.2 Add idempotent seed data for `mirpur-1`, `mirpur-2`, `mirpur-10`, `uttara-4`, `uttara-5`, and `uttara-6` with normalized unique names and realistic coordinates; verify rerunning the seed does not create duplicates.
- [x] 1.3 Verify the seeded records can be loaded by ID and that RideRequest foreign keys point to ServiceZone without duplicated location fields.

## 2. Location and fare domain rules

- [x] 2.1 Add a read-only `GET /api/v1/service-zones` endpoint with a repository projection of supported IDs, names, and coordinates; verify it returns seeded zones without allowing writes.
- [x] 2.2 Add strict ride-request input schemas for pickupZoneId, destinationZoneId, seats, and optional weather defaulting to `CLEAR`; verify unknown fields, invalid UUIDs, and invalid seat counts are rejected.
- [x] 2.3 Implement directional corridor resolution using ordered ServiceZone records for the Mirpur and Uttara corridors; verify forward, reverse, same-corridor, and cross-corridor cases.
- [x] 2.4 Implement a pure Haversine distance calculation over ServiceZone coordinates; verify known coordinate pairs produce the expected approximate kilometer value without external API calls.
- [x] 2.5 Implement the server-owned integer-paisa fare calculation with `5,000` base fare and `1,000/km` rate, plus weather adjustment, currency, and unit; verify client fare/distance overrides cannot affect the result.

## 3. Ride-request API

- [x] 3.1 Add the ride-request repository operation to resolve both ServiceZones and create a `REQUESTED` RideRequest with authenticated passenger ownership, foreign keys, and calculated fare; verify missing zones and persistence behavior.
- [x] 3.2 Add the authenticated passenger create controller and existing ride-request route using existing auth, validation, repository, async-handler, logger, error, and response conventions; verify unauthenticated and non-passenger access is rejected.
- [x] 3.3 Return populated pickupZone and destinationZone details plus the fare breakdown; verify a valid Mirpur request returns the expected request status and location relationships.
- [x] 3.4 Ensure creation performs no passenger joining or matching decision beyond creating the request's own route pool; verify no other passenger is assigned automatically.

## 4. Focused tests and documentation

- [x] 4.1 Add tests for ServiceZone discovery, seeded/fixture ServiceZones, unknown pickup/destination IDs, same-zone rejection, unsupported/reverse routes, coordinate authority, and foreign-key persistence; verify all location validation cases pass.
- [x] 4.2 Add tests for Haversine distance, exact `5,000 + 1,000/km` fare calculation, default CLEAR weather, weather adjustment, and rejection of client-controlled fare/distance/coordinates; verify backend-derived values are returned.
- [x] 4.3 Update README/API documentation with both route contracts, ServiceZone ID discovery, seeded locations, fare policy, and the Haversine straight-line-distance limitation; verify the documented request/response matches the implementation.
- [x] 4.4 Run the focused ride-request tests, `npm run check`, `npm run build`, and the full test command; record any unrelated failures without claiming them as passed.

## 5. Authenticated ride lists and completed history

- [x] 5.1 Add strict pagination validation for driver cursor lists and driver/passenger completed offset lists.
- [x] 5.2 Add repository projections that scope driver requests through the authenticated driver's vehicle pools and passenger history through passenger ownership.
- [x] 5.3 Add `GET /api/v1/ride-requests/driver` with cursor pagination and inline Redis cache-aside.
- [x] 5.4 Add `GET /api/v1/ride-requests/driver/completed` with `COMPLETED` filtering, offset pagination, and inline Redis cache-aside.
- [x] 5.5 Add `GET /api/v1/ride-requests/completed` with passenger ownership, `COMPLETED` filtering, offset pagination, and inline Redis cache-aside.
- [x] 5.6 Add focused authorization, filtering, pagination, cache miss/hit, and Redis fallback tests; update README route contracts.
- [x] 5.7 Run focused tests, `npm run check`, `npm run build`, and inspect the final diff.

## 6. Ride pool opening and passenger pool joining

- [x] 6.1 Extend Prisma RidePool with destinationZoneId and RideRequest with pool opt-in state; add and verify the migration/client generation.
- [x] 6.2 Add strict schemas and directional ServiceZone validation for driver pool opening and passenger pool joining.
- [x] 6.3 Add authenticated driver `POST /api/v1/ride-requests/open-pool` with derived vehicle ownership and one-active-pool protection.
- [x] 6.4 Add `enableRidePool` to passenger ride creation and persist the server-validated opt-in.
- [x] 6.5 Add transactional `POST /api/v1/ride-requests/:rideRequestId/join-pool` with row locking, capacity validation, assignment, status transition, and history.
- [x] 6.6 Update available-pool discovery to use RidePool destinationZoneId and return capacity for the requested seats.
- [ ] 6.7 Add focused authorization, validation, capacity, route compatibility, and concurrent-final-seat tests; update README contracts.
- [x] 6.8 Run focused tests, `npm run check`, `npm run build`, and inspect the final diff.

## 7. Ride request acceptance and counter fare

- [x] 7.1 Add strict counter-fare validation and authenticated acceptance/counter-fare controllers with passenger/driver ownership checks.
- [x] 7.2 Add transactional driver acceptance that transitions `PENDING_DRIVER_ACCEPTANCE` to `MATCHED`, records history, and persists the latest Redis counter fare.
- [x] 7.3 Store counter fares in Redis with a bounded TTL, keep status unchanged while negotiating, and clean up after acceptance without making Redis authoritative.
- [x] 7.4 Register the accept and counter-fare routes, add focused tests, and document the request contracts.
- [x] 7.5 Run focused tests, `npm run check`, `npm run build`, and inspect the final diff.

## 8. Vehicle discovery and selected fresh ride booking

- [x] 8.1 Add authenticated `GET /api/v1/ride-requests/available-vehicles` with strict route/seats validation and vehicle/pool projections.
- [x] 8.2 Update `POST /api/v1/ride-requests/fresh` so vehicleId is required and selected vehicle ownership/capacity is validated server-side.
- [x] 8.3 Reconcile RidePool.vehicleId back to required and add the migration/client generation needed to remove unassigned pools.
- [x] 8.4 Implement transactional shared-pool reservation for `enableRidePool: true` and private `CLOSE` pool creation for false/omitted pooling.
- [x] 8.5 Add tests for vehicle search, selected vehicle IDs, route filtering, available seats, shared reservation, private pool isolation, and capacity conflicts.
- [x] 8.6 Update README/API contracts and run focused tests, `npm run check`, `npm run build`, and inspect the final diff.
