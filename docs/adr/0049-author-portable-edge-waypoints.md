# ADR 0049: Author portable edge waypoints

## Status

Accepted for the approved headless package slice, 2026-11-12. Boundary review:
**safe with noted risk**. Architecture, delivery and test reviews are self-review.
The user approved the roadmap's E1 headless contract; native editing handles and
workbench controls remain a follow-up slice. No publication or Alchemy integration.

## Context and intent

Layout engines return transient `EditorState.routes`; these do not represent a
portable user edit. A custom renderer cannot provide the missing validation,
policy, history and serialization contract. The approved outcome is package-owned
bends that can be inspected and edited without a browser, with one Undo and shared
rendering geometry. Existing defaults and literal v1 documents must keep working.

## Decision

Add optional `ZlozEdge.waypoints`: a non-empty ordered array of
`ZlozEdgeWaypoint` records `{ id, position: { x, y } }`. IDs are non-blank and
unique within the owning edge, independent of position/order. Coordinates are
finite world units; waypoints exclude source/target anchors. Empty arrays, null,
duplicate IDs, invalid coordinates and extra waypoint/position fields reject at
the graph and edit boundaries. Omission means automatic routing; an edit request
uses null to remove the property.

Geometry precedence is: custom geometry policy, authored waypoint polyline,
explicit path style, layout route, straight fallback. Live endpoints always bound
the authored polyline. Its label uses the arc-length midpoint. Shared geometry
also drives hit paths, history ghosts and reconnection previews. Minimap, fit,
reveal and viewport culling include authored detours. A collapsed endpoint uses
its existing projected connection geometry and temporarily suppresses bends.
Expansion restores the stored geometry; collapse never deletes authored data.

Endpoint/node/group movement, resizing, reparenting, reconnection and layout keep
bends fixed in world coordinates. Copy/paste and pattern insertion translate them
by the fragment offset, retaining edge-local waypoint IDs. Layout routes remain
cached independently; clearing waypoints reveals the existing path-style/layout
fallback. Editing bends does not invalidate an otherwise current layout route.

`resolveEdgeWaypointEdit` is a pure availability/preview resolver. The fact
`EdgeWaypointsChanged` carries edge ID, source revision and the complete proposed
waypoint list or null. `updateEditor` re-resolves against live state and policy,
detaches accepted input and publishes once through the existing transaction
boundary. Read-only, active gesture/connection/label draft, stale revision,
history disabled, missing/hidden/collapsed endpoint and policy veto all block with
a reason. Blank policy reasons receive a usable fallback. The new
`canChangeEdgeWaypoints` policy is independent of semantic editing and wiring.
Preview never changes state; hosts may discard a draft without publishing an
event. Replayed commits become stale; equivalent current edits create no history.
Undo/Redo use the standard graph history and monotonic revision.

This is an additive optional field in graph/snapshot/model/edition v1, following
the existing optional architecture/presentation contracts. There is no envelope
bump or required migration. New readers validate it; old graph readers preserve
unknown optional fields but old renderers cannot display authored geometry. That
is data compatibility, not visual feature compatibility. Keep this limitation
explicit in consumer docs; do not promise downgrade rendering fidelity.
Waypoint changes, including identity-only changes, are layout changes in edition
comparison. They are excluded from semantic meaning. Mermaid already reports
unsupported edge fields as explicit loss, so waypoints must appear in that report.

## Alternatives and consequences

- Keeping bends only in layout routes would lose authored intent on save/Undo and
  conflate engine results with document ownership.
- Anonymous points would make control identity depend on mutable array indices.
  Edge-local IDs support later composable controls without a global ID allocator.
- Relative-to-endpoint bends would introduce movement/reconnection rules and
  ambiguous behaviour when both endpoints move. World coordinates match nodes;
  fragment duplication is the one explicit translation operation.
- A v2 envelope would force unrelated documents through migration for an additive
  field that existing codecs already retain. Older rendering fidelity is the
  documented cost of retaining v1.
- Adding pointer gesture state now would couple the headless contract to handle
  UX. Atomic replacement and pure preview are sufficient for this slice; drag and
  keyboard editing controls must later retain these same guards and one-Undo rule.

No dependency, Astro domain logic, external state store or new package is needed.
Layout adapters continue to own automatic routes; core owns authored bends.
No live geometry preview mutates the authoritative graph or history.

## Implementation and verification

- Extend public types and graph validation; export the edit resolver. Keep wire
  validation and translation helpers below editor/pattern/geometry consumers.
- Reuse `commitGraph`, existing policies, presentation visibility and revision.
  Add no bypass around live permission checks.
- Compose geometry, bounds, culling, copy/pattern insertion and history; preserve
  defaults for edges with no waypoints.
- Add an independent literal v1 fixture and regression tests for invalid data,
  route precedence/labels, detachment, one Undo/Redo, late veto, stale replay,
  read-only/busy/hidden/collapsed/zero-history guards, copy translation, node
  movement, layout, reconnection, history and viewport/reveal behaviour.
- Qualify types and runtime through packed Node/Bun consumers without UI peers.
  Assert Mermaid's explicit projection loss. Generate public TypeDoc.
- Run root lint/format, typecheck and tests. No visual/manual acceptance claim:
  native controls and light/dark/minimal workbench evidence belong to the next slice.

Rollback is a local commit revert before release. Once consumers author bends,
removing support would require a documented compatibility/loss decision rather
than dropping saved geometry silently.
