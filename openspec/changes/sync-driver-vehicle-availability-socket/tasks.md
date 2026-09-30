# Tasks

## 1. Socket.IO startup and authentication

- [x] 1.1 Add the Socket.IO dependency and attach it to the existing HTTP server without adding a second port; verify `npm run check` and `npm run build` remain successful.
- [x] 1.2 Implement the authenticated driver-presence handshake using the existing access-token verification and user lookup; reject missing/invalid tokens, passengers, and drivers without vehicles, and verify authorization tests pass.
- [x] 1.3 Document the client handshake auth payload and presence event names in the backend API documentation; verify the documentation contains the supported events and no new REST logout contract.

## 2. Authoritative vehicle presence transitions

- [x] 2.1 Add a repository operation that updates only the authenticated driver's owned vehicle availability; verify it cannot target a client-supplied or foreign vehicle.
- [x] 2.2 Mark the owned vehicle `ONLINE` on accepted presence connection and acknowledge the state; verify PostgreSQL update success and failure behavior with focused tests.
- [x] 2.3 Implement explicit `driver:offline` and `driver:logout` events that persist `OFFLINE`, acknowledge safely, and disconnect logout sessions; verify repeated events are idempotent.
- [x] 2.4 Track active sockets per driver and mark the vehicle `OFFLINE` on the final disconnect while keeping it `ONLINE` when another socket remains; verify multi-socket and unexpected-disconnect tests pass.

## 3. Scope protection and verification

- [x] 3.1 Verify presence failures do not change ride requests, pools, fares, vehicle CRUD contracts, or other drivers' availability through focused regression tests.
- [x] 3.2 Run the full project checks with `npm run check` and `npm run build`, inspect the diff for unrelated changes/secrets/generated artifacts, and verify the implementation remains limited to driver vehicle presence.
