# Spec Delta

## Purpose

Keeps a driver's PostgreSQL vehicle availability synchronized with the driver's authenticated real-time presence, so vehicle discovery reflects whether the driver is actively online without changing ride or pool workflows.

## ADDED Requirements

### Requirement: Authenticated driver presence controls vehicle availability

The system MUST provide a Socket.IO presence connection authenticated with the existing access token. Only an authenticated user with the `DRIVER` role MAY establish driver presence. When the connection is accepted, the system MUST resolve the vehicle owned by that authenticated driver and persist its availability as `ONLINE`. The system MUST reject unauthenticated users, passengers, and drivers without an owned vehicle without changing any vehicle availability.

#### Scenario: Driver connects after login

- **WHEN** a verified driver connects to the Socket.IO presence channel using a valid access token and owns a vehicle
- **THEN** the system marks only that driver's vehicle `ONLINE` in PostgreSQL and acknowledges the presence connection

#### Scenario: Invalid or passenger connection is rejected

- **WHEN** a client connects without a valid access token or with a passenger identity
- **THEN** the system rejects the Socket.IO connection and does not change vehicle availability

#### Scenario: Driver without a vehicle connects

- **WHEN** an authenticated driver without an owned vehicle connects
- **THEN** the system rejects the presence connection with a safe not-found or authorization error and does not create or modify a vehicle

### Requirement: Driver offline and logout presence marks the vehicle offline

The system MUST support an explicit driver offline/logout presence event and MUST mark the authenticated driver's owned vehicle `OFFLINE` in PostgreSQL after that event. A disconnected presence connection MUST also mark the vehicle `OFFLINE` when the driver has no remaining active presence connections. Repeated offline/logout or disconnect events MUST be harmless and MUST NOT modify another driver's vehicle.

#### Scenario: Driver explicitly goes offline

- **WHEN** an authenticated driver emits the documented offline presence event
- **THEN** the system persists that driver's vehicle as `OFFLINE` and acknowledges the state change

#### Scenario: Driver logs out through presence

- **WHEN** an authenticated driver emits the documented logout presence event and disconnects the presence socket
- **THEN** the system persists that driver's vehicle as `OFFLINE` and closes the presence session

#### Scenario: Socket disconnects unexpectedly

- **WHEN** the driver's presence socket disconnects and no other presence socket for that driver remains active
- **THEN** the system best-effort persists the driver's vehicle as `OFFLINE` without affecting any other vehicle

#### Scenario: Multiple presence sockets remain active

- **WHEN** one of several active presence sockets for the same driver disconnects
- **THEN** the system keeps the driver's vehicle `ONLINE` until the final active presence socket disconnects or the driver explicitly goes offline

### Requirement: Presence failures do not alter unrelated ride-pooling behavior

The presence workflow MUST use the existing vehicle repository and PostgreSQL authority for availability updates. It MUST NOT change ride request creation, pool membership, pool capacity, fares, ride lifecycle, vehicle CRUD contracts, or add an HTTP logout endpoint. Database update failures MUST be reported through the existing safe logging/error conventions and MUST NOT update a different vehicle.

#### Scenario: Availability update fails

- **WHEN** PostgreSQL cannot persist an online or offline availability transition
- **THEN** the system reports a safe presence error or warning and leaves all unrelated ride-pooling state unchanged
