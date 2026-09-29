# Proposal

## Why

OTP records are currently duplicated between PostgreSQL and Redis, while verification consumes the PostgreSQL record. This creates conflicting lifecycle logic and does not meet the desired Redis-only OTP design.

## What Changes

- **BREAKING** Store email-verification and password-reset OTP state only in Redis; PostgreSQL will no longer create, update, or consume `OtpChallenge` records.
- Define Redis OTP keys, TTL, single-use consumption, attempt tracking, resend replacement, and purpose isolation.
- Update registration, resend verification, forgot-password, verify-email, and reset-password flows to issue and consume Redis OTPs.
- Remove the OTP challenge persistence model, repository methods, and related database migration/schema artifacts once no flow depends on them.
- Make Redis availability an explicit authentication dependency and return a safe service error when OTP state cannot be read or written.

## Capabilities

### New Capabilities

- `redis-otp-lifecycle`: Redis-backed issuance, resend, validation, attempt limiting, expiry, and single-use OTP behavior for authentication flows.

### Modified Capabilities

- None.

## Impact

- Affected code: auth controllers, authentication repository, Redis utility, OTP validation, and tests.
- Affected persistence: the `OtpChallenge` Prisma model and its database table will be removed after a migration plan that preserves deployability.
- Affected operations: Redis becomes required for OTP-based verification and password reset; a Redis outage prevents those flows rather than falling back to PostgreSQL.
