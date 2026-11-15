# ADR 0070: Layout detached descriptor previews with ELK

## Status

Accepted for the approved opt-in descriptor preview layout slice, 2026-11-13.
Architecture, boundary and test-quality reviews are self-review.

## Decision

Core layout currently represents an undoable edit. Extract its existing geometry
validation into a shared private function and expose `applyPreviewLayout` for a
host-owned detached read-only editor. It accepts the same active LayoutRequest and
LayoutResult as normal layout, checks request/revision/idle state and validates all
positions, optional group sizes and routes before publication. It changes only
preview positions/group bounds/routes, advances the preview revision, cancels old
fit animation and preserves selection, source semantics and past/future references.
Normal `applyLayout` keeps its writable/Undo behavior. No readOnly override is used.

The workbench owns preview layout lifecycle inside the current descriptor review:
request generation, direction, last displayed mode and nullable active request.
ELK is dynamically imported only after explicit Arrange. The portable Alchemy entry
continues to depend on core alone. A Command executes the existing ELK adapter; the
Model publishes a matching result atomically to the detached editor and fits it.
Working editor, descriptor/projection, findings, source IDs and model/Undo are never
replaced. Finding requests survive geometry changes because they bind source content
and resolve current target geometry. Restore original synthesizes a geometry-only
result from the immutable projection; it preserves current selection and source.

Close, replacement, draft/file input, explicit Cancel/Restore and actual preview
navigation invalidate pending layout. Measurements may update while layout runs.
Late/mismatched completions are ignored; invalid or failed results retain the last
valid preview. New runs use a new request ID. Cancellation is logical: the default
in-process ELK job may still finish. No worker, timeout, provider or publication is
introduced. Native controls expose direction, Arrange/Cancel, Restore and reasons;
Minimal mode retains these review actions.

Visual inspection exposed existing adapter option scoping: grouped nodes used the
20-unit default gap despite requested spacing. Apply the same direction/spacing/
algorithm/routing options to root and group parent containers. Real grouped-engine
tests assert requested gaps for RIGHT and DOWN, alongside existing nested-boundary,
route endpoint and custom-anchor tests. ELK documents direction and layer spacing
as parent options: [direction](https://eclipse.dev/elk/reference/options/org-eclipse-elk-direction.html)
and [between-layer spacing](https://eclipse.dev/elk/reference/options/org-eclipse-elk-layered-spacing-nodeNodeBetweenLayers.html).
The workbench requests spacing 160; this is not a universal label-collision guarantee.

## Alternatives and consequences

Toggling readOnly or treating layout as an edit would weaken the preview boundary
and append Undo. Duplicating validation in Astro would hide reusable functionality
from package consumers. Automatically laying out uploads would violate opt-in and
load the engine eagerly. Mutating the descriptor would change source provenance.
The separate core API and host-owned command lifecycle preserve these boundaries
while adding a small public API and a grouped ELK option fix. No dependency versions,
source formats, model serialization or release selection change.

## Implementation and acceptance

Modify core layout/index plus pure and installed-consumer tests. Wire the new
Alchemy layout host module/state/messages/Command into the existing review; use
core geometry validation for Arrange and Restore. Update ELK group options and
regression tests. Test read-only/writable separation, atomic invalid geometry,
stale revisions, routes and unchanged graph semantics/Undo; real ELK grouped
layouts; preview cancellation/replacement/navigation, source/finding preservation,
request reuse and exact restoration. Browser-check lazy loading, delayed-module
Cancel, actual RIGHT/DOWN layout, source IDs/coverage/findings, keyboard focus,
restore/navigation, Minimal mode and working-model equality. Inspect light/dark
captures. Run root typecheck/check/all tests, package checks and production build
sequentially. Revert this local change to roll back; no external state changes.
