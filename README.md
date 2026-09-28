# Dhaka Tesla Pool API

TypeScript/Fastify backend boilerplate for the architecture in [`../docs/architecture.md`](../docs/architecture.md).

## Local setup

1. Copy `.env.example` to `.env` and choose a secure `JWT_SECRET` of at least 32 characters.
2. From the repository root, copy `.env.example` to `.env` and run `docker compose up -d postgres redis`.
3. In this directory, run `npm install`, then `npm run prisma:generate`.
4. Create the initial migration with `npm run prisma:migrate -- --name init`.
5. Start the API with `npm run dev`; `GET http://localhost:3001/health` returns `{ "status": "ok" }`.

Alternatively, from the repository root, run `docker compose up --build` to run the API with PostgreSQL and Redis. Create and apply the first migration before using database-backed endpoints.

`/health` is a liveness endpoint. `/ready` checks PostgreSQL and Redis; it is intended for deployment readiness checks.

Redis is for cacheable reads only. Booking capacity, memberships, fares, and lifecycle state must continue to use PostgreSQL transactions.

## File storage

Supabase Storage is prepared for private profile photos, vehicle documents, and future ride attachments. Set `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, and `SUPABASE_STORAGE_BUCKET` in `backend/.env` before adding upload endpoints. The secret key is API-only; clients must receive signed URLs rather than storage credentials.
# RST-Tesla--Backend-
