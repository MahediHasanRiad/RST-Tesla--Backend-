# Spec Delta

## Purpose

Provides verified email-based authentication and secure session management for passenger and driver accounts before they access protected ride-pooling resources.

## ADDED Requirements

### Requirement: Register a role-bearing account
The system SHALL register an account with a valid unique email address, unique phone number, name, password, and either the PASSENGER or DRIVER role. It MUST hash the password with bcrypt, record the account as unverified, and queue an email verification OTP delivery without returning credentials. Registration MAY include one optional avatar image, which the system stores in Cloudinary and persists as the account avatar URL. The public registration interface MUST reject ADMIN role selection and malformed or unknown input.

#### Scenario: Successful passenger registration
- **WHEN** a client submits valid unused passenger registration details
- **THEN** the system creates an unverified PASSENGER account, queues an email verification OTP delivery, and returns a 201 response without a password or token

#### Scenario: Successful driver registration
- **WHEN** a client submits valid unused driver registration details
- **THEN** the system creates an unverified DRIVER account and its driver profile, queues an email verification OTP delivery, and returns a 201 response without a password or token

#### Scenario: Duplicate identity registration
- **WHEN** a client submits an email address or phone number already held by an account
- **THEN** the system returns a 409 response and does not create another account

#### Scenario: Registration with a valid avatar
- **WHEN** a client submits valid registration data and one JPEG, PNG, or WebP avatar no larger than the configured limit
- **THEN** the system stores the image in Cloudinary, creates the account with the resulting secure avatar URL, queues verification email delivery, and returns 201 without exposing provider credentials

#### Scenario: Invalid registration avatar
- **WHEN** a client submits more than one file, an unsupported media type, an oversized file, or unexpected multipart fields
- **THEN** the system rejects the registration input with 400 and does not create an account

### Requirement: Verify and resend email OTPs
The system SHALL issue purpose-bound, expiring, single-use OTPs for email verification and password reset. It MUST verify an OTP only for its intended account and purpose, mark a matching account verified after a successful email-verification OTP, and allow an unverified account to request a replacement verification OTP. Expired, consumed, incorrect, or purpose-mismatched OTPs MUST not change account state.

#### Scenario: Successful email verification
- **WHEN** an unverified account submits its current valid email-verification OTP
- **THEN** the system marks the account verified, consumes the OTP, and returns a 200 response

#### Scenario: Expired OTP
- **WHEN** a client submits an expired verification or password-reset OTP
- **THEN** the system returns a validation or authorization error and leaves the account state unchanged

### Requirement: Deliver OTP emails through BullMQ and Brevo
The system SHALL enqueue verification and password-reset OTP email delivery to BullMQ after creating their purpose-bound OTP records. The queue job MUST contain only an encrypted delivery payload, never a raw OTP or recipient contact data. The worker SHALL decrypt the payload only in process, send through Brevo, and retry transient delivery failures without regenerating, consuming, or changing the associated OTP. Email delivery processing MUST NOT decide account verification, password-reset, session, or lockout state.

#### Scenario: Accepted request queues delivery
- **WHEN** a registration, verification resend, or password-reset request creates an OTP
- **THEN** the system queues asynchronous delivery without waiting for Brevo to respond

#### Scenario: Retried provider failure
- **WHEN** Brevo delivery for a queued OTP email fails transiently
- **THEN** the worker retries the encrypted delivery payload and preserves the same usable OTP and account state

### Requirement: Authenticate verified accounts
The system SHALL authenticate only a verified, non-locked account with its email address and password. A successful login SHALL return a short-lived access token and a refresh token; an unsuccessful login MUST not reveal whether the email, password, verification state, or lock state was the cause. Unverified accounts MUST complete email verification before receiving a session.

#### Scenario: Successful login after verification
- **WHEN** a verified passenger or driver supplies correct credentials
- **THEN** the system returns a 200 response with access and refresh credentials associated with that account and role

#### Scenario: Unverified account login
- **WHEN** an unverified account supplies correct credentials
- **THEN** the system denies login and returns no session credentials

### Requirement: Refresh and revoke sessions
The system SHALL accept a valid unrevoked refresh credential to issue a replacement access credential and a rotated refresh credential. It MUST invalidate the presented refresh credential during rotation, and logout MUST revoke the current refresh session so it cannot be used again.

#### Scenario: Refresh rotation
- **WHEN** a client submits a valid active refresh credential
- **THEN** the system returns new access and refresh credentials and rejects subsequent reuse of the submitted refresh credential

#### Scenario: Logout
- **WHEN** an authenticated client logs out its current session
- **THEN** the system revokes that session and a later refresh attempt for it is denied

### Requirement: Derive protected actors from access credentials
The system SHALL derive the authenticated actor ID and role exclusively from a valid access credential for protected endpoints. It MUST reject missing, invalid, expired, or revoked credentials with 401 and MUST not accept an actor identity supplied in request input as proof of identity.

#### Scenario: Protected request with a valid token
- **WHEN** a client calls a protected endpoint with a valid access credential
- **THEN** the endpoint receives the credential-derived actor identity and role

#### Scenario: Protected request without a token
- **WHEN** a client calls a protected endpoint without a valid access credential
- **THEN** the system returns 401 before the endpoint performs its action

### Requirement: Change or recover passwords securely
The system SHALL allow an authenticated account to change its password after providing its current password, and SHALL provide an email-OTP password-reset flow for a forgotten password. A successful password change or reset MUST invalidate all existing refresh sessions and MUST NOT reveal password material in responses or logs. Password-reset requests MUST return a privacy-preserving accepted response whether or not the email exists.

#### Scenario: Authenticated password update
- **WHEN** an authenticated account supplies its correct current password and a valid replacement password
- **THEN** the system updates the password and revokes all of that account's refresh sessions

#### Scenario: Forgotten-password reset
- **WHEN** a client requests a reset for an existing verified email, verifies a valid password-reset OTP, and provides a valid new password
- **THEN** the system updates the password and revokes all existing refresh sessions for that account

### Requirement: Limit authentication abuse
The system SHALL rate-limit OTP delivery and verification attempts and SHALL temporarily lock an account after the configured number of consecutive failed login attempts. A successful login MUST clear the failed-login count. The system MUST log authentication security events with request and actor context when available, without logging passwords, OTP values, access tokens, refresh tokens, or Brevo credentials.

#### Scenario: Login lockout
- **WHEN** consecutive failed login attempts reach the configured threshold for an account
- **THEN** the system temporarily denies further login attempts for that account and returns no session credentials

#### Scenario: OTP delivery rate limit
- **WHEN** a client exceeds the configured OTP delivery limit for an email and purpose
- **THEN** the system rejects or defers the additional request without sending another OTP
