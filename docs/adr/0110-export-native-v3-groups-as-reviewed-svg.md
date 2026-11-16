# ADR 0110: Export native v3 groups as reviewed SVG

## Status and scope

Accepted, 2026-11-16. The user approved the next native v3 SVG export slice,
following ADR 0109's ELK adoption: package APIs, fidelity reporting, workbench demo,
tests, visual evidence, roadmap and a local commit in the isolated worktree.
Architecture, boundary, delivery and test-quality reviews are self-review.
PNG, other adapters, publication and deployment remain separate work.

## Decision

Validate/own the full v3 document before planning or writing static SVG. Distinct
native plan/writer/review APIs keep the complete document, mode, capability,
world-space membership, group ports and endpoint identities. Reuse internal
capability-independent planning, safe vector serialization and review transitions;
never downgrade or call a legacy graph validator on a ported v3 graph. Core stays
peer-free and IO-free. The SVG is a static projection, not a model codec or an
interactive canvas capture. Extra model data stays in the source plan, not an
implicit embedded model file. Export must not edit the source or Undo history.

Native retained layout binds the full source document plus current renderer key.
Validate owned routes against preserved authored endpoints; stale routes block
with visible findings. Group sockets paint above edges in native SVG. File roots
identify document version, mode and group-port capability without erasing those
contracts. Custom native adapters receive a frozen complete document as well as
the existing node/edge geometry context.

Reuse review state and composable Foldkit SVG controls. Native review identity
covers the full document, session/revision, settings, adapter-produced bytes and
findings. Only exact-artifact loss acceptance permits fallback/approximation/
omission; unsupported content never becomes downloadable. Recheck current host
policy on download; stale clicks/completions cannot authorize a changed artifact.
The workbench stores review state in Model; browser download IO runs in a Command.
Show both palettes, custom-shell fallback, visible findings and retained layout.

## Alternatives and consequences

Passing a bare graph to the public legacy writer loses explicit capability
validation and fails for authored group ports. Copying the planner/writer/review
would duplicate security and fidelity behavior. Shared internal projections plus
versioned entry points preserve current v1/v2 contracts with less drift. Internal
functions are not package entry points or public prepared-plan authority.

System-font substitution, unmeasured text/stroke bounds, custom renderer fidelity
and explicit omissions remain visible limits. Safe SVG primitives exclude raw
markup, scripts, remote resources and foreignObject. Existing bounded font/output
checks apply. Native projection is whole authored content (or an explicit camera
crop), not transient collapse, selection, diagnostics or editor overlays.

## Implementation and verification

- `group-svg-v3.ts`: complete document/layout snapshots and plan/write APIs.
  Share only internal geometry planning and safe writing with existing SVG modules.
- `group-svg-review-v3.ts`: full-document review context and live download policy;
  reuse shared review transitions and Foldkit view primitives without forged editors.
- `group-workbench/main.ts`: source-bound native review, opt-in retained routes,
  explicit custom-shell fallback and Command-based download.
- Tests: nested ported groups/loose mode/camera crops; retained routes/staleness;
  safe immutable custom adapters; loss consent and protected downloads; unchanged
  history; literal unsupported inputs/resources and output budgets; installed
  consumers and legacy refusals. Browser evidence covers light/dark, exact SVG
  download, loss reset, minimal-mode reasons and independent Undo.
- Verify required lint/format/typechecks/workspace tests, production demo build,
  API docs, source-hashed visual receipt and pre-commit checks, then commit locally.

Rollback is a local revert; no canonical document format or dependency changes.
The bounded follow-up is PNG using this same validated native projection.
