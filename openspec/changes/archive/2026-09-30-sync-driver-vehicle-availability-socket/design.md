# Design

## Context

The backend currently starts Express with `app.listen`, authenticates HTTP requests from the access-token cookie or bearer token, and stores `Vehicle.availability` in PostgreSQL through `VehicleRepository`. Vehicle discovery already filters on the authoritative `ONLINE` value. There is no Socket.IO integration or HTTP logout endpoint. See `proposal.md` and the driver-vehicle-presence spec for the external behavior.

## Goals / Non-Goals

**Goals:**

- Attach a Socket.IO server to the existing HTTP server with a small, authenticated driver-presence namespace or event boundary.
- Reuse access-token verification and the vehicle repository; derive driver and vehicle ownership exclusively from the authenticated token.
- Persist online/offline transitions in PostgreSQL and handle disconnect cleanup safely for multiple sockets from one driver.
- Keep the change isolated to real-time presence, availability persistence, tests, and the required dependency/configuration documentation.

**Non-Goals:**

- No HTTP logout endpoint, login response redesign, ride/pool changes, vehicle schema migration, availability CRUD redesign, Redis presence source of truth, or frontend implementation.

## Decisions

### Attach Socket.IO to the existing HTTP server

Use Node's `http.createServer(buildApp())` in the existing startup path and attach Socket.IO to that server. This is required for Socket.IO upgrades and avoids creating a second listening port or changing the Express route surface. A separate real-time service is rejected because it would add infrastructure and coordination outside the requested scope.

### Authenticate the handshake with the existing access token

Accept the access token from the Socket.IO handshake auth payload, with the same bearer-token semantics already used by HTTP authentication. Verify it with `AuthCredentials`, load the user, and require the `DRIVER` role before accepting the socket. Do not accept a client-provided driver ID or vehicle ID.

### Use explicit presence events plus disconnect cleanup

On accepted connection, mark the driver's owned vehicle `ONLINE`. Define `driver:offline` and `driver:logout` events; both mark the owned vehicle `OFFLINE`, acknowledge success, and make logout disconnect the socket. On disconnect, mark the vehicle offline only when no other active socket for that driver remains. Track active socket IDs by driver in process memory; this is ephemeral connection state, while PostgreSQL remains authoritative for vehicle availability.

### Extend the existing vehicle repository narrowly

Add a repository operation that updates availability by authenticated driver ownership. The socket layer coordinates events and calls this operation; it does not access Prisma directly. Do not reuse the client-controlled vehicle update endpoint for presence because presence must not trust request body fields or expose unrelated vehicle mutation behavior.

### Keep availability transitions idempotent and failure-safe

Repeated connect/offline/disconnect events may result in the same availability value and must not produce cross-driver writes. Repository failures use existing logger conventions; disconnect cleanup is best-effort because the socket is already gone, while explicit online/offline event failures receive an acknowledgement error. No Redis state is needed for the baseline single-process presence tracker.

## Risks / Trade-offs

- **[Risk]** In-memory socket tracking does not coordinate across multiple API instances → **Mitigation:** keep the baseline deployment single-process as the current server has no Socket.IO adapter; document that a future horizontally scaled deployment requires a shared adapter and liveness policy.
- **[Risk]** Abrupt network loss may delay or miss a disconnect transition → **Mitigation:** configure Socket.IO heartbeat timeouts and keep PostgreSQL as the final availability state; a reconnect restores `ONLINE`.
- **[Risk]** A driver can have multiple tabs or devices → **Mitigation:** track socket IDs per authenticated driver and only mark `OFFLINE` after the final socket disconnects.
- **[Risk]** Existing vehicle availability can be manually changed through vehicle CRUD → **Mitigation:** presence owns only connection-driven transitions; do not alter existing CRUD contracts in this change.

## Migration Plan

1. Add the Socket.IO dependency and attach it to the existing HTTP server startup.
2. Add the driver-presence handler and ownership-scoped repository update.
3. Add focused unit/integration tests for handshake authorization, transitions, disconnects, multiple sockets, and failure handling.
4. Document the handshake auth payload and event names for clients.
5. Roll back by removing the Socket.IO startup/handler and repository operation; no database migration or persisted-data rollback is required.
