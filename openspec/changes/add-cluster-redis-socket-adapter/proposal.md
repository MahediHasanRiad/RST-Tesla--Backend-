# Proposal

## Why

The backend currently runs as a single Node.js process, and Socket.IO presence state is local to that process. Using Node cluster workers with a Redis-backed Socket.IO adapter will allow the runtime to use multiple CPU cores while keeping real-time events and driver presence connections coordinated across workers.

## What Changes

- Add a clustered Node.js startup mode using one primary process and worker processes.
- Configure the worker count as `available CPU cores - 1`, with an environment override and a safe minimum of one worker.
- Add Socket.IO sticky-session routing so a client remains associated with the worker that owns its connection.
- Add the Socket.IO Redis adapter using the existing `REDIS_URL` and separate pub/sub connections through the existing Redis infrastructure boundary.
- Preserve the existing HTTP, REST, Socket.IO event, authentication, and vehicle-availability contracts.
- Keep all existing route paths and route behavior unchanged.
- Add worker lifecycle handling, shutdown coordination, adapter connection failure handling, and focused runtime tests/documentation.

## Capabilities

### New Capabilities

- `clustered-realtime-runtime`: Runs the backend across Node.js workers while preserving Socket.IO connection affinity and cross-worker event delivery.

### Modified Capabilities

<!-- No existing route or domain capability requirements are changed. -->

## Impact

- Node.js startup/bootstrap and process lifecycle handling.
- Socket.IO server initialization and the existing driver-presence runtime.
- Redis infrastructure configuration and pub/sub connections using `REDIS_URL`.
- New runtime dependencies for Socket.IO clustering/sticky sessions and Redis adapter support.
- Environment documentation and focused tests. No database migration, route change, controller change, or repository domain behavior change is planned.
