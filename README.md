# Dhaka Tesla Pool API

TypeScript/Fastify backend boilerplate for the architecture in [`../docs/architecture.md`](../docs/architecture.md).

## Local setup

1. Copy `.env.example` to `.env` and choose a secure `JWT_SECRET` of at least 32 characters.
2. From the repository root, copy `.env.example` to `.env` and run `docker compose up -d postgres redis`.
3. In this directory, run `npm install`, then `npm run prisma:generate`.
4. Create the initial migration with `npm run prisma:migrate -- --name init`.
5. Start the API with `npm run dev`; `GET http://localhost:3001/health` returns `{ "status": "ok" }`.

Alternatively, from the repository root, run `docker compose up --build` to run the API with PostgreSQL and Redis. Create and apply the first migration before using database-backed endpoints.

`/health` is a liveness endpoint. `/ready` checks PostgreSQL and Redis; it is intended for deployment readiness checks.

Redis is for cacheable reads only. Booking capacity, memberships, fares, and lifecycle state must continue to use PostgreSQL transactions.

## Driver vehicle presence

After a driver signs in, the client opens the Socket.IO connection using the access token in the handshake auth payload:

```ts
io("http://localhost:3001", { auth: { accessToken } });
```

Only authenticated drivers with an owned vehicle are accepted. An accepted connection marks that vehicle `ONLINE`. Clients can emit `driver:offline` or `driver:logout` with an optional acknowledgement callback; both mark the owned vehicle `OFFLINE`, and logout closes the socket. An unexpected disconnect also marks the vehicle offline after the driver's final active presence socket disconnects. This is a real-time presence contract; it does not add an HTTP logout endpoint or change ride, pool, fare, or vehicle CRUD behavior.

## Ride requests and service zones

Supported pickup and destination locations are database-backed `ServiceZone` records. Seed the predefined Dhaka zones with:

```bash
npm run prisma:seed
```

Clients can discover zone IDs through `GET /api/v1/service-zones?limit=20&cursor=<opaque-cursor>`. The first request omits `cursor`; subsequent responses provide `nextCursor` while `hasNextPage` is true. Authenticated passengers create a fresh request with `POST /api/v1/ride-requests/fresh`:

```json
{
  "pickupZoneId": "uuid-of-mirpur-1",
  "destinationZoneId": "uuid-of-mirpur-10",
  "seats": 1,
  "enableRidePool": true,
  "vehicleId": "selected-vehicle-uuid",
  "weatherCondition": "CLEAR"
}
```

Before creating the request, passengers search available vehicles with `GET /api/v1/ride-requests/available-vehicles?pickupZoneId=<uuid>&destinationZoneId=<uuid>&seats=1`. The endpoint validates the requested route, then lists vehicles directly from PostgreSQL where `availability` is `ONLINE`; it returns the vehicle capacity and available seats. No `RidePool` is required for this discovery step. The passenger sends the selected `vehicleId` to the fresh request endpoint. With `enableRidePool: true`, the request joins the selected vehicle's existing matching `OPEN` pool atomically; with `false`, it creates a private `CLOSE` pool. Vehicle capacity and all seat reservations are resolved and enforced by PostgreSQL.

The server validates the directional Mirpur/Uttara corridor, reads coordinates from PostgreSQL, calculates Haversine distance, and returns a fare using a 5,000 paisa base plus 1,000 paisa per kilometer (10 BDT/km). `CLEAR` is the default weather condition; `RAIN` and `HEAVY_RAIN` apply server-controlled surcharges. Money is stored as integer paisa.

Authenticated passengers can discover available pools for a route with `GET /api/v1/ride-requests/list-of-ride-request?pickupZoneId=<uuid>&destinationZoneId=<uuid>&limit=20`. The endpoint validates both ServiceZone IDs and the directional corridor, then returns open online pools with available seats whose active requests continue to the requested destination. Pool discovery is a read-only view; joining a pool and reserving capacity remain separate PostgreSQL-authoritative operations.

Passengers can fetch one of their requests with `GET /api/v1/ride-requests/:rideRequestId`, inspect lifecycle history with `GET /api/v1/ride-requests/:rideRequestId/status-history`, and cancel eligible requests with `POST /api/v1/ride-requests/:rideRequestId/cancel`. Cancellation is allowed only before the request reaches `DRIVER_ARRIVED`.

Drivers can list requests assigned to their pools with `GET /api/v1/ride-requests/driver?cursor=<opaque-cursor>&limit=20`. Drivers can view completed history with `GET /api/v1/ride-requests/driver/completed?page=1&limit=20`, while passengers can view their own completed history with `GET /api/v1/ride-requests/completed?page=1&limit=20`. Completed-history endpoints use offset pagination; all three list endpoints use a 60-second Redis cache-aside and keep PostgreSQL authoritative.

Drivers open a directional pool with `POST /api/v1/drivers/open-pool`:

```json
{
  "pickupZoneId": "uuid-of-mirpur-1",
  "destinationZoneId": "uuid-of-mirpur-10"
}
```

The owning driver can stop accepting new passengers by closing the pool with `POST /api/v1/drivers/close-pool`:

```json
{ "poolId": "open-pool-uuid" }
```

Only the driver who owns the pool's vehicle can close it. Closing changes the pool from `OPEN` to `CLOSE`, removes it from future pool discovery and joins, and preserves ride requests already assigned to the pool.

The driver pool endpoints were moved from the ride-request namespace in this breaking API change; the former mutation paths are no longer registered.

Passengers opt into pooling when creating a request with `"enableRidePool": true` and their requested `seats`. After choosing a compatible pool, they join it with `POST /api/v1/ride-requests/:rideRequestId/join-pool` and `{ "poolId": "..." }`. The backend uses the stored request seat count and performs the capacity update in a PostgreSQL transaction.

The pool-owning driver accepts a pending request with `POST /api/v1/ride-requests/:rideRequestId/accept`. The passenger or pool-owning driver may submit a temporary counter fare with `POST /api/v1/ride-requests/:rideRequestId/counter-fare`:

```json
{ "farePaisa": 12000 }
```

Counter fares are stored in Redis with a bounded TTL and do not change ride status. When the driver accepts, the latest counter fare is written to PostgreSQL and the request becomes `MATCHED`. PostgreSQL remains authoritative for the final fare and lifecycle state.

Haversine distance is a straight-line MVP approximation and does not represent actual road distance. No paid maps or routing API is used.

List responses use cursor pagination with a maximum limit of 100. Public list pages use a 60-second Redis cache-aside TTL; Redis failures fall back to PostgreSQL, which remains authoritative.

## File storage

Supabase Storage is prepared for private profile photos, vehicle documents, and future ride attachments. Set `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, and `SUPABASE_STORAGE_BUCKET` in `backend/.env` before adding upload endpoints. The secret key is API-only; clients must receive signed URLs rather than storage credentials.
# RST-Tesla--Backend-
