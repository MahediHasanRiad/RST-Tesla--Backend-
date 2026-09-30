# Spec Delta

## Purpose

Provides a dedicated driver-facing API for opening and closing route-specific ride pools while enforcing authenticated ownership, valid service zones, vehicle availability, and safe pool lifecycle transitions.

## ADDED Requirements

### Requirement: Drivers can open directional ride pools from the driver feature

The system MUST expose `POST /api/v1/drivers/open-pool` for authenticated users with the `DRIVER` role. The request MUST accept only strict `pickupZoneId` and `destinationZoneId` input, derive the driver's vehicle from `request.user`, validate both ServiceZone records and the supported forward route, and create an `OPEN` RidePool with `reservedSeats = 0`. The system MUST reject a second active pool for the same vehicle and MUST reject client-supplied driver or vehicle ownership fields.

#### Scenario: Driver opens a valid pool

- **WHEN** an authenticated driver with an online vehicle submits distinct service zones forming a supported forward route
- **THEN** the system creates an open pool owned by that driver's vehicle and returns the normal success response

#### Scenario: Passenger cannot open a pool

- **WHEN** an authenticated passenger submits the open-pool request
- **THEN** the system returns a forbidden error and creates no pool

#### Scenario: Invalid route or zone is rejected

- **WHEN** a driver submits an unknown zone, identical zones, or an unsupported route
- **THEN** the system returns the project's validation or not-found error and creates no pool

#### Scenario: Driver cannot override ownership

- **WHEN** a client includes a driver ID or vehicle ID in the request
- **THEN** the strict request contract rejects the unknown fields and no pool is created

### Requirement: Drivers can close owned ride pools from the driver feature

The system MUST expose `POST /api/v1/drivers/close-pool` for authenticated drivers with strict `{ poolId }` input. The server MUST derive the driver from `request.user`, verify that the selected pool belongs to a vehicle owned by that driver, and allow the transition only when the pool status is `OPEN`. A successful close MUST change the pool status to `CLOSE`, exclude it from future discovery and passenger joins, preserve existing assignments, and return the closed pool. The transition MUST be atomic and Redis cache invalidation MUST remain best-effort.

#### Scenario: Driver closes an owned open pool

- **WHEN** an authenticated driver submits an open pool belonging to the driver's vehicle
- **THEN** the system atomically closes the pool and returns its closed representation

#### Scenario: Driver cannot close another driver's pool

- **WHEN** an authenticated driver submits a pool owned by another driver's vehicle
- **THEN** the system returns a forbidden error and leaves the pool unchanged

#### Scenario: Unknown or already closed pool is rejected

- **WHEN** a driver submits an unknown pool ID or a pool whose status is already `CLOSE`
- **THEN** the system returns the standard not-found or conflict error and performs no mutation

#### Scenario: Existing assignments survive closure

- **WHEN** a driver closes an open pool that already has ride requests assigned
- **THEN** the requests remain linked to the pool while new discovery and joins are blocked

#### Scenario: Redis invalidation failure does not undo closure

- **WHEN** PostgreSQL successfully closes the pool but Redis cache invalidation fails
- **THEN** the API still returns the successful close response and records a safe warning for the infrastructure failure
