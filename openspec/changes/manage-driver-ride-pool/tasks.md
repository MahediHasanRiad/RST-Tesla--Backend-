# Tasks

## 1. Driver route structure

- [x] 1.1 Create the dedicated driver feature router mounted at `/api/v1/drivers`, apply `requireAuth` and `asyncHandler`, and verify the router is reachable through the application composition test.
- [x] 1.2 Wire `POST /api/v1/drivers/open-pool` and `POST /api/v1/drivers/close-pool` using the existing strict validators and response/error conventions; verify route registration exposes exactly the new paths.
- [x] 1.3 Remove the old `/api/v1/ride-requests/open-pool` and `/api/v1/ride-requests/close-pool` registrations and update in-repository callers/tests to the new paths; verify no stale route references remain with `rg`.

## 2. Pool action behavior

- [x] 2.1 Relocate or reuse the existing open-pool controller in the driver feature without duplicating Prisma access, preserving authenticated-driver ownership, zone/route validation, online-vehicle checks, and the active-pool conflict; verify success and failure controller tests pass.
- [x] 2.2 Relocate or reuse the existing close-pool controller in the driver feature, preserving repository ownership checks, atomic `OPEN` → `CLOSE` transition, assigned-request preservation, and standard errors; verify ownership/state tests pass.
- [x] 2.3 Preserve post-commit discovery-cache version invalidation through the configured Redis abstraction and safe warning logging; verify a Redis failure still returns a successful close response and leaves PostgreSQL state closed.

## 3. Verification and contract updates

- [x] 3.1 Add or update focused tests for driver authorization, strict unknown-field rejection, invalid zones/routes, duplicate active pools, successful open/close, foreign/closed/unknown pools, and old-route absence; verify the relevant test files pass.
- [x] 3.2 Update API documentation or route references to describe the dedicated driver pool endpoints and the breaking route move; verify documentation contains both new paths and no obsolete mutation paths.
- [x] 3.3 Run the full project checks with `npm run check` and `npm run build`, then inspect the diff for unintended route duplication, generated artifacts, or secrets; verify both commands succeed and the diff is scoped to this change.
