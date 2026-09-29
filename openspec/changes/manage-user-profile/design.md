# Design

## Context

See `proposal.md` and the `user-profile-management` delta spec for motivation and behavior. The current `User` model owns authentication fields and is referenced by passenger ride requests and status history with restrictive foreign keys. Driver and vehicle records are also transitively required by pool history. Refresh sessions already cascade from `User`; avatar storage is handled through the shared Cloudinary helper.

## Goals / Non-Goals

**Goals:**

- Add a protected self-service `/api/v1/users/me` resource for profile read, profile update, and permanent account deletion.
- Keep account identity exclusively credential-derived, validate all writable input with strict Zod schemas, and keep secrets out of responses and logs.
- Permanently remove the `User` record and personally identifying account data without corrupting completed or cancelled ride, payment, and lifecycle records.
- Prevent deletion from racing with or invalidating active ride and pool responsibilities.

**Non-Goals:**

- Changing email address, role, password, driver credentials, vehicle details, or ride history through profile update.
- Deleting fare, payment, completed/cancelled ride, pool, or lifecycle-history records.
- Allowing administrative deletion of another user's account.

## Decisions

### Use one authenticated self resource

Expose `GET /api/v1/users/me`, `PATCH /api/v1/users/me`, and `DELETE /api/v1/users/me`; the middleware-provided actor ID is the only account selector. `PATCH` accepts only `name`, `phone`, and one valid avatar upload. `DELETE` requires the caller's current password in addition to a valid access token.

This uses a familiar, least-privilege route contract and prevents both insecure actor IDs in payloads and accidental deletion from a stolen access token. Separate path parameters or a general user-administration resource would broaden authorization scope; email and password changes already belong to authentication flows and require their own verification/revocation rules.

### Preserve operational history while removing the account

Before deletion, execute a PostgreSQL transaction that locks or otherwise serializes against the user's active passenger requests and, for drivers, active pools reached through their driver/vehicle records. Active means any lifecycle state other than `COMPLETED` or `CANCELLED`; return 409 when one exists.

The migration will make historical actor references nullable and use `SET NULL` for user-to-ride-request and user-to-status-history relations. It will detach a historical driver profile from the deleted user while retaining the non-personal driver/vehicle/pool records needed by completed and cancelled trips. The transaction deletes refresh sessions and the `User` record only after these checks and relation changes are valid. Avatar media cleanup occurs after successful database deletion; a cleanup failure is logged with request/actor context for retry or remediation without restoring the deleted account.

Hard-deleting all dependent trip data was rejected because it would destroy fare and lifecycle truth. Rejecting every account that has any history was rejected because it makes permanent deletion unusable for most real users.

### Keep persistence and side effects separated

Add a user feature module with validation, controller, service, repository, routes, and focused tests. The repository is the only Prisma caller and exposes atomic profile update and delete-precondition operations. The service owns authorization, password confirmation, active-state decisions, response-safe projection, and ordering of database versus Cloudinary cleanup. Controllers only parse/translate HTTP and attach request context to structured logs.

Existing avatar uploads return a URL, so the implementation must retain or reliably derive a provider public ID before replacing or deleting avatar media. If the current URL alone cannot safely identify the asset, add a persisted public-ID field with a migration rather than guessing from arbitrary URLs.

## Risks / Trade-offs

- [A new ride or pool assignment races account deletion] → Perform active-state checks and account deletion in one database transaction with the relevant row locks; capacity decisions remain in the ride service transaction.
- [Historical foreign keys block deletion] → Migrate only history-safe references to nullable `SET NULL`; test the migration against records with completed and cancelled rides.
- [Cloudinary cleanup fails after the database transaction] → Keep deletion authoritative in PostgreSQL, log only non-secret identifiers/context, and make cleanup retryable.
- [Old avatar media is orphaned on replacement] → Delete the previous asset only after a replacement profile update commits; log and retry failed cleanup.
- [Valid token theft causes irreversible action] → Require current-password confirmation for account deletion and remove all sessions as part of deletion.

## Migration Plan

1. Add the required nullable relations and `SET NULL` foreign-key behavior through a Prisma migration, preserving existing historical data.
2. Deploy the route and service with the migration; active ride/pool checks gate hard deletion from the first request.
3. Verify API behavior and migration tests, then monitor structured deletion and external-media cleanup failures.
4. Roll back application code without reversing the history-preserving relation migration. The migration is backward-compatible because existing non-null records remain valid; data deleted under the new feature is intentionally not recoverable.
