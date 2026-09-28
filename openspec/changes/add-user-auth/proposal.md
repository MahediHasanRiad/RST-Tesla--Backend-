# Proposal

## Why

The API has a user model but no authentication surface, so protected ride-pooling actions cannot establish an authenticated passenger or driver. Email verification, secure credential recovery, and revocable sessions are needed before those endpoints are exposed.

## What Changes

- Add email/password registration for passenger and driver roles, with a unique email address, optional Cloudinary-hosted avatar, and mandatory Brevo email OTP verification before login.
- Queue email OTP delivery through BullMQ so request handling remains responsive and provider failures can be retried.
- Add login, short-lived JWT access tokens, refresh-token rotation, logout, and protected-request actor derivation.
- Add authenticated password change plus OTP-verified forgotten-password reset.
- Add expiration, single-use OTPs, delivery and verification rate limits, and temporary account lockout for repeated failed authentication attempts.
- Add validation, consistent error responses, structured security-safe logging, configuration placeholders, and focused authentication tests.

## Capabilities

### New Capabilities

- `user-auth`: Authenticates verified passenger and driver accounts, manages their sessions, and provides secure password recovery.

### Modified Capabilities

- None.

## Impact

- Affected code: a new `/api/v1/auth` feature, authentication middleware, route registration, validation, and tests.
- Data: `User` gains a unique email and verification/security state; persistent OTP and refresh-session records support verification, recovery, and revocation.
- Dependencies/configuration: bcrypt password hashing, JWT signing/verification, Express and Multer parsing, Cloudinary avatar storage, BullMQ email workers, and Brevo transactional email support; safe environment placeholders for Cloudinary, Brevo, and token settings.
- API: new registration, OTP, login, token-refresh, logout, password-change, and password-reset endpoints.
