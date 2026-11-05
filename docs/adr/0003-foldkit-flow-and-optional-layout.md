# ADR 0003: FoldKit Flow and optional ELK layout

## Status

Accepted for local implementation on 2026-11-03 following user approval of the
native FoldKit editor and replaceable layout direction. Registry publication
remains a separate release action.

## Context

Stateflow supplies machine-specific graph inspection and fixed-size layered
layout. A reusable editor needs general nodes, named ports, variable dimensions,
document edits, keyboard interaction, history and browser lifecycle management.
The application must remain the sole owner of its graph and editor state.

## Decision

Create two versioned npm packages:

- `@opsydyn/foldkit-flow`: a dependency-free graph/editor core at the root and
  an optional `/foldkit` view and scoped input adapter using the host builder.
- `@opsydyn/foldkit-flow-elk`: a separately installed ELK layout adapter. It
  consumes detached graph snapshots and returns positions/routes, never writes
  application state, and supports a caller-supplied worker-backed ELK instance.

The graph owns node/port/edge identity, positions and JSON-compatible user data.
Editor session state owns selection, viewport, gestures and bounded undo history.
Applications own persistence, execution, permissions and connection policy.
Measurements are typed facts. DOM resources are scoped to Mount; no DOM refs or
layout-engine instances enter the Model. Layout results require the active request
ID and unchanged monotonic document revision. One drag or accepted layout is one
undo transaction. Undo does not rewind the revision used for async freshness.

Use HTML node contents and SVG connections. Manual placement works without ELK.
The initial public contract is flat graphs, named input/output ports, single
pointer drag/pan, wheel zoom, keyboard selection/movement/connections/deletion,
bounded undo/redo, serialization and explicit arrange. Nested groups,
collaboration, workflow execution and a new general layout solver are deferred.

## Alternatives and consequences

React Flow would add another UI runtime. xyflow/system is explicitly maintained
for React/Svelte Flow and owns mutable interaction state. Dagre is a viable later
layout adapter; ELK is selected for explicit ports and orthogonal routes. A new
solver would add algorithm and maintenance work before proving editor value.
The optional boundary isolates ELK's size and upstream licence from the core's
dependency graph. ELK is distributed as an unmodified dependency with upstream
licensing documented; no algorithm source is copied.

Two packages cost an extra release surface but let consumers choose automatic
layout independently. The adapter pins its core peer to the same version;
versions and the peer pin are linked by the existing release tooling. Core-only Node imports must
work without browser globals, FoldKit, Effect or ELK installed.

## Verification and release

Behaviour tests precede implementation. Verify invalid graph/edit rejection,
history/cancellation, pointer identity, stale layout results, real ELK output,
keyboard/browser lifecycle, and a packed npm consumer. Packages ship ESM and
declarations with explicit export maps, licences, READMEs and changelogs.
Run publint, Are The Types Wrong, lint/format, workspace typecheck/tests and a
browser editing journey. Publish the exact checked tarballs with npm provenance
through the existing manual workflow, core first. No credential or hosted setting
changes are needed to prepare the packages locally.

The editor owns authored node widths and edge metadata as document edits.
Browser measurements update content height independently of authored width so
a resize remains undoable. Edge appearance is a view callback over graph data,
which keeps the serialized document independent of SVG rendering.

Endpoint replacement is one editor transaction. It preserves edge identity
and metadata, rechecks port direction and the host policy, and invalidates
layout routes. The policy sees the graph without the prior edge so it can
evaluate the replacement without counting that edge twice. Modeling this as
delete plus create would split history and could lose edge metadata.

Flow exposes scoped CSS variables for its built-in parts. A host may apply
generated classes, including Pleat classes, to the editor root. This gives the
host control of style registration and theme scope while Flow owns geometry.
A direct Pleat dependency would tie Flow consumers to its release lifecycle.
The public npm registry did not serve the Pleat packages when this was checked.

