# Tasks

## 1. Redis OTP foundation

- [x] 1.1 Add a Redis OTP store abstraction with purpose-scoped, hashed-email keys and configured TTL; verify unit tests cover issuance and same-purpose replacement.
- [x] 1.2 Implement atomic Redis OTP consumption with raw OTP comparison, attempt decrement, exhaustion deletion, and single-use deletion; verify concurrent-consumption and attempt-limit tests pass.
- [x] 1.3 Add safe Redis-unavailable error handling and structured logs without OTPs, keys, passwords, or tokens; verify issuance and consumption return `503` in Redis-failure tests.

## 2. Authentication flow migration

- [x] 2.1 Update registration to create the user transactionally and issue its email-verification OTP only through the Redis abstraction; verify registration creates no `OtpChallenge` record.
- [x] 2.2 Update resend verification and forgot-password flows to issue purpose-isolated Redis OTPs while preserving account-enumeration and rate-limit behavior; verify focused controller/service tests.
- [x] 2.3 Update email verification and password reset to consume Redis OTPs atomically before changing PostgreSQL user state; verify valid, expired, invalid, exhausted, and replay OTP scenarios.

## 3. Persistent OTP removal

- [x] 3.1 Remove `OtpChallenge` repository methods, Prisma model/relation, and unused OTP enum references after all flow migrations; verify Prisma generation and TypeScript checks pass.
- [x] 3.2 Create and apply a forward migration that removes the OTP challenge table and related constraints/indexes; verify migration deploy/status succeeds against a populated-compatible database.

## 4. Validation and documentation

- [x] 4.1 Update architecture documentation and environment guidance to state that Redis is required for OTP flows and PostgreSQL holds no OTP state; verify documentation matches the deployed behavior.
- [x] 4.2 Run `npm test`, `npm run check`, and `npm run build`; verify all OTP lifecycle tests and project checks pass.
