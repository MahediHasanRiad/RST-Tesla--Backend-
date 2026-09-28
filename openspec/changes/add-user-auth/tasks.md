# Tasks

## 1. Authentication foundation

- [x] 1.1 Add bcrypt password hashing, JWT, Express and Multer, Cloudinary, Brevo, and TypeScript test dependencies; verify the lockfile installs cleanly and the test command executes.
- [ ] 1.2 Extend environment validation, `.env.example`, and Docker configuration with safe Cloudinary, Brevo, JWT, OTP-encryption, multipart-limit, BullMQ worker, and rate-limit placeholders; verify production configuration rejects missing required secrets without printing them.
- [ ] 1.3 Add the email, verification, lockout, OTP-challenge, and refresh-session Prisma schema; create and apply a migration and regenerate Prisma client, verifying `prisma generate` succeeds without hand-editing generated files.

## 2. Auth feature and secure email delivery

- [ ] 2.1 Create strict Zod request schemas and response models for all `/api/v1/auth` endpoints, including JSON and multipart registration; verify unknown fields, ADMIN registration, invalid email/phone, weak passwords, unsafe avatar MIME types, oversized avatars, and extra uploads are rejected.
- [ ] 2.2 Implement auth repository methods as the exclusive Prisma access layer for users, avatar persistence, driver-profile creation, OTP atomic consumption, session rotation/revocation, password updates, and lockout state; verify repository tests cover transaction failure and one-time OTP behavior.
- [ ] 2.3 Implement bcrypt password, OTP, token, payload-encryption, Cloudinary upload, and Brevo mail helpers so passwords, OTPs, and refresh values are never persisted or logged in plaintext; verify mocked providers receive only required values while API responses and logs do not.
- [ ] 2.4 Implement the BullMQ OTP-email queue and retrying worker so jobs carry only an encrypted delivery payload and transient Brevo failures retry the same OTP; verify a mocked provider failure is retried without raw OTP/contact data in queue payloads.
- [ ] 2.5 Implement controller-owned JSON/multipart registration with optional Cloudinary avatar, verification/resend, login, refresh, logout, forgotten-password, reset-password, and authenticated password-change rules that create OTPs and encrypted queue jobs; verify endpoint tests cover all specified success and failure statuses without waiting for Brevo.
- [ ] 2.6 Register the versioned auth routes and implement access-token middleware that attaches only credential-derived actor identity and role; verify a protected test route rejects missing, expired, tampered, refresh, and revoked tokens.

## 3. Abuse resistance and session safety

- [ ] 3.1 Enforce configured OTP expiry, single use, attempt caps, resend cooldowns, and identity/IP rate limits with PostgreSQL as the durable authority; verify expired, reused, purpose-mismatched, and throttled OTP cases cannot alter account state.
- [ ] 3.2 Enforce generic login and password-recovery errors, failed-login counters, temporary lockout, and successful-login counter reset; verify an unknown email and known email receive equivalent recovery responses and lockout blocks valid credentials until expiry.
- [ ] 3.3 Atomically rotate refresh credentials, detect replay, revoke sessions on logout and password changes, and reject access tokens tied to revoked sessions; verify old refresh-token reuse and post-logout protected access both fail.
- [ ] 3.4 Test queue retry/backoff after transient Brevo failure, stable job IDs, and unchanged OTP/account state; verify retried jobs preserve the same OTP without exposing raw delivery data.

## 4. Verification and handoff

- [ ] 4.1 Add focused integration tests for passenger and driver registration, queued email verification, login, token rotation, logout, password reset, password change, ownership derivation, queue retries, and security-safe logs; verify the full authentication test suite passes.
- [ ] 4.2 Run `npm run check` and `npm run build`; verify both complete successfully and record any required Brevo sandbox/manual configuration in the README or deployment notes.
