# Spec Delta

## Purpose

Allows authenticated passengers to create ride requests from supported ServiceZone IDs while the backend resolves route validity, distance, fare, ownership, and persisted location relationships.

## ADDED Requirements

### Requirement: Authenticated passengers can create ride requests by ServiceZone ID

The system MUST expose `POST /api/v1/ride-requests` for authenticated passengers. The request MUST accept pickupZoneId, destinationZoneId, seats, and an optional weather condition defaulting to `CLEAR`, and MUST persist pickupZoneId and destinationZoneId as RideRequest foreign keys.

#### Scenario: Passenger creates a valid request

- **WHEN** an authenticated passenger submits valid distinct ServiceZone IDs, a valid positive seat count, and a supported forward corridor
- **THEN** the system creates a RideRequest with status `REQUESTED`, the authenticated passenger as owner, both ServiceZone foreign keys, and a calculated fare

#### Scenario: Unauthenticated creation is rejected

- **WHEN** a request is submitted without a valid authenticated passenger context
- **THEN** the system returns an unauthenticated error and creates no RideRequest

#### Scenario: Invalid seat count is rejected

- **WHEN** a passenger submits a missing, non-integer, zero, negative, or otherwise out-of-range seat count
- **THEN** the system returns a validation error and creates no RideRequest

### Requirement: Ride-request locations must be valid and distinct

The system MUST validate both ServiceZone IDs as UUIDs, require that both records exist, and reject equal pickup and destination IDs. The system MUST return populated pickupZone and destinationZone details in the successful response.

#### Scenario: Unknown pickup zone is rejected

- **WHEN** pickupZoneId is syntactically valid but no matching ServiceZone exists
- **THEN** the system returns a missing-location error and creates no RideRequest

#### Scenario: Unknown destination zone is rejected

- **WHEN** destinationZoneId is syntactically valid but no matching ServiceZone exists
- **THEN** the system returns a missing-location error and creates no RideRequest

#### Scenario: Same zone is rejected

- **WHEN** pickupZoneId equals destinationZoneId
- **THEN** the system returns a validation error and creates no RideRequest

#### Scenario: Client cannot override ownership or calculated values

- **WHEN** the client submits passengerId, fare, distance, latitude, longitude, or other calculated fields
- **THEN** those fields are rejected or ignored according to the strict request contract, and no client value controls the persisted request

### Requirement: Distance and fare are calculated by the backend

The system MUST calculate approximate straight-line distance using the Haversine formula over the resolved ServiceZone coordinates. It MUST calculate and return a fare breakdown in integer paisa using a `5,000` paisa base fare, a `1,000` paisa per-kilometer rate (`10 BDT/km`), distance charge, weather adjustment, estimated fare, currency `BDT`, and unit `POISHA`; it MUST not call a paid routing API.

#### Scenario: Haversine distance uses ServiceZone coordinates

- **WHEN** a valid forward route is submitted
- **THEN** the backend calculates distance from the two database coordinate pairs and returns the resulting distance in kilometers

#### Scenario: Fare uses backend distance

- **WHEN** a valid request has a calculated distance and weather condition
- **THEN** the estimated fare is calculated from backend distance and server fare rules, not a client-provided fare or distance

#### Scenario: Weather defaults to clear

- **WHEN** a valid request omits weatherCondition
- **THEN** the backend uses `CLEAR` and applies zero weather adjustment

#### Scenario: Straight-line limitation is disclosed

- **WHEN** the ride-request location/fare capability is documented
- **THEN** the README states that Haversine distance is an MVP straight-line approximation and is not road distance

### Requirement: Ride-request persistence and response preserve location relationships

The system MUST persist only the ServiceZone foreign keys on RideRequest for pickup and destination, with appropriate indexes, and MUST not duplicate zone name or coordinates without a documented snapshot requirement. A successful response MUST include the resolved zone details and request status.

#### Scenario: Foreign keys are stored correctly

- **WHEN** a valid ride request is created
- **THEN** its pickupZoneId and destinationZoneId reference the selected ServiceZone records and the response includes their IDs, normalized names, latitude, and longitude

#### Scenario: No pool join occurs during creation

- **WHEN** a valid ride request is created
- **THEN** the request remains `REQUESTED` and no pool membership or matching decision is created by this capability

### Requirement: Drivers can list their assigned ride requests

The system MUST expose `GET /api/v1/ride-requests/driver` for authenticated drivers. It MUST derive the driver from `request.user`, return only requests assigned to pools owned by that driver, and support the existing opaque cursor pagination contract. It MUST not trust a driver ID supplied by the client.

#### Scenario: Driver sees only assigned requests

- **WHEN** an authenticated driver requests their ride list
- **THEN** the API returns requests from pools linked to that driver's vehicle and excludes requests assigned to other drivers or no pool

### Requirement: Completed ride history is available to drivers and passengers

The system MUST expose `GET /api/v1/ride-requests/driver/completed` for authenticated drivers and `GET /api/v1/ride-requests/completed` for authenticated passengers. Both endpoints MUST return only `COMPLETED` requests visible to the authenticated actor. They MUST use offset pagination with `page` defaulting to `1`, `limit` defaulting to `20`, and a maximum limit of `100`.

