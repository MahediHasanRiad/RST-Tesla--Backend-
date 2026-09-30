# Proposal

## Why

Vehicle discovery already depends on the PostgreSQL `Vehicle.availability` value, but driver session presence is not synchronized with that value. A narrowly scoped Socket.IO presence channel will keep a driver's owned vehicle discoverable only while the driver is connected and online, without changing ride, pool, fare, or authentication behavior.

## What Changes

- Add a Socket.IO server boundary attached to the existing HTTP server.
- Authenticate Socket.IO connections with the existing access-token verification and allow only `DRIVER` users to establish driver-presence sessions.
- Set the authenticated driver's owned vehicle to `ONLINE` after a successful presence connection.
- Set the same vehicle to `OFFLINE` on an explicit offline/logout presence event and on socket disconnect.
- Persist availability through the existing vehicle repository/Prisma boundary; PostgreSQL remains authoritative.
- Add focused presence tests for authentication, ownership, online/offline transitions, disconnect cleanup, and idempotent repeated events.
- Do not add or change ride routes, pool behavior, fare logic, vehicle CRUD contracts, or an HTTP logout endpoint.

## Capabilities

### New Capabilities

- `driver-vehicle-presence`: Synchronizes a driver's owned vehicle availability with an authenticated Socket.IO presence session.

### Modified Capabilities

<!-- No existing capability requirement is changed. The new presence contract is isolated to the driver vehicle availability lifecycle. -->

## Impact

- A new Socket.IO dependency and server adapter in the existing backend startup path.
- A small driver-presence module and repository operation that updates only `Vehicle.availability` for the authenticated driver's owned vehicle.
- Socket events for connection, explicit offline/logout, and disconnect; no REST API contract changes.
- Tests and configuration/documentation for the Socket.IO connection contract. No database migration is expected because `VehicleAvailability` already exists.
