# Proposal

## Why

Codex has no focused, reusable skill for safely adding ride-pooling API endpoints. A dedicated API-builder skill will make endpoint work consistent with the documented architecture and require user approval before any implementation changes.

## What Changes

- Add `.agents/skills/create-api/SKILL.md` as a Codex API-builder skill.
- Add rules for DRY and SOLID design, versioned REST resources, TypeScript, Zod validation, authentication and authorization, structured error handling, and focused tests.
- Require the agent to preserve the feature-oriented controller/service/repository separation and documented PostgreSQL capacity and lifecycle invariants.
- Require explicit user approval before the agent writes code, changes dependencies, creates migrations, or changes API contracts.
- Require a concise implementation plan and impact summary before requesting approval, then type/build/test validation after approval.

## Capabilities

### New Capabilities

None. This is developer-agent configuration and does not change product behavior.

### Modified Capabilities

None.

## Impact

Adds an instruction-only Codex skill under `.agents/skills/create-api/`. It will guide Codex API work but will not alter the API runtime, data model, dependencies, or deployment configuration by itself.
