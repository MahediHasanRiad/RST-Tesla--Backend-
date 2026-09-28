# Design

## Context

The repository currently contains only the supplied `project.md` brief and OpenSpec scaffolding. The brief requires architecture and ERD documentation before implementation, but it mixes product requirements, delivery expectations, and engineering guidance in a root-level document. See `proposal.md` for the motivation.

## Goals / Non-Goals

**Goals:**

- Establish `docs/` as the canonical home for durable project documentation.
- Preserve the supplied project brief in `docs/project.md` rather than rewriting or silently dropping its constraints.
- Add a focused `docs/architecture.md` that turns requirements already in the brief into a proposed MVP design: a modular frontend/API/database topology, a relational ERD, request and ride lifecycle boundaries, fare handling, capacity consistency, and testable assumptions.
- Use Mermaid diagrams so the documentation remains reviewable and version-controlled without a binary drawing tool.
- Link each document to the other and make the architecture doc explicit about proposed choices versus requirements inherited from the brief.

**Non-Goals:**

- Implement the application, database schema, API, Docker configuration, authentication, or deployment.
- Finalize technology choices that require the implementer's input beyond the brief's constraints; the architecture document may recommend an MVP baseline and identify alternatives.
- Alter the supplied product requirements or create a runtime migration path.

## Decisions

### Place the overview and architecture record in `docs/`

Move `project.md` to `docs/project.md` and add `docs/architecture.md` alongside it. This gives project documentation a predictable location while retaining the meaningful filename from the supplied brief. A root-level `README.md` can later link to both documents but is not part of this change.

Alternative considered: retain `project.md` at the repository root and add only an architecture file. This leaves durable documentation split between locations and does not satisfy the requested organization.

### Preserve the brief; derive, do not duplicate, architecture content

`docs/project.md` remains the source for problem statement, product scope, assessment constraints, and delivery requirements. `docs/architecture.md` references it and synthesizes only implementation-relevant decisions and assumptions. This avoids two divergent requirement documents.

Alternative considered: replace the brief with a short rewritten overview. That risks losing explicit evaluator requirements and story details needed for seed data and testing.

### Make architecture diagrams text-based and MVP-scoped

The architecture document will include Mermaid diagrams for Browser → frontend → Node.js API → relational database and for the proposed domain entities. It will document a modular-monolith baseline, transactional capacity enforcement, integer-paisa monetary storage, and a clear request/pool lifecycle, with scale-out considerations clearly separated from the MVP.

Alternative considered: include rendered image diagrams or microservice/event infrastructure. Images become harder to maintain, and the brief explicitly cautions against premature platform complexity.

### Use `architecture.md` as the canonical filename

The requested `architecher.md` will be implemented as `docs/architecture.md`, using conventional English spelling and the filename used by the supplied requirements. A link or redirect file is unnecessary in a greenfield repository.

## Risks / Trade-offs

- [The brief contains incomplete implementation choices] → Clearly label recommended architecture decisions and assumptions, and defer environment-specific choices to implementation documentation.
- [Overview and architecture can drift] → Cross-link the documents and keep the overview as the normative product brief while the architecture record cites it.
- [Mermaid rendering differs by viewer] → Keep diagrams to broadly supported Mermaid syntax and pair them with explanatory prose.
- [Moving the only root-level document can break external links] → Search the repository for references before moving it; no source files currently exist, so the expected impact is limited.

## Migration Plan

1. Create `docs/`.
2. Move the existing `project.md` unchanged to `docs/project.md`.
3. Author `docs/architecture.md` and add bidirectional navigation links.
4. Confirm the root-level `project.md` no longer exists, both documentation files render as Markdown, and Mermaid blocks are syntactically complete.

Rollback consists of moving `docs/project.md` back to the root and removing `docs/architecture.md`; no runtime state or data is affected.
