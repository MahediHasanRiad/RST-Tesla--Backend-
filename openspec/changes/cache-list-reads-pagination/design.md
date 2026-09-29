# Design

## Context

See `proposal.md` and the `list-read-caching-pagination` spec. The project has a shared `src/lib/redis.ts` client, but list reads currently call Prisma directly and `GET /api/v1/service-zones` returns an unbounded array. PostgreSQL remains authoritative; Redis is permitted only for derived, non-critical reads.

## Goals / Non-Goals

**Goals:**

- Provide one pagination parser and response shape reusable by every collection endpoint.
- Provide one cache-aside helper that safely handles cache hits, misses, serialization, bounded TTLs, and Redis failures.
- Convert the ServiceZone list endpoint to paginated PostgreSQL reads with Redis caching.
- Establish conventions future list endpoints can adopt without duplicating cache/pagination logic.

**Non-Goals:**

- Caching ride lifecycle, fares, capacity, memberships, ownership, authorization, or matching decisions.
- Redis-based pagination state, full-text search, or cache warming jobs.
- Adding a new Redis dependency or replacing the existing Redis client.

## Decisions

### Use opaque cursor pagination with bounded query parameters

Parse an optional opaque cursor and a positive integer `limit` defaulting to `20`, with a maximum limit of `100`. Return `{ items, nextCursor, hasNextPage }`. Encode the stable ordering position, such as `(createdAt, id)`, inside the cursor and validate/decode it server-side. Cursor pagination avoids offset drift under inserts and is preferred for list growth; clients must not inspect or construct cursor contents.

### Use a shared cache-aside abstraction

Build the cache helper on the existing `redis` client rather than scattering `get`/`set` calls across controllers and repositories. The helper will accept a deterministic key, a bounded TTL (initially 60 seconds), a loader, and safe JSON serialization. Cache read/write errors will be logged with the existing logger and treated as misses/non-fatal failures.

### Cache complete cursor-window representations

Cache the full `{ items, nextCursor, hasNextPage }` representation for each normalized endpoint/filter/sort/cursor/limit combination. This avoids reconstructing continuation metadata differently on cache hits and makes cursor-window isolation explicit. Cache keys use a versioned namespace such as `list:v2:service-zones:cursor=<normalized>:limit=20` and include a stable encoding of any future filters or sort order.

### Keep database pagination authoritative

The repository performs the paginated `findMany` and `count` against PostgreSQL, preferably in one read transaction so the page and total are consistent. A cache hit may avoid that read; Redis is never consulted for decisions that affect ride correctness. Future writes to a cached collection must invalidate the relevant namespace after the database commit, or rely only on the documented short TTL until an invalidation operation exists.

### Apply the pattern first to ServiceZones

`GET /api/v1/service-zones` will parse query parameters in the established validation path, load the page through the repository, and use the shared cache helper. The public projection remains only `id`, `name`, `latitude`, and `longitude`. Future list routes should use the same helper and response contract.

## Risks / Trade-offs

- [A cached page can be briefly stale] → Cache only derived public list data, use a 60-second TTL, and invalidate after future ServiceZone writes.
- [Redis outage adds warning logs and database load] → Swallow cache failures, serve PostgreSQL, and keep Redis outside the endpoint's correctness path.
- [Cursors can become invalid after ordering changes] → Keep cursor contents opaque, version the cursor/key namespace, use stable `(createdAt, id)` ordering, and return a validation error for invalid cursors.
- [Unstable filters can create excessive keys] → Normalize supported filters/sorts and reject unknown query fields before cache lookup.

## Migration Plan

1. Add shared pagination and cache helpers without changing Redis infrastructure configuration.
2. Update the ServiceZone repository/controller and API documentation to use the paginated contract.
3. Deploy with the existing Redis service; Redis keys are disposable and require no data migration.
4. Roll back by removing cache usage and restoring the unpaginated response only through an explicit API compatibility decision; deleting Redis keys is optional because TTL handles old entries.
