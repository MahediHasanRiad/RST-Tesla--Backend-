# Design

## Context

See `proposal.md` for motivation. The current implementation persists `OtpChallenge` rows in PostgreSQL and separately writes an unauthoritative Redis value. Verification and password reset consume PostgreSQL state, while registration and resend use inconsistent Redis keys.

## Goals / Non-Goals

**Goals:**

- Make Redis the single OTP store for email verification and password reset.
- Preserve purpose isolation, expiry, attempt limits, resend replacement, and single-use semantics.
- Prevent email leakage through Redis key names and prevent OTP leakage through logs.
- Remove the `OtpChallenge` Prisma model and its database dependencies.

**Non-Goals:**

- Moving user records, password hashes, refresh sessions, or rate-limit records out of PostgreSQL.
- Adding an OTP delivery queue or a PostgreSQL fallback when Redis is unavailable.
- Changing public request payloads for registration, resend verification, verification, forgot-password, or reset-password.

## Decisions

### Store one Redis record per purpose and normalized email

Use a key shaped as `auth:otp:<purpose>:<sha256(normalized-email)>`. Store a JSON or Redis-hash value containing the user ID, raw OTP, normalized email, remaining attempts, and issue metadata. Set the key expiry from `OTP_TTL_SECONDS`; do not use a second hard-coded TTL.

Hashing the email key component avoids exposing a customer email through Redis key inspection. The requested raw OTP storage keeps Redis consumption simple; the application MUST not log the OTP.

Alternative considered: key by random challenge ID. This requires carrying the challenge ID through client APIs or a secondary email lookup index, neither of which is needed for the current API.

### Atomically consume with Redis-side logic

Use a Lua script or equivalent Redis transaction that reads, validates, decrements attempts on mismatch, and deletes the key on success or exhaustion as one atomic operation. The caller receives only a safe success/failure/service-unavailable result and the user ID needed for the follow-on action.

Alternative considered: `GET` followed by `DEL`. It permits two concurrent requests to consume the same OTP.

### Make Redis failure explicit

Redis is no longer a cache for OTPs. Issuance or consumption failure returns `503` and logs request context without an OTP, key, password, or token. During registration, the user record may already exist if Redis fails after the user transaction; the user can use resend verification after Redis recovers.

Alternative considered: retain PostgreSQL fallback. It violates the requested Redis-only requirement and reintroduces divergent OTP state.

### Keep non-OTP authoritative state in PostgreSQL

Users, email verification state, password updates, sessions, and rate limiting remain PostgreSQL-backed. Remove only `OtpChallenge`, its user relation, `OtpPurpose` enum if no longer used, repository methods, and migrations/schema artifacts tied solely to OTP persistence.

## Risks / Trade-offs

- [Redis outage blocks OTP issuance and consumption] → Return `503`, retain retry-safe resend endpoints, monitor Redis connectivity, and document Redis as required authentication infrastructure.
- [Redis eviction loses an active OTP] → Use a protected Redis deployment with suitable memory policy; clients can request a resend.
- [Redis access exposes active raw OTPs] → Restrict Redis network and credential access, use TLS where supported, and retain only short TTL records.
- [Concurrent OTP submissions] → Use an atomic Redis-side consume operation.
- [Existing deployed `OtpChallenge` rows] → Remove the table in a forward migration only after the code no longer reads it; historical OTP rows are intentionally discarded because OTPs are short-lived secrets.

## Migration Plan

1. Add and test the Redis OTP store/consume abstraction while PostgreSQL OTP reads remain unchanged behind a controlled implementation boundary.
2. Switch all issue and consume flows to the Redis abstraction and verify no controller/repository path reads or writes `OtpChallenge`.
3. Apply a forward Prisma migration that removes `OtpChallenge`, its user relation, and unused enum values.
4. Deploy with Redis health monitoring; rollback code before the database migration if necessary. After the table is removed, rollback remains code-only and must continue using Redis.
