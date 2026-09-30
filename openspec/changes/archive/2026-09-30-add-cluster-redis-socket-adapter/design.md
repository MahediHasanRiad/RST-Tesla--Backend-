# Design

## Context

The backend currently starts a single Express application and attaches Socket.IO to one HTTP server. Driver presence is tracked in PostgreSQL, while Redis is already configured through `src/lib/redis.ts` for non-authoritative infrastructure. The requested change is runtime-only: the existing REST routes and domain behavior must remain unchanged.

## Goals / Non-Goals

**Goals:**

- Run one Node.js primary and `max(1, available CPU cores - 1)` workers.
- Keep the existing HTTP port and Express route composition.
- Add Socket.IO sticky-session routing for connection affinity.
- Add Socket.IO Redis pub/sub synchronization using the existing `REDIS_URL`.
- Coordinate worker replacement and graceful shutdown without duplicating domain initialization in the primary.

**Non-Goals:**

- No REST route, controller, validation, response, Prisma schema, ride, pool, fare, or authorization changes.
- No Redis source-of-truth behavior for vehicle availability or ride-pooling decisions.
- No redesign of the existing driver-presence event names or client handshake.
- No multi-host deployment or load-balancer configuration beyond the in-process sticky-session boundary.

## Decisions

### Use a primary/worker cluster entrypoint

The primary process owns worker lifecycle and does not initialize Express, Prisma, Redis domain clients, or Socket.IO application handlers. Workers initialize the existing application and listen through the shared server handle. The default worker count is `max(1, available CPU cores - 1)`; an optional `CLUSTER_WORKERS` override may be retained for local testing and constrained environments. A one-worker minimum avoids a nonfunctional single-core deployment.

Using one process per container was considered, but it would not satisfy the requested Node cluster behavior. A separate process manager was rejected because it would add deployment-specific orchestration outside the backend.

### Use Socket.IO sticky sessions with the existing HTTP server

Use Socket.IO's sticky-session support around the cluster's shared HTTP server so polling handshakes and upgraded connections remain associated with one worker. The existing Socket.IO server options, handshake auth, and driver-presence events remain unchanged. Forcing WebSocket-only transport was considered, but sticky sessions preserve compatibility with the current default transport negotiation.

### Use the Socket.IO Redis adapter with dedicated pub/sub clients

Create independent Redis publisher and subscriber connections from the existing `REDIS_URL` configuration and pass them to the Socket.IO Redis adapter. Do not reuse the single command-oriented Redis client for pub/sub because subscription mode changes its command behavior. Keep these connections behind the existing Redis infrastructure boundary and close them during worker shutdown.

### Treat Redis adapter failure as infrastructure degradation

Redis remains non-authoritative for domain state. Adapter connection errors are logged safely, but the process continues with local-worker Socket.IO behavior when Redis pub/sub is unavailable. Cross-worker event delivery is degraded until Redis recovers; REST behavior, PostgreSQL state, and worker lifecycle remain available. The task list includes a focused test for this policy.

### Keep route composition in the worker application

Workers continue to call the existing `buildApp()` and route modules exactly once. The primary never calls `buildApp()`. This prevents duplicate route registration and keeps the change isolated from the API surface.

## Risks / Trade-offs

- **[Risk]** Sticky sessions are required for Socket.IO polling handshakes and must also be preserved by any external load balancer → **Mitigation:** document the in-process requirement and verify connection affinity in tests.
- **[Risk]** Redis pub/sub outages interrupt cross-worker event delivery → **Mitigation:** log adapter health failures, preserve PostgreSQL authority, and apply the documented startup/runtime degradation policy.
- **[Risk]** Worker replacement can create transient connection loss → **Mitigation:** use graceful shutdown, allow clients to reconnect, and test unexpected worker exit handling.
- **[Risk]** Each worker creates its own database and Redis clients → **Mitigation:** initialize infrastructure only in workers and close all clients during worker shutdown.

## Migration Plan

1. Add cluster/sticky-session and Socket.IO Redis-adapter dependencies.
2. Split startup into primary lifecycle and worker application initialization while preserving the existing port and route composition.
3. Configure dedicated Redis pub/sub clients and attach the adapter to the existing Socket.IO server.
4. Add environment/documentation guidance and focused runtime tests.
5. Roll back by returning to the existing single-process `server.ts`; no database migration or REST route rollback is required.