Groups are portless nodes with explicit parent IDs. Positions remain in canvas
coordinates, so existing edge geometry and flat saved documents keep their
meaning. Parent-relative coordinates would make containment natural but require
converting positions throughout rendering and layout. The editor expands group
movement and deletion to descendants in a single transaction. Group bounds are
authored independently of membership. Compound ELK layout follows the parent
IDs, returns coordinates relative to the canvas root, and joins edge sections
into continuous routes. Layout may update group sizes together with positions
in one undo transaction. Ordinary node sizes stay host-owned.

Grouping wraps siblings under a new boundary without translating their canvas
positions. Restricting the action to siblings preserves existing ownership when
a selection spans separate groups. Ungrouping promotes children to the nearest
remaining ancestor and preserves their connections. Each action is one history
transaction.

Edge path style is optional authored graph metadata. Straight, stepped, and
smooth overrides draw from the current port positions. An omitted style keeps
the layout engine's route, with a straight fallback, so existing version 1
documents retain their routing behavior. Automatic routing and authored
overrides share a geometry calculation with the label anchor. Stroke styling
stays in the view callback. Layout route points remain session data.

Custom edge renderers receive the resolved path and visual state as a view
callback. They own SVG decoration along that path. Flow owns the hit area,
reconnection handles and label placement, keeping these interactions shared
across host renderers.

Group collapse is editor-session presentation state. The view hides descendants
and internal edges, then projects crossing edges to the visible collapsed
ancestor's boundary. This preserves authored endpoints, group membership and
cached layout routes across a collapse and expansion. Projected endpoints are
visual anchors. Ports remain on the original nodes.

Group drop targets are resolved from the world-space pointer and visible group
boundaries. The deepest eligible group wins. Collapsed groups and the moving
subtree are excluded. A drag changes only the selected roots' membership, and
publishes membership and position together on release.

Drag alignment is opt-in editor-session behavior. It uses visible stationary
nodes and the moving selection's bounds, with a tolerance measured in screen
pixels. Alignment overrides the grid only on a matching axis. Guides are
derived during the drag and share its existing commit and cancellation paths.

Drag auto-pan is opt-in at the FoldKit view. The mounted input adapter owns
the animation-frame lifetime and reports elapsed viewport movement. The editor
applies that movement and updates the active drag in the same reducer turn.
Viewport movement stays outside graph history.

Two-finger navigation is opt-in at the FoldKit view. The input adapter tracks
the two touch contacts and reports their midpoint and distance. The reducer
cancels any active drag, then anchors zoom and translation to the starting
viewport. This keeps touch navigation separate from document history.

Optional parent extent is authored on a child as `extent: 'parent'`.
Movement intersects the allowed offsets of constrained selection roots, then
moves the selection together. Descendants moving with their parent keep their
relative placement. Drag-out retains constrained membership. Detached clipboard
roots and ungrouped root nodes lose an extent whose parent no longer exists.

Parent expansion is optional authored child metadata. Width edits and measured
height changes grow enabled ancestors outward with padding, preserving canvas
coordinates. Resizing previews derive expansion from the gesture snapshot so
cancellation restores the authored bounds. Measurements follow the existing
history-rebasing policy.

The optional force adapter is distributed as `@opsydyn/foldkit-flow-force`.
It depends on Viz simulation and Flow's public layout contract. Its eligibility
subpath stays separate from the simulation entry for lazy-loading hosts.
The Astro sample imports the adapter and owns its Commands and active request.

Group fitting is an explicit document edit. It uses authored descendant bounds,
including hidden contents, with the existing group-creation padding. Fitting
preserves child canvas positions and uses enabled ancestor expansion. Parent
containment can reject a fit whose bounds exceed the available parent space.

