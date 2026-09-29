## File and image handling

- Every API image input must be uploaded as `multipart/form-data` and received through Multer. Do not accept base64 images, arbitrary image URLs, or image paths from the request body unless an endpoint explicitly documents that behavior.
- Image fields are `Express.Multer.File` at the controller boundary. Validate required/optional file presence, MIME type, file size, and allowed image formats before upload.
- Controllers coordinate the image workflow. Do not put Cloudinary calls in routes or repositories.
- For create/update flows involving an image:
  1. validate body/params/query and the Multer file;
  2. derive the authenticated actor from `request.user`;
  3. upload the validated image to Cloudinary;
  4. persist only the required Cloudinary metadata in PostgreSQL through the repository;
  5. return the resource through the normal response helper.
- Store at minimum the Cloudinary `public_id` and secure delivery URL when deletion/replacement is required. Never store raw image bytes in PostgreSQL.
- When replacing an image, do not delete the previous Cloudinary asset until the new upload and database update have succeeded.
- When deleting an entity/image, coordinate Cloudinary cleanup carefully. Database state is authoritative; external cleanup may be retried if deletion fails.
- If Cloudinary upload succeeds but the database operation fails, attempt best-effort cleanup of the newly uploaded Cloudinary asset and log the failure with safe structured context.
- Never log image buffers, Cloudinary credentials, signatures, API secrets, or complete upload payloads.
- Keep Cloudinary configuration in the existing infrastructure/config layer rather than constructing a new client inside every controller.
- Add Cloudinary environment variables to `.env.example` with safe placeholders.
- Add focused tests for invalid MIME types, oversized files, missing required files, Cloudinary failure, DB failure after upload, image replacement, and authorization.

## Redis rules

Redis is non-authoritative infrastructure.

Allowed uses:
- cache expensive/non-authoritative reads;
- short-lived derived data;
- rate limiting where applicable;
- BullMQ infrastructure;
- explicitly documented ephemeral data.

Never use Redis as the source of truth for:
- ride lifecycle;
- pool membership;
- occupied/available seat count;
- fares;
- ownership/authorization;
- final matching/reservation decisions.

PostgreSQL always wins when Redis and PostgreSQL disagree.

Example:

GET /api/v1/areas

1. Controller/repository checks cache key `areas:v1`.
2. On a cache hit, return the cached derived representation.
3. On a miss, read the authoritative data from PostgreSQL through the repository.
4. Cache the result with a bounded TTL.
5. Return the database result.
6. A Redis failure must not make this endpoint fail if PostgreSQL can still satisfy the request.

For a capacity-sensitive operation:

POST /api/v1/rides/:rideId/match

WRONG:
`redis.get("pool:123:availableSeats")` → decrement → consider seat reserved.

RIGHT:
PostgreSQL transaction → lock relevant pool/capacity row(s) → calculate current occupied seats from authoritative state → reject or reserve → commit → invalidate/update Redis cache after commit.

Redis access must go through the project's established Redis/cache abstraction if one exists. Do not scatter raw Redis client calls across controllers and repositories merely for convenience.

## External infrastructure boundaries

- Prisma access belongs only in repositories.
- Cloudinary access belongs in the configured image/media infrastructure adapter.
- Redis access belongs in the configured cache infrastructure module.
- Controllers orchestrate these dependencies and own business rules.
- Routes only compose middleware, validation, controller invocation, and `asyncHandler`.
- Do not create a service layer simply to wrap one repository or SDK call.
- If the existing codebase already has an abstraction for Cloudinary, Redis, logging, configuration, or errors, reuse it instead of creating another one.

## Validation rules

- Zod schemas must use strict object validation where appropriate so unknown fields are rejected.
- Validate `params`, `query`, and `body` independently.
- Normalize only when the API contract explicitly permits it.
- Never trust client-provided role, ownership, fare, lifecycle status, available seats, driver ID, passenger ID, or calculated totals.
- Validate enum/state inputs against domain enums rather than arbitrary strings.
- Put upload-specific validation around Multer because files are not normal JSON body fields.
- Return the project's standard validation error shape.

## Transaction and concurrency rules

Before implementing any operation that can affect pool capacity, membership, fare finalization, or lifecycle transitions, identify whether it requires a transaction.

For capacity-sensitive operations:
- use a PostgreSQL transaction;
- acquire the appropriate row-level lock;
- re-read authoritative state inside the transaction;
- check capacity inside the transaction;
- perform mutation inside the same transaction;
- commit before triggering cache invalidation or retryable side effects.

Never implement:
read capacity → check in application memory → update later

when concurrent requests could violate capacity.

Add a concurrency test proving two simultaneous claims for the final seat cannot both succeed.

## Lifecycle rules

Represent allowed transitions explicitly.

REQUESTED
  → PENDING_DRIVER_ACCEPTANCE
  → MATCHED
  → DRIVER_ARRIVED
  → STARTED
  → COMPLETED

Cancellation is allowed only from explicitly supported states.

Do not allow clients to set arbitrary ride status values through a generic update endpoint. Expose domain actions such as accept, arrive, start, complete, and cancel, and validate the transition in the controller/domain rule before repository mutation.

## Codex implementation discipline

Before writing code:

1. Read `docs/project.md`.
2. Read `docs/architecture.md`.
3. Inspect `src/app.ts`.
4. Inspect the complete auth feature as the structural reference.
5. Inspect Prisma schema and existing migrations.
6. Inspect existing error, validation, auth, logging, Redis, Cloudinary, and response utilities.
7. Inspect relevant tests and test conventions.
8. State which existing patterns will be reused.

Do not invent a utility, abstraction, middleware, response shape, logger API, Redis wrapper, Cloudinary wrapper, or folder convention without first checking whether the repository already has one.

Prefer modifying the smallest number of files necessary.

When uncertain about an established project convention, inspect the repository instead of guessing.

## Completion requirements

A feature is not complete merely because code was generated.

Before reporting completion:
- run relevant focused tests;
- run `npm run check`;
- run `npm run build`;
- inspect the resulting diff;
- verify no secret or generated artifact was accidentally added;
- verify `.env.example` if configuration changed;
- verify architecture docs if an architectural decision changed;
- report exactly which commands passed or failed.

Never claim a command passed unless it was actually executed successfully.
Never hide failing tests, type errors, lint errors, or build errors.