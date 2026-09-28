# Proposal

## Why

The project brief is currently a large root-level file, which makes the intended product scope difficult to discover alongside future implementation documentation. A concise project overview and a dedicated architecture document will give contributors and evaluators a stable, navigable source of truth before MVP development begins.

## What Changes

- Move the root-level `project.md` into a new `docs/` documentation area as the project overview, preserving the supplied brief as project context.
- Add `docs/architecture.md`, translating the brief into an MVP architecture decision record with system-context and ERD diagrams, component responsibilities, data-integrity strategy, API and lifecycle boundaries, and explicit assumptions.
- Cross-link the overview and architecture documents so product requirements and technical design remain easy to find.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None.

## Impact

Documentation structure only. No application code, APIs, data schema, runtime dependency, or deployed behavior changes. The change opts out of OpenSpec delta specifications because it establishes documentation rather than a user-visible capability.
