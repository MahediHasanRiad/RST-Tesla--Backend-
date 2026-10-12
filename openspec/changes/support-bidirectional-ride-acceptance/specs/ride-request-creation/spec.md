# Spec Delta

## MODIFIED Requirements

### Requirement: Ride requests support driver acceptance and ephemeral fare negotiation

The system MUST expose a protected acceptance action for the owning passenger and the pool-owning driver on a ride request in a negotiable pre-match state. The request MUST have one authoritative current fare offer with a stable offer version or equivalent identity. The counter-fare action MUST create or replace that current offer, record which actor proposed it, and clear both participants' acceptance for the replaced offer. A participant MUST be able to accept only the current offer; accepting an older offer MUST return a conflict without changing state. The system MUST transition the request to `MATCHED`, persist the agreed fare, and record the lifecycle transition only after both the owning passenger and pool-owning driver have accepted the same current offer. The finalization transaction MUST re-read and lock the authoritative request/pool/capacity state, enforce ownership and capacity, and commit before any cache invalidation or notifications. Redis MUST NOT be authoritative for the current offer, acceptance state, final fare, or ride lifecycle.

#### Scenario: Driver counters and passenger accepts the current offer

- **WHEN** the pool-owning driver submits a new fare and the owning passenger accepts that current offer
- **THEN** the system records the passenger's acceptance, keeps the request pending until the driver also accepts, and returns the current offer and both acceptance states

#### Scenario: Passenger counters and driver accepts the current offer

- **WHEN** the owning passenger submits a new fare and the pool-owning driver accepts that current offer
- **THEN** the system records the driver's acceptance, keeps the request pending until the passenger also accepts, and returns the current offer and both acceptance states

#### Scenario: Both participants accept the same offer

- **WHEN** both the owning passenger and pool-owning driver have accepted the same current offer and the request is still eligible for matching
- **THEN** one authoritative transaction persists that offer as `farePaisa`, changes the request to `MATCHED`, records the status history, and returns the matched request

#### Scenario: A new counter offer invalidates prior acceptance

- **WHEN** either participant submits a new fare after one or both participants accepted an earlier offer
- **THEN** the system replaces the current offer, clears acceptance for the earlier offer, leaves the request unmatched, and requires both participants to accept the new offer

#### Scenario: Stale offer acceptance is rejected

- **WHEN** a participant attempts to accept an offer version that is no longer current
- **THEN** the system returns a conflict response and leaves the current offer, acceptance state, fare, and lifecycle status unchanged

#### Scenario: Only authorized participants can counter or accept

- **WHEN** a user who is neither the request passenger nor the pool-owning driver attempts to counter or accept
- **THEN** the API returns an authorization error and changes neither PostgreSQL nor Redis state

#### Scenario: Invalid negotiation state is rejected

- **WHEN** either participant attempts to counter or accept after the request is matched, cancelled, started, completed, or otherwise outside the supported negotiation states
- **THEN** the API returns a conflict response and performs no mutation

#### Scenario: Concurrent final-seat agreement cannot overbook the pool

- **WHEN** concurrent acceptance requests could finalize agreements that claim the remaining pool capacity
- **THEN** PostgreSQL serialization/row locking allows no more successful finalizations than the vehicle capacity, and losing transactions receive a capacity conflict without a partial match

#### Scenario: Driver accepts a pending ride request

- **WHEN** the pool-owning authenticated driver accepts the current offer for a pending request
- **THEN** the driver's acceptance is recorded for that offer, the request remains pending until the passenger accepts the same offer, and no cached fare is treated as final

#### Scenario: Passenger or driver counters the fare

- **WHEN** the owning passenger or pool-owning driver submits a positive integer `farePaisa`
- **THEN** the system creates a new authoritative current offer, resets acceptance for the replaced offer, keeps the request pending, and returns the new offer state

#### Scenario: Unauthorized fare negotiation is rejected

- **WHEN** a user who is neither the request passenger nor the pool-owning driver attempts to accept or counter
- **THEN** the API rejects the operation without changing the offer, acceptance, fare, or lifecycle state

