# Spec Delta

## Purpose

Provide passengers with a real-time view of driver ride decisions so acceptance or rejection is visible immediately without polling the HTTP API.

## ADDED Requirements

### Requirement: Authenticated passengers can receive ride-status updates

The existing Socket.IO server SHALL authenticate passenger connections with the existing access-token mechanism and SHALL associate each accepted passenger socket with its authenticated user identifier. Unauthenticated connections SHALL be rejected.

#### Scenario: Passenger connects with a valid access token

- **WHEN** a passenger establishes a Socket.IO connection with a valid access token
- **THEN** the connection is accepted and associated with that passenger's user identifier

#### Scenario: Invalid or non-user socket authentication

- **WHEN** a Socket.IO connection has no valid access token or the token does not resolve to a user
- **THEN** the connection is rejected

### Requirement: Driver acceptance or rejection produces a direct ride-status event

After a driver's acceptance or rejection successfully commits the authoritative ride-request transition, the system SHALL emit one `ride:status-updated` event directly to the affected passenger's connected socket(s), with the affected ride request identifier and resulting status.

#### Scenario: Driver accepts a pending ride

- **WHEN** the driver acceptance transaction commits with the ride request status `MATCHED`
- **THEN** the affected passenger's connected Socket.IO client(s) receive a status event containing the ride request identifier and `MATCHED` status

#### Scenario: Driver rejects a pending ride

- **WHEN** the driver uses the existing cancel flow to reject a pending ride and the transaction commits with status `CANCELLED`
- **THEN** the affected passenger's connected Socket.IO client(s) receive a status event containing the ride request identifier and `CANCELLED` status

#### Scenario: Acceptance or rejection fails

- **WHEN** the acceptance or rejection transaction fails, the ride is not found, or acceptance capacity is rejected
- **THEN** no ride-decision status event is published

#### Scenario: Passenger is not connected

- **WHEN** acceptance or rejection commits while the passenger has no active realtime connection
- **THEN** the database remains the source of truth and the existing HTTP/status-history APIs remain usable for later synchronization

#### Scenario: Socket.IO is unavailable

- **WHEN** the direct Socket.IO server is unavailable after the database transition
- **THEN** the acceptance result and persisted status remain successful, and clients can recover by fetching authoritative ride status through the existing API
