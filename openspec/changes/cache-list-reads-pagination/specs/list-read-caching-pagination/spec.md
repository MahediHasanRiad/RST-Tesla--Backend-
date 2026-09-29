# Spec Delta

## Purpose

Provides consistent pagination and resilient Redis cache-aside behavior for collection reads while preserving PostgreSQL as the authoritative source of list data.

## ADDED Requirements

### Requirement: Collection endpoints use the common cursor pagination contract

Collection/list endpoints MUST accept an optional opaque `cursor` and a `limit` query parameter defaulting to `20`. They MUST reject malformed, non-positive, or over-limit limits and MUST return `items`, `nextCursor`, and `hasNextPage` metadata. The first request omits `cursor`; clients MUST treat cursors as opaque.

#### Scenario: First cursor page is applied

- **WHEN** a client requests a list endpoint with no cursor and no limit
- **THEN** the endpoint returns the first cursor window using limit `20` and continuation metadata

#### Scenario: Next cursor page is applied

- **WHEN** a client requests `?limit=10&cursor=<opaque-cursor>`
- **THEN** the endpoint returns the next ten-item window after that cursor

#### Scenario: Invalid cursor pagination is rejected

- **WHEN** a client supplies a malformed, non-positive, or greater-than-maximum limit, or a malformed cursor
- **THEN** the endpoint returns the standard validation error and does not query Redis or PostgreSQL

### Requirement: List reads use Redis cache-aside with PostgreSQL fallback

List endpoints MUST first attempt to read the cursor-window derived response from Redis. On a cache hit, they MUST return the cached representation. On a cache miss, they MUST read the authoritative cursor window from PostgreSQL, return that result, and store the derived response in Redis with a bounded TTL.

#### Scenario: Cached list page is returned

- **WHEN** Redis contains a valid cached response for the endpoint, filters, sort, cursor, and limit
- **THEN** the endpoint returns the cached response without requiring a PostgreSQL list read

#### Scenario: Cache miss reads and populates from PostgreSQL

- **WHEN** Redis has no cached response for a requested cursor window
- **THEN** the endpoint reads PostgreSQL, returns the database result, and stores the result in Redis with a bounded expiration

#### Scenario: Redis failure does not break a list read

- **WHEN** Redis is unavailable or a cache operation fails but PostgreSQL can serve the list
- **THEN** the endpoint returns the PostgreSQL result and does not fail solely because of Redis

### Requirement: Cache keys isolate list representations

Cache keys MUST identify the endpoint/resource, relevant filters and sort order, and normalized cursor/limit values. A response for one cursor window, limit, filter, or sort order MUST NOT be returned for another request.

#### Scenario: Cursor and limit do not collide

- **WHEN** clients request the same list with different cursor or limit values
- **THEN** each request uses and receives its own cache entry

#### Scenario: Filtered list entries do not collide

- **WHEN** two requests use different supported list filters
- **THEN** their cache entries remain isolated

### Requirement: PostgreSQL remains authoritative

Redis MUST contain only derived, non-authoritative list representations. Cache unavailability, stale data, or cache/database disagreement MUST NOT affect ownership, fare, lifecycle, capacity, membership, or final matching decisions.

#### Scenario: Database remains the source of truth

- **WHEN** a cached list representation differs from the authoritative PostgreSQL result after expiration or invalidation
- **THEN** the database result is used for the next cache miss and the derived cache entry is refreshed

### Requirement: ServiceZone listing is paginated and cacheable

`GET /api/v1/service-zones` MUST implement the common cursor pagination and cache-aside contract while returning only the public ServiceZone projection required by the API.

#### Scenario: ServiceZone pages are cached

- **WHEN** a client requests `GET /api/v1/service-zones?limit=20` repeatedly
- **THEN** the first miss reads PostgreSQL and later requests can be served from the matching Redis cursor-window entry
