# Proposal

## Why

Fare negotiation currently lets both participants submit a counter fare, but only the driver can accept and finalize the ride. A passenger who agrees with the driver's counter offer has no equivalent acceptance action, and the system cannot represent which participant has accepted the current offer. This blocks a fair two-sided negotiation flow and can leave the final agreement dependent on a driver-only action.

## What Changes

- Add a two-sided acceptance flow for the current fare offer: the passenger and the pool-owning driver can each accept the latest negotiated fare.
- Track the current offer and each participant's acceptance in authoritative PostgreSQL state so an acceptance cannot be lost, overwritten ambiguously, or treated as a final fare prematurely.
- Finalize the fare and transition the ride request to `MATCHED` only after both the passenger and driver have accepted the same current offer.
- Invalidate or reset the other participant's acceptance whenever either participant submits a new counter offer.
- Expose the acceptance action to both authorized actors with ownership/authorization checks and explicit conflict responses for stale, already-finalized, cancelled, or otherwise invalid negotiations.
- Notify the other participant after a counter offer or acceptance, and publish the final `MATCHED` status only after the authoritative transaction commits.
- Remove the use of Redis as the source of truth for negotiated fares and acceptance state; retain Redis only for non-authoritative concerns if an existing cache path still needs it.
- Add focused tests for both acceptance orders, counter-after-acceptance reset behavior, authorization, stale offers, finalization, capacity conflicts, and concurrent final-seat acceptance.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ride-request-creation`: Change fare negotiation and ride acceptance from driver-only finalization to a two-sided current-offer agreement that finalizes only after both participants accept.
- `ride-status-realtime-updates`: Extend ride negotiation events to the affected passenger and driver, while keeping final ride-status events commit-after-success and recoverable from PostgreSQL.

## Impact

- Prisma `RideRequest` negotiation fields and a migration will be needed, or an equivalent normalized offer model if design review favors offer history; existing data must receive safe defaults.
- Ride-request and driver controllers/routes will need a shared accept action or equivalent role-specific route, strict validation, and updated authorization rules.
- The ride-request repository must implement transactional offer acceptance/finalization, reset semantics, and existing pool-capacity locking without trusting Redis.
- Existing counter-fare Redis reads/writes, notifications, Socket.IO payloads, and negotiation tests will change. Client consumers will need the new offer/acceptance state in ride responses and realtime events.
- No image upload, Cloudinary, or Redis-authoritative lifecycle behavior is introduced; PostgreSQL remains authoritative for fare agreement, membership, capacity, ownership, and ride status.
