# Spec Delta

## Purpose

Allows authenticated drivers to manage the single vehicle that governs their availability and ride-pool capacity.

## ADDED Requirements

### Requirement: Driver can create their vehicle

The system SHALL provide `POST /api/v1/vehicles/me` for an authenticated user with the `DRIVER` role to create their own vehicle. The system MUST derive the driver from the authenticated actor and MUST NOT accept a driver or vehicle identifier as proof of ownership. The request MUST contain a non-empty vehicle name, an integer capacity from one through three, and may contain `ONLINE` or `OFFLINE` availability and a bounded list of valid image URLs. The system MUST reject malformed or unknown input with 400, a non-driver caller with 403, and a driver that already has a vehicle with 409. On success, it MUST return the newly created vehicle with 201.

#### Scenario: Driver creates a vehicle
- **WHEN** an authenticated driver without a vehicle submits valid vehicle details
- **THEN** the system creates a vehicle owned by that driver's profile and returns it with 201

#### Scenario: Duplicate vehicle is rejected
- **WHEN** an authenticated driver that already owns a vehicle submits another create request
- **THEN** the system returns 409 and does not create a second vehicle

#### Scenario: Passenger cannot create a vehicle
- **WHEN** an authenticated passenger submits a vehicle create request
- **THEN** the system returns 403 and does not create a vehicle

### Requirement: Driver can update their vehicle

The system SHALL provide `PATCH /api/v1/vehicles/me` for an authenticated driver to update only their own vehicle's name, capacity, availability, or image URLs. The request MUST contain at least one supported field and reject unknown, malformed, or unsafe values with 400. The system MUST reject a request when the caller has no vehicle with 404, and MUST return 409 without persisting a capacity reduction that would make any active pool's reserved seats exceed the vehicle capacity. On success, it MUST return the updated vehicle with 200.

#### Scenario: Driver updates availability
- **WHEN** an authenticated driver with a vehicle submits a valid availability change
- **THEN** the system updates only that driver's vehicle and returns it with 200

#### Scenario: Capacity cannot invalidate an active pool
- **WHEN** a driver requests a capacity lower than the reserved seats in one of that vehicle's active pools
- **THEN** the system returns 409 and leaves the vehicle capacity unchanged

#### Scenario: Driver cannot update another vehicle
- **WHEN** a driver submits an update request with a different vehicle or driver identifier in the input
- **THEN** the system ignores that identifier for authorization and updates only the caller's vehicle when the remaining input is valid

### Requirement: Driver can delete an unused vehicle

The system SHALL provide `DELETE /api/v1/vehicles/me` for an authenticated driver to delete their own vehicle only when it has no associated ride pools. The system MUST derive ownership from the authenticated actor, reject a non-driver caller with 403, return 404 when the driver has no vehicle, and return 409 without deletion when any pool references the vehicle. On success, it MUST return 204.

#### Scenario: Driver deletes an unused vehicle
- **WHEN** an authenticated driver deletes a vehicle that has no associated pools
- **THEN** the system deletes that driver's vehicle and returns 204

#### Scenario: Vehicle with pool history cannot be deleted
- **WHEN** an authenticated driver tries to delete a vehicle referenced by a ride pool
- **THEN** the system returns 409 and retains the vehicle and pool records
