# Design

## Context

Driver acceptance and the existing cancel/rejection flow are performed by authenticated HTTP controllers, while PostgreSQL commits the resulting status transition and records status history in one transaction. The existing worker already has a Socket.IO server available for realtime events.

## Goals / Non-Goals

**Goals:**

- Emit a stable ride-status event directly after a successful acceptance or rejection transaction.
- Keep the implementation limited to the existing accept/cancel routes and Socket.IO server.
- Authenticate passenger sockets through the existing Socket.IO authentication path and target events by authenticated user ID.
- Keep the existing HTTP routes and PostgreSQL lifecycle behavior unchanged.

**Non-Goals:**

- Moving ride status authority into Socket.IO.
- Replacing the existing ride-status/history HTTP APIs.
- Adding subscription rooms, new HTTP routes, or Redis/pub-sub behavior.
- Adding status events for lifecycle transitions other than driver acceptance and driver rejection in this change.

## Decisions

### Publish directly from the accept/cancel controllers after repository success

The repositories remain responsible for the transactions and return the changed request only after commit. The accept or cancel controller will call a small realtime publisher with the committed request ID and resulting status. Publishing failures will be logged and will not roll back or change the successful database result.

The publisher will use the existing worker's Socket.IO server instance and emit the minimal `ride:status-updated` payload directly to sockets whose authenticated user ID matches the ride passenger ID. No Redis calls, adapter changes, rooms, or new routes will be added for this feature.

### Reuse Socket.IO authentication for passenger sockets

The existing Socket.IO authentication will retain driver presence behavior and also accept authenticated passengers, recording the authenticated user ID on socket data. Passenger sockets will not receive driver presence handlers; they only remain available for targeted ride-status emissions.

### Define a minimal event contract

- Server update event: `ride:status-updated`
- Update payload: `{ rideRequestId, status: "MATCHED" | "CANCELLED" }`

The payload intentionally contains no fare, driver, vehicle, or location data. Clients can hydrate additional details from PostgreSQL-backed APIs.

### Test direct acceptance emission

Tests will cover passenger socket authentication, targeted post-commit emission for acceptance and rejection, no emission for failed decisions, direct Socket.IO payload shape, and publisher failure not changing the HTTP result.

## Risks / Trade-offs

- [Risk] A client is connected to another worker and does not receive a direct local emission → This intentionally remains out of scope for the one-route feature; the existing HTTP/status-history APIs remain authoritative recovery paths.
- [Risk] The passenger disconnects before the event is delivered → The persisted status and existing status/history APIs remain authoritative recovery paths.
- [Risk] Socket.IO is unavailable during acceptance → Log the delivery failure without rolling back the committed database transition or changing the HTTP response.

## Migration Plan

Deploy the server and client contract together. Existing HTTP acceptance clients continue to work unchanged. Clients that support realtime updates listen for `ride:status-updated` and use the event to refresh or update local state. Rollback requires only removing the direct emission; persisted ride status and the HTTP route remain compatible.
