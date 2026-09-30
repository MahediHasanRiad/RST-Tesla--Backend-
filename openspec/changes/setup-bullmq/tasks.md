# Tasks

## 1. Queue infrastructure and configuration

- [x] 1.1 Add BullMQ and Firebase Admin dependencies, configuration schemas, and safe `.env.example` placeholders; verify package installation, type-checking, and secret scanning.
- [x] 1.2 Create the queue infrastructure adapter with separate notification and email queues, typed job payloads, bounded retries, exponential backoff, deterministic job IDs where applicable, and graceful connection shutdown; verify queue unit tests.
- [x] 1.3 Add explicit API, notification-worker, and email-worker development/production commands without changing existing REST route paths; verify each entrypoint compiles.

## 2. Firebase push-notification capability

- [x] 2.1 Add PostgreSQL persistence and repository operations for authenticated-user FCM device tokens, including uniqueness, refresh/replacement, revocation, and invalid-token cleanup; verify authorization and idempotency tests.
- [x] 2.2 Add the validated device-token registration/removal API contract and standard validation/error handling; verify malformed tokens, ownership, and removal tests.
- [x] 2.3 Implement Firebase Admin initialization from secret-managed configuration and the notification job processor; verify successful delivery, missing-token handling, invalid-token cleanup, and provider-failure behavior without logging secrets.
- [x] 2.4 Add the PostgreSQL `Notification` model, migration, repository operations, ownership constraints, unread/recent indexes, and read-state behavior; verify notification persistence and authorization tests.
- [x] 2.5 Add push-notification producers to the approved ride controllers for ride creation, acceptance, cancellation, and counter-fare events; persist notifications before enqueueing and verify recipient/event mapping and queue-failure behavior.

## 3. Email worker capability

- [x] 3.1 Move the existing Brevo delivery call behind the email job processor while preserving approved email purposes and templates; verify email processor success, retry, and terminal-failure tests.
- [x] 3.2 Update existing authentication email producers to enqueue email jobs after authoritative OTP state is written, then verify HTTP flows do not wait for provider delivery and enqueue failures are handled according to the contract.

## 4. Worker operations and integration

- [x] 4.1 Implement graceful shutdown, worker health/failure logging, retry exhaustion handling, and safe job observability for both worker processes; verify signal and retry lifecycle tests.
- [x] 4.2 Add focused integration tests proving Redis is queue infrastructure only and PostgreSQL remains authoritative for domain and token state; verify Redis failures do not mutate domain decisions.
- [x] 4.3 Document Firebase project/service-account/APNs/client-token prerequisites, queue startup commands, retry behavior, and secret handling without including real credentials; verify documentation against configuration.
- [ ] 4.4 Run focused queue, Firebase, email, and authentication tests, then run `npm run check` and `npm run build`; inspect the diff for unrelated route changes, secrets, and generated artifacts.
