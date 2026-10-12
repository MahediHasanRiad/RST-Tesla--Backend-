# Spec Delta

## MODIFIED Requirements

### Requirement: Driver acceptance or rejection produces a direct ride-status event

After an authorized counter offer or acceptance successfully commits, the system SHALL publish a targeted negotiation event to the other participant's authenticated connected socket(s), containing the ride request identifier, current offer identity and amount, and the participant acceptance state. When both participants accept and the authoritative transaction commits the request as `MATCHED`, the system SHALL publish the final ride-status event to the affected passenger and driver socket(s). No negotiation or final-status event SHALL be published for a failed, unauthorized, stale, capacity-conflicted, or rolled-back mutation. Event delivery failure SHALL NOT roll back or fail the committed HTTP result; clients SHALL be able to recover current authoritative state through the existing ride-request API.

#### Scenario: Counter offer notifies the other participant

- **WHEN** an authorized passenger or driver submits a counter offer and the database transaction commits
- **THEN** the other participant receives a negotiation update with the new offer and reset acceptance state

#### Scenario: One-sided acceptance notifies the other participant

- **WHEN** an authorized participant accepts the current offer but the other participant has not accepted it yet
- **THEN** the other participant receives an update showing the current offer and which participant has accepted it, while the ride remains unmatched

#### Scenario: Mutual acceptance emits the final matched event

- **WHEN** the second participant accepts the current offer and the transaction commits with status `MATCHED`
- **THEN** both affected participants receive a final ride-status event containing the ride request identifier and `MATCHED` status

#### Scenario: Failed negotiation emits no event

- **WHEN** a counter offer or acceptance fails validation, authorization, stale-offer checks, capacity checks, or database commit
- **THEN** no negotiation or final-status event is published

#### Scenario: Realtime delivery is unavailable

- **WHEN** the database transaction commits but Socket.IO delivery is unavailable or a participant has no active connection
- **THEN** the HTTP result and persisted state remain successful, and the participant can recover the current offer, acceptance state, fare, and ride status through the existing authenticated API

#### Scenario: Driver accepts a pending ride

- **WHEN** the driver accepts the current offer and the transaction commits with only the driver's acceptance recorded
- **THEN** the passenger receives a negotiation update showing the current offer and the driver's acceptance, while the ride remains pending

#### Scenario: Driver rejects a pending ride

- **WHEN** the driver uses the existing cancel flow to reject a pending ride and the transaction commits with status `CANCELLED`
- **THEN** the affected passenger receives a status event containing the ride request identifier and `CANCELLED` status

#### Scenario: Acceptance or rejection fails

- **WHEN** the acceptance or rejection transaction fails, the ride is not found, or acceptance capacity is rejected
- **THEN** no negotiation or ride-decision status event is published

#### Scenario: Passenger is not connected

- **WHEN** a negotiation update or acceptance/rejection commits while the passenger has no active realtime connection
- **THEN** the persisted state and HTTP result remain successful, and the passenger can recover it through the existing authenticated API

#### Scenario: Socket.IO is unavailable

- **WHEN** the direct Socket.IO server is unavailable after a negotiation or acceptance/rejection database transition
- **THEN** the persisted state and HTTP result remain successful, and clients can recover through the existing authenticated API
