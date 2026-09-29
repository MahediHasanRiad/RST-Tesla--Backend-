# Proposal

## Why

Drivers need to create and maintain the single vehicle that defines their pool capacity and availability. The schema already models this one-to-one relationship, but the API provides no driver-owned vehicle-management routes.

## What Changes

- Add protected driver-only routes to create, update, and delete the caller's vehicle: `POST`, `PATCH`, and `DELETE /api/v1/vehicles/me`.
- Derive the owning driver exclusively from the authenticated user; never accept a driver or vehicle ID as authorization input.
- Validate vehicle name, capacity, availability, and image URL input strictly. Capacity will be constrained to the product's three-seat Tesla maximum.
- Enforce the schema's one-vehicle-per-driver invariant with a conflict response on duplicate creation.
- Prevent a driver from lowering capacity below reserved seats or deleting a vehicle while it has an active pool, preserving capacity and lifecycle truth.

## Capabilities

### New Capabilities

- `driver-vehicle-management`: Authenticated drivers can safely create, update, and remove their own vehicle configuration.

### Modified Capabilities

- None.

## Impact

- Affected API: protected `/api/v1/vehicles/me` create, update, and delete contracts.
- Affected application layers: new vehicles feature routes, controllers, Zod validation, Prisma-only repository operations, app registration, and focused tests.
- Affected persistence: existing `Driver`–`Vehicle` one-to-one relation and pool references are used; no schema change is planned.
