# Spec Delta

## Purpose

Provides a database-backed location catalog and directional corridor model so ride requests use supported ServiceZone records consistently and never depend on controller-local location lists.

## ADDED Requirements

### Requirement: Service zones are the authoritative supported locations

The system MUST store every supported pickup and destination location in the existing `ServiceZone` database model with a unique normalized name, UUID, latitude, and longitude. Ride-request location validation MUST resolve against these database records rather than a hardcoded controller or service list.

#### Scenario: Seeded Dhaka zones are available

- **WHEN** the database seed is applied
- **THEN** `mirpur-1`, `mirpur-2`, `mirpur-10`, `uttara-4`, `uttara-5`, and `uttara-6` exist as unique ServiceZone records with realistic coordinates

#### Scenario: Unknown location is not supported

- **WHEN** an API request references a ServiceZone ID that is not present in the database
- **THEN** the request is rejected as an unsupported or missing location

### Requirement: Clients can discover supported ServiceZones

The system MUST expose `GET /api/v1/service-zones` and return the supported ServiceZone ID, normalized name, latitude, and longitude without exposing unrelated database fields.

#### Scenario: ServiceZone discovery succeeds

- **WHEN** a client requests the ServiceZone catalog
- **THEN** the API returns the seeded supported zones with their IDs, names, and coordinates

#### Scenario: ServiceZone discovery does not define new locations

- **WHEN** a client submits data to the read-only ServiceZone catalog
- **THEN** the API does not create or modify ServiceZone records

### Requirement: Route corridors are directional and database-backed

The system MUST define the initial poolable route corridors separately from ServiceZone location records, resolve corridor entries to ServiceZone IDs, and accept a route only when the pickup zone occurs before the destination zone in the same corridor.

#### Scenario: A forward Mirpur segment is supported

- **WHEN** a passenger requests `mirpur-1` to `mirpur-10`
- **THEN** the route resolves through the Mirpur corridor in forward order and is accepted as supported

#### Scenario: A forward Uttara segment is supported

- **WHEN** a passenger requests `uttara-4` to `uttara-6`
- **THEN** the route resolves through the Uttara corridor in forward order and is accepted as supported

#### Scenario: A reverse corridor is rejected

- **WHEN** a passenger requests `mirpur-10` to `mirpur-2`
- **THEN** the route is rejected because the destination does not occur after the pickup in the same directional corridor

#### Scenario: A cross-corridor route is rejected

- **WHEN** a passenger requests a pickup and destination that do not belong to one supported corridor
- **THEN** the route is rejected as unsupported

### Requirement: ServiceZone coordinates are authoritative

The system MUST use latitude and longitude stored on the resolved ServiceZone records for distance and fare calculation and MUST NOT accept client-supplied coordinates or location names as authoritative values.

#### Scenario: Client coordinates cannot override zone coordinates

- **WHEN** a request includes client-supplied latitude, longitude, or location names alongside valid ServiceZone IDs
- **THEN** unknown fields or unauthorized location values are rejected and calculations use only database coordinates
