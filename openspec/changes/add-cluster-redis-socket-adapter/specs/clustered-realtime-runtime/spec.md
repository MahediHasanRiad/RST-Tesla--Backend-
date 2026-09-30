# Spec Delta

## Purpose

Runs the Node.js backend across multiple CPU-aware worker processes while preserving Socket.IO connection affinity and cross-worker real-time event delivery through Redis, without changing the REST route surface.

## ADDED Requirements

### Requirement: Backend startup uses CPU-aware cluster workers

The system MUST start one Node.js primary process and a worker count equal to the available CPU core count minus one, with a minimum of one worker. The primary MUST coordinate worker creation, worker exit handling, and graceful shutdown. Workers MUST serve the existing Express and Socket.IO application on the existing configured port, and startup MUST NOT register duplicate REST routes.

#### Scenario: Backend starts on a multi-core host

- **WHEN** the backend starts on a host with more than one available CPU core
- **THEN** the primary starts the configured CPU-minus-one number of workers and the existing HTTP/Socket.IO server remains reachable on the configured port

#### Scenario: Backend starts on a single-core host

- **WHEN** the backend starts on a host with one available CPU core
- **THEN** the primary starts one worker and the backend remains operational without attempting to create zero workers

#### Scenario: Worker exits unexpectedly

- **WHEN** a worker exits unexpectedly while the primary is running
- **THEN** the primary records the failure and replaces the worker without changing REST route registration or application contracts

### Requirement: Socket.IO connections remain sticky across workers

The system MUST route a Socket.IO client consistently to the worker that owns its connection for the lifetime of that connection. Sticky-session routing MUST operate with the existing HTTP server and MUST preserve the current Socket.IO handshake and driver-presence events.

#### Scenario: Driver establishes a Socket.IO connection

- **WHEN** an authenticated driver connects through the configured Socket.IO endpoint
- **THEN** the connection is accepted by one worker and subsequent events for that connection are delivered to the same worker

#### Scenario: Existing Socket.IO presence behavior continues

- **WHEN** a driver emits the existing presence events through a clustered worker
- **THEN** the driver vehicle availability behavior remains unchanged from the single-process runtime

### Requirement: Socket.IO events synchronize through Redis

The system MUST configure a Socket.IO Redis adapter using the existing `REDIS_URL` configuration and dedicated pub/sub Redis connections. Events emitted from one worker MUST be deliverable to Socket.IO clients connected to another worker. Redis adapter traffic MUST remain ephemeral infrastructure and MUST NOT become the source of truth for vehicle availability, ride lifecycle, pool membership, capacity, fares, or authorization.

#### Scenario: Cross-worker Socket.IO event

- **WHEN** a worker emits a Socket.IO event for a room or client connected to another worker
- **THEN** the Redis adapter propagates the event and the connected client receives it once

#### Scenario: Redis adapter is unavailable

- **WHEN** Redis pub/sub connection fails during startup or runtime
- **THEN** the failure is logged with safe context, the process does not silently treat Redis as authoritative domain state, and the configured operational failure behavior is applied without changing REST routes

### Requirement: Cluster runtime preserves the existing API surface

The clustered runtime MUST NOT add, remove, rename, or alter any existing REST route, request validation contract, response shape, authentication rule, or domain repository behavior. Configuration and documentation changes MUST be limited to process scaling, sticky Socket.IO routing, and Redis adapter operation.

#### Scenario: REST route inventory remains unchanged

- **WHEN** the application starts in clustered mode
- **THEN** the registered REST route paths and methods match the pre-cluster runtime