Group resize handles reuse the package's pointer gesture and graph transaction
boundary. Expanded groups resize from the bottom-right, preserving origin and
child canvas positions. Descendant bounds plus padding set the shrink limit;
parent extent clamps growth unless expansion is enabled. Keyboard input reports
`GroupResizeNudged` to the same geometry path. The FoldKit view owns the handle;
Astro consumes it through `resizeHandles`. This avoids a second sample-only
editing implementation. Moving children or scaling their coordinates during a
resize would change the document unexpectedly, so boundary editing leaves them
fixed. Core and browser checks cover zoom, containment, cancellation and Undo.

Manual resize limits are optional node document metadata (`resizeLimits`),
validated as positive finite dimensions with ordered minima and maxima. They
travel with saved nodes and clipboard copies; the reducer applies them to
pointer and keyboard edits. They are interaction bounds rather than global
geometry invariants: layout, measurement, explicit group fitting and automatic
ancestor expansion retain their existing contracts. A strict global bound would
clip content or reject layout publications. Group content and parent constraints
still prevent unsafe shrinking; conflicting bounds leave the graph unchanged.
Core tests cover clamping, invalid metadata, document round-trips and Undo;
the sample's width control reads the authored bounds instead of hard-coded ones.

Group proportion locking is authored as optional `keepAspectRatio` metadata.
The package toggle is a document transaction. Manual resizing projects the
larger proportional axis change onto a uniform scale, then clamps that scale
to the intersection of content, explicit size and parent bounds. An empty
intersection leaves the document unchanged. Uniform scaling changes the group
boundary only; child positions and sizes stay authored. This reuses the existing
pointer and keyboard geometry path rather than maintaining separate algorithms.
A fixed numeric aspect ratio is deferred: locking the current proportions avoids
resizing a group when the toggle is pressed. Layout and explicit fitting retain
their independent behavior. Regressions cover bound conflicts, no-op history,
serialization, cancellation and Undo; browser checks exercise both toggle sites.

Group resizing now carries an optional corner on pointer-start and keyboard
facts. Omitted corners retain the existing bottom-right contract. All four
handles use the package geometry function with signed axis growth and the
opposite corner as anchor. Top/left bounds account for fixed child coordinates
and header padding; parent extent is measured from the opposite edge. Uniform
scaling uses the same anchor and constraint intersection. This extends the
existing gesture snapshot and one-step history instead of moving descendants
or adding sample-only interaction state. Core tests cover all corners at zoom,
content and parent limits, expansion, locking, cancellation and Undo; browser
checks exercise the rendered handles and keyboard direction.

Side resizing extends the interaction contract with `ResizeHandle` and an
optional `handle` field on pointer/keyboard facts. Legacy `corner` inputs remain
valid; explicit handles take precedence. Side handles ignore perpendicular input.
Unlocked sides change only their axis; locked sides scale uniformly, anchoring
the opposite edge and perpendicular center. Centered content and parent bounds
constrain both sides of the perpendicular dimension, including header padding.
This follows standard side-handle behavior while preserving authored children.
All eight handles share the same reducer, snapshot, cancellation and history
paths. Tests cover zoom, axis filtering, centered constraints, expansion and Undo;
the sample exercises the package view without new editing logic.

Group resize snapping uses the existing 20-unit grid on the moving canvas edge,
after input coordinates are converted by zoom. Masked side axes remain untouched.
Content/parent bounds and aspect locking take precedence over exact grid alignment.
The input adapter reads the Model's snap flag from the existing surface boundary
and uses grid-sized keyboard steps to avoid keys rounding back to the same edge.
Snapping retains the gesture snapshot and single graph transaction.

Backgrounds are an independent FoldKit view contract: dots by default, squares,
none, or a custom render callback using the host HtmlBuilder and viewport/surface
context. Built-ins support visual gap, mark size and CSS color; visual gap does
not alter snap math. The callback returns declarative HTML/SVG into a decorative
screen-space layer rather than mutating DOM or maintaining another state owner.
The Astro host stores only its presentation choice. Package SSR and packed-consumer
checks cover defaults, custom-builder composition and public types; core/browser
checks cover snapped resizing, pan/zoom, constraints, cancellation and Undo.
