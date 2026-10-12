# Design

## Context

See `proposal.md` for the motivation and `specs/ride-request-creation/spec.md` for the behavior contract. Today the counter fare is written to a single Redis key, and the driver acceptance controller reads that key before `acceptForDriver` changes the request to `MATCHED`. This makes Redis carry negotiation state and provides no durable offer identity or participant acceptance state. The existing request lifecycle and pool capacity rules remain authoritative in PostgreSQL.

## Goals / Non-Goals

**Goals:**

- Represent a durable current fare offer, its version, proposer, and acceptance by both participants.
- Let either authorized participant accept the current offer through one consistently validated domain action.
- Make mutual acceptance and pool-capacity enforcement one PostgreSQL transaction.
- Preserve a useful offer history for debugging and audit, while exposing only the current offer and relevant acceptance state in normal ride responses.
- Keep notifications and Socket.IO delivery after commit and non-authoritative.

**Non-Goals:**

- Adding payments, escrow, automatic bargaining, offer expiry beyond the existing negotiation eligibility rules, or a new ride lifecycle.
- Using Redis for final fare agreement, acceptance state, ownership, capacity, or matching decisions.
- Reworking unrelated ride creation, route matching, image handling, or driver presence behavior.

## Decisions

### Use a normalized PostgreSQL offer model with acceptance columns

Add a `RideFareOffer`-style relation keyed to `RideRequest`, with an immutable offer identifier/version, amount in paisa, proposer actor, passenger/driver acceptance timestamps (or equivalent actor IDs), current/replaced status, and timestamps. Enforce at most one current offer per request with a database constraint or transaction-maintained invariant. Keeping offer history makes stale client actions unambiguous and preserves the negotiation audit trail.

An alternative is adding `currentFare`, `offerVersion`, `passengerAccepted`, and `driverAccepted` directly to `RideRequest`. That is smaller, but loses offer history and makes future audit/debugging harder; it is not selected unless migration constraints show the normalized relation cannot be deployed safely.

### Use one role-aware acceptance action

Expose a protected acceptance route under the ride-request resource, accepting the offer version/ID in a strict body. The controller derives the actor from `request.user`, verifies that the actor is either the request passenger or the driver owning the request's pool, and delegates persistence to the repository. The existing driver route can be retained only as a compatibility alias during migration if the implementation proves clients depend on it; both routes must call the same repository operation and cannot have different semantics.

### Make counter and accept mutations transactional and PostgreSQL-authoritative

The repository locks the ride request and current offer, re-reads the request status and pool/vehicle ownership, and rejects stale or invalid operations before mutation. A counter creates a new current offer and clears acceptance by virtue of the new offer identity. Acceptance marks only the authenticated actor's acceptance for the supplied current offer. If both acceptance markers are now present, the same transaction locks the pool and vehicle, recomputes authoritative reserved seats, checks capacity, updates `RideRequest.farePaisa` and status to `MATCHED`, writes `RideStatusHistory`, and commits.

The old Redis counter-fare key will no longer be read for acceptance or written as the source of truth. If a compatibility cleanup is needed, the controller may best-effort delete old keys after a successful PostgreSQL operation; failure to delete must be logged safely and must not affect the decision.

### Publish events from committed results

Controllers derive the target participant IDs from the committed repository result, then enqueue/publish push and realtime updates. Counter and one-sided acceptance responses include the current offer amount/version and both acceptance states. Mutual acceptance emits the existing `MATCHED` ride-status event after commit; negotiation events are additive and must not be emitted for rejected transactions.

### Preserve existing lifecycle and error conventions

Use the project's `ApiError`, strict Zod validation, repository-only Prisma access, existing notification helper, realtime adapter, and response helper. Map stale offer and invalid negotiation state to the project's conflict shape, authorization to the existing forbidden shape, and capacity races to the existing capacity-conflict shape. No generic status update endpoint is introduced.

## Risks / Trade-offs

- **[Migration with active requests]** Existing requests have no durable offer record → create a migration/backfill that gives eligible pending requests a current offer from their persisted fare, with both acceptances false, and verify the fallback for requests that have no fare.
- **[Concurrent acceptance retries]** Repeated requests may race or be retried → lock the current offer/request and make a repeated acceptance idempotent for the same actor and offer; only the first transaction that can satisfy both acceptances finalizes.
- **[Old clients call driver-only acceptance]** Existing clients may omit an offer ID → support a bounded compatibility path that resolves only the current offer and still requires passenger acceptance, then remove/document it after client migration.
- **[Realtime payload compatibility]** Clients may not understand negotiation events → keep the existing final status event shape, add versioned negotiation event fields, and ensure all clients can refetch through the existing GET endpoint.
- **[Offer history growth]** Every counter creates a row → index by request/current status and retain history as lightweight audit data; do not cache it in Redis.

## Migration Plan

1. Add the offer/acceptance schema and indexes, migrate existing pending requests with a safe current-offer representation, and regenerate Prisma artifacts.
2. Deploy repository/controller behavior that reads PostgreSQL offer state and accepts from either role; keep old Redis keys ignored except for best-effort cleanup.
3. Deploy response and realtime payload changes, then update clients to submit the current offer identity and render both acceptance states.
4. Verify rollback before rollout: application rollback must not write old Redis values into PostgreSQL or finalize requests using stale cache data. If schema rollback is required, retain the additive offer table until all pending negotiations are resolved.

