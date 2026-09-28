# Design

## Context

`AGENTS.md` and `docs/architecture.md` already describe the project stack, layered API layout, and ride-pooling safety invariants, but no task-specific API-creation skill exists. See `proposal.md` for motivation.

## Goals / Non-Goals

**Goals:**

- Provide a focused API-builder instruction profile that complements, rather than duplicates, repository-wide guidance.
- Make explicit the user-approved stop point before an API implementation changes files or dependencies.
- Encode code-quality, security, testing, documentation, and domain-integrity checks that every new API must meet.

**Non-Goals:**

- Change the existing API runtime, route behavior, schema, dependencies, or Docker services.
- Give the agent authority to commit, deploy, publish, run destructive commands, or bypass explicit approval.
- Replace the repository-wide `AGENTS.md` instructions.

## Decisions

### Use a dedicated Codex skill

Create `.agents/skills/create-api/SKILL.md` with clear metadata that triggers when a user asks to create or materially change a REST API. Keep shared project rules in `AGENTS.md`; the skill adds the endpoint-creation workflow and approval gate.

Alternative considered: put all API rules in `AGENTS.md`. This applies the detailed API workflow to unrelated tasks and does not give users a focused agent to select.

### Require approval at the implementation boundary

The agent may inspect the codebase and present an endpoint plan, affected files, API contract, validation rules, database/migration impact, and test plan. It must stop and request approval before any write, dependency change, migration, or API-contract change.

Alternative considered: automatic implementation. The user explicitly selected approval-first behavior, which provides control over changes with data and compatibility implications.

### Apply a layered, test-first API checklist

The profile will require DRY and SOLID principles, feature-based controller/service/repository separation, Zod validation, server-derived authorization, conventional REST status codes, safe Winston logging, and focused tests. It will elevate PostgreSQL transactions and row locks for capacity-sensitive changes.

Alternative considered: generic coding-style guidance. Generic guidance would not protect the pool-capacity and ride-lifecycle invariants that are specific to this project.

## Risks / Trade-offs

- [Approval gate slows small changes] → The agent presents a concise plan and file list to make approvals quick.
- [Rules drift from architecture] → Require the agent to read `AGENTS.md` and `docs/architecture.md` before planning and update architecture documentation when a proposed API changes a material decision.
- [Overly broad instructions reduce usefulness] → Limit the profile to creating or materially changing REST APIs; defer frontend and infrastructure work to other agents.

## Migration Plan

1. Create the API-builder skill and include a precise name and trigger description.
2. Verify the skill contains the approval gate and all required project safeguards.
3. Invoke the skill for a dry-run API request and confirm it stops after presenting its plan.

Rollback consists of removing the skill directory; no runtime state or database data is affected.
