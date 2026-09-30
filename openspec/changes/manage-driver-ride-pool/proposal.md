# Proposal

## Why

Driver-owned ride-pool management currently lives under the passenger-oriented ride-request route. That blurs ownership boundaries and makes the API harder to understand as the driver workflow grows. A dedicated driver feature should own pool creation and closure while preserving the existing authorization, route validation, capacity, and PostgreSQL transaction guarantees.

## What Changes

- Add a dedicated authenticated driver route group for managing ride pools.
- Move the existing driver actions for opening and closing pools from the ride-request route to the driver route group.
- Keep vehicle ownership derived from `request.user`; reject passenger access and client-supplied driver/vehicle ownership fields.
- Preserve the existing open-pool validation, one-active-pool rule, close-state transition, cache invalidation, response helper, and error behavior.
- Treat the old ride-request pool-management routes as removed (**BREAKING**) unless an implementation decision explicitly adds temporary compatibility aliases.
- Add focused route/controller/repository tests for successful actions, validation, authorization, invalid state, and cache-failure tolerance.

## Capabilities

### New Capabilities

- `driver-ride-pool`: Authenticated drivers can open and close pools through the dedicated driver API surface.

### Modified Capabilities

- `ride-request-creation`: Move the documented driver pool-management endpoints out of the ride-request route namespace while retaining the underlying pool behavior and passenger discovery/join contract.

## Impact

- API routing and documentation under `src/api/v1` and `src/app.ts`.
- Driver pool controllers, validation, and repository wiring; existing ride-pool persistence remains authoritative in PostgreSQL.
- Redis discovery-cache invalidation after pool closure remains best-effort and non-authoritative.
- Existing ride-request tests and API consumers that call the old pool-management paths will need updated paths.
