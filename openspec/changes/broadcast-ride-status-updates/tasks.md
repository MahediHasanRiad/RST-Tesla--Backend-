# Tasks

## 1. Direct Socket.IO event wiring

- [x] 1.1 Extend the existing Socket.IO authentication path to accept authenticated passengers, store the authenticated user ID on socket data, and preserve driver presence behavior; verify valid passenger and invalid socket authentication cases.
- [x] 1.2 Define the `ride:status-updated` payload as `{ rideRequestId, status: "MATCHED" | "CANCELLED" }`, then verify both event statuses with a focused test.

## 2. Acceptance event publication

- [x] 2.1 Emit `{ rideRequestId, status: "MATCHED" }` directly to the affected passenger socket(s) after `acceptForDriver` returns a committed accepted result, then verify failed and capacity-conflict paths emit nothing and unrelated passengers receive nothing.
- [x] 2.2 Use the existing cancel flow as driver rejection for a pending ride and emit `{ rideRequestId, status: "CANCELLED" }` directly to the affected passenger socket(s) only after its transaction commits, then verify failed rejection paths emit nothing.
- [x] 2.3 Ensure Socket.IO emission failure does not change either successful HTTP response or persisted ride status, then verify this behavior with focused tests.

## 3. Regression coverage

- [x] 3.1 Verify no REST route, cluster configuration, Redis adapter behavior, or unrelated domain code changes as part of this feature.
- [x] 3.2 Run the focused ride-acceptance, rejection, and Socket.IO tests, `npm run check`, and `npm run build`; all must pass before completion.
