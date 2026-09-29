# Tasks

## 1. Establish documentation structure

- [x] 1.1 Create the `docs/` directory and move the existing root `project.md` to `docs/project.md` without losing brief content; verify `docs/project.md` exists and the root-level file does not.
- [x] 1.2 Add concise navigation links between `docs/project.md` and `docs/architecture.md`; verify both relative Markdown links resolve to the intended document paths.

## 2. Author the architecture document

- [x] 2.1 Create `docs/architecture.md` with the project context, MVP scope, actor responsibilities, stated assumptions, and explicitly separated future-scale considerations; verify it references `docs/project.md` as the product brief.
- [x] 2.2 Document the proposed modular MVP topology (browser, React/Next.js frontend, Node.js API, and relational database) with a Mermaid system diagram and component responsibilities; verify the diagram uses a fenced `mermaid` block and reflects the documented components.
- [x] 2.3 Document the relational domain model with a Mermaid ERD covering users, vehicles/Teslas, ride requests, pools, memberships, lifecycle history, and optional payment records; verify the model captures pool membership, per-passenger fare, and vehicle capacity relationships.
- [x] 2.4 Record the request/pool lifecycle, matching rule, integer-paisa fare model, authorization boundary, and transaction/locking approach for concurrent capacity claims; verify the Nusrat, Rafiq, Shirin, Jashim, and Bullet scenario can be reasoned through from the document.
- [x] 2.5 Add MVP trade-offs, test priorities, observability/security baseline, and a clearly non-binding path to scale; verify the document avoids committing to unnecessary microservices, queues, or paid infrastructure.

## 3. Validate documentation quality

- [x] 3.1 Review all Markdown links, headings, and Mermaid fences in `docs/project.md` and `docs/architecture.md`; verify there are no dangling local links or unclosed fenced code blocks.
- [x] 3.2 Compare the architecture document against the supplied brief; verify it preserves mandated stack constraints and names the story cast consistently without introducing conflicting product requirements.
