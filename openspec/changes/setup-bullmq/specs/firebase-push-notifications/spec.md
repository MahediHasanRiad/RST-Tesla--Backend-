# Spec Delta

## Purpose

Deliver targeted push notifications to authenticated users through Firebase Cloud Messaging while safely managing device tokens and provider feedback.

## ADDED Requirements

### Requirement: Notifications are persisted in PostgreSQL

The system SHALL persist each user-facing ride notification in PostgreSQL before attempting push delivery. Each notification SHALL contain a unique ID, owning user ID, event type, title, body, optional structured data, read state, and creation/read timestamps. PostgreSQL SHALL remain authoritative for notification history and read state.

#### Scenario: Ride notification is created

- **WHEN** an approved ride event occurs
- **THEN** the system creates a notification record for the intended recipient and then enqueues its push delivery

#### Scenario: Push delivery is unavailable

- **WHEN** the notification queue or Firebase provider is unavailable
- **THEN** the PostgreSQL notification record remains available and the authoritative ride operation is not rolled back

#### Scenario: User reads a notification

- **WHEN** an authenticated user reads one of their notifications
- **THEN** its read state and read timestamp are updated without allowing access to another user's notification

### Requirement: Approved ride flows enqueue push notifications

The system SHALL enqueue push notifications for the following events after the related authoritative operation succeeds: `RIDE_REQUEST_CREATED`, `RIDE_MATCHED`, `RIDE_CANCELLED`, and `COUNTER_FARE_UPDATED`. Each event SHALL target the other participant or assigned driver rather than the actor who caused the event.

#### Scenario: Driver accepts a ride

- **WHEN** a driver accepts a ride request
- **THEN** the passenger receives a persisted `RIDE_MATCHED` notification and an asynchronous push job

#### Scenario: Ride is cancelled

- **WHEN** a driver or passenger cancels a ride request
- **THEN** the other participant receives a persisted `RIDE_CANCELLED` notification and an asynchronous push job

#### Scenario: Counter fare changes

- **WHEN** a passenger or driver submits a valid counter fare
- **THEN** the other participant receives a persisted `COUNTER_FARE_UPDATED` notification and an asynchronous push job

#### Scenario: New ride request is created

- **WHEN** a passenger creates a ride request assigned to a vehicle or driver
- **THEN** the assigned driver receives a persisted `RIDE_REQUEST_CREATED` notification and an asynchronous push job

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

The system SHALL use Firebase Admin Application Default Credentials through environment or deployment configuration, SHALL document safe placeholders in `.env.example`, and SHALL never commit service-account JSON or private keys.

#### Scenario: Firebase credentials are missing

- **WHEN** the notification worker starts without the required Firebase configuration
- **THEN** the worker fails clearly or remains disabled according to the configured startup policy, without logging secret values
