# Tasks

## 1. Create the API-builder skill

- [x] 1.1 Create `.agents/skills/create-api/SKILL.md` with API-builder metadata, scope, and references to `AGENTS.md`, `docs/project.md`, and `docs/architecture.md`; verify the skill is discoverable and its Markdown is complete.
- [x] 1.2 Add an approval-first workflow requiring a plan, affected-file list, API contract, validation/authorization approach, data impact, and test plan before any write; verify the instructions explicitly prohibit implementation without user approval.

## 2. Add endpoint engineering safeguards

- [x] 2.1 Add DRY, SOLID, TypeScript, versioned REST, controller/service/repository, Zod validation, response/error, logging, and documentation rules; verify every required practice appears in the agent instructions.
- [x] 2.2 Add project-specific ownership, lifecycle, integer-paisa fare, PostgreSQL transaction/locking, Redis/BullMQ, and Docker constraints; verify capacity and state authority remain in PostgreSQL.
- [x] 2.3 Add a post-approval verification checklist for focused tests, `npm run check`, `npm run build`, and a concise outcome report; verify each command and reporting requirement is present.

## 3. Validate the agent profile

- [x] 3.1 Review the skill against `AGENTS.md` and `docs/architecture.md` for conflicting instructions; verify the skill adds endpoint-specific guidance without duplicating or contradicting repository-wide rules.
- [x] 3.2 Invoke the skill for a dry-run request to create a new ride API and verify it provides a plan then waits for user approval before modifying project files.
