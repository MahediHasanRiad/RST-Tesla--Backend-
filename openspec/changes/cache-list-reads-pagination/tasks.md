# Tasks

## 1. Shared pagination and cache infrastructure

- [x] 1.1 Add a strict common cursor pagination parser for optional opaque `cursor` and `limit`, with default limit `20`, maximum limit `100`, and standard validation errors; verify malformed cursors and over-limit queries are rejected.
- [x] 1.2 Add a common cursor response helper returning `items`, `nextCursor`, and `hasNextPage`; verify empty, partial, and multi-window results calculate continuation metadata correctly.
- [x] 1.3 Add a shared Redis cache-aside helper over the existing Redis client with a bounded 60-second TTL, JSON serialization, deterministic keys, and non-fatal error logging; verify cache errors do not escape to callers.

## 2. Paginated cached list endpoint

- [x] 2.1 Update the ServiceZone repository to load a stable cursor-ordered window from PostgreSQL using `(createdAt, id)` position semantics; verify first-window and next-cursor boundaries.
- [x] 2.2 Update `GET /api/v1/service-zones` to use the common cursor parser, cache-aside helper, and public ServiceZone projection; verify first and next cursor responses.
- [x] 2.3 Ensure cache keys include endpoint/resource, filters/sort values, cursor, limit, and a version namespace; verify different cursors, limits, and filters never collide.
- [x] 2.4 Ensure Redis misses and Redis outages fall back to PostgreSQL and populate Redis only when possible; verify the endpoint remains successful when Redis is unavailable.

## 3. Tests and documentation

- [x] 3.1 Add unit tests for cursor parsing and metadata, including first-window, next-cursor, invalid, empty, and over-limit cases; verify the shared helper contract.
- [x] 3.2 Add cache helper tests for hit, miss, write, TTL, serialization failure, Redis read failure, and Redis write failure; verify database fallback behavior.
- [x] 3.3 Add ServiceZone endpoint tests for cursor output, cache hits/misses, Redis fallback, and cursor-key isolation; verify PostgreSQL remains the fallback source.
- [x] 3.4 Document the common `?limit=20&cursor=<opaque-cursor>` contract, continuation metadata, 60-second cache behavior, and Redis non-authoritative limitation; verify API documentation matches the endpoint.
- [x] 3.5 Run focused tests, `npm run check`, `npm run build`, and the full test suite; report any unrelated failures exactly.
