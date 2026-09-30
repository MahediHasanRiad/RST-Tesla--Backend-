# Proposal

## Why

After a driver accepts or rejects a ride, the passenger currently needs to poll or make another API request to learn about the persisted status transition. Direct Socket.IO updates will let connected clients receive `MATCHED` or `CANCELLED` immediately.

## What Changes

- Define a real-time ride-status event containing the ride request identifier and authoritative status data.
- Emit `MATCHED` after the existing driver acceptance transaction successfully commits.
- Treat the existing `cancel` flow as driver rejection for a pending ride and emit `CANCELLED` after its transaction successfully commits.
- Allow authenticated passenger sockets on the existing Socket.IO server and target updates to the passenger who owns the ride request.
- Keep the existing accept/cancel routes, response shapes, and database lifecycle rules unchanged.

## Capabilities

### New Capabilities

- `ride-status-realtime-updates`: Deliver authorized, post-commit ride status changes to the associated passenger over Socket.IO.

### Modified Capabilities

<!-- No existing capability requirements are modified. -->

## Impact

- Affected code: existing ride accept/cancel controller integration, direct Socket.IO emission, and focused controller/socket tests.
- New client contract: authenticated passenger Socket.IO connections receive the `ride:status-updated` event.
- Existing HTTP routes, PostgreSQL persistence, cluster configuration, and Redis adapter behavior remain unchanged.
