# ADR 0019: Import edition archives and restore undoably

## Status

Accepted for the approved archive-import and explicit restore slice, 2026-11-08.
Extends ADR 0018. Boundary review: **safe with noted risk**; snapshot replacement
is a privileged bulk edit and must not bypass the existing editing policies.

## Decision

Keep archive version 1 and the existing graph/snapshot formats unchanged.
`mergeEditions` adds validated immutable incoming editions, skips exact identities
idempotently, and rejects an entire batch on conflicting IDs or duplicate input
identities. It never overwrites an edition or changes the working editor.
`parseEditions` remains the canonical archive decoder. Invalid input throws
through the existing codec; expected merge conflicts return a typed decision.

Add `resolveEditionRestore` and `restoreEdition` to the dependency-free core.
The required `expectedRevision` binds a preview to the working graph's monotonic
freshness token. Commit resolves again using current policies; a previous ready
result grants no permission. Read-only/busy editors, stale/invalid revision tokens
and a disabled Undo history reject restoration. Exact graph no-ops preserve the
whole editor without adding history. Invalid editions validate before publication.

Restore the graph only. Preserve the current camera instead of restoring the
edition camera, since graph Undo does not own camera history. Publish through the
existing `commitGraph` boundary: one Undo entry, freshness increment, invalidated
routes, cleared pending connection/drafts and normal retained selection/group
rules. Existing editions remain immutable. Subsequent edits remain ordinary
functional graph edits, and Undo/Redo traverse the replacement as one change.

`ZlozEditionRestorePolicy` extends `EditorPolicy` with a whole-transaction
`canRestoreEdition` veto. Granular checks cover exact node/edge removals, movement/
reparenting, size, architecture, appearance, authored edits to ports on retained
nodes, and added/rewired connections. Port kind replacement checks remove/add.
Node deletion follows deletion policy; creation with initial ports follows normal
node-creation semantics. Fields without granular hooks, such as labels, data,
constraints or node kind, belong to the whole-transaction policy. This is not a
security boundary against a host writing its own Model.

Existing-element edit hooks see the current graph and proposed node where their
normal signatures require it. Connection hooks see the complete proposed graph
excluding the candidate edge, so new nodes are available and aggregate connection
limits are checked atomically. Reconnection hooks see the original edge/current
graph; unchanged endpoints are not treated as new port connections. Blank vetoes
remain vetoes with usable fallback reasons. Policies must remain pure.

## Workbench integration

Read one archive up to 5 MiB through a Command. Decode UTF-8 strictly and validate
with `parseEditions`. Each request has its own interrupt key and a pending
collection identity; cancellation, superseded results and results for a changed
edition collection cannot merge. Import is additive and never replaces the
working graph. Generated capture IDs skip imported collisions.

Restore requires selecting an edition, opening a concrete preview, then pressing
**Restore as new change**. Cancellation preserves the working model. Store the
frozen target and expected working revision in the Model. Display a live policy
reason and disable confirmation when blocked; the reducer still rechecks. A
restore-protection switch demonstrates the public veto. Changing selected edition
or importing clears the preview. Refresh only current surface measurements after
leaving review; preserve the working camera and Undo semantics.

## Alternatives and consequences

Replacing the entire editor with `createEditor` would discard Undo and freshness.
Restoring the edition camera would promise recovery the graph Undo stack cannot
provide. A cached authorization result would permit stale or newly blocked writes.
Silently replacing ID conflicts would break immutable checkpoint identity.

A new persistence package, database or graph-patch/event-store engine is unnecessary
here. Full snapshots retain their existing memory costs. Core remains independent
of Effect/Foldkit; browser I/O and typed Effect failures stay in Commands. Existing
archive import size policy belongs to the host, not the format. No automatic
persistence, fork/merge, playback, npm publication or deployment is activated.

## Acceptance

Qualify additive/idempotent/atomic merge; one-step Undo/Redo; unchanged camera and
archives; no-op, stale, busy, read-only and unavailable-Undo cases; every relevant
policy family including blank denials and endpoint semantics; strict UTF-8 and byte
limits; cancellation/late completions; generated-ID collisions; installed consumers
and browser import/preview/cancel/protection/restore/Undo in the workbench.
Architecture, delivery and test review are self-review in this session.
