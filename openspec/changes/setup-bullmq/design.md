# Design

## Context

The backend already has a shared Redis client and direct Brevo delivery for authentication emails. It does not currently have a queue abstraction, Firebase Admin integration, persistent FCM device-token ownership, or standalone background worker entrypoints. PostgreSQL remains authoritative for domain and user data; Redis is suitable for ephemeral queue transport only.

## Goals / Non-Goals

**Goals:**

- Add two independently deployable worker processes: one for push notifications and one for emails.
- Keep API requests independent from Firebase and Brevo network latency.
- Reuse the existing Redis configuration through a queue infrastructure adapter rather than scattering raw Redis calls.
- Persist device-token ownership and lifecycle in PostgreSQL.
- Persist notification history and read state in PostgreSQL before push delivery.
- Notify the other ride participant or assigned driver from the approved ride controllers.
- Make provider failures retryable, bounded, observable, and safe to replay.
- Keep provider secrets out of source code, logs, job payloads, and `.env.example`.

**Non-Goals:**

- Moving ride lifecycle, authorization, capacity, fares, or final matching decisions into queues.
- Creating a generic event bus or adding Kafka/RabbitMQ.
- Supporting SMS, browser Web Push, or providers other than Firebase Cloud Messaging and the existing Brevo integration.
- Changing existing REST route paths unless a later implementation task explicitly adds a device-token management endpoint.

## Decisions

### Use two dedicated BullMQ queues and two worker processes

Create separate notification and email queues. Run one worker process for each queue so provider-specific concurrency, retry policy, deployment, and failure monitoring remain isolated. A shared worker that branches on job type was rejected because a slow or failing provider could starve the other delivery channel.

### Keep queue access behind an infrastructure module

Queue creation, job options, Redis connection settings, worker construction, and shutdown will live in a queue infrastructure module. Controllers and repositories will call typed enqueue functions, not instantiate BullMQ or raw Redis clients directly. Queue failures will not mutate authoritative domain state.

### Use typed, minimal, replay-safe job payloads

Notification jobs contain a target user ID, approved event type, minimal entity identifier, title/body data, and an idempotency key; they do not contain Firebase credentials or arbitrary untrusted provider options. Email jobs contain a recipient reference, approved template/purpose, and minimal template data. Jobs receive bounded attempts, exponential backoff, and deterministic IDs where duplicate enqueueing is possible.

### Store FCM tokens in PostgreSQL

Add a user-device-token record owned by a user, with token, platform metadata, active/revoked state, timestamps, and a uniqueness constraint suitable for idempotent refresh. The notification worker reads active tokens through the repository and disables tokens that Firebase reports as invalid. Redis does not own token state.

### Store notifications in PostgreSQL

Add a `Notification` record with `id`, `userId`, `eventType`, `title`, `body`, optional JSON `data`, `isRead`, `readAt`, `createdAt`, and `updatedAt`. Add an index for a user's unread and recent notifications. The notification record is created before enqueueing delivery, so notification history remains available when Firebase or Redis is unavailable. Notification reads and ownership remain PostgreSQL-authoritative.

### Enqueue approved ride notifications

After the existing authoritative operation succeeds, create a notification and enqueue a push job from these controllers:

- `accept-ride-request.controller.ts` → passenger, `RIDE_MATCHED`.
- `cancel-ride-request.controller.ts` → the other participant, `RIDE_CANCELLED`.
- `counter-fare-ride-request.controller.ts` → the other participant, `COUNTER_FARE_UPDATED`.
- `create-fresh-ride-request.controller.ts` → assigned driver, `RIDE_REQUEST_CREATED`.
- `create-ride-request.controller.ts` → assigned driver, `RIDE_REQUEST_CREATED`.

Push enqueue failure is logged safely and does not roll back the completed ride operation or notification record.

### Initialize Firebase Admin only inside the notification worker

The notification worker will initialize Firebase Admin with Application Default Credentials. Local or non-Google deployments set `GOOGLE_APPLICATION_CREDENTIALS` to a protected service-account JSON path; Google-managed deployments use the platform's default credentials. No Firebase Admin client will be created in controllers or repositories.

### Reuse Brevo delivery inside the email worker

Move the existing Brevo provider call behind an email-job processor. Authentication flows enqueue approved email jobs after their authoritative OTP state is written. The worker performs delivery and applies queue retry behavior; provider credentials remain in the existing configuration boundary.

### Start workers explicitly

Add separate development and production commands for the API, notification worker, and email worker. The API process will not silently spawn delivery workers, allowing deployments to scale or restart each process independently. Worker startup will validate only its own provider configuration and will shut down its queue and provider connections gracefully.

## Risks / Trade-offs

- [Risk] Queue delivery is eventually consistent → Keep API responses and PostgreSQL mutations authoritative; document that provider delivery can happen after the response.
- [Risk] Duplicate jobs can produce duplicate emails or notifications → Use deterministic job IDs where possible, idempotent token updates, and provider/job event identifiers in logs.
- [Risk] Invalid FCM tokens accumulate → Remove or disable tokens on Firebase permanent-token errors and provide token refresh/removal behavior.
- [Risk] Redis outage prevents enqueueing → Log safe context and preserve PostgreSQL state; flows that require user-visible delivery must expose an explicit enqueue failure according to their contract.
- [Risk] Service-account credentials are mishandled → Use environment/deployment secrets, redact configuration errors, and add secret scanning/configuration tests.
- [Risk] Worker and API versions disagree on job payloads → Version job names or payload schemas and make processors reject unknown versions safely.

## Migration Plan

1. Add queue and Firebase configuration with disabled/unconfigured worker behavior documented for local development.
2. Add the device-token persistence model and client registration flow.
3. Deploy the notification and email workers before switching producers from direct provider calls to enqueue functions.
4. Switch approved email and notification producers to queues while retaining provider metrics and failure logs.
5. Roll back by stopping the workers and restoring direct producer behavior if necessary; PostgreSQL domain data remains valid because queues do not own lifecycle decisions.

## Firebase Setup Information Required

- Firebase project ID.
- Firebase Admin SDK credentials through Application Default Credentials; local/non-Google deployments need a protected service-account JSON path in `GOOGLE_APPLICATION_CREDENTIALS`.
- FCM enabled in the Firebase project.
- Android package name and/or iOS bundle ID for the client application.
- APNs key/certificate configuration in Firebase if iOS notifications are required.
- Client-side permission handling and the mechanism that sends refreshed FCM registration tokens to the backend.
