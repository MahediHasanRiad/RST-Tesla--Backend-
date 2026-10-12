# Tasks

## 1. Persist the negotiated offer state

- [x] 1.1 Add the normalized current/history fare-offer schema, actor/proposer relation, offer identity/version, acceptance state, indexes, and Prisma relations; verify `npm run prisma:generate` succeeds and the schema enforces at most one current offer per request.
- [ ] 1.2 Add a forward migration and safe backfill for existing eligible pending requests using their persisted fare, with both acceptances initially false; verify the migration applies cleanly against a representative database and does not alter matched, cancelled, started, or completed requests.

## 2. Implement authoritative negotiation transactions

- [x] 2.1 Replace Redis-authoritative counter-fare persistence with repository methods that create a new current PostgreSQL offer, record the proposer, and invalidate prior acceptance through the new offer identity; verify counter tests prove PostgreSQL state changes and Redis outages do not decide the fare.
- [x] 2.2 Implement one repository acceptance operation for passenger and driver actors that locks/re-reads the request and current offer, rejects stale or invalid state, and records the actor's acceptance idempotently; verify both passenger-first and driver-first acceptance tests remain `PENDING_DRIVER_ACCEPTANCE` after only one acceptance.
- [ ] 2.3 Finalize mutual acceptance in the same PostgreSQL transaction by locking the pool/vehicle, recomputing authoritative reserved seats, enforcing capacity, persisting `farePaisa`, changing status to `MATCHED`, and writing status history; verify a successful second acceptance produces one matched request and a capacity race cannot overbook the final seat.

## 3. Expose the two-sided API behavior

- [x] 3.1 Add strict validation for the current offer ID/version and update counter-fare validation/response fields to expose the current offer and both acceptance states without accepting client ownership, status, or calculated fare fields; verify unknown fields, stale versions, invalid amounts, and invalid params return the standard validation/conflict shapes.
- [x] 3.2 Add the protected role-aware acceptance route and controller, deriving identity from `request.user` and reusing existing response/error helpers; verify the passenger and pool-owning driver can accept while unrelated users, wrong-role actors, and requests outside negotiation states are rejected.
- [x] 3.3 Update ride-request detail and relevant list responses so clients can render the current offer, proposer, offer identity, and passenger/driver acceptance state; verify the GET endpoint reflects each committed counter, acceptance, reset, and finalization state.

## 4. Deliver committed realtime and notification updates

- [x] 4.1 Extend the realtime adapter and push-notification payloads for targeted counter-offer and one-sided-acceptance updates to the other participant, while preserving the existing final `MATCHED` status event; verify only affected sockets receive the corresponding event.
- [x] 4.2 Ensure events and notifications are emitted only after repository success and that Socket.IO/notification failures do not fail committed HTTP decisions; verify failed, stale, unauthorized, and capacity-conflicted mutations emit no negotiation or final-status event.

## 5. Regression and rollout verification

- [x] 5.1 Update existing negotiation, driver-decision, ride-request action, and realtime tests for the new two-sided semantics, including counter-after-acceptance reset, stale offer, repeated acceptance, authorization, and old-client compatibility behavior; verify the focused ride negotiation test suite passes.
- [ ] 5.2 Run `npm run check`, `npm run build`, and `npm test`; inspect the migration/schema/API diff and verify no Redis-authoritative fare logic or generated secrets/artifacts were introduced.
