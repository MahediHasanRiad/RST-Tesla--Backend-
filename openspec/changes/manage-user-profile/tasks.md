# Tasks

## 1. Persistence and deletion safety

- [x] 1.1 Update the Prisma schema and create a migration that permits historical completed/cancelled ride and status records to outlive a deleted user without retaining a live account reference; verify migration applies to a populated development database.
- [ ] 1.2 Add repository operations for response-safe self-profile lookup/update, phone-conflict lookup, active passenger/driver responsibility checks, and transactional account deletion; verify repository tests cover both passenger and driver history.
- [x] 1.3 Add reliable avatar public-ID persistence or derivation required for replacement and deletion cleanup; verify existing and replacement avatar assets can be identified without exposing provider secrets.

## 2. User profile API

- [ ] 2.1 Create strict Zod schemas and multipart handling for self-profile read/update and delete-confirmation input, allowing only name, phone, and a single supported avatar; verify malformed, unexpected, oversized, and duplicate-phone inputs receive the documented errors.
- [x] 2.2 Implement the user controller, service, repository, and protected `/api/v1/users/me` GET and PATCH routes using only middleware-derived actor identity; verify profile responses exclude password hashes and session credentials.
- [x] 2.3 Implement protected `DELETE /api/v1/users/me` with current-password confirmation, transactionally enforced active-ride/pool conflict checks, session removal, account deletion, and post-commit avatar cleanup; verify successful deletion returns 204 and leaves no usable session.

## 3. Tests and validation

- [ ] 3.1 Add focused API/service tests for owner-only profile access, permitted updates, duplicate phone conflict, invalid input, and secret-free responses; verify the new test suite passes.
- [ ] 3.2 Add deletion tests for invalid credentials, missing authentication, active passenger and driver conflicts, successful permanent deletion, historical ride/payment/lifecycle retention, and failed avatar cleanup logging; verify all scenarios pass.
- [x] 3.3 Run `npm run check`, `npm run build`, and the relevant test command; verify all pass and OpenSpec task completion can be updated with the results.
