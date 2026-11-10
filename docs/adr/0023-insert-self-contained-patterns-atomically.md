# ADR 0023: Insert self-contained patterns atomically

## Status

Accepted for the approved package/workbench insertion slice, 2026-11-09.
Boundary review: **safe with noted risk**. Core owns identity/reference integrity
and one graph transaction; hosts own their palette, placement and live policies.

## Decision

Expose dependency-free `insertPattern(editor, fragment, options)` accepting any
self-contained validated graph, plus `createArchitecturePattern` with fresh C4
context and DDD aggregate starters. Reuse graph validation, detached graph copying,
connection validation and `commitGraph`. No persisted pattern format is added.

Always allocate fresh IDs for every inserted node/edge, avoiding both destination
and fragment IDs; return separate explicit source-to-destination maps. Remap
parent IDs and endpoint node IDs. Ports remain node-local, preserving their IDs,
anchors and labels. JSON data is opaque: strings in custom payloads are not
interpreted as references. All positions, including descendants, are world-space
and receive the same explicit offset. No automatic layout/overlap resolution.

Validate the whole fragment before allocation and the complete candidate graph
before policy evaluation. Invalid data/offsets throw the canonical ZlozError;
expected vetoes return the original editor and a nonempty reason. Empty graphs
are unchanged. Read-only/busy editors and disabled Undo cannot insert. No async
preview token is introduced: the operation resolves all decisions against the
current editor on each synchronous call.

The complete remapped fragment and original graph reach `canInsertPattern`.
Existing connection policies evaluate every new edge against the complete proposed
graph excluding that edge; endpoint policies share that candidate graph too.
Any veto rejects the entire batch. Existing movement/resize/port-edit policies
continue to govern edits to existing objects; creating new nodes is controlled
by the whole-insertion hook. Selection policies only filter the newly inserted
root selection, not permission to insert. Policies are pure callbacks.

One commit invalidates routes/Redo and records exactly one graph Undo entry.
Camera, editions, model identity, source fragment and existing objects remain
unchanged. Workbench insertion is additive and blocked during history review,
imports, layout and unfinished drafts. Insertion preserves the chosen visual
mode; C4 and DDD preset modes compose both families without restyling existing
nodes when a different semantic pattern is added. Built-in notation stays customizable and
does not enforce DDD business invariants.

## Alternatives and consequences

An app-only copy/paste wrapper would leave users without a reusable contract.
Reworking existing clipboard paste risks changing its established behavior; keep
it separate in this slice. A pattern registry/schema, external wiring, palette
search, drag placement and arbitrary host-data rewriting are omitted. The host
must handle its own opaque data references and choose placement. No dependencies,
publication, deployment or collaboration changes. Rollback is a code revert;
inserted content remains ordinary version-one graph data. Reviews are self-review.
