# Spec Delta

## Purpose

Define a single Redis-backed lifecycle for every authentication OTP without persisting OTP state in PostgreSQL.

## ADDED Requirements

### Requirement: Redis-only OTP issuance
The system SHALL store email-verification and password-reset OTP state exclusively in Redis. An issued OTP record MUST include its purpose, subject email, user ID when available, the raw OTP value, remaining attempts, and expiration; PostgreSQL MUST NOT store an OTP, OTP challenge, or OTP attempt state.

#### Scenario: Email verification OTP is issued
- **WHEN** a newly registered or unverified existing user requests email verification
- **THEN** the system stores a Redis OTP record for that email and verification purpose with the configured TTL before attempting delivery

#### Scenario: Password-reset OTP is issued
- **WHEN** a verified user requests a password reset
- **THEN** the system stores a Redis OTP record for that email and password-reset purpose with the configured TTL before attempting delivery

### Requirement: OTP purpose isolation and replacement
The system SHALL isolate OTP records by purpose and subject. Issuing another OTP for the same purpose and subject MUST replace the prior OTP record, while an OTP for another purpose remains independently valid.

#### Scenario: Resend replaces verification OTP
- **WHEN** an unverified user requests another verification email before the previous OTP expires
- **THEN** only the newly issued verification OTP is accepted

#### Scenario: Password reset does not replace verification OTP
- **WHEN** a user has an active verification OTP and requests a password-reset OTP
- **THEN** each purpose retains its own independently consumable OTP record

### Requirement: Atomic single-use OTP consumption
The system SHALL atomically validate an OTP's purpose, expiry, and remaining attempts in Redis. A successful validation MUST consume the OTP so it cannot be used again; a failed validation MUST decrement the remaining attempt count and remove the record once attempts are exhausted.

#### Scenario: Valid OTP is consumed once
- **WHEN** a client submits the current OTP before expiration and within the attempt limit
- **THEN** the requested verification or password-reset action proceeds and a repeat submission is rejected

#### Scenario: Invalid OTP reaches attempt limit
- **WHEN** a client repeatedly submits an invalid OTP until the configured maximum is reached
- **THEN** the OTP record is removed and further submissions are rejected

### Requirement: Redis dependency failure handling
The system SHALL not fall back to PostgreSQL for OTP issuance or consumption. If Redis is unavailable, it MUST not issue or validate an OTP and MUST return a safe service-unavailable error without exposing OTP data.

#### Scenario: Redis unavailable during OTP verification
- **WHEN** Redis cannot be reached while a client submits an OTP
- **THEN** the verification or reset action is not performed and the API returns a service-unavailable response

### Requirement: OTP persistence removal
The system SHALL remove the persistent OTP challenge data model and all OTP persistence paths after Redis-only issuance and consumption are available.

#### Scenario: Authentication database inspection
- **WHEN** an email-verification or password-reset OTP is issued, resent, rejected, or consumed
- **THEN** no OTP challenge record or OTP value is written to PostgreSQL
