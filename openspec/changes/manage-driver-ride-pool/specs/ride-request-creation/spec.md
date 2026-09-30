# Spec Delta

## MODIFIED Requirements

### Requirement: Drivers can open directional ride pools

The system MUST expose `POST /api/v1/drivers/open-pool` for authenticated drivers. The request MUST accept pickupZoneId and destinationZoneId, derive the driver's vehicle from `request.user`, validate the ServiceZone records and forward corridor, and create an `OPEN` RidePool with `reservedSeats = 0`, vehicleId, pickupZoneId, and destinationZoneId. The system MUST reject a second active pool for the same vehicle. The former `POST /api/v1/ride-requests/open-pool` route is removed from the ride-request feature.

#### Scenario: Driver opens a pool

- **WHEN** an authenticated driver with an online vehicle submits a valid forward route to `/api/v1/drivers/open-pool`
- **THEN** the system creates an open pool owned by that driver's vehicle with both zone foreign keys

#### Scenario: Pool opening does not trust client ownership

- **WHEN** a client submits a vehicleId or driverId
- **THEN** the server rejects the unknown fields and derives ownership from the authenticated driver

#### Scenario: Legacy ride-request pool-opening route is unavailable

- **WHEN** a client submits the same action to `/api/v1/ride-requests/open-pool`
- **THEN** the endpoint is no longer exposed by the ride-request feature and no pool is created through that route

### Requirement: Drivers can close their open ride pools

The system MUST expose `POST /api/v1/drivers/close-pool` for authenticated drivers with `{ poolId }`. The server MUST derive the driver from `request.user`, verify that the selected pool belongs to a vehicle owned by that driver, and allow the transition only when the pool status is `OPEN`. A successful close MUST change the pool status to `CLOSE`, exclude it from future available-pool discovery and passenger joins, and preserve ride requests already assigned to the pool. The transition MUST be atomic and MUST reject unknown, foreign, or already closed pools without changing state. The former `POST /api/v1/ride-requests/close-pool` route is removed from the ride-request feature.

#### Scenario: Driver closes an open pool

- **WHEN** an authenticated driver submits the ID of an open owned pool to `/api/v1/drivers/close-pool`
- **THEN** the system changes the pool status to `CLOSE` and returns the closed pool representation

#### Scenario: Closed pool is no longer joinable

- **WHEN** a passenger searches for or attempts to join a pool after its driver has closed it
- **THEN** the pool is excluded or the join is rejected, and no new request is assigned

#### Scenario: Existing assignments are preserved

- **WHEN** a driver closes a pool that already has assigned ride requests
- **THEN** those assignments remain linked to the pool and are not cancelled or detached by the close action

#### Scenario: Driver cannot close another driver's pool

- **WHEN** an authenticated driver submits a pool owned through another driver's vehicle
- **THEN** the API returns an authorization error and leaves the pool unchanged

#### Scenario: Invalid pool close state is rejected

- **WHEN** a driver submits an unknown pool ID or a pool that is already `CLOSE`
- **THEN** the API returns the project's standard not-found or conflict error and performs no mutation
