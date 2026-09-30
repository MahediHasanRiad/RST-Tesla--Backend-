# Spec Delta

## Purpose

Deliver targeted push notifications to authenticated users through Firebase Cloud Messaging while safely managing device tokens and provider feedback.

## ADDED Requirements

### Requirement: Users can register and manage push device tokens

The system SHALL accept a validated FCM registration token for an authenticated user, support replacing refreshed tokens, and support removing tokens that are revoked or no longer valid.

#### Scenario: User registers a device token

- **WHEN** an authenticated user submits a valid FCM registration token
- **THEN** the token is associated with that user without exposing Firebase credentials or another user's tokens

#### Scenario: User refreshes a device token

- **WHEN** an authenticated user submits a replacement token for a device
- **THEN** the stored token is updated or replaced idempotently

#### Scenario: User removes a device token

- **WHEN** an authenticated user signs out or removes a device
- **THEN** the associated token is removed or disabled for future delivery

### Requirement: Push notifications are sent through Firebase Cloud Messaging

The notification worker SHALL send only to tokens owned by the target user and SHALL use Firebase Admin credentials held in secret-managed configuration. Notification payloads SHALL contain only the approved title, body, event type, and minimal identifiers needed by the client.

#### Scenario: Push notification succeeds

- **WHEN** a valid notification job targets a user with an active token
- **THEN** Firebase Cloud Messaging receives the notification and the job is acknowledged

#### Scenario: Target user has no active token

- **WHEN** a notification job targets a user with no active device token
- **THEN** the job is handled as a non-delivery without exposing credentials or failing the originating domain transaction

#### Scenario: Firebase reports an invalid token

- **WHEN** Firebase reports that a token is invalid or unregistered
- **THEN** the token is disabled or removed and is not retried indefinitely

### Requirement: Firebase configuration is secret-safe

The system SHALL require the Firebase project identifier and server-side service-account configuration through environment or deployment secrets, SHALL document safe placeholders in `.env.example`, and SHALL never commit service-account JSON or private keys.

#### Scenario: Firebase credentials are missing

- **WHEN** the notification worker starts without the required Firebase configuration
- **THEN** the worker fails clearly or remains disabled according to the configured startup policy, without logging secret values
