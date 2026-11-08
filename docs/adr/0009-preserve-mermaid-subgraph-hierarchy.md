# ADR 0009: Preserve Mermaid subgraph hierarchy

## Status

Accepted for local implementation on 2026-11-08 following explicit user approval.
Extends ADR 0008's export-only boundary. Import and publication remain deferred.

## Decision

Represent non-empty Flow groups with named Mermaid subgraphs, nested according to
`parentId`. Emit declarations in stable sibling order, independently of input
parent/child ordering, with edges after all declarations. Crossing edges retain
ordinary child node endpoints. Core validates parent references, acyclic
membership and portless groups before conversion; no topology repair occurs.
Use an iterative traversal so nesting does not depend on the JS call stack, and
stop with a source-limit diagnostic before excessive indentation accumulates.

Extend version 1 identity node entries additively with optional `kind: 'group'`
and `parentId` (the original Flow group ID). Flat entries and protocol remain
unchanged. These fields describe identity/topology only, not hidden graph data.
There is no production bundle reader to migrate. Future readers must preserve
these fields to reconstruct hierarchy; readers that ignore them cannot claim
hierarchy fidelity.

Group labels use the existing literal encoder and safe aliases. Explicit group
appearance is reported as `group-presentation-omitted` because subgraph boundaries
do not preserve node outline choice. Group meaning, containment constraints,
positions, sizes and host data retain explicit loss reporting. Empty groups
reject with `unsupported-subgraph`, including empty nested groups, rather than
becoming invisible or being replaced by fake nodes. Existing strict loss policy
and source bounds apply unchanged.

## Alternatives and consequences

Flattening loses architectural boundaries. Storing a full graph alongside source
would disguise projection losses. A new protocol version for optional metadata
would unnecessarily change flat exports before publication. Recursive emission
would introduce an avoidable nesting limit. Empty-group placeholders would
invent domain nodes. The qualified subset remains explicit.

Boundary review: **safe with noted risk**. Only the optional adapter owns this
projection; core graph/session contracts stay unchanged. Mermaid chooses layout,
and cross-boundary connections can affect its placement. Syntax and rendered
cluster structure must be qualified separately from Flow canvas appearance.

## Implementation and verification

- Extend package identity types, diagnostics and emitter; keep flat snapshots.
- Test nested hierarchy, child-before-parent input, safe labels, cross-boundary,
  parallel/self edges, identity/port metadata, invalid parents/cycles, empty
  boundaries and inclusive source limits. Check deep input without stack overflow.
- Add a separate nested C4 container example, leaving existing examples intact.
- Exercise preview/consent/download without graph or Undo mutation. Qualify
  generated syntax and real SVG clusters using pinned Mermaid in Chromium;
  capture themed workbench evidence and test the packed public npm contract.
- Run required workspace gates and commit this slice before the authorized
  left-sidebar redesign. No release, CLI or import work is included.

Before publication recovery is reverting the optional exporter/example changes;
canonical Flow documents require no migration.
