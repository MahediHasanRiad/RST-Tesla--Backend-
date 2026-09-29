# Design

## Context

See `proposal.md` and the `driver-vehicle-management` delta spec. The Prisma schema already has a one-to-one `Driver`–`Vehicle` relationship through unique `Vehicle.driverId`, and `RidePool` references the vehicle. There is no vehicle feature module today. The existing API derives an authenticated user from middleware, uses strict Zod schemas, uses repositories as the only Prisma layer, and returns consistent success/error HTTP responses.

## Goals / Non-Goals

**Goals:**

- Add exactly three authenticated driver-owned vehicle mutations with no caller-provided ownership ID.
- Preserve the database's one-vehicle-per-driver and pool reference integrity.
- Prevent vehicle configuration changes from violating existing active pool reservations.

**Non-Goals:**

- Vehicle read/list endpoints, vehicle-document storage, vehicle assignment transfer, or administrative vehicle management.
- Creating, updating, or deleting ride pools.
- Schema or migration changes; the existing relation and `images` URL field are sufficient for this API.

## Decisions

### Use a self-owned resource path

Expose `POST`, `PATCH`, and `DELETE /api/v1/vehicles/me`. Controllers obtain the actor ID and role from `request.user`, look up the linked driver profile in the repository, and never authorize from body or path IDs. This makes all three operations owner-scoped and avoids a general vehicle-ID mutation surface. A `:vehicleId` route was rejected because it adds an avoidable IDOR authorization risk for a one-vehicle-per-driver model.

### Keep the existing schema as the source of truth

The repository will create, update, and delete through the existing `Vehicle.driverId` relation. It will translate Prisma's unique constraint into the documented 409 create conflict and use a transaction for capacity-sensitive update checks. No migration is needed because `driverId` is already unique and `RidePool.vehicleId` already protects referenced records.

### Validate configuration against MVP limits

The feature validation module will use strict schemas: a trimmed bounded name, an integer capacity in the one-to-three Tesla seat range, the persisted `ONLINE`/`OFFLINE` availability enum, and a bounded collection of HTTPS image URLs. Update payloads require at least one writable field. The current schema stores URLs only; it does not authorize an external storage upload flow, so accepting raw image files or arbitrary provider data is out of scope.

### Preserve pool capacity and history

Before reducing capacity, the repository will check active pools for the vehicle and reject when the new capacity is less than the greatest reserved-seat count. Vehicle deletion will reject when any pool references the vehicle, including completed history, because the present foreign key does not support preserving pools after deletion. This conservative rule preserves lifecycle, fare, and capacity records without a schema migration. Allowing deletion with historical pool records was rejected because it would require an explicit history-preserving schema redesign.

## Risks / Trade-offs

- [A capacity update races a reservation] → Perform the update eligibility check and vehicle update in one PostgreSQL transaction with the vehicle row locked; future reservation logic must lock the same row.
- [A valid driver account lacks a linked driver profile] → Return 404 rather than creating an inferred profile, avoiding an implicit role-data repair operation.
- [Image URLs point to inaccessible or later-removed content] → Validate URL format and limit count; durable vehicle-media hosting is a separate feature.
- [Deletion is stricter than only blocking active pools] → Retaining vehicles with historical pools is necessary under the current foreign key; a later retention migration can relax this deliberately.

## Migration Plan

1. Deploy the new feature without a database migration because the required relations and enum already exist.
2. Validate authorization, unique-vehicle conflicts, capacity conflicts, and referenced-vehicle deletion behavior in focused tests.
3. Roll back by removing route registration; no data transformation is required. Existing vehicles remain intact.
