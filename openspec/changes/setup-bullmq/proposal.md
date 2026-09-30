# Proposal

## Why

Email and push delivery are external side effects that can slow HTTP requests and are vulnerable to temporary provider failures. BullMQ will move those side effects into retryable background jobs handled by dedicated workers while PostgreSQL remains authoritative for application state.

## What Changes

- Add BullMQ queues backed by the existing Redis infrastructure.
- Add a dedicated push-notification worker that sends Firebase Cloud Messaging notifications.
- Add a dedicated email worker that reuses the existing Brevo email delivery integration.
- Add retry, backoff, failure logging, and graceful shutdown behavior for both workers.
- Add a safe device-token registration/storage contract for users who opt into push notifications.
- Change notification/email-producing flows to enqueue jobs instead of waiting for provider delivery in the HTTP request.
- Keep Redis limited to ephemeral queue infrastructure; PostgreSQL remains authoritative for users, ride state, fares, capacity, authorization, and notification preferences.

## Capabilities

### New Capabilities

- `bullmq-notification-email-workers`: Queue and process push-notification and email jobs using separate worker processes with retries and safe failure handling.
- `firebase-push-notifications`: Deliver authenticated user notifications through Firebase Cloud Messaging using server-side Firebase Admin credentials and registered device tokens.

### Modified Capabilities

<!-- No existing capability requirements are modified. -->

## Impact

- Affected code: queue infrastructure, worker entrypoints/scripts, email-producing authentication flows, push-token persistence and validation, configuration, tests, and operational documentation.
- Existing email delivery uses Brevo and should be called by the email worker rather than directly inside request handling.
- Firebase setup required before implementation/deployment:
  - Firebase project ID.
  - Firebase Admin credentials through Application Default Credentials, normally `GOOGLE_APPLICATION_CREDENTIALS` pointing to a protected service-account JSON file for local/non-Google deployments.
  - Firebase Cloud Messaging enabled for the project.
  - Android package name and/or iOS bundle ID in the client Firebase apps.
  - iOS APNs configuration in Firebase if iOS push is required.
  - Client implementation that requests notification permission and sends FCM registration tokens to the backend.
  - Decision on token lifecycle: register, refresh/replace, revoke on logout, and remove invalid tokens after provider feedback.
- No Firebase private key, service-account JSON, or device token will be committed to the repository.