#### Scenario: Driver sees completed history

- **WHEN** an authenticated driver requests completed ride history
- **THEN** the API returns only completed requests assigned to that driver's pools with offset pagination metadata

#### Scenario: Passenger sees completed history

- **WHEN** an authenticated passenger requests completed ride history
- **THEN** the API returns only completed requests owned by that passenger with offset pagination metadata

### Requirement: Ride list reads use non-authoritative Redis caching

The driver and passenger list endpoints MUST check Redis before PostgreSQL, cache successful PostgreSQL results with a bounded TTL, and continue using PostgreSQL when Redis is unavailable. Cache keys MUST isolate actor identity, endpoint/filter, page, limit, and cursor where applicable.

#### Scenario: Cache miss loads and stores database results

- **WHEN** a list cache key is absent
- **THEN** the API loads the authoritative result from PostgreSQL, stores the derived page in Redis, and returns the result

#### Scenario: Redis failure does not break list reads

- **WHEN** Redis read or write fails but PostgreSQL is available
- **THEN** the API returns the PostgreSQL result and does not treat Redis as authoritative

### Requirement: Drivers can open directional ride pools

The system MUST expose `POST /api/v1/ride-requests/open-pool` for authenticated drivers. The request MUST accept pickupZoneId and destinationZoneId, derive the driver's vehicle from `request.user`, validate the ServiceZone records and forward corridor, and create an `OPEN` RidePool with `reservedSeats = 0`, vehicleId, pickupZoneId, and destinationZoneId. The system MUST reject a second active pool for the same vehicle.

#### Scenario: Driver opens a pool

- **WHEN** an authenticated driver with an online vehicle submits a valid forward route
- **THEN** the system creates an open pool owned by that driver's vehicle with both zone foreign keys

#### Scenario: Pool opening does not trust client ownership

- **WHEN** a client submits a vehicleId or driverId
- **THEN** the server ignores or rejects those fields and derives ownership from the authenticated driver

### Requirement: Passengers can opt into and join a selected pool

Ride-request creation MUST accept `enableRidePool`, defaulting to `false`, and persist the opt-in. The system MUST expose `POST /api/v1/ride-requests/:rideRequestId/join-pool` with `{ poolId }` for the owning authenticated passenger. The server MUST use the RideRequest requested seat count, not a client-provided seat count, when joining.

#### Scenario: Passenger opts into pooling

- **WHEN** an authenticated passenger creates a request with `enableRidePool: true`
- **THEN** the request is persisted as pool-enabled and remains unassigned until the passenger selects a compatible pool

#### Scenario: Passenger joins a compatible pool

- **WHEN** a pool-enabled passenger selects an open pool with matching pickup and destination zones and enough capacity
- **THEN** the system assigns poolId, increments reservedSeats by the stored requested seat count, changes the request to `PENDING_DRIVER_ACCEPTANCE`, and records status history atomically

#### Scenario: Pool capacity is protected from concurrent joins

- **WHEN** concurrent passengers attempt to join a pool with insufficient remaining seats
- **THEN** at most the capacity-fitting transaction succeeds and other joins receive a conflict response

#### Scenario: Invalid pool join is rejected

- **WHEN** the request is not owned by the passenger, pooling is disabled, the pool is closed, the route differs, or capacity is insufficient
- **THEN** the system rejects the join without changing the request or pool capacity

### Requirement: Ride requests support driver acceptance and ephemeral fare negotiation

The system MUST expose `POST /api/v1/ride-requests/:rideRequestId/accept` for the authenticated driver who owns the request's pool. The endpoint MUST accept only requests in `PENDING_DRIVER_ACCEPTANCE`, transition them to `MATCHED`, and record the transition in `RideStatusHistory`. The system MUST expose `POST /api/v1/ride-requests/:rideRequestId/counter-fare` for the owning passenger or pool-owning driver with a strict `{ farePaisa }` body. A counter fare MUST be stored only in Redis with a bounded TTL, MUST NOT change ride status, and MUST be persisted to `RideRequest.farePaisa` only when the owning driver accepts the request. Redis MUST NOT be used as the authoritative source for the final fare or lifecycle state.

#### Scenario: Driver accepts a pending ride request

- **WHEN** the pool-owning authenticated driver accepts a pending request
- **THEN** the request becomes `MATCHED`, the status transition is recorded, and the latest cached counter fare is persisted if one exists

#### Scenario: Passenger or driver counters the fare

- **WHEN** the owning passenger or pool-owning driver submits a positive integer `farePaisa`
- **THEN** the latest counter fare is stored in Redis, the request status remains unchanged, and PostgreSQL is not updated with the counter yet

#### Scenario: Unauthorized fare negotiation is rejected

- **WHEN** a user who is neither the request passenger nor the pool-owning driver attempts to accept or counter
- **THEN** the API rejects the operation without changing Redis or PostgreSQL state
