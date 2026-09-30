# Tasks

## 1. Clustered startup

- [x] 1.1 Add the Node cluster/sticky-session and Socket.IO Redis-adapter dependencies, then verify the lockfile and `npm install` remain consistent.
- [x] 1.2 Split startup into a primary process and worker initialization with `max(1, available CPU cores - 1)` workers and an optional test/deployment override; verify single-core and multi-core worker-count tests pass.
- [x] 1.3 Add worker replacement and graceful primary/worker shutdown handling; verify an unexpected worker exit is replaced and shutdown closes HTTP, Socket.IO, PostgreSQL, and Redis resources.

## 2. Sticky Socket.IO and Redis adapter

- [x] 2.1 Attach Socket.IO sticky-session routing to the existing HTTP server without changing the existing Socket.IO handshake or event names; verify the current driver-presence tests still pass.
- [x] 2.2 Create dedicated Redis publisher/subscriber connections from the existing `REDIS_URL` through the configured Redis infrastructure boundary, and attach the Socket.IO Redis adapter; verify cross-worker event propagation with focused tests.
- [x] 2.3 Implement the selected Redis degradation policy: log safe adapter failures and keep local-worker Socket.IO behavior available without changing PostgreSQL or REST behavior; verify Redis-unavailable tests pass.
- [x] 2.4 Ensure workers initialize the application and route composition exactly once while the primary does not register routes; verify the REST route inventory remains unchanged.

## 3. Documentation and verification

- [x] 3.1 Document worker-count configuration, sticky-session requirements, Redis adapter configuration, and local-worker degradation behavior without documenting or changing new REST routes; verify the documentation is accurate.
- [x] 3.2 Run focused cluster, Socket.IO, and route-inventory tests, then run `npm run check` and `npm run build`; inspect the diff for unrelated route/domain changes, secrets, and generated artifacts.
