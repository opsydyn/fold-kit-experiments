# ADR 0050: Compose waypoint interaction controls

## Status

Accepted for the approved package/workbench slice, 2026-11-12. Boundary review:
**safe with noted risk**. Architecture, delivery and test reviews are self-review.
Continues [ADR 0049](0049-author-portable-edge-waypoints.md). No dependency change,
publication, shared runtime or Alchemy work.

## Decision and boundaries

Core owns a transient `edge-waypoint-drag` gesture, pure preview and controls
resolvers. Drag start names a stable edge/waypoint and source revision. Origin
and latest pointer sample are stored in the parent-owned editor state. Movement
resolves world coordinates through the viewport and optionally snaps to the editor
grid; Alt bypasses snapping, including modifier-only changes at the last sample.
Viewport changes recompute the world-space sample rather than accumulating deltas.

The graph, revision, cached layout routes and Undo/Redo remain unchanged while
previewing. Release rechecks the live source, visibility, read-only/busy settings
and `canChangeEdgeWaypoints`, then delegates one atomic replacement to the existing
headless reducer. A no-op creates no history. Escape, lost capture, resource
release and blur discard the transient preview. Foreign pointers cannot finish it.
Revision changes or a late policy veto cannot publish stale geometry. No shadow
saved graph or browser-side domain state is introduced.

`resolveEdgeWaypointControls` owns ID allocation, insertion/removal/reset events,
protection reasons, effective preview geometry and keyboard step sizes. Additional
bends split the longest authored segment in path order; ties choose the first.
IDs remain edge-local and stable independently of array position. The first bend
uses the existing label anchor. A degenerate authored route gets a visible offset.
Arrow keys nudge in world units (grid spacing when enabled, otherwise one unit),
Shift multiplies the step by ten, Alt uses unsnapped unit steps, and Delete removes
the focused bend. Each arrow action is one Undo; repeated key actions remain
separate transactions. Removal returns focus to the canvas before unmounting.

The optional Foldkit adapter adds opt-in selected-edge controls through
`edgeWaypoints`, `renderEdgeWaypoints` and the same live waypoint policy. Native
handle/action/readout helpers expose semantic behaviour separately from artwork.
Undefined keeps default rendering; null hides it. Custom attributes and children
support complete visual composition. Fixed-size handles stay centered on their
world positions regardless of zoom or whether readouts are visible. Actions dock
inside the measured canvas with native scrolling. `waypointLabelOffset` provides
configurable CSS-pixel clearance when a selected bend meets its label anchor;
this is presentation only, leaving canonical geometry unchanged. Collapsed
endpoint projections suppress the stored handles without deleting authored data.

Shared edge geometry resolves the transient candidate for rendering and labels;
active edges stay retained during culling. Saved/exported/history data continues
to see only committed geometry. While dragging, fit/layout/edit operations remain
subject to the existing busy guards. This slice does not add waypoint auto-pan,
freehand drawing or segment-specific curve algorithms.

Measurement and instruction flags use the existing diagnostics contract, including
minimal/global suppression. Essential controls and protection reasons remain
available independently. Existing light/dark tokens style default controls; no
new hard-coded workbench theme or CSS override is required.

Astro owns Off/Native/Custom preferences, an independent bend protection switch
and custom artwork composed from package helpers. Its existing model/epoch-scoped
message adapter remains authoritative for asynchronous model ownership. The raised
edge example yields to authored bends instead of ignoring them. None of these
host choices are core invariants.

## Alternatives and consequences

Mutating the saved graph on every sample would require cancellation snapshots,
revision churn and special history publications. A transient candidate is simpler
for a single-point edit and preserves portable exports during a drag. Reusing only
raw `EdgeWaypointsChanged` in the app would leave gesture/ID/policy logic in Astro;
that would not ship the interaction contract to package users.

Adding only an all-in-one toolbar would constrain designer freedom. The default
renderer is therefore composed from the same small native helpers available to
consumers, while core availability remains pure and view-independent. Native
focus/pointer work stays in the scoped input resource, not Commands in the graph
engine or arbitrary application DOM references.

## Verification and follow-up

Regression tests cover transient state, release/Undo, zoom, snapping and bypass,
no-ops, cancellation, foreign pointers, late policy/source rejection, keyboard
nudge/removal, deterministic insertion, protection reasons, custom/null/off views
and diagnostic suppression. Packed Node/Bun consumers exercise the pure public
interaction API. Workbench tests check preference/protection composition.

Qualify the production build in Chromium for native/custom controls, real pointer
and keyboard input, Undo, Escape, policy reasons and light/dark/minimal screenshots.
Root lint/format, typecheck and tests plus TypeDoc must pass before commit. This is
bounded browser evidence, not comprehensive device or assistive-technology
acceptance; the later core qualification gate remains open.

Next core slice: E2 headless palette/external placement, using existing screen to
world, snapping, policy and atomic insertion primitives. Alchemy stays deferred.
