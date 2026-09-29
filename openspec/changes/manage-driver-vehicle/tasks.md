# Tasks

## 1. Vehicle feature foundation

- [x] 1.1 Create strict vehicle create/update Zod schemas for name, capacity, availability, and bounded HTTPS image URLs; verify focused validation tests reject unknown and unsafe input.
- [x] 1.2 Add Prisma-only repository operations to resolve the authenticated driver's profile and create, guarded-update, and guarded-delete its vehicle; verify duplicate, capacity, and pool-reference conflicts are distinguishable.

## 2. Driver vehicle API

- [x] 2.1 Implement create, update, and delete controllers that enforce driver ownership from `request.user` and return documented status codes; verify no request field can select another driver's vehicle.
- [x] 2.2 Register protected `POST`, `PATCH`, and `DELETE /api/v1/vehicles/me` routes and mount the feature under `/api/v1/vehicles`; verify all routes use `asyncHandler`.

## 3. Tests and validation

- [ ] 3.1 Add focused tests for validation, driver-only authorization, one-vehicle conflict, reserved-seat capacity conflict, and referenced-vehicle deletion conflict; verify the test suite passes.
- [ ] 3.2 Run `npm run check`, `npm run build`, and `npm test`; verify all commands pass or record unrelated failures.
