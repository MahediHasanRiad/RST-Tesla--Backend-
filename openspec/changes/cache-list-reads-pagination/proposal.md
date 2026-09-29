# Proposal

## Why

List endpoints currently read directly from PostgreSQL and return unbounded collections, while the project already has Redis infrastructure intended for non-authoritative read caching. A shared pagination and cache-aside contract will make list responses predictable and reduce repeated database reads without allowing Redis to become the source of truth.

## What Changes

- Add a common cursor pagination parser/response helper for `?limit=20&cursor=<opaque-cursor>` with bounded limits and continuation metadata.
- Apply pagination to list/read collection endpoints, starting with `GET /api/v1/service-zones` and reusable by future list routes.
- Add Redis cache-aside behavior for list reads: cache hit returns Redis data; miss reads PostgreSQL, stores a bounded-TTL result, and returns the database result.
- Treat Redis failures as non-fatal; PostgreSQL remains authoritative and serves the request when Redis is unavailable.
- Include cursor and limit values in cache keys to prevent page-window collisions.
- Add focused tests for pagination validation, cache hit/miss/fallback behavior, cache key isolation, and paginated response metadata.

## Capabilities

### New Capabilities

- `list-read-caching-pagination`: Paginated collection responses with Redis cache-aside reads and PostgreSQL fallback.

### Modified Capabilities

- None.

## Impact

- Affected API: paginated list responses, initially `GET /api/v1/service-zones`.
- Affected infrastructure: existing Redis client through a shared cache abstraction; no new datastore or dependency.
- Affected code: shared pagination helper, cache helper, service-zone repository/controller, and future list endpoint conventions.
- No authoritative ride, fare, ownership, capacity, or lifecycle state will be stored in Redis.
