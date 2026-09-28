# Design

## Context

See [proposal.md](proposal.md) for the motivation. The current Fastify application exposes only health routes; Prisma has `User` with role, phone, and plaintext-named password field but no email or authentication records. Redis and BullMQ are available, while no authentication, hashing, token, testing, or Brevo SDK dependency is installed. The project architecture now places feature business logic in controllers and restricts Prisma access to repositories.

## Goals / Non-Goals

**Goals:**

- Add a cohesive `/api/v1/auth` feature and authentication middleware using the controller/repository layout.
- Make PostgreSQL authoritative for account verification, refresh-session revocation, OTP consumption, and lockout state.
- Use a BullMQ worker to deliver Brevo OTP email without delaying HTTP requests or exposing credentials or sensitive values in API responses or logs.
- Provide immediately testable behavior for public and protected authentication flows.

**Non-Goals:**

- Phone/SMS OTPs, social sign-in, MFA beyond the required email OTP flows, admin self-registration, driver-profile/vehicle onboarding, or a PostgreSQL email outbox.
- Storing access tokens server-side or using Redis as the authority for security state.

## Decisions

### Email is the login and OTP-delivery identity

Add a required, normalized, unique email field while retaining the existing unique phone field for the product profile. Login and recovery begin with email. This matches the requested Brevo email OTP flow; using the existing phone field for SMS would conflict with that request.

### Registration may include one Cloudinary avatar

Register accepts either strict JSON without an avatar or `multipart/form-data` with the same registration fields and one optional `avatar` file. Multer enforces one file, a 5 MiB limit, and an allowlist of JPEG, PNG, and WebP MIME types before the controller accepts it. The controller uploads the validated buffer to Cloudinary's `dhaka-tesla-pool/avatars` folder and persists only the resulting secure URL in `User.avatar`; no avatar-update endpoint is added in this change. Failed uploads prevent account creation and no Cloudinary credentials, provider errors, or untrusted filenames are returned to clients or logs.

### Use bcrypt for passwords with legacy verification compatibility

New registrations and password changes use bcrypt with a configured cost factor of 12. Existing Argon2 hashes remain verifiable during the transition; after a successful legacy verification, the controller upgrades the stored value to bcrypt through the repository. This avoids forcing existing users to reset passwords while making bcrypt the sole algorithm for newly persisted credentials.

### Registration creates the selected role's account record

Registration accepts only PASSENGER or DRIVER. A DRIVER registration creates the existing `Driver` profile in the same transaction as its user, but does not mark the driver operationally verified or create a vehicle. This preserves the selected role from registration while leaving driver onboarding and approval to later features. Accepting ADMIN, or allowing an arbitrary role change, is rejected.

### Persist hashed OTPs and refresh-session state in PostgreSQL

Introduce purpose-bound OTP records with account/email reference, hashed code, expiry, consumption time, and attempt/rate-limit metadata; introduce refresh-session records with a hashed token identifier, expiry, revoked time, and account reference. PostgreSQL provides durable single-use and revocation semantics. Redis can support transient rate-limit acceleration but is not the authority. Stateless refresh JWTs alone were rejected because logout and rotation-reuse detection require reliable revocation.

### Queue encrypted OTP payloads directly to BullMQ

Create and persist the hashed OTP challenge, then enqueue a BullMQ job containing an encrypted payload with the recipient email, OTP, and purpose. The worker decrypts this payload only in process, sends through Brevo, and uses BullMQ retry/backoff for transient failures. Job payloads never contain raw OTPs or recipient contact data, and no PostgreSQL email-outbox record or dispatcher is used. This keeps the request path fast and preserves retry of the same OTP without adding outbox storage; Redis remains retry infrastructure rather than the authority for authentication state.

### Use access JWTs plus opaque rotating refresh tokens

Sign short-lived access JWTs carrying only actor ID and role. Generate high-entropy opaque refresh values, store only their hashes, rotate them atomically, and revoke them on logout or credential change. This limits access-token blast radius and provides session revocation without retaining bearer values. Long-lived JWT refresh tokens were rejected because reliable single-use rotation is harder to enforce.

### Authenticate with bcrypt, current token libraries, and Brevo's supported transactional-email API

Use bcrypt for password hashing and a current JWT validation library, and use Brevo's transactional-email client or its documented API. Keep provider calls behind a narrowly scoped mail adapter and BullMQ worker. OTP generation and hashing happen before queueing; if delivery fails, BullMQ retries the same encrypted payload without changing the OTP. A custom cryptographic scheme or direct SMTP integration was rejected because it increases security and operational risk.

### Apply consistent public error and abuse policy

Use Zod schemas that reject unknown keys. Return 201 for registration, 200 for successful verification/login/refresh/password change/reset completion, 202 for password-reset requests, 401 for missing/invalid credentials, 409 for duplicate registration, and 429 for configured rate/lock limits. Login and recovery responses avoid account enumeration. OTP lifespan, resend window, verification-attempt cap, login failure threshold, lock duration, and token TTLs are environment-configured security settings with safe documented defaults.

## Risks / Trade-offs

- [Brevo delivery outage leaves users unable to complete verification or recovery] → return a retry-safe response, log provider failures without secrets, and allow controlled OTP resend after recovery.
- [Email delay can make OTPs inconvenient] → use a short configurable expiry and clear resend behavior; do not extend validity merely because delivery was delayed.
- [Redis or worker downtime delays delivery after the database transaction succeeds] → use BullMQ retry/backoff and alert on persistent failed jobs; clients can request a replacement OTP after the configured cooldown.
- [Repeated queue attempts send duplicate emails] → use a stable queue job ID per OTP challenge; duplicate delivery of the same still-valid OTP is harmless, while duplicate state transitions are forbidden.
- [Refresh-token theft remains possible before revocation] → hash persisted refresh values, rotate on every use, use short access-token TTLs, and revoke all sessions on password changes.
- [Password/OTP timing and response differences can leak account information] → use generic public authentication errors, uniform reset-request responses, and rate limits.
- [Schema migration affects the pre-existing User table] → migrate email and security data safely, generate Prisma client, and deploy only after required environment configuration is supplied.

## Migration Plan

1. Add dependencies and environment placeholders, including Cloudinary and Brevo credentials, an OTP payload-encryption key, multipart file-size limits, BullMQ worker configuration, and configurable security durations/thresholds; do not commit live secrets.
2. Apply a Prisma migration that adds email and authentication records. Existing users, if any, remain unable to log in until an email is populated and verified through a controlled migration/admin process.
3. Deploy the auth routes and email worker after Redis and Brevo configuration are verified in the target environment.
4. Roll back application code by disabling auth routes; retain the additive security tables and fields rather than deleting account/security history. Revoke active refresh sessions if a credential-signing secret is rotated.
