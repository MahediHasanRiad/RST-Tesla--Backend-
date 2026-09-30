# Spec Delta

## Purpose

Provide reliable background processing for push notifications and emails without blocking API requests or treating Redis queues as authoritative application state.

## ADDED Requirements

### Requirement: Notification and email jobs are queued independently

The system SHALL expose separate background job paths for push notifications and email delivery, and API requests that create these side effects SHALL enqueue jobs without waiting for the external provider to complete.

#### Scenario: Push notification job is queued

- **WHEN** an application flow requests a push notification
- **THEN** the system stores an ephemeral notification job in the notification queue and returns without waiting for Firebase delivery

#### Scenario: Email job is queued

- **WHEN** an application flow requests an email
- **THEN** the system stores an ephemeral email job in the email queue and returns without waiting for Brevo delivery

### Requirement: Dedicated workers process only their assigned job type

The system SHALL run one dedicated notification worker for push jobs and one dedicated email worker for email jobs. A worker MUST NOT process the other worker's job type.

#### Scenario: Notification worker processes push jobs

- **WHEN** a push job is available
- **THEN** the notification worker processes it through the push provider and acknowledges it only after the provider call succeeds

#### Scenario: Email worker processes email jobs

- **WHEN** an email job is available
- **THEN** the email worker processes it through the configured email provider and acknowledges it only after the provider call succeeds

### Requirement: External delivery failures are retryable and observable

The system SHALL retry transient provider failures with bounded attempts and backoff, record terminal failures with safe structured context, and prevent a failed job from being acknowledged as successful.

#### Scenario: Transient provider failure

- **WHEN** Firebase or Brevo temporarily rejects a delivery attempt
- **THEN** the job is retried according to the configured retry policy

#### Scenario: Job reaches the retry limit

- **WHEN** a job exhausts its retry attempts
- **THEN** the job is marked failed, safe failure context is logged, and no application lifecycle state is changed because of the queue failure

### Requirement: Worker shutdown is graceful

Each worker SHALL stop accepting new jobs, allow active provider calls to finish within a bounded shutdown period, close its queue connections, and exit without exposing credentials or job payload secrets in logs.

#### Scenario: Worker receives a termination signal

- **WHEN** a notification or email worker receives SIGTERM or SIGINT
- **THEN** it closes gracefully and does not abandon an actively processing job without applying the queue's retry/recovery behavior

### Requirement: Redis queues remain non-authoritative

Queue data SHALL remain ephemeral infrastructure. PostgreSQL SHALL remain authoritative for users, ride lifecycle, pool membership, capacity, fares, authorization, and notification preferences, and a Redis outage MUST NOT create or finalize those domain decisions.

#### Scenario: Queue infrastructure is unavailable

- **WHEN** Redis is unavailable while an application flow attempts to enqueue a side effect
- **THEN** the system reports or logs the delivery enqueue failure according to the flow's contract without changing authoritative PostgreSQL domain state
